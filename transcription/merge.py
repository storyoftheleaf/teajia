"""Reconcile word timing with exclusive diarization without inventing identity."""
from bisect import bisect_left
import math


def interval(item):
    start, end = float(item["start"]), float(item["end"])
    if not math.isfinite(start) or not math.isfinite(end) or start < 0 or end < start:
        raise ValueError("Invalid transcript timestamp")
    return start, end


class SpeakerIndex:
    def __init__(self, turns):
        self.turns = sorted(turns, key=lambda turn: interval(turn)[0])
        self.starts = [interval(turn)[0] for turn in self.turns]
        self.prefix_ends = []
        largest = 0
        for turn in self.turns:
            largest = max(largest, interval(turn)[1])
            self.prefix_ends.append(largest)

    def speaker(self, start, end):
        scores = {}
        i = bisect_left(self.starts, end) - 1
        while i >= 0 and self.prefix_ends[i] > start:
            turn = self.turns[i]
            overlap = min(end, turn["end"]) - max(start, turn["start"])
            if overlap > 0:
                label = turn["speaker"]
                scores[label] = scores.get(label, 0) + overlap
            i -= 1
        if not scores:
            return None
        # Stable ties; ambiguous overlapping speech remains a model limitation.
        return min(scores, key=lambda label: (-scores[label], label))


def merge(asr, diarization):
    index = SpeakerIndex(diarization["turns"])
    segments = []
    for source in asr["segments"]:
        start, end = interval(source)
        words = []
        for original in source.get("words", []):
            if "start" not in original or "end" not in original:
                raise ValueError("ASR returned a word without timestamps")
            a, b = interval(original)
            text = str(original.get("word", original.get("text", "")))
            word = {"start": a, "end": b, "word": text, "speaker": index.speaker(a, b)}
            if "probability" in original:
                word["probability"] = float(original["probability"])
            words.append(word)
        if words:
            # Preserve token whitespace and punctuation, including scripts without spaces.
            groups = []
            for word in words:
                if not groups or groups[-1][0]["speaker"] != word["speaker"]:
                    groups.append([])
                groups[-1].append(word)
            for group in groups:
                segments.append({"speaker": group[0]["speaker"], "start": group[0]["start"],
                                 "end": group[-1]["end"], "text": "".join(w["word"] for w in group).strip(),
                                 "words": group})
        elif str(source.get("text", "")).strip():
            segments.append({"speaker": index.speaker(start, end), "start": start, "end": end,
                             "text": str(source["text"]).strip(), "words": []})
    labels = sorted({s["speaker"] for s in segments if s["speaker"] is not None})
    return {"language": asr.get("language"), "speakers": [{"id": label, "name": None} for label in labels],
            "segments": segments}


def readable(result):
    names = {speaker["id"]: speaker["name"] or f"Speaker {index + 1}"
             for index, speaker in enumerate(result["speakers"])}
    lines = []
    for segment in result["segments"]:
        second = int(segment["start"])
        timestamp = f"{second // 3600:02d}:{second // 60 % 60:02d}:{second % 60:02d}"
        name = names.get(segment["speaker"], "Unknown speaker")
        lines.append(f"[{timestamp}] {name}: {segment['text']}")
    return "\n".join(lines) + ("\n" if lines else "")
