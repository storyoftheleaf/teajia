"""Local fallback using the whosaid architecture and official sherpa-onnx API.

API orchestration adapted from k2-fsa/sherpa-onnx's
python-api-examples/offline-speaker-diarization.py (Apache-2.0,
Copyright 2024 Xiaomi Corporation). Model provisioning follows
sblattj/whosaid lib/diarize_sherpa.py (MIT, Stephen Blatt).
"""
from pathlib import Path
import os
import tarfile
import urllib.request

SEGMENTATION_URL = "https://github.com/k2-fsa/sherpa-onnx/releases/download/speaker-segmentation-models/sherpa-onnx-pyannote-segmentation-3-0.tar.bz2"
EMBEDDING_URL = "https://github.com/k2-fsa/sherpa-onnx/releases/download/speaker-recongition-models/wespeaker_en_voxceleb_resnet34_LM.onnx"


def model_paths():
    folder = Path(os.environ.get("MAG_DIARIZATION_MODELS", Path(__file__).resolve().parents[1] / ".models" / "diarization"))
    return folder, folder / "sherpa-onnx-pyannote-segmentation-3-0/model.onnx", folder / "wespeaker_en_voxceleb_resnet34_LM.onnx"


def ensure_models(progress):
    folder, segmentation, embedding = model_paths()
    folder.mkdir(parents=True, exist_ok=True)
    def download(url, target):
        part = target.with_suffix(target.suffix + ".part")
        progress({"detail": "Downloading local speaker model"})
        urllib.request.urlretrieve(url, part)
        part.replace(target)
    if not segmentation.is_file():
        archive = folder / "segmentation.tar.bz2"
        download(SEGMENTATION_URL, archive)
        with tarfile.open(archive) as tar:
            tar.extractall(folder, filter="data")
    if not embedding.is_file():
        download(EMBEDDING_URL, embedding)
    return segmentation, embedding


class SherpaDiarizationAdapter:
    identity = "sherpa-onnx:pyannote-segmentation-3.0:wespeaker-resnet34-LM:fp32:threshold-0.7:v2"

    def diarize(self, audio, *, progress):
        import soundfile as sf
        import sherpa_onnx
        segmentation, embedding = ensure_models(progress)
        progress({"detail": "Loading local speaker models"})
        config = sherpa_onnx.OfflineSpeakerDiarizationConfig(
            segmentation=sherpa_onnx.OfflineSpeakerSegmentationModelConfig(
                pyannote=sherpa_onnx.OfflineSpeakerSegmentationPyannoteModelConfig(
                    model=str(segmentation), window_shift_ratio=0.1),
                num_threads=4, provider="cpu"),
            embedding=sherpa_onnx.SpeakerEmbeddingExtractorConfig(
                model=str(embedding), num_threads=4, provider="cpu"),
            clustering=sherpa_onnx.FastClusteringConfig(num_clusters=-1, threshold=0.7),
            min_duration_on=0.3, min_duration_off=0.5)
        if not config.validate():
            raise RuntimeError("Local speaker model configuration is invalid")
        pipeline = sherpa_onnx.OfflineSpeakerDiarization(config)
        waveform, rate = sf.read(str(audio), dtype="float32", always_2d=True)
        if rate != pipeline.sample_rate or waveform.shape[1] != 1:
            raise ValueError("Diarization requires normalized 16 kHz mono audio")
        def hook(completed, total):
            progress({"detail": "Separating speakers locally", "completed": completed, "total": total})
            return 0
        turns = pipeline.process(waveform[:, 0], callback=hook).sort_by_start_time()
        labels = {}
        for turn in turns:
            labels.setdefault(turn.speaker, f"SPEAKER_{len(labels):02d}")
        return {"turns": [{"start": float(t.start), "end": float(t.end),
                          "speaker": labels[t.speaker]} for t in turns],
                "device": "cpu", "adapter": self.identity,
                "model": "pyannote-segmentation-3.0 + WeSpeaker ResNet34-LM (sherpa-onnx)",
                "exclusive": False}


class PreferredDiarizationAdapter:
    def __init__(self, primary, fallback=None):
        self.primary = primary
        self.fallback = fallback or SherpaDiarizationAdapter()
        self.identity = primary.identity + ":fallback:" + self.fallback.identity

    def diarize(self, audio, *, progress):
        from huggingface_hub.errors import GatedRepoError
        try:
            result = self.primary.diarize(audio, progress=progress)
            result["adapter"] = self.primary.identity
            return result
        except GatedRepoError:
            progress({"detail": "Community-1 access unavailable; using local sherpa-onnx"})
            result = self.fallback.diarize(audio, progress=progress)
            result["fallback_reason"] = "Community-1 model access unavailable; used public sherpa-onnx models."
            return result
