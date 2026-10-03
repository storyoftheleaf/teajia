#!/usr/bin/env bash
# mag-intake — turn a Teajia interview recording, or a transcript that already exists,
# into a RAW transcript in the magazine Inbox.
#
#   mag-intake "Title" <recording | transcript> [voice-note] [--lang zh|en|auto] [--terms clay,puerh,...]
#
# A transcript (.txt .md .docx .rtf .srt .vtt) is filed as it is: no whisper, no times unless
# the file has them. A file taken from the Drop folder is MOVED into the story's folder, so Drop
# empties as stories come in; from anywhere else it is copied. The story folder also gets Photos/.
#
# Tea vocabulary: whisper gets a short prompt of tea terms from ~/builds/tea-terms.json
# (the core terms, plus any --terms topic sets first), and RAW's frontmatter lists every
# library term it spotted with its Chinese and pinyin (terms_heard), for /mag's SRC step,
# each marked "on teajia.com", "in the glossary queue" or "not in the glossary yet".
#
# Everything runs on this Mac (ffmpeg + whisper.cpp). Nothing is uploaded.
# The recording is COPIED to the magazine's Files folder (outside every vault);
# the RAW transcript lands in Workflow/0-Inbox/ of the personal vault.
# RAW is never overwritten: if it exists, the script stops.
# Rules for what happens next: Brands/Teajia/Magazine/SYSTEM.md.

set -euo pipefail

BUILD_NAME="mag-intake"
BUILD_TITLE="Magazine intake — recording to RAW transcript"
LOG="$HOME/builds/${BUILD_NAME}.log"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/mag-intake.config"

# ── Colors (auto-off on non-TTY) ─────────────────────────────────────────
if [[ -t 1 ]] && command -v tput >/dev/null 2>&1 && tput colors >/dev/null 2>&1; then
  C_RESET=$'\033[0m'; C_BOLD=$'\033[1m'; C_DIM=$'\033[2m'; C_GREEN=$'\033[32m'; C_RED=$'\033[31m'
  C_YELLOW=$'\033[33m'; C_CYAN=$'\033[36m'; C_MAGENTA=$'\033[35m'; C_GREY=$'\033[90m'
else
  C_RESET=""; C_BOLD=""; C_DIM=""; C_GREEN=""; C_RED=""; C_YELLOW=""; C_CYAN=""; C_MAGENTA=""; C_GREY=""
fi

BUILD_START_TS=$(date +%s)
ts() { date '+%H:%M:%S'; }
stage_run()  { printf '%s[%s]%s %s▶%s  %s%s%s\n' "$C_GREY" "$(ts)" "$C_RESET" "$C_CYAN" "$C_RESET" "$C_BOLD" "$*" "$C_RESET" | tee -a "$LOG"; }
stage_ok()   { printf '%s[%s]%s %s✓%s  %s\n' "$C_GREY" "$(ts)" "$C_RESET" "$C_GREEN" "$C_RESET" "$*" | tee -a "$LOG"; }
stage_fail() { printf '%s[%s]%s %s✗%s  %s%s%s\n' "$C_GREY" "$(ts)" "$C_RESET" "$C_RED" "$C_RESET" "$C_RED" "$*" "$C_RESET" | tee -a "$LOG"; }
stage_done() { printf '%s[%s]%s %s⚑%s  %s%s%s\n' "$C_GREY" "$(ts)" "$C_RESET" "$C_MAGENTA" "$C_RESET" "$C_BOLD" "$*" "$C_RESET" | tee -a "$LOG"; }
stage_warn() { printf '%s[%s]%s %s!%s  %s\n' "$C_GREY" "$(ts)" "$C_RESET" "$C_YELLOW" "$C_RESET" "$*" | tee -a "$LOG"; }
stage_info() { printf '            %s\n' "$*" | tee -a "$LOG"; }
divider() { printf '%s            ────────────────────────────────────────────────────────%s\n' "$C_DIM" "$C_RESET" | tee -a "$LOG"; }
stream_dim() { while IFS= read -r line; do printf '%s            %s%s\n' "$C_DIM" "$line" "$C_RESET"; printf '            %s\n' "$line" >> "$LOG"; done; }
elapsed() { local d=$(( $(date +%s) - BUILD_START_TS )); if (( d >= 60 )); then printf '%dm %02ds' $((d/60)) $((d%60)); else printf '%ds' "$d"; fi; }
fail() {
  stage_fail "$*"
  printf '\n%s%s═══ %s stopped after %s ═══%s\n' "$C_RED" "$C_BOLD" "$BUILD_TITLE" "$(elapsed)" "$C_RESET"
  printf '%sLog: %s%s\n' "$C_GREY" "$LOG" "$C_RESET"
  exit 1
}

WORK=""
cleanup() { [[ -n "$WORK" && -d "$WORK" ]] && rm -rf "$WORK"; }
trap cleanup EXIT

usage() {
  echo "Usage: mag-intake \"Title\" <recording> [voice-note] [--lang zh|en|auto] [--terms clay,puerh]"
  echo "  Title       the story name, e.g. \"Monk in Meoli\""
  echo "  recording   the interview audio (m4a, mp3, wav, mov…), or a transcript (txt, md, docx, rtf, srt, vtt)"
  echo "  voice-note  optional: your own note recorded afterwards"
  echo "  --lang      spoken language of the interview (default: auto-detect)"
  echo "  --terms     tea topic sets to put first in whisper's vocabulary, e.g. clay, puerh, oolong,"
  echo "              dark, ceramics, water (list them all: tea-terms --sets). Default: core terms only"
  exit 1
}

# ── Arguments ────────────────────────────────────────────────────────────
LANG_OPT="auto"; TERMS_OPT=""; POS=()
while (( $# )); do
  case "$1" in
    --lang) LANG_OPT="${2:-}"; shift 2 ;;
    --terms) TERMS_OPT="${2:-}"; shift 2 ;;
    -h|--help) usage ;;
    *) POS+=("$1"); shift ;;
  esac
done
(( ${#POS[@]} >= 2 )) || usage
TITLE="${POS[0]}"; REC="${POS[1]}"; NOTE="${POS[2]:-}"

: > "$LOG"
printf '\n%s%s═══════════════════════════════════════════════════════════════════%s\n' "$C_CYAN" "$C_BOLD" "$C_RESET"
printf '%s%s  %s%s\n' "$C_CYAN" "$C_BOLD" "$BUILD_TITLE" "$C_RESET"
printf '%s%s═══════════════════════════════════════════════════════════════════%s\n\n' "$C_CYAN" "$C_BOLD" "$C_RESET"
echo "=== $BUILD_TITLE === started $(date)" >> "$LOG"

# ── Pre-flight ───────────────────────────────────────────────────────────
stage_run "Checking everything is in place"
# A file dropped from the phone into iCloud Drive may still be a placeholder (".name.icloud"):
# ask iCloud for it and wait, up to ICLOUD_WAIT seconds, rather than failing.
fetch_icloud() {
  local f="$1" ph; ph="$(dirname "$f")/.$(basename "$f").icloud"
  [[ -f "$f" || ! -e "$ph" ]] && return 0
  stage_info "Still downloading from iCloud: $(basename "$f"). Fetching it now."
  brctl download "$f" >/dev/null 2>&1 || true
  local waited=0
  while [[ ! -f "$f" && $waited -lt ${ICLOUD_WAIT:-600} ]]; do sleep 3; waited=$((waited + 3)); done
  [[ -f "$f" ]] && stage_ok "Downloaded from iCloud after ${waited}s"
}
fetch_icloud "$REC"
[[ -n "$NOTE" ]] && fetch_icloud "$NOTE"
[[ -f "$REC" ]] || fail "Recording or transcript not found: $REC"
TEXT=0
case "$(printf '%s' "${REC##*.}" | tr '[:upper:]' '[:lower:]')" in
  txt|md|docx|doc|rtf|srt|vtt) TEXT=1 ;;
  pdf|pages) fail "A $(printf '%s' "${REC##*.}") transcript can't be read here: export it as .txt or .docx first" ;;
esac
NEED_AUDIO=$(( ! TEXT )); [[ -n "$NOTE" ]] && NEED_AUDIO=1
command -v node >/dev/null || fail "node is not installed"
if (( NEED_AUDIO )); then
  for bin in ffmpeg ffprobe whisper-cli; do command -v "$bin" >/dev/null || fail "$bin is not installed"; done
  [[ -f "$WHISPER_MODEL" ]] || fail "Whisper model not found at $WHISPER_MODEL (set WHISPER_MODEL in mag-intake.config)"
fi
[[ -z "$NOTE" || -f "$NOTE" ]] || fail "Voice note not found: $NOTE"
[[ -d "$MAG_VAULT/Workflow/0-Inbox" ]] || fail "Magazine Inbox not found: $MAG_VAULT/Workflow/0-Inbox"
[[ "$TITLE" != */* ]] || fail "Title can't contain a slash"
[[ -f "$TEA_TERMS" ]] || fail "Tea term library not found: $TEA_TERMS"
if [[ -n "$TERMS_OPT" ]]; then
  node "$SCRIPT_DIR/tea-terms.mjs" --prompt --terms "$TERMS_OPT" >/dev/null || fail "Unknown --terms set (see above)"
fi
RAW="$MAG_VAULT/Workflow/0-Inbox/RAW - $TITLE.md"
[[ ! -e "$RAW" ]] || fail "RAW already exists, and RAW is never overwritten: $RAW"
if (( TEXT )); then stage_ok "Transcript and Inbox found (no recording, so no whisper)"; else stage_ok "Recording, model and Inbox found"; fi

# ── Keep the recording (or transcript) outside the vault ─────────────────
stage_run "Keeping the source in the story's own folder, outside the vault"
DEST="$MAG_FILES/$TITLE"; mkdir -p "$DEST/Photos"
is_drop() {  # is this folder one of the drop folders in MAG_DROPS?
  local d="$1" one
  IFS='|' read -r -a _drops <<< "$MAG_DROPS"
  for one in "${_drops[@]}"; do [[ -d "$one" && "$(cd "$one" && pwd)" == "$d" ]] && return 0; done
  return 1
}
keep() {  # into the story folder: moved when it came from a drop folder, copied otherwise; echo the kept path
  local src="$1" base dir; base="$(basename "$src")"; dir="$(cd "$(dirname "$src")" && pwd)"
  if [[ "$dir" == "$DEST" ]]; then echo "$src"; return; fi
  [[ -e "$DEST/$base" ]] && cmp -s "$src" "$DEST/$base" && { echo "$DEST/$base"; return; }
  [[ -e "$DEST/$base" ]] && { echo "A different file named $base is already in $DEST" >&2; return 1; }
  if is_drop "$dir"; then mv "$src" "$DEST/$base"; else cp -p "$src" "$DEST/$base"; fi && echo "$DEST/$base"
}
REC_KEPT="$(keep "$REC")" || fail "Could not keep the recording (see message above)"; stage_ok "Recording: ${REC_KEPT#$HOME/Documents/Files/}"
NOTE_KEPT=""
if [[ -n "$NOTE" ]]; then NOTE_KEPT="$(keep "$NOTE")" || fail "Could not keep the voice note"; stage_ok "Voice note: ${NOTE_KEPT#$HOME/Documents/Files/}"; fi

WORK="$(mktemp -d "${TMPDIR:-/tmp}/mag-intake.XXXXXX")"

# ── Transcribe one file: to_wav + whisper, output "[hh:mm:ss] text" lines ─
# args: input, out-prefix, language, extra whisper flags…
transcribe() {
  local in="$1" out="$2" lang="$3"; shift 3
  ffmpeg -nostdin -loglevel error -y -i "$in" -ar 16000 -ac 1 -c:a pcm_s16le "$WORK/$out.wav" \
    || fail "ffmpeg could not read $(basename "$in")"
  divider
  set +e
  whisper-cli -m "$WHISPER_MODEL" -t "$WHISPER_THREADS" -l "$lang" ${WHISPER_EXTRA_FLAGS:-} ${PROMPT_ARGS[@]+"${PROMPT_ARGS[@]}"} "$@" -f "$WORK/$out.wav" \
    2> "$WORK/$out.err" | tee "$WORK/$out.stdout" | stream_dim
  local rc=${PIPESTATUS[0]}
  set -e
  divider
  (( rc == 0 )) || { tail -5 "$WORK/$out.err" | stream_dim; fail "whisper stopped with code $rc on $(basename "$in")"; }
  # "[00:01:02.340 --> 00:01:05.120]   text"  →  "[00:01:02] text"
  awk '/^\[[0-9][0-9]:[0-9][0-9]:[0-9][0-9]\.[0-9]+ -->/ {
         t = substr($1, 2, 8); sub(/^\[[^]]*\][ \t]*/, ""); if (length($0)) print "[" t "] " $0 }' \
    "$WORK/$out.stdout" > "$WORK/$out.lines"
  [[ -s "$WORK/$out.lines" ]] || fail "whisper produced no text for $(basename "$in")"
}

# Tea vocabulary prompt for whisper, in English or Chinese. Sets PROMPT_ARGS.
PROMPT_ARGS=()
use_prompt() {
  local lang="$1" text
  PROMPT_ARGS=()
  text="$(TEA_TERMS_FILE="$TEA_TERMS" node "$SCRIPT_DIR/tea-terms.mjs" --prompt --lang "$lang" ${TERMS_OPT:+--terms "$TERMS_OPT"})" \
    || fail "Could not build the tea vocabulary prompt"
  PROMPT_ARGS=(--prompt "$text")
  [[ "$WHISPER_CARRY_PROMPT" == "1" ]] && PROMPT_ARGS+=(--carry-initial-prompt)
  stage_info "${C_DIM}Vocabulary: ${text}${C_RESET}"
}

detected_lang() { sed -n 's/.*auto-detected language: \([a-z]*\).*/\1/p' "$WORK/$1.err" | head -1; }
duration_of() { ffprobe -v error -show_entries format=duration -of csv=p=0 "$1" | awk '{printf "%d min", ($1+30)/60}'; }

# ── Interview ────────────────────────────────────────────────────────────
TRANSLATED=0
if (( TEXT )); then
  stage_run "Reading the transcript as it is (nothing is re-heard or changed)"
  case "$(printf '%s' "${REC_KEPT##*.}" | tr '[:upper:]' '[:lower:]')" in
    docx|doc|rtf) textutil -convert txt -stdout "$REC_KEPT" > "$WORK/interview.lines" 2>/dev/null \
                    || fail "Could not read $(basename "$REC_KEPT") (textutil)" ;;
    *) tr -d '\r' < "$REC_KEPT" > "$WORK/interview.lines" ;;
  esac
  [[ -s "$WORK/interview.lines" ]] || fail "The transcript is empty: $(basename "$REC_KEPT")"
  LANG_FOUND="$LANG_OPT"; [[ "$LANG_FOUND" == "auto" ]] && LANG_FOUND="as written"
  PROMPT_LANG="none"
  stage_ok "Transcript read: $(wc -l < "$WORK/interview.lines" | tr -d ' ') lines"
else
PROMPT_LANG="$LANG_OPT"
if [[ "$LANG_OPT" == "auto" ]]; then
  stage_run "Listening to the first 30 seconds to pick English or Chinese tea vocabulary"
  ffmpeg -nostdin -loglevel error -y -t 30 -i "$REC_KEPT" -ar 16000 -ac 1 -c:a pcm_s16le "$WORK/probe.wav" \
    || fail "ffmpeg could not read $(basename "$REC_KEPT")"
  whisper-cli -m "$WHISPER_MODEL" -t "$WHISPER_THREADS" -l auto ${WHISPER_EXTRA_FLAGS:-} -dl -f "$WORK/probe.wav" \
    > /dev/null 2> "$WORK/probe.err" || true
  PROMPT_LANG="$(detected_lang probe)"
  stage_ok "Sounds like: ${PROMPT_LANG:-unknown}"
fi
[[ "$PROMPT_LANG" == "zh" ]] || PROMPT_LANG="en"

stage_run "Transcribing the interview ($(duration_of "$REC_KEPT")). Text streams below as it is heard."
use_prompt "$PROMPT_LANG"
transcribe "$REC_KEPT" interview "$LANG_OPT"
LANG_FOUND="$LANG_OPT"; [[ "$LANG_OPT" == "auto" ]] && LANG_FOUND="$(detected_lang interview)"
LANG_FOUND="${LANG_FOUND:-unknown}"
stage_ok "Interview transcribed: $(wc -l < "$WORK/interview.lines" | tr -d ' ') lines, language: $LANG_FOUND"

if [[ "$LANG_FOUND" != "en" && "$LANG_FOUND" != "unknown" ]]; then
  stage_run "Not English, so also making a rough English version with whisper (marked as machine translation)"
  use_prompt en
  transcribe "$REC_KEPT" translation "$LANG_FOUND" -tr
  TRANSLATED=1
  stage_ok "Rough English version made"
fi
fi

# ── Voice note ───────────────────────────────────────────────────────────
if [[ -n "$NOTE_KEPT" ]]; then
  stage_run "Transcribing your voice note ($(duration_of "$NOTE_KEPT"))"
  use_prompt en
  transcribe "$NOTE_KEPT" note auto
  stage_ok "Voice note transcribed"
fi

# ── Tea terms heard ──────────────────────────────────────────────────────
stage_run "Reading the teajia.com glossary so every term knows whether it is on the site"
if TEA_TERMS_FILE="$TEA_TERMS" node "$SCRIPT_DIR/tea-terms.mjs" --sync > "$WORK/sync.txt" 2>&1; then
  stage_ok "$(head -1 "$WORK/sync.txt")"
else
  stage_warn "Could not read the glossary; using the last copy. $(head -1 "$WORK/sync.txt")"
fi
stage_run "Looking for tea terms from the library in the transcript"
SCAN_FILES=("$WORK/interview.lines")
(( TRANSLATED )) && SCAN_FILES+=("$WORK/translation.lines")
[[ -n "$NOTE_KEPT" ]] && SCAN_FILES+=("$WORK/note.lines")
TEA_TERMS_FILE="$TEA_TERMS" node "$SCRIPT_DIR/tea-terms.mjs" --scan "${SCAN_FILES[@]}" > "$WORK/terms.yaml" \
  || fail "The tea term scan failed"
TERMS_FOUND=$(grep -c '^  - ' "$WORK/terms.yaml" || true)
stage_ok "$TERMS_FOUND tea terms spotted (listed in RAW's frontmatter as terms_heard)"
sed -n '2,6p' "$WORK/terms.yaml" | sed 's/^  - "//; s/"$//' | stream_dim

# ── Write RAW ────────────────────────────────────────────────────────────
stage_run "Writing RAW to the magazine Inbox"
REC_DATE=""
(( TEXT )) || REC_DATE="$(ffprobe -v error -show_entries format_tags=creation_time -of csv=p=0 "$REC_KEPT" | cut -c1-10)"
[[ -n "$REC_DATE" ]] || REC_DATE="$(stat -f %Sm -t %Y-%m-%d "$REC_KEPT")"
rel() { local p="$1"; echo "${p#$HOME/Documents/}"; }
{
  echo "---"
  echo "type: RAW"
  echo "title: \"$TITLE\""
  echo "recorded: $REC_DATE"
  if (( TEXT )); then echo "transcript: \"$(rel "$REC_KEPT")\""; else echo "audio: \"$(rel "$REC_KEPT")\""; fi
  if [[ -n "$NOTE_KEPT" ]]; then echo "voice_note: \"$(rel "$NOTE_KEPT")\""; else echo "voice_note: none"; fi
  echo "photos: \"$(rel "$DEST/Photos")\""
  echo "credit: Adrian Rasmussen"
  echo "language: $LANG_FOUND"
  if (( TEXT )); then echo "transcribed: dropped in as text $(date +%Y-%m-%d); no whisper pass"
  else
    echo "transcribed: $(date +%Y-%m-%d) with whisper.cpp ($(basename "$WHISPER_MODEL"))"
    echo "vocabulary: tea-terms (${TERMS_OPT:-core}; prompt in $PROMPT_LANG)"
  fi
  cat "$WORK/terms.yaml"
  echo "---"
  echo
  echo "# RAW – $TITLE"
  echo
  if (( TEXT )); then
    echo "The transcript as it was dropped in, never edited. Every quote in the story is checked against this. Times appear only if the file had them. Speakers are labelled in SRC by \`/mag\`."
  else
    echo "Machine transcript, never edited. Every quote in the story is checked against this. Speakers are not labelled yet; \`/mag\` does that in SRC."
  fi
  echo
  echo "## Interview"
  echo
  cat "$WORK/interview.lines"
  if (( TRANSLATED )); then
    echo
    echo "## Rough English (whisper machine translation, for orientation only)"
    echo
    cat "$WORK/translation.lines"
  fi
  if [[ -n "$NOTE_KEPT" ]]; then
    echo
    echo "## Adrian's voice note"
    echo
    cat "$WORK/note.lines"
  fi
} > "$RAW"
stage_ok "RAW written"

# ── Footer ───────────────────────────────────────────────────────────────
printf '\n'
stage_done "Done in $(elapsed)"
printf '\n%s%s═══════════════════════════════════════════════════════════════════%s\n' "$C_MAGENTA" "$C_BOLD" "$C_RESET"
printf '  RAW        %s\n' "Brands/Teajia/Magazine/Workflow/0-Inbox/RAW - $TITLE.md"
printf '  Source     %s\n' "$(rel "$REC_KEPT")"
printf '  Next       %sin Claude, type /mag and pick "%s"%s\n' "$C_BOLD" "$TITLE" "$C_RESET"
printf '  Log        %stail -200 %s%s\n' "$C_GREY" "$LOG" "$C_RESET"
printf '%s%s═══════════════════════════════════════════════════════════════════%s\n\n' "$C_MAGENTA" "$C_BOLD" "$C_RESET"
exit 0
