# Local transcription

Apple Silicon Whisper **full Large V3**, native word timestamps, and pyannote **Community-1** exclusive speaker diarization. ffmpeg normalizes every source, including WAVs, to 16 kHz mono. Python imports stay lightweight until inference runs.

From the repository root, use a Python 3.12 environment with `transcription/requirements.txt` installed and ffmpeg on PATH:

```sh
python -m transcription process recording.m4a --output /absolute/path/to/job
python -m transcription process recording.m4a --output /absolute/path/to/job --language zh --prompt 'Tea names: Teajia, puer'
```

Omit `--language` to detect the recording language. Set `HF_TOKEN` in the process environment after accepting the [Community-1 model conditions](https://huggingface.co/pyannote/speaker-diarization-community-1). A cached authorized model may work without an explicit token. Credentials are never written into artifacts. First inference can download weights; installation alone does not warm/download models. `--model` and `--diarization-model` also accept local model directories. `--diarization-device cpu` is available when MPS is unsuitable; auto uses MPS when available and retries only recognized MPS runtime errors on CPU.

## Artifacts and recovery

- `progress.json`: atomically written `stage`, `state`, `error`, `completed_stages`, `updated_at`, optional model step `detail`/`completed`/`total`. Stages: normalize, transcribe, diarize, merge, complete. States: running, failed, completed. ASR stage is indeterminate; no invented percentage.
- `transcript.json`: `language`, `speakers: [{id, name: null}]`, `segments: [{speaker, start, end, text, words}]`, `metadata`. Each word has `word`, second-based `start`/`end`, speaker ID or null, and optional probability. Speaker changes split the ASR segment into readable turns. Speaker names remain unset for later naming.
- `transcript.txt`: timestamped readable speaker turns; unknown timing overlap prints Unknown speaker.
- `job.json`, `audio.wav`, `normalize.json`, `transcribe.json`, `diarize.json`: retained local recovery artifacts.

Rerun the same command/output directory after failure. Valid completed stages are reused; corrupt or missing checkpoints are recomputed. The source content SHA-256, options and adapter identities must match; changed input/options require a new directory. A process lock prevents simultaneous writers and releases automatically after a crash. Reconciliation/output can be repeated without rerunning inference.

Audio, checkpoint text and outputs are private local files. Recording-wide language detection does not guarantee accurate code-switching; Whisper word timings are approximate rather than a language-specific forced alignment. Overlapping speech, noise and similar voices can affect text and speaker clustering. IDs identify clusters within a recording, not verified people. A word with no temporal overlap remains `speaker: null`; no nearest-speaker guess fills silence. A segment without words remains available with segment timestamps.

## Adapter boundary

`process(input, output, asr=adapter, diarizer=adapter)` accepts independent `ASRAdapter`/`DiarizationAdapter` implementations from `adapters.py`. ASR returns `{language, segments}` with original second-based word timestamps. Diarization returns `{turns: [{start, end, speaker}], device?}`. Each adapter supplies a stable `identity` for checkpoint invalidation. A later local Cohere model can implement this boundary without changing the job runner or artifact consumer; no unverified Cohere ASR implementation is supplied.

Run dependency-free orchestration tests:

```sh
python3 -m unittest discover -s transcription/tests -v
```

See [UPSTREAM.md](UPSTREAM.md) for reviewed source paths and license/model attribution.
