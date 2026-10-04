import unittest
from types import SimpleNamespace
from huggingface_hub.errors import GatedRepoError
from transcription.sherpa import PreferredDiarizationAdapter


class Adapter:
    def __init__(self, identity, error=None):
        self.identity, self.error, self.calls = identity, error, 0

    def diarize(self, audio, **kwargs):
        self.calls += 1
        if self.error:
            raise self.error
        return {'turns': [], 'adapter': self.identity}


class PreferredTests(unittest.TestCase):
    def test_primary_kept_when_authorized(self):
        primary, fallback = Adapter('community'), Adapter('sherpa')
        result = PreferredDiarizationAdapter(primary, fallback).diarize('audio', progress=lambda e: None)
        self.assertEqual(result['adapter'], 'community')
        self.assertEqual(fallback.calls, 0)

    def test_gate_uses_truthfully_labelled_fallback(self):
        primary, fallback = Adapter('community', GatedRepoError('403', response=SimpleNamespace(headers={}, request=None))), Adapter('sherpa')
        result = PreferredDiarizationAdapter(primary, fallback).diarize('audio', progress=lambda e: None)
        self.assertEqual(result['adapter'], 'sherpa')
        self.assertIn('Community-1 model access unavailable', result['fallback_reason'])

    def test_other_failures_are_not_hidden(self):
        primary, fallback = Adapter('community', RuntimeError('corrupt model')), Adapter('sherpa')
        with self.assertRaisesRegex(RuntimeError, 'corrupt model'):
            PreferredDiarizationAdapter(primary, fallback).diarize('audio', progress=lambda e: None)
        self.assertEqual(fallback.calls, 0)
