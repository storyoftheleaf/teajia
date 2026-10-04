import argparse
import json
import sys
from .adapters import DEFAULT_MODEL, MLXWhisperAdapter, CommunityDiarizationAdapter, DIARIZATION_MODEL
from .pipeline import process
from .sherpa import PreferredDiarizationAdapter, SherpaDiarizationAdapter


def main(argv=None):
    parser = argparse.ArgumentParser(description="Local Whisper Large V3 transcription and speaker separation")
    commands = parser.add_subparsers(dest="command", required=True)
    command = commands.add_parser("process")
    command.add_argument("input")
    command.add_argument("--output", required=True)
    command.add_argument("--language", help="Whisper language code; omitted means automatic detection")
    command.add_argument("--prompt", help="Optional domain vocabulary or proper names")
    command.add_argument("--model", default=DEFAULT_MODEL, help="MLX model repository or local model directory")
    command.add_argument("--whole-recording-asr", action="store_true", help="Disable detected-speech windows for comparison; default diarizes the conversation first")
    command.add_argument("--diarization-model", default=DIARIZATION_MODEL)
    command.add_argument("--diarization-device", choices=["auto", "mps", "cpu"], default="auto")
    command.add_argument("--diarization-engine", choices=["auto", "community", "sherpa"], default="auto")
    args = parser.parse_args(argv)
    community = CommunityDiarizationAdapter(args.diarization_model, args.diarization_device)
    diarizer = community if args.diarization_engine == "community" else SherpaDiarizationAdapter() if args.diarization_engine == "sherpa" else PreferredDiarizationAdapter(community)
    try:
        process(args.input, args.output, language=args.language, prompt=args.prompt,
                asr=MLXWhisperAdapter(args.model, speech_gating=not args.whole_recording_asr),
                diarizer=diarizer,
                on_progress=lambda event: print(json.dumps(event), file=sys.stderr, flush=True))
    except KeyboardInterrupt:
        return 130
    except Exception as error:
        # The persisted progress carries the redacted detail; avoid printing raw model exceptions.
        print(f"Transcription failed ({type(error).__name__}); see progress.json in the output directory.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
