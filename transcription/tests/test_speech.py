import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import types
import wave

from transcription.adapters import MLXWhisperAdapter
from transcription.pipeline import process
from transcription.speech import offset_result, speech_windows


class SpeechTests(unittest.TestCase):
    def test_window_union_padding_and_no_overlap(self):
        turns = [{"start": 0.1, "end": 12}, {"start": 11, "end": 20},
                 {"start": 20.1, "end": 41}, {"start": 80, "end": 84}]
        windows = speech_windows(turns, 82)
        self.assertEqual(windows, [(0, 20.3), (20.3, 41.3), (79.7, 82)])
        self.assertTrue(all(b - a <= 30 for a, b in windows))
        self.assertTrue(all(windows[i][1] <= windows[i + 1][0] for i in range(len(windows) - 1)))

    def test_long_continuous_turn_is_bounded(self):
        self.assertEqual(speech_windows([{"start": 0, "end": 75}], 75), [(0, 30), (30, 60), (60, 75)])
        self.assertEqual(speech_windows([], 75), [])

    def test_offsets_and_clips_model_overrun_without_text_deduplication(self):
        raw = {"language": "zh", "segments": [{"start": 0, "end": 4, "text": "yes yes ghost", "words": [
            {"start": 0, "end": 1, "word": "yes"}, {"start": 1, "end": 4, "word": " yes"},
            {"start": 4, "end": 5, "word": " ghost"}]}]}
        result = offset_result(raw, 10, 12)
        segment = result["segments"][0]
        self.assertEqual((segment["start"], segment["end"]), (10, 12))
        self.assertEqual(segment["text"], "yes yes")
        self.assertEqual(segment["words"][-1]["end"], 12)

    def test_native_mlx_settings_are_used_and_identity_invalidates_old_asr(self):
        calls = []
        module = types.SimpleNamespace(transcribe=lambda *args, **kwargs: calls.append(kwargs) or {"language": "en", "segments": []})
        with patch.dict("sys.modules", {"mlx_whisper": module}):
            adapter = MLXWhisperAdapter()
            adapter.transcribe(Path("audio.wav"), language=None, prompt=None, progress=lambda event: None)
        self.assertEqual(calls[0]["hallucination_silence_threshold"], 2.0)
        self.assertFalse(calls[0]["condition_on_previous_text"])
        self.assertIsNone(calls[0]["language"])
        self.assertIn("speech-v2", adapter.identity)
        self.assertNotEqual(adapter.identity, MLXWhisperAdapter(speech_gating=False).identity)

    def test_resume_chunk_failure_and_language_per_chunk(self):
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            source = base / "input.wav"
            with wave.open(str(source), "wb") as stream:
                stream.setnchannels(1)
                stream.setsampwidth(2)
                stream.setframerate(16000)
                stream.writeframes(b"\0\0" * 16000 * 70)
            output = base / "output"
            events = []

            class ASR:
                identity = "gated-fake-v2"
                speech_gating = True
                calls = 0
                fail = True

                def transcribe(self, audio, **kwargs):
                    self.calls += 1
                    events.append("transcribe")
                    self_language = kwargs["language"]
                    self.assert_none = self_language is None
                    if self.fail and self.calls == 2:
                        raise RuntimeError("interrupted")
                    code = "en" if self.calls == 1 else "zh"
                    return {"language": code, "segments": [{"start": 0, "end": 1, "text": "again again", "compression_ratio": 3.0}]}

            class Diarizer:
                identity = "one-conversation"
                calls = 0

                def diarize(self, audio, **kwargs):
                    self.calls += 1
                    events.append("diarize")
                    return {"turns": [{"start": 1, "end": 2, "speaker": "A"},
                                      {"start": 50, "end": 52, "speaker": "A"}]}

            def normalizer(original, target):
                target.write_bytes(original.read_bytes())
                return {"duration_seconds": 70}

            asr, diarizer = ASR(), Diarizer()
            with self.assertRaisesRegex(RuntimeError, "interrupted"):
                process(source, output, asr=asr, diarizer=diarizer, normalizer=normalizer)
            self.assertEqual(events, ["diarize", "transcribe", "transcribe"])
            asr.fail = False
            result = process(source, output, asr=asr, diarizer=diarizer, normalizer=normalizer)
            self.assertEqual(asr.calls, 3)
            self.assertEqual(diarizer.calls, 1)
            self.assertTrue(asr.assert_none)
            raw = json.loads((output / "transcribe.json").read_text())
            self.assertEqual(raw["languages"], ["en", "zh"])
            self.assertAlmostEqual(raw["segments"][1]["start"], 49.7)
            self.assertEqual(len(result["metadata"]["quality_flags"]), 2)
            self.assertEqual(result["metadata"]["language_detection"], "speech-window")
            self.assertEqual([s["text"] for s in raw["segments"]], ["again again", "again again"])
            # Completed recovery performs no additional model inference.
            process(source, output, asr=asr, diarizer=diarizer, normalizer=normalizer)
            self.assertEqual(asr.calls, 3)
            # Recovered/replaced diarization boundaries must invalidate combined ASR.
            turns = json.loads((output / "diarize.json").read_text())
            turns["turns"][1].update(start=55, end=57)
            (output / "diarize.json").write_text(json.dumps(turns))
            process(source, output, asr=asr, diarizer=diarizer, normalizer=normalizer)
            self.assertEqual(asr.calls, 4)  # First matching speech chunk is reused.
            updated = json.loads((output / "transcribe.json").read_text())
            self.assertAlmostEqual(updated["segments"][1]["start"], 54.7)


if __name__ == "__main__":
    unittest.main()

class DecoderConfidenceTests(unittest.TestCase):
    def test_missing_confidence_is_retained_as_unknown_not_a_json_failure(self):
        import json
        from transcription.adapters import clean_whisper_result
        raw={'language':'zh','segments':[{'start':0,'end':1,'text':'Tea','avg_logprob':float('nan'),'words':[{'start':0,'end':1,'word':'Tea','probability':float('nan')}]}]}
        result=clean_whisper_result(raw)
        json.dumps(result,allow_nan=False)
        self.assertTrue(result['segments'][0]['confidence_unavailable'])
        self.assertNotIn('probability',result['segments'][0]['words'][0])
        self.assertEqual(result['segments'][0]['text'],'Tea')
        self.assertNotEqual(raw['segments'][0]['avg_logprob'],raw['segments'][0]['avg_logprob'])
        raw['segments'][0]['start']=float('nan')
        with self.assertRaisesRegex(ValueError,'timestamp'):clean_whisper_result(raw)
