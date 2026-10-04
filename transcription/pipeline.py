"""Atomic stage checkpoints; failures resume without repeating completed inference."""
from pathlib import Path
from contextlib import contextmanager
from datetime import datetime, timezone
import fcntl
import hashlib
import json
import os
import subprocess
import tempfile
import wave

from .adapters import MLXWhisperAdapter, CommunityDiarizationAdapter
from .merge import merge, readable, interval
from .speech import speech_windows, transcribe_speech

SCHEMA_VERSION = 1


def atomic_text(path, text):
    path = Path(path)
    with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=path.parent,
                                     prefix=f".{path.name}.", delete=False) as stream:
        temporary = Path(stream.name)
        try:
            stream.write(text)
            stream.flush()
            os.fsync(stream.fileno())
        except BaseException:
            temporary.unlink(missing_ok=True)
            raise
    os.replace(temporary, path)


def atomic_json(path, value):
    atomic_text(path, json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n")


def normalize(source, target):
    temporary = target.with_name(".audio.partial.wav")
    try:
        subprocess.run(["ffmpeg", "-nostdin", "-y", "-loglevel", "error", "-i", str(source),
                        "-map", "0:a:0", "-vn", "-ac", "1", "-ar", "16000",
                        "-c:a", "pcm_s16le", str(temporary)], check=True, capture_output=True)
        duration = audio_duration(temporary)
        if duration <= 0:
            raise ValueError("Input contains no audio samples")
        os.replace(temporary, target)
        return {"duration_seconds": duration, "sample_rate": 16000, "channels": 1}
    except subprocess.CalledProcessError as error:
        raise RuntimeError("ffmpeg could not decode the input audio: " + error.stderr.decode(errors="replace")[-1500:]) from error
    finally:
        temporary.unlink(missing_ok=True)


def audio_duration(path):
    with wave.open(str(path), "rb") as audio:
        if audio.getframerate() != 16000 or audio.getnchannels() != 1:
            raise ValueError("Checkpoint audio is not 16 kHz mono")
        return audio.getnframes() / audio.getframerate()


@contextmanager
def job_lock(output):
    # OS releases the advisory lock even after SIGKILL; no stale PID cleanup.
    with (output / ".lock").open("a") as stream:
        try:
            fcntl.flock(stream, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise RuntimeError("Another process is using this output directory") from None
        try:
            yield
        finally:
            fcntl.flock(stream, fcntl.LOCK_UN)


def process(source, output, *, language=None, prompt=None, asr=None, diarizer=None,
            normalizer=normalize, on_progress=None):
    source, output = Path(source).resolve(), Path(output).resolve()
    if not source.is_file():
        raise FileNotFoundError(f"Input audio does not exist: {source}")
    output.mkdir(parents=True, exist_ok=True)
    asr = asr or MLXWhisperAdapter()
    diarizer = diarizer or CommunityDiarizationAdapter()
    with job_lock(output):
        digest = hashlib.sha256()
        with source.open("rb") as stream:
            for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                digest.update(chunk)
        config = {"schema_version": SCHEMA_VERSION, "source_sha256": digest.hexdigest(),
                  "language": language, "prompt": prompt, "asr": asr.identity,
                  "diarizer": diarizer.identity}
        manifest = output / "job.json"
        if manifest.exists():
            previous = json.loads(manifest.read_text())
            if previous != config:
                # An unfinished diarization can change engines without repeating ASR.
                same_input = {k: v for k, v in previous.items() if k != "diarizer"} == {k: v for k, v in config.items() if k != "diarizer"}
                if not same_input or (output / "diarize.json").exists() or (output / "transcript.json").exists():
                    raise ValueError("Output directory belongs to different audio or options; use a new directory")
                atomic_json(manifest, config)
        else:
            atomic_json(manifest, config)
        completed = []
        stage = "normalize"

        def report(state, **extra):
            event = {"stage": stage, "state": state, "error": None,
                     "completed_stages": list(completed),
                     "updated_at": datetime.now(timezone.utc).isoformat(), **extra}
            atomic_json(output / "progress.json", event)
            if on_progress:
                on_progress(event)

        def checkpoint(name, work, validator):
            nonlocal stage
            stage = name
            report("running")
            path = output / f"{name}.json"
            cached = False
            if path.exists():
                try:
                    result = json.loads(path.read_text())
                    validator(result)
                    cached = True
                except (ValueError, KeyError, TypeError, OSError, EOFError, wave.Error):
                    cached = False
            if not cached:
                result = work()
                validator(result)
                atomic_json(path, result)
            completed.append(name)
            report("running", detail="Checkpoint reused" if cached else "Stage complete")
            return result

        try:
            audio = output / "audio.wav"

            def validate_audio(result):
                if abs(audio_duration(audio) - result["duration_seconds"]) > 0.001:
                    raise ValueError("Audio checkpoint duration changed")

            normalized = checkpoint("normalize", lambda: normalizer(source, audio), validate_audio)

            def validate_asr(result):
                if not isinstance(result["segments"], list):
                    raise ValueError("ASR segments must be a list")
                for segment in result["segments"]:
                    interval(segment)
                    if not isinstance(segment.get("text"), str):
                        raise ValueError("ASR segment text is missing")
                    for word in segment.get("words", []):
                        interval(word)

            def validate_diarization(result):
                if not isinstance(result["turns"], list):
                    raise ValueError("Diarization turns must be a list")
                for turn in result["turns"]:
                    interval(turn)
                    if not isinstance(turn["speaker"], str):
                        raise ValueError("Diarization speaker is missing")

            def diarize():
                return checkpoint("diarize", lambda: diarizer.diarize(
                    audio, progress=lambda event: report("running", **event)), validate_diarization)

            if getattr(asr, "speech_gating", False):
                # Whole-conversation clustering also supplies speech regions for ASR.
                turns = diarize()
                expected_windows = [{"start": a, "end": b} for a, b in speech_windows(
                    turns["turns"], normalized["duration_seconds"])]

                def validate_speech_asr(result):
                    validate_asr(result)
                    if result.get("speech_windows") != expected_windows:
                        raise ValueError("Transcription checkpoint speech boundaries changed")

                def chunk_checkpoint(index, start, end, work):
                    directory = output / "speech-chunks"
                    directory.mkdir(exist_ok=True)
                    path = directory / f"{index:06d}.json"
                    if path.exists():
                        try:
                            cached = json.loads(path.read_text())
                            if cached["start"] != start or cached["end"] != end:
                                raise ValueError("Speech boundaries changed")
                            validate_asr(cached["result"])
                            return cached["result"]
                        except (ValueError, KeyError, TypeError, OSError):
                            pass
                    result = work()
                    validate_asr(result)
                    atomic_json(path, {"start": start, "end": end, "result": result})
                    return result

                raw = checkpoint("transcribe", lambda: transcribe_speech(
                    asr, audio, turns["turns"], language=language, prompt=prompt,
                    progress=lambda event: report("running", **event), checkpoint=chunk_checkpoint), validate_speech_asr)
            else:
                raw = checkpoint("transcribe", lambda: asr.transcribe(
                    audio, language=language, prompt=prompt, progress=lambda event: report("running", **event)), validate_asr)
                turns = diarize()
            stage = "merge"
            report("running")
            result = merge(raw, turns)
            result["metadata"] = {
                "schema_version": SCHEMA_VERSION, "source": str(source),
                "source_sha256": config["source_sha256"],
                "duration_seconds": normalized["duration_seconds"],
                "asr_adapter": asr.identity, "diarization_adapter": turns.get("adapter", diarizer.identity),
                "diarization_model": turns.get("model"), "diarization_exclusive": turns.get("exclusive"),
                "diarization_device": turns.get("device"), "word_timestamps": getattr(asr, "timestamp_method", "adapter-provided"),
                "language_detection": raw.get("language_detection", "recording-wide"),
                "detected_languages": raw.get("languages", [raw.get("language")]),
                "quality_flags": raw.get("quality_flags", []),
                "warnings": ["Language detection and overlapping speech require listening review, including changes within a speech window.",
                             "Speaker IDs are recording-local clusters, not verified identities."]}
            if raw.get("quality_flags"):
                result["metadata"]["warnings"].append(f"{len(raw['quality_flags'])} speech segments have repetitive decoder output; review the marked timestamps.")
            if turns.get("fallback_reason"):
                result["metadata"]["warnings"].append(turns["fallback_reason"])
            atomic_json(output / "transcript.json", result)
            atomic_text(output / "transcript.txt", readable(result))
            completed.append("merge")
            stage = "complete"
            report("completed", result=str(output / "transcript.json"))
            return result
        except BaseException as error:
            message = str(error) or type(error).__name__
            for variable in ("HF_TOKEN", "HUGGING_FACE_HUB_TOKEN"):
                token = os.environ.get(variable)
                if token:
                    message = message.replace(token, "[redacted]")
            report("failed", error=message)
            raise
