# Local magazine transcription

Checked on 2026-10-04. This is the local Mac magazine workshop, separate from the storefront and its Cloudflare deployment. The target is full **Whisper Large V3 through MLX**, followed by preferred **pyannote Community-1** speaker diarization, with an explicitly labelled public local sherpa-onnx fallback when gated access is denied. Turbo is a different model and is not the default.

## Existing workshop and source boundaries

The working magazine starts at `~/builds/mag-preview.mjs`. Its configuration comes from `~/builds/mag-intake.config`; `mag-config.mjs` also reads that configuration. The observed paths are:

| Purpose | Configured path |
|---|---|
| Sources and photos, outside the vault | `~/Documents/Files/1 Areas/Brands/Teajia/Magazine` |
| Computer drop | the preceding folder's `Drop/` |
| Phone drop | `~/Library/Mobile Documents/com~apple~CloudDocs/Teajia Drop` |
| Magazine notes | `~/Library/Mobile Documents/iCloud~md~obsidian/Documents/Adrian-obsidian/Brands/Teajia/Magazine` |
| Tea vocabulary | `~/builds/tea-terms.json` |

The existing `mag-intake.sh` accepts a recording or an already written transcript. Before this integration, audio went through ffmpeg and whisper.cpp using cached `ggml-small.bin`; transcript inputs bypass ASR. Dropped sources move into the story's folder; sources elsewhere are copied. RAW lands at `MAG_VAULT/Workflow/0-Inbox/RAW - [Title].md`, and intake refuses to overwrite it. Photos remain beside the recording, outside the vault.

The magazine's own `SYSTEM.md` makes RAW immutable after creation. SRC is the later working source, with reviewed speaker names, source grade and highlights; then come MAP, DEV and review. The eight legacy stories predate this intake and lack recording references and times. Their SRC is their source record. Do not replace those records with a fresh machine interpretation or manufacture timestamps for them.

The repository's `transcription/` package supplies the new local processing boundary. `scripts/mag-local/` integrates it with the existing workshop. Installing or restarting the local workshop is distinct from deploying teajia.com.

## Machine readiness observed

| Check | Result |
|---|---|
| Hardware | MacBook Pro, Apple M1 Max, 64 GB unified memory (`system_profiler`) |
| Architecture | `arm64` |
| Disk | approximately 595 GiB available on the workspace volume |
| Audio tools | `/opt/homebrew/bin/ffmpeg` and `ffprobe` present |
| Existing ASR | `/opt/homebrew/bin/whisper-cli`; small and base whisper.cpp weights cached |
| Python | shell `python3` is 3.10; uv has Apple Silicon Python 3.11 and 3.13 installed |
| Model packages | isolated `.venv-transcription` imports MLX Whisper 0.4.3, pyannote.audio 4.0.7 and torch successfully; Metal/MPS available |
| Hugging Face default model cache | full Large V3 cached and verified in an offline ASR run; Community-1 is not yet downloaded |
| Hugging Face credentials | locally cached token now present; its account still receives Community-1 HTTP 403 |

These are checks of the current shell and known default locations, not a claim that every Python environment on the computer is empty. Spokenly is installed and keeps audio/history; its `Models/` directory had no entries during inspection. Its proprietary managed runtime is not reused by this pipeline.

Dependencies, full Large V3 and public fallback speaker weights are now installed. Community-1 itself remains gated; the default auto engine can complete local processing using the fallback. Read the measured validation below rather than interpreting model readiness as accuracy.

## Setup and first download

Use a dedicated Python 3.11 environment for the package rather than the system Python. During setup the workspace environment is `.venv-transcription`; its interpreter is `.venv-transcription/bin/python`. The repository workshop installer entry point is `npm run mag:install-local`; inspect its output for the actual environment and workshop install paths. Create the isolated environment and install the verified dependency set:

```sh
uv venv --python 3.11 .venv-transcription
uv pip install --python .venv-transcription/bin/python -r transcription/requirements.lock.txt
.venv-transcription/bin/hf auth login
npm run mag:install-local                 # inspect dry-run
npm run mag:install-local -- --apply       # backs up and patches local scripts
launchctl kickstart -k gui/$(id -u)/com.teajia.mag-page
```

The login stores credentials locally so the launch agent can download Community-1; an environment token in a shell alone is not inherited by a running launch agent. Never paste tokens into chat. After accepting Community-1 terms, run one full process command to warm its dependent weights. The command-line processing interface is:

```sh
python -m transcription process "/absolute/path/to/recording.wav" --output "/absolute/path/to/output"
```

Run that command with the installed environment's Python, from the package's installed directory or repository root. It does not imply that bare system `python` has the dependencies.

Before the first diarization run, the owner must sign in and accept the conditions on the [Community-1 model page](https://huggingface.co/pyannote/speaker-diarization-community-1), then create a Hugging Face token with permission to read that model. Acceptance includes sharing contact information with the model publisher. Use the same account for acceptance and the token. Keep credentials in the local environment or Hugging Face credential store, never source control, output manifests or logs. The Python adapter accepts `HF_TOKEN` or `HUGGING_FACE_HUB_TOKEN`.

ASR uses the public [mlx-community/whisper-large-v3-mlx](https://huggingface.co/mlx-community/whisper-large-v3-mlx) model; Community-1 is a separate gated download. Full Large V3 weights require several gigabytes; allow further space for the Python/torch environment, diarization dependencies, cache and normalized audio. A 16 kHz mono PCM16 working WAV uses about 115 MB per hour, before other runtime copies. The free disk reading above provides ample room, but is not an actual download measurement.

First-use networking downloads dependencies and model weights. It does not require sending recordings to an inference service. Cache both stages before relying on offline operation. For a reproducible run, record exact model revisions as well as model IDs and package versions; an unpinned Hub name may change at a later download.

## Offline behavior and privacy

After all model files are local, set `HF_HUB_OFFLINE=1` and `PYANNOTE_METRICS_ENABLED=0` when verifying disconnected processing. The adapter disables pyannote telemetry before importing the library. Hub offline mode makes a missing cache fail instead of silently fetching a missing component. Verify a whole ASR-plus-diarization run with networking unavailable before claiming the installation works offline.

Community-1 also documents loading a complete local pipeline directory with `Pipeline.from_pretrained('/local/path')`; the MLX adapter can receive a local model path. A partial snapshot, Git LFS pointer or missing dependent weight is not an offline installation. The package should report a failed stage and preserve the source when either model is unavailable. It should never substitute a cloud transcription or silently omit speaker attribution.

Speaker clusters are local anonymous identities, not proof of a person's name. Keep `SPEAKER_00`-style labels until a human maps them. No voice enrollment or persistent biometric registry is necessary for this magazine flow. Source copies and transcript sidecars are private local material; neither belongs in the public repository.

The [pyannote telemetry documentation](https://github.com/pyannote/pyannote-audio#telemetry) describes optional metrics, including processed duration and speaker-count parameters. Disabling telemetry is part of the local-only setup. Community-1's [offline instructions](https://huggingface.co/pyannote/speaker-diarization-community-1#offline-use) describe downloading once and running from disk.

## Why these components

The following upstream projects were reviewed before the implementation:

| Project | Relevant finding | Integration decision |
|---|---|---|
| [weypro/whispermlx](https://github.com/weypro/whispermlx) | WhisperX fork replacing inference with mlx-whisper; includes forced alignment and Community-1 diarization | Reference for composition; avoid adopting another complete ASR stack for the first Mag integration |
| [haniabdemai/local-transcription](https://github.com/haniabdemai/local-transcription) | Small separated ASR, diarization and merge scripts; default ASR is **Turbo**; documents MPS diarization | Useful stage separation; choose full Large V3 explicitly and do not assume its published timing applies here |
| [sblattj/whosaid](https://github.com/sblattj/whosaid) | MLX ASR plus ungated sherpa-onnx CPU diarization and optional voice registry | Useful attribution/sidecar reference; its diarizer is not Community-1, so it does not meet the requested default |
| [WhisperX](https://github.com/m-bain/whisperX) | faster-whisper ASR, wav2vec2 forced alignment and pyannote; documents CPU use on macOS | Optional future alignment comparison; default Mac ASR remains MLX |
| [sooth/whisperx-mlx](https://github.com/sooth/whisperx-mlx) | MLX backend, optional forced alignment, VAD/batching and diarization; package declares alpha status | Optional timing/alignment experiment after real interview results; its warm English M4 Max timings do not predict end-to-end Mag time |

The direct path is ffmpeg normalization → mlx-whisper with full Large V3 → Community-1 → speaker/text reconciliation → readable transcript and structured sidecars. MLX uses the Apple GPU for ASR; pyannote can use MPS, with a clearly reported CPU fallback for unsupported MPS operations. Community-1's exclusive diarization output simplifies assigning one speaker to a time span; preserve ordinary overlap evidence where available instead of interpreting exclusivity as proof there was no simultaneous speech.

The [Large V3 MLX model card](https://huggingface.co/mlx-community/whisper-large-v3-mlx) declares MIT; the [Community-1 model card](https://huggingface.co/pyannote/speaker-diarization-community-1) declares CC BY 4.0. Preserve required notices and model attribution in redistribution. Pipeline code licenses and model licenses are separate: WhisperX and sooth's package declare BSD-2-Clause; the local-transcription and whosaid projects declare MIT. Do not copy upstream code without its corresponding notice.

## Language and alignment limits

Use transcription, not translation, for RAW. English, Mandarin and mixed conversations must retain the spoken language; translation belongs in a later clearly marked source step. Automatic language detection is a starting point, not a guarantee of correct code switching. A global language hint can improve a mostly single-language interview but can also hurt its other language; compare hints on the actual bilingual audio rather than forcing English.

Tea prompts are vocabulary hints. They do not establish that a rare cultivar, place or person's name was actually spoken. Review uncertain terms against audio and preserve uncertainty in SRC. Whisper can hallucinate text during silence or music, miss short interjections and struggle with simultaneous speech.

Native Whisper word timestamps improve speaker assignment without adding a separate forced-alignment model, but remain estimated timings. WhisperX-style forced alignment requires a language-specific model and may fail on out-of-dictionary terms, numbers and mixed-language spans. Do not advertise Chinese/English word-perfect alignment from English-only tests. Exclusive diarization also does not make overlapping speakers or very short turns reliably attributable. Review speaker changes and consequential quotes against the recording.

## Real available benchmark fixtures

The configured Magazine folder and both current drops contained no audio source at inspection. However, Spokenly's current history contains paired audio and completed transcripts. The directory is `~/Library/Application Support/Spokenly/History/2026-10-04/`:

| History basename (same `.wav` and `.json`) | Original source name | Duration | Use |
|---|---|---|---|
| `90CEABDF-0EE6-4A69-8805-10F3E21161A5` | `TX00_MIC022_20261003_143744_orig.wav` | 51.48 s | Fast smoke fixture; completed transcript has 22 segments and Speaker 1/2 labels |
| `199AEDB4-F5BF-412F-B4DA-EB7AE79DD66B` | `TX00_MIC028_20261003_195100_orig.wav` | 876.70 s | Relevant tea interview comparison; completed transcript has 204 segments and Adrian/Mathew labels |
| `4DE43475-3CAD-4431-8B4D-016F812B12C9` | `TX00_MIC024_20261003_143858_orig.wav` | 1800.15 s | Longer real audio, but Spokenly recorded a failed state; no completed transcript baseline |
| `B10BCED5-32E4-40C5-97A6-92F6884A0779` | `TX00_MIC023_20261003_143840_orig.wav` | 2.97 s | Empty-text/silence check; existing result contains one empty segment |

These WAVs are 48 kHz mono, verified from their headers. The completed JSON stores segments at `content.fileTranscription._0.state.completed._0.segments`, with `start`, `end`, `text` and optional `speakerId`. Its recorded model ID is `whisper-v3`. Existing completed text contains no Chinese characters; that describes the saved text, not a verified language classification of the audio. The tea interview is identified by its saved tea vocabulary and speaker labels, not by listening performed during setup.

No Cohere-labelled matching export was found in the scoped Magazine/drop locations. `whisper-v3` does not identify a Cohere backend, and neither existing machine transcript is ground truth. Do not label these baselines Cohere or claim a quality win against one until its exact matching export is supplied or located.

### Comparison procedure

The machine-baseline comparison tool reads the pipeline's `transcript.json` and the original Spokenly history JSON directly:

```sh
node scripts/mag-local/benchmark.mjs "/path/to/output/transcript.json" "/path/to/Spokenly/History/date/id.json"
node --test scripts/mag-local/benchmark.test.mjs
```

It emits a JSON report with normalized token edit distance, insertion/deletion/substitution counts, machine-text disagreement rate, source duration delta, segment counts, speaker counts, unattributed segments and first/last segment times. Memory used by edit-distance rows grows linearly with transcript length; execution time remains quadratic. Mixed text is NFKC-normalized and lowercased; punctuation is ignored, Han characters are individual tokens and other text uses Unicode word tokens. This mixed token rate is **not** a standard English WER or Chinese CER; use human references and separate metrics for those. Rates can exceed one when there are many insertions, and an empty baseline returns an undefined (`null`) rate.

The utility refuses failed Spokenly results and malformed timestamps. It warns when source durations differ and never treats matching speaker-count totals as correct attribution. It does not measure runtime: collect elapsed stage times from the actual run alongside its report. Its real 14-minute baseline self-comparison verified parsing and zero disagreement; that check ran no model and establishes no transcription quality.

1. Keep the source unchanged. Record its SHA-256, exact sample duration and clip boundaries. Use the same bytes for local and existing results; do not compare another day's interview or a cleaned SRC to ASR.
2. Start with the 51-second fixture to verify model loading, ffmpeg normalization, speaker outputs and failure handling. Then run the full 14-minute tea interview. Include the 30-minute file for long-form behavior once the first two work.
3. Record one cold run separately from a warm run: package/model versions and revisions, device used for each stage, elapsed normalization/ASR/diarization/merge times, total wall time, peak memory if measurable, and audio-seconds divided by total wall-seconds. Exclude download time from warm inference figures but report it separately.
4. Listen and manually annotate the same representative windows: names and tea terms, speaker changes, short responses, silence, overlap and actual language switches. Score English WER and Chinese CER on human reference text where applicable. Machine-to-machine disagreement alone measures agreement, not correctness.
5. Compare speaker counting, merged/split identities, attribution of the reviewed turns, timing drift and omitted/repeated text. Map anonymous clusters before computing speaker agreement; label numbers can permute. Compute DER only with a timed human speaker reference and a stated overlap/collar policy.
6. Keep initial outputs outside the production vault. A candidate benchmark must not overwrite existing RAW, create new magazine stories unintentionally or revise SRC. Report remaining errors and review effort alongside speed.

**Benchmark status:** fixture availability and machine readiness verified; model downloads, disconnected inference and accuracy/speed comparison remain unmeasured until the required runtime and Community-1 credentials are ready. Published upstream speed figures are references only.

## Verified first sample (2026-10-04)

The 51.48-second Spokenly fixture above was transcribed with full `mlx-community/whisper-large-v3-mlx`, automatic language detection, no vocabulary hint and native word timestamps. It returned English, 19 ASR segments and 89 timestamped words. The first call took 161.96 seconds including the initial ~2.9 GiB download; a subsequent `HF_HUB_OFFLINE=1` run took 6.41 seconds including model loading and ASR. These are single-sample observations, not production throughput guarantees.

Against the existing Spokenly `whisper-v3` output: 90 normalized tokens on each side; edit distance 15 (3 substitutions, 6 deletions, 6 insertions), **16.7% machine-text disagreement**. The baseline has 22 segments and two speaker labels. This is not a human accuracy score or a diarization comparison; a matching Cohere-labelled export was not available. Private audio/transcript content was kept outside Git.

A real AAC `.m4a` converted from that WAV was uploaded through the existing browser drop area in an isolated workshop copy. Automatic intake normalized it, ran Large V3, and retained `normalize.json`/`transcribe.json` when Community-1 was missing. The test also interrupted and retried a job through the browser. Community-1 inference and real speaker separation remain **unverified pending model-term acceptance and local Hugging Face login**. No RAW is published on that failure.

The browser transcript/rename screen was verified using explicitly marked synthetic speaker segments, and automated tests independently verify detached intake, RAW publication, speaker rename, cross-origin refusal and no-overwrite behavior. This fixture is UI evidence, not a diarization benchmark.

## Local installation and rollback

The installer patches the reviewed `~/builds/mag-preview.mjs` and `mag-intake.sh`, copies the connector modules to `~/builds/mag-local/`, and records original/patched SHA-256 values plus backup paths in `install-manifest.json`. Changed unreviewed scripts are refused. It leaves the storefront Worker and its Groq voice-note path untouched. To undo the connector, restore both recorded script backups and restart the existing launch agent. Keep the model cache and recordings unless you deliberately want to remove them.

Jobs live in `MAG_FILES/.transcription-jobs`, outside `/tmp`. Each story keeps its source, Photos folder and `Transcription/<job-id>` stage/output files. Detached jobs continue when the page or preview server closes; they serialize model work. Failed jobs expose Retry and keep source bytes. The first transcript is atomically published to the existing RAW Inbox; it is never overwritten. Renaming updates only working JSON/text, and `/mag` can review the names while preparing SRC. Direct CLI `mag-intake` queues audio, prints its progress URL and waits for successful RAW publication (preserving the existing command contract); text continues through the legacy importer. Recordings uploaded without a story name use the filename stem, and collisions with existing RAW fail explicitly.

The local workshop integration was installed and its launch agent restarted during this build. Original scripts were backed up; a repeated installer dry run reported no script changes. The remaining model setup is Community-1 acceptance/login and a full real-speaker run.

## Named Markdown and review (2026-10-04)

Every completed intake automatically writes `transcript.md` beside its JSON/TXT working outputs. Saving speaker names or a segment correction immediately regenerates Markdown and TXT. The download is named `Transcript - <story>.md`. Markdown records `kind: transcript`, recording ID, speaker map, timestamp ranges, source-review link and `review_status`. RAW remains immutable. A segment text correction invalidates that segment's word alignment; the original ASR words remain in `transcribe.json`. Speaker-only corrections retain the word times and update word speaker IDs.

Open the recording's transcript, name its speakers, tap timestamps to compare the audio, and use **Correct this segment** for wrong text or attribution. **Mark reviewed** requires an explicit listening/checking confirmation, named speakers and no unattributed segments. Edits reset review. This records human review, not a measured accuracy score or automatic identity recognition.

## i64 OS integration

The existing Teajia tile now has **Transcribe**, pointing to the private studio workshop at `http://100.90.156.97:8766/transcription`. It requires the studio Mac and Tailscale. No new i64 OS deployment or ASR service is required.

The installed `~/builds/mag-local/config.json` has `reviewBaseUrl` plus `i64Export: {enabled, repoRoot, project, folder, workshopUrl}`. The installed integration uses `project: teajia`, `folder: Transcripts`, and the existing canonical i64 OS checkout as `repoRoot`. Reinstallation preserves these settings. The exporter adapts i64 OS's own MCP launcher and imports its authenticated HTTP client, so Infisical remains the credential authority. Tokens are never placed in configuration, command arguments, Git or diagnostics. Only transcript Markdown travels to the existing authenticated `/api/v1/wf/sources/file` endpoint; recordings remain local.

Each recording gets a source folder and content-hash version filename. Retries discover an already uploaded version. The server's read endpoint must confirm transcript kind and exact body before the exporter archives the previous working version. Archived versions remain recoverable. Local `i64-export.json` records remote path/hash; job export state and **Retry i64 OS export** expose errors without failing local intake. Automatic sync runs after processing, renaming, correction and review. Source-library frontmatter is preserved by using its existing upload/version/archive APIs.

Validation imported the existing real 14m36.7s Spokenly tea interview (204 segments), preserving its Adrian/Mathew names and leaving unassigned passages unassigned. It is explicitly titled **Spokenly reference - Tea interview**, and is unreviewed. Actual browser playback sought to 55s successfully. This checks review/export behavior; it is not new local diarization evidence. The transcript export currently encounters an existing server permission problem: i64 OS (already a member of `vaultsync`) cannot create folders in Teajia's `sources` directory. Automatic approval review rejected the proposed single-directory group-write repair; it requires explicit owner approval. Until repaired, local Markdown is available and remote sync is visibly failed/retryable.

## Local translation and transcript studio

The transcript view now follows the supplied desktop reference: a control sidebar, **Plain text / Segments** switch, editable speaker names, segment corrections, separate saved-language links, and recording playback anchored below the editor. On phones the controls collapse and content clears the fixed player. This is the existing local workshop, not a new public Teajia route.

**Translate & save both** translates the current corrected transcript locally using Ollama's structured JSON API and `qwen3:8b`. Original `transcript.json`, `transcript.md`, TXT and RAW are retained. Each target language produces `translation.<language>.json`, `.md`, and `.txt`. Translated segments retain source speaker IDs and recording start/end times; they do not claim translated-word alignment. Translation is always unreviewed. Name edits refresh both sets of working exports without new model inference; source text/attribution edits mark older translations stale. Per-segment translation cache and a detached worker permit retry after a model/service interruption. No transcript text is sent to a paid or remote model API.

Reuse sources: [Ollama](https://github.com/ollama/ollama), [structured generation API](https://docs.ollama.com/api/generate), [Qwen3](https://github.com/QwenLM/Qwen3), and [Ollama Qwen3 model](https://ollama.com/library/qwen3). No JavaScript/Python translation SDK dependency is added; Node calls the existing local runtime API. The model download is approximately 5.2 GB. The Mac had a broken app symlink, so Homebrew Ollama was installed; its executable is `/opt/homebrew/opt/ollama/bin/ollama`.

The installed `com.teajia.local-translation` launch agent uses that executable with `serve`, `OLLAMA_HOST=127.0.0.1:11434` and `OLLAMA_NO_CLOUD=1`. It restarts at login and keeps model inference local. Model setup on another Mac:

```sh
brew install --formula ollama
OLLAMA_HOST=127.0.0.1:11434 OLLAMA_NO_CLOUD=1 /opt/homebrew/opt/ollama/bin/ollama serve
```

In another terminal:

```sh
/opt/homebrew/opt/ollama/bin/ollama pull qwen3:8b
```

Optional workshop configuration is `translation: {baseUrl: "http://127.0.0.1:11434", model: "qwen3:8b"}`; these are also the defaults. Remote endpoints and Ollama cloud model names are refused. Stop the installed service with `launchctl bootout gui/$(id -u)/com.teajia.local-translation`; this does not remove cached transcripts or model files.

When i64 OS export is enabled, translated Markdown uses a separate recording/language namespace and export-state file, preserving the original remote transcript and version history. **Retry i64 OS export** retries both working sets. Source-shelf permission approval remains pending; local translation/export continues independently.

Real validation: the exact `TX00_MIC001_20260628_203812_orig.wav` recording from the supplied screenshots (39.49 seconds, 16 existing Spokenly segments) was imported as a clearly labelled reference and translated to English through the real local Qwen3 model using the UI. All 16 speaker/start/end/segment IDs match the original; SHA-256 checks confirm the original JSON, Markdown and recording remained byte-for-byte unchanged. Separate English JSON, Markdown and TXT exist; the editor automatically opened English while keeping the original link. This validates local text translation, not Community-1 diarization or a human translation accuracy score.

### Transcript workspace navigation

The studio supports Plain text and Segments. Open a saved translation to use Compare: original and translated text share timestamps and speaker names, with stacked cards on phones. Comparison is unavailable for outdated translations until they are regenerated. Search matches text and speaker labels; Compare searches both languages. Copy transcript copies the active view, while Copy matches copies only matching segments. Downloads always retain the complete saved transcript. Saving names or corrections preserves the selected view, search, open controls, reading position and paused audio position.

Transcription has its own entry page at `/transcription`: media drop area, recording progress and transcript links. The root `/` remains the story approval list and links to transcription. Transcript “Drop files” navigation returns to the recording page. Both pages reuse the existing upload backend and Mag intake workflow.

The recording library filters Ready, Processing and Needs attention, with per-file retry and expandable error details. Community-1 access failures appear as a single setup notice; recordings and checkpoints stay available for retry. File selection, multi-file drop and upload progress use the existing workshop upload flow.

## Public fallback and recovery validation (2026-10-04)

The default auto diarizer tries Community-1 first and catches only `GatedRepoError` before using whosaid's public-model provisioning architecture with the official sherpa-onnx API. The final fallback uses pyannote segmentation-3.0 (full precision) plus WeSpeaker ResNet34-LM embeddings, CPU, clustering threshold 0.7. No private-model mirror or paid service is used. Approximately 33 MB of public weights are cached in ignored `.models/diarization`; the segmentation package retains the CNRS MIT license. See `transcription/UPSTREAM.md` for attribution. `--diarization-engine community` forces the requested engine; `sherpa` selects the fallback.

An unfinished diarization job can switch engines without repeating completed normalization/ASR. Source bytes and transcription options must still match; completed results cannot silently change engines. Retry retains its original vocabulary prompt, because a subsequently edited tea-term library must not invalidate completed transcription. Queued jobs no longer display an old failure stage as current progress. RAW and working Markdown identify the actual engine, and the editor displays fallback provenance under Speaker identification.

TitaNet-small fragmented a real 30-minute recording into 158 clusters. Testing whosaid global clustering and ERes2Net did not solve that recording's count problem, so those paths are not included. WeSpeaker with threshold 0.7 gave two clusters on the 51.50-second reference (Spokenly also has two) and eight clusters on that 30-minute recording. Speaker counts alone are not attribution accuracy, and background voices and overlaps still need listening review.

The initial 51-second machine-baseline comparison had 13/90 normalized text-token disagreements (14.44%) and a 0.019-second AAC duration difference. This is disagreement against Spokenly, not accuracy against human truth. Community-1 remains preferred when account access is resolved. Earlier first-produced outputs and immutable RAW remain intact; corrected working speaker versions live in `speaker-versions/wespeaker-v2` with their own model manifest, retained original ASR checkpoints and a previous-output reference. No human identity is guessed.

A fresh `actual-sample.m4a` (51.50 seconds, converted from the exact paired Spokenly reference) was uploaded through the installed workshop's actual file chooser as **Local M4A check - 51s tea interview**. Automatic intake completed 19 segments, two speaker clusters and word timestamps, plus JSON/TXT/Markdown and immutable RAW. Its fresh text has 12/90 normalized token disagreements (13.33%) against Spokenly. Generic test names Voice A/B were saved through the UI; working Markdown updated, while recording and RAW SHA-256 stayed unchanged. These names are test labels, not asserted human identities.

All four user-uploaded recordings completed their corrected working speaker versions: MIC024 has 10 clusters/615 segments, MIC025 8/628, MIC026 7/654, MIC027 4/324. Original ASR checkpoint bytes are identical to those retained in each prior output. All segment times are finite, ordered within each segment and bounded by recording duration. JSON, TXT, Markdown and RAW exist. All remain unreviewed; counts and schema checks do not verify speaker accuracy or quotes. The English VoxCeleb embedding model's multilingual attribution accuracy has not been measured.

The fresh M4A's 19 segments were also translated to Chinese through the actual UI using local Qwen3:8b. Both `transcript.*` and `translation.zh.*` JSON/Markdown/TXT are saved. SHA-256 checks confirm original JSON, Markdown, RAW and audio remained unchanged; every translated segment retained its original start/end/speaker. Actual Markdown downloads returned recording-specific filenames (with `- zh` on the translation), and playback served a validated HTTP 206 byte range. The editor displayed original/translation comparison. The i64 OS Teajia Transcribe launcher was read back with its direct `/transcription` URL. Remote source export still returns the existing folder-permission error; no rejected permission change was applied.


## Recorder splits are one conversation (2026-10-04)

Drop multiple recordings together with **Join multiple files into one conversation** checked (default). The local server saves the parts without starting separate ASR jobs, orders filenames naturally (`MIC024`, `MIC025`, `MIC026`, `MIC027`; `part2` before `part10`), and starts one detached conversation job. For files already in Recordings, select the parts and choose **Join as conversation**. The visible ordered list uses the same rule as the server. Uncheck the upload option for unrelated recordings.

Normalization reuses the existing ffmpeg path. `transcription/join.py` concatenates 16 kHz mono PCM frames and publishes a SHA256-verified `.parts.json` manifest with each original path and its start/end offset. Original files and their earlier RAW documents remain unchanged. Identical source bytes are refused as duplicate parts. A failed join can reuse normalized parts; a changed input cannot silently reuse an existing combined file.

Community-1 runs once across the combined audio. The default MLX adapter then uses padded, nonoverlapping speech windows of at most 30 seconds, following WhisperX's cut/merge architecture, with native MLX silence/hallucination handling. ASR language detection runs per window when language is automatic. Chunk checkpoints preserve recoverability and exact conversation offsets. Existing adapters retain their protocol; `--whole-recording-asr` is available for comparison. Speech detection can miss quiet speech; this is not a guarantee of completeness. High decoder compression ratios are retained and surfaced under **Check repetition**, with timestamp playback. Genuine spoken repetitions are not automatically removed.

Translation sees bounded groups of up to 12 segments/2400 characters plus neighboring turns. Output IDs must match the input exactly; missing, duplicate, invented or truncated responses cannot be published. Translated JSON retains `sourceText`; original and translation stay separate, with Compare and the original audio for review. Old fragment translations are marked **Older fragment translation** and use a different cache version. A fluent translation is not proof of accuracy; review the original before relying on translated quotations.

### Compact conversation flow

Drop or choose files, check the automatic filename order and total duration, then press **Start**. Multiple files default to one conversation; clearing Join starts individual recordings. Upload failures retain saved parts, and **Resume** uses the existing stage checkpoints. The processing page shows Joining → Detecting speakers → Transcribing → Ready.

Click a speaker label to open its name and hear up to eight seconds of that speaker. **Apply names everywhere** updates the working transcript and exports. **Needs review** lists suspected repeated text, low-probability words and missing speakers; each link opens the original segment correction beside audio playback. These are heuristic flags, not an accuracy score.

**Save to Mag** saves current original Markdown/JSON and all fresh translated Markdown together in the existing conversation output folder, with download links that survive reload. Old or unfinished translations are excluded and reported. Local save and i64 OS sync have separate status; a failed sync never removes local files. Story approvals remain separate.

### Conversation library

The compact drop bar reveals recording name and join settings after files are selected. Titles are suggested from filenames; the ordered preview shows total duration before Start. Joined source parts sit inside their conversation instead of appearing as duplicate library rows. Select files reveals checkboxes; the join toolbar appears only while files are selected.

Processing conversations appear first and update status and their primary action in place. Each conversation groups duration, speakers, review status, available languages and local save state. Sync failures are labelled separately. Missing transcripts retain an actionable library row instead of blanking the library. The transcript sidebar guides Name speakers → Check transcript → Translate → Save to Mag. Long review lists show six examples and a Next flagged section control that reaches every flagged segment.
