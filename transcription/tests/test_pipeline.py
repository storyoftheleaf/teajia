import json
from pathlib import Path
import tempfile
import unittest
import wave

from transcription.pipeline import process
from transcription.merge import merge, readable


ASR = {"language": "zh", "segments": [{"start": 0, "end": 3, "text": "你好 world!",
       "words": [{"start": 0, "end": 1, "word": "你好"},
                 {"start": 1, "end": 2, "word": " world!"},
                 {"start": 2, "end": 3, "word": " absent"}]}]}
TURNS = {"turns": [{"start": 0, "end": 1, "speaker": "SPEAKER_00"},
                   {"start": 1, "end": 2, "speaker": "SPEAKER_01"}]}


class FakeASR:
    identity = "fake-asr"
    calls = 0

    def transcribe(self, audio, **kwargs):
        self.calls += 1
        return ASR


class FakeDiarizer:
    identity = "fake-diarizer"
    calls = 0
    fail = False

    def diarize(self, audio, **kwargs):
        self.calls += 1
        if self.fail:
            raise RuntimeError("test device failure")
        return TURNS


def normalize(source, target):
    with wave.open(str(target), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(16000)
        wav.writeframes(b"\0\0" * 48000)
    return {"duration_seconds": 3}


class PipelineTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.source = self.base / "input.bin"
        self.source.write_bytes(b"audio")
        self.output = self.base / "output"
        self.asr, self.diarizer = FakeASR(), FakeDiarizer()

    def run_pipeline(self, **kwargs):
        return process(self.source, self.output, asr=self.asr, diarizer=self.diarizer,
                       normalizer=normalize, **kwargs)

    def test_word_speaker_split_and_unknown(self):
        result = merge(ASR, TURNS)
        self.assertEqual([s["speaker"] for s in result["segments"]], ["SPEAKER_00", "SPEAKER_01", None])
        self.assertEqual([s["text"] for s in result["segments"]], ["你好", "world!", "absent"])
        self.assertIsNone(result["speakers"][0]["name"])
        self.assertIn("Unknown speaker: absent", readable(result))
        self.assertEqual(result["segments"][0]["words"][0]["start"], 0)

    def test_overlap_sums_disjoint_turns_same_speaker(self):
        result = merge({"segments": [{"start": 0, "end": 4, "text": "hello"}]},
                       {"turns": [{"start": 0, "end": 1.2, "speaker": "A"},
                                  {"start": 1.2, "end": 3, "speaker": "B"},
                                  {"start": 3, "end": 4, "speaker": "A"}]})
        self.assertEqual(result["segments"][0]["speaker"], "A")

    def test_no_words_preserves_segment_and_empty_audio(self):
        result = merge({"language": "en", "segments": [{"start": 0, "end": 1, "text": "hello"}]}, {"turns": []})
        self.assertIsNone(result["segments"][0]["speaker"])
        self.assertEqual(merge({"segments": []}, {"turns": []})["segments"], [])

    def test_failure_resumes_completed_asr(self):
        self.diarizer.fail = True
        with self.assertRaises(RuntimeError):
            self.run_pipeline()
        progress = json.loads((self.output / "progress.json").read_text())
        self.assertEqual(progress["stage"], "diarize")
        self.assertEqual(progress["state"], "failed")
        self.assertEqual(progress["completed_stages"], ["normalize", "transcribe"])
        self.diarizer.fail = False
        result = self.run_pipeline()
        self.assertEqual(self.asr.calls, 1)
        self.assertEqual(self.diarizer.calls, 2)
        self.assertEqual(result["language"], "zh")
        self.assertEqual(json.loads((self.output / "progress.json").read_text())["state"], "completed")
        self.assertTrue((self.output / "transcript.txt").is_file())

    def test_changed_source_and_options_refused(self):
        self.run_pipeline()
        with self.assertRaises(ValueError):
            self.run_pipeline(language="en")
        self.source.write_bytes(b"changed")
        with self.assertRaises(ValueError):
            self.run_pipeline()

    def test_corrupt_checkpoint_recomputed(self):
        self.run_pipeline()
        (self.output / "transcribe.json").write_text('{"segments": [{"start": -1}]}')
        self.run_pipeline()
        self.assertEqual(self.asr.calls, 2)
        self.assertEqual(self.diarizer.calls, 1)

    def test_invalid_timing_is_refused(self):
        with self.assertRaises(ValueError):
            merge({"segments": [{"start": float("nan"), "end": 1}]}, TURNS)
        with self.assertRaises(ValueError):
            merge({"segments": [{"start": 2, "end": 1}]}, TURNS)


if __name__ == "__main__":
    unittest.main()
