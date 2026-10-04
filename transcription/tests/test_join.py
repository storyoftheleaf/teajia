import tempfile
import unittest
import wave
from pathlib import Path
from unittest.mock import patch
from transcription.join import join_recordings, sha256


class JoinTests(unittest.TestCase):
    def test_order_timeline_recovery_and_originals(self):
        with tempfile.TemporaryDirectory() as root:
            root = Path(root)
            inputs = [root / 'part 2.wav', root / 'part 10.wav']
            for index, file in enumerate(inputs):
                file.write_bytes(bytes([index + 1]))
            before = [sha256(p) for p in inputs]
            def normalizer(source, output):
                with wave.open(str(output), 'wb') as stream:
                    stream.setparams((1, 2, 16000, 0, 'NONE', 'not compressed'))
                    stream.writeframes(bytes([source.read_bytes()[0], 0]) * 16000)
            output = root / 'combined.wav'
            with patch('transcription.join.normalize', normalizer):
                result = join_recordings(inputs, output)
            self.assertEqual([(p['start'], p['end']) for p in result['parts']], [(0, 1), (1, 2)])
            with wave.open(str(output)) as stream:
                self.assertEqual(stream.getnframes(), 32000)
                self.assertEqual(stream.readframes(16000), b'\x01\x00' * 16000)
                self.assertEqual(stream.readframes(16000), b'\x02\x00' * 16000)
            self.assertEqual([sha256(p) for p in inputs], before)
            self.assertEqual(join_recordings(inputs, output), result)
            with self.assertRaisesRegex(ValueError, 'differs'):
                join_recordings(list(reversed(inputs)), output)

    def test_duplicate_audio_and_invalid_count_refused(self):
        with tempfile.TemporaryDirectory() as root:
            source = Path(root) / 'part.wav'; source.write_bytes(b'audio')
            duplicate = Path(root) / 'copy.wav'; duplicate.write_bytes(b'audio')
            output = Path(root) / 'combined.wav'
            with self.assertRaisesRegex(ValueError, 'more than once'):
                join_recordings([source, duplicate], output)
            with self.assertRaisesRegex(ValueError, 'between 2'):
                join_recordings([source], output)
            self.assertFalse(output.exists())
