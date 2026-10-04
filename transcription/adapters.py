"""Model library adapters; importing this module never loads model weights."""
from pathlib import Path
from typing import Callable, Protocol
import os
import math

DEFAULT_MODEL = "mlx-community/whisper-large-v3-mlx"
DIARIZATION_MODEL = "pyannote/speaker-diarization-community-1"
Progress = Callable[[dict], None]


class ASRAdapter(Protocol):
    identity: str

    def transcribe(self, audio: Path, *, language: str | None,
                   prompt: str | None, progress: Progress) -> dict: ...


class DiarizationAdapter(Protocol):
    identity: str

    def diarize(self, audio: Path, *, progress: Progress) -> dict: ...


def clean_whisper_result(result):
    """Optional decoder diagnostics can be NaN on short windows; timings cannot."""
    segments=[]
    for source in result['segments']:
        segment=dict(source)
        for key in ('start','end'):
            if not math.isfinite(float(segment[key])):
                raise ValueError('Whisper returned an invalid timestamp')
        for key in ('avg_logprob','compression_ratio','no_speech_prob','temperature'):
            if key in segment and not math.isfinite(float(segment[key])):
                segment.pop(key)
                segment['confidence_unavailable']=True
        if 'words' in segment:
            segment['words']=[]
            for original in source['words']:
                word=dict(original)
                if not all(math.isfinite(float(word[key])) for key in ('start','end')):
                    raise ValueError('Whisper returned an invalid word timestamp')
                if 'probability' in word and not math.isfinite(float(word['probability'])):
                    word.pop('probability')
                    segment['confidence_unavailable']=True
                segment['words'].append(word)
        segments.append(segment)
    return {'language':result.get('language'),'segments':segments}


class MLXWhisperAdapter:
    timestamp_method = "whisper-native"
    def __init__(self, model: str = DEFAULT_MODEL, *, speech_gating: bool = True):
        self.model = model
        self.speech_gating = speech_gating
        self.identity = f"mlx-whisper:{model}:speech-v2:{speech_gating}"

    def transcribe(self, audio, *, language, prompt, progress):
        import mlx_whisper
        progress({"detail": "Loading Whisper and transcribing; model progress is indeterminate"})
        # Use the official decoder's native word alignment, not a second ASR stack.
        result = mlx_whisper.transcribe(
            str(audio), path_or_hf_repo=self.model, language=language,
            initial_prompt=prompt, task="transcribe", word_timestamps=True,
            verbose=False, condition_on_previous_text=False,
            # Native upstream protection: skip long silence around anomalous words.
            hallucination_silence_threshold=2.0,
        )
        return clean_whisper_result(result)


class CommunityDiarizationAdapter:
    def __init__(self, model: str = DIARIZATION_MODEL, device: str = "auto"):
        self.model, self.device = model, device
        self.identity = f"pyannote-community-1:{model}:{device}"

    def diarize(self, audio, *, progress):
        # Turn off optional usage telemetry before importing the library.
        os.environ["PYANNOTE_METRICS_ENABLED"] = "0"
        import torch
        import soundfile as sf
        from pyannote.audio import Pipeline
        progress({"detail": "Loading Community-1"})
        token = os.environ.get("HF_TOKEN") or os.environ.get("HUGGING_FACE_HUB_TOKEN")
        pipeline = Pipeline.from_pretrained(self.model, token=token)
        if pipeline is None:
            raise RuntimeError("Community-1 is unavailable; accept its Hugging Face terms and set HF_TOKEN")
        device = self.device
        if device == "auto":
            device = "mps" if torch.backends.mps.is_available() else "cpu"
        try:
            pipeline.to(torch.device(device))
        except RuntimeError as error:
            if device != "mps" or not any(word in str(error).lower() for word in ("mps", "metal")):
                raise
            device = "cpu"
            progress({"detail": "MPS unavailable; using CPU diarization"})
            pipeline.to(torch.device(device))
        waveform, rate = sf.read(str(audio), dtype="float32", always_2d=True)
        if rate != 16000 or waveform.shape[1] != 1:
            raise ValueError("Diarization requires normalized 16 kHz mono audio")
        data = {"waveform": torch.from_numpy(waveform.T.copy()), "sample_rate": rate}

        def hook(step_name, step_artifact, file=None, total=None, completed=None):
            update = {"detail": str(step_name)}
            if total and completed is not None:
                update.update(completed=int(completed), total=int(total))
            progress(update)

        try:
            output = pipeline(data, hook=hook)
        except RuntimeError as error:
            # Retry only a device failure, not download/authentication or arbitrary errors.
            if device != "mps" or not any(word in str(error).lower() for word in ("mps", "metal")):
                raise
            device = "cpu"
            progress({"detail": "MPS operation unsupported; retrying diarization on CPU"})
            pipeline.to(torch.device(device))
            output = pipeline(data, hook=hook)
        annotation = output.exclusive_speaker_diarization
        turns = [{"start": float(turn.start), "end": float(turn.end), "speaker": str(speaker)}
                 for turn, _, speaker in annotation.itertracks(yield_label=True)]
        return {"turns": turns, "device": device, "model": self.model, "exclusive": True}
