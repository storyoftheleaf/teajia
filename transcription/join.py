"""Join ordered media on one sample-accurate timeline; originals stay untouched."""
import hashlib
import json
import os
import sys
import wave
from pathlib import Path
from .pipeline import normalize, atomic_json


def sha256(path):
    digest = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def join_recordings(sources, output):
    output = Path(output)
    if not 2 <= len(sources) <= 32:
        raise ValueError('Choose between 2 and 32 recordings in conversation order')
    output.parent.mkdir(parents=True, exist_ok=True)
    parts = [{'source': str(Path(p).resolve()), 'sha256': sha256(p)} for p in sources]
    if len({p['sha256'] for p in parts}) != len(parts):
        raise ValueError('The same audio was selected more than once')
    manifest = output.with_suffix('.parts.json')
    if output.exists():
        saved = json.loads(manifest.read_text()) if manifest.exists() else {}
        if saved.get('inputs') != parts or saved.get('output_sha256') != sha256(output):
            raise ValueError('Combined recording differs from these inputs; use a new conversation')
        return saved
    temp = output.with_suffix('.part.wav')
    normalized = output.parent / '.join-parts'
    normalized.mkdir(exist_ok=True)
    frames = 0
    timeline = []
    try:
        with wave.open(str(temp), 'wb') as joined:
            joined.setparams((1, 2, 16000, 0, 'NONE', 'not compressed'))
            for index, part in enumerate(parts):
                audio = normalized / f'{index:02d}-{part["sha256"][:16]}.wav'
                if not audio.exists():
                    normalize(Path(part['source']), audio)
                with wave.open(str(audio), 'rb') as stream:
                    if (stream.getnchannels(), stream.getsampwidth(), stream.getframerate()) != (1, 2, 16000):
                        raise ValueError('Joined audio must be 16 kHz mono PCM')
                    start = frames / 16000
                    count = stream.getnframes()
                    while chunk := stream.readframes(16000 * 30):
                        joined.writeframesraw(chunk)
                    frames += count
                    timeline.append({**part, 'index': index, 'start': start, 'end': frames / 16000})
        # Publish provenance before audio, so a crash can safely retry.
        result = {'inputs': parts, 'parts': timeline, 'duration_seconds': frames / 16000,
                  'sample_rate': 16000, 'output_sha256': sha256(temp)}
        atomic_json(manifest, result)
        os.replace(temp, output)
        return result
    finally:
        temp.unlink(missing_ok=True)


if __name__ == '__main__':
    request = json.loads(Path(sys.argv[1]).read_text())
    result = join_recordings(request['sources'], request['output'])
    print(json.dumps({'parts': len(result['parts']), 'duration_seconds': result['duration_seconds']}))
