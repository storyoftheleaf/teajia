"""Bounded speech windows following WhisperX's cut-and-merge architecture.

Reuse diarization's detected speech rather than loading a second VAD model.
Windows have no overlap, so padding cannot produce duplicate transcript words.
"""
from collections import defaultdict
from pathlib import Path
import tempfile
import wave

from .merge import interval


def speech_windows(turns, duration, *, padding=0.3, max_seconds=30.0):
    if padding < 0 or max_seconds <= 0:
        raise ValueError("Invalid speech window settings")
    intervals = []
    speech_ends = []
    for turn in sorted(turns, key=lambda item: interval(item)[0]):
        start, end = interval(turn)
        if end <= start or start >= duration:
            continue
        start, end = max(0.0, start - padding), min(duration, end + padding)
        speech_ends.append(end)
        if intervals and start <= intervals[-1][1]:
            intervals[-1][1] = max(intervals[-1][1], end)
        else:
            intervals.append([start, end])
    windows = []
    for start, end in intervals:
        while end - start > max_seconds:
            # Prefer a detected turn end over cutting the decoder's window mid-word.
            candidates = [point for point in speech_ends if start + max_seconds / 2 <= point <= start + max_seconds]
            boundary = max(candidates) if candidates else start + max_seconds
            windows.append((start, boundary))
            start = boundary
        if end > start:
            # Merge nearby short speech runs only when the whole span fits.
            if windows and start - windows[-1][1] <= 1.0 and end - windows[-1][0] <= max_seconds:
                windows[-1] = (windows[-1][0], end)
            else:
                windows.append((start, end))
    return windows


def offset_result(result, start, end):
    """Restore chunk-local alignment to original audio time; clip model overrun."""
    segments = []
    length = end - start
    for original in result["segments"]:
        a, b = interval(original)
        if a >= length or b <= 0:
            continue
        segment = {**original, "start": start + min(a, length), "end": start + min(b, length),
                   "language": result.get("language")}
        if "words" in original:
            words = []
            for original_word in original["words"]:
                x, y = interval(original_word)
                if x >= length or y <= 0:
                    continue
                words.append({**original_word, "start": start + min(x, length), "end": start + min(y, length)})
            segment["words"] = words
            # Text beyond a clip must not survive when aligned words were clipped away.
            if original["words"]:
                if not words:
                    continue
                segment["text"] = "".join(word.get("word", word.get("text", "")) for word in words).strip()
        segments.append(segment)
    return {**result, "segments": segments}


def transcribe_speech(asr, audio, turns, *, language, prompt, progress, checkpoint):
    with wave.open(str(audio), "rb") as stream:
        rate = stream.getframerate()
        duration = stream.getnframes() / rate
        windows = speech_windows(turns, duration)
        results = []
        for index, (start, end) in enumerate(windows):
            progress({"detail": f"Transcribing speech window {index + 1} of {len(windows)}",
                      "completed": index, "total": len(windows)})

            def work():
                # PCM slicing preserves exact joined-audio offsets without ffmpeg per window.
                with tempfile.TemporaryDirectory(prefix="mag-speech-") as directory:
                    chunk = Path(directory) / "speech.wav"
                    stream.setpos(round(start * rate))
                    with wave.open(str(chunk), "wb") as target:
                        target.setparams(stream.getparams())
                        target.writeframes(stream.readframes(round(end * rate) - round(start * rate)))
                    return asr.transcribe(chunk, language=language, prompt=prompt, progress=progress)

            raw = checkpoint(index, start, end, work)
            results.append((end - start, offset_result(raw, start, end)))
    languages = defaultdict(float)
    segments = []
    flagged = []
    for duration, result in results:
        if result.get("language"):
            languages[result["language"]] += duration
        segments.extend(result["segments"])
        # Keep real repetitions; report decoder evidence instead of deleting text by regex.
        for segment in result["segments"]:
            if segment.get('confidence_unavailable') or segment.get('avg_logprob', 0) < -1:
                flagged.append({'start':segment['start'],'end':segment['end'],'kind':'confidence',
                                'reason':'Decoder confidence is unavailable or low; listen to verify.'})
            if segment.get("compression_ratio", 0) > 2.4:
                flagged.append({"start": segment["start"], "end": segment["end"],
                                "reason": "Decoder reports unusually repetitive text; listen to verify."})
    return {"language": max(languages, key=languages.get) if languages else language,
            "languages": sorted(languages), "segments": segments,
            "speech_windows": [{"start": a, "end": b} for a, b in windows],
            "quality_flags": flagged, "language_detection": "speech-window" if not language else "user-selected"}
