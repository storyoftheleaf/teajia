#!/usr/bin/env bash
# lint-colors.sh — Enforces COLOR_RULES.md at build time.
# Fails with non-zero exit if forbidden border/color patterns are found.
#
# Usage:
#   bash scripts/lint-colors.sh          # check all src/
#   bash scripts/lint-colors.sh --fix    # show what to fix (same output, just informational)
#
# To permanently prevent violations, this runs before every `npm run build`.

set -euo pipefail

SRC_DIR="src"
ERRORS=0
NOTICES=0

check_pattern() {
  local pattern="$1"
  local message="$2"
  local matches

  # Use grep -P for Perl-compatible regex (lookbehinds)
  matches=$(grep -rn --include='*.tsx' --include='*.ts' -P "$pattern" "$SRC_DIR" 2>/dev/null || true)
  if [ -n "$matches" ]; then
    echo ""
    echo "COLOR RULE VIOLATION: $message"
    echo "$matches"
    ERRORS=$((ERRORS + 1))
  fi
}

check_pattern_ere() {
  local pattern="$1"
  local message="$2"
  local matches

  # POSIX ERE (BSD-grep compatible) — no lookarounds. Use this for rules that
  # must work reliably inside non-interactive bash (where grep is BSD, not PCRE).
  matches=$(grep -rn --include='*.tsx' --include='*.ts' -E "$pattern" "$SRC_DIR" 2>/dev/null || true)
  if [ -n "$matches" ]; then
    echo ""
    echo "COLOR RULE VIOLATION: $message"
    echo "$matches"
    ERRORS=$((ERRORS + 1))
  fi
}

check_pattern_notice() {
  local pattern="$1"
  local message="$2"
  shift 2
  local matches

  # Remaining args are passed through to a chain of `grep -v` exclusions.
  # Pass them as `-e PATTERN` pairs (one `-e PATTERN` per exclusion).
  matches=$(grep -rn --include='*.tsx' --include='*.ts' -E "$pattern" "$SRC_DIR" 2>/dev/null || true)
  if [ -n "$matches" ] && [ "$#" -gt 0 ]; then
    matches=$(printf '%s\n' "$matches" | grep -v "$@" || true)
  fi
  if [ -n "$matches" ]; then
    echo ""
    echo "NOTICE: $message"
    echo "$matches"
    NOTICES=$((NOTICES + 1))
  fi
}

echo "Checking COLOR_RULES.md compliance..."

# 1. border-tea-border with any opacity modifier
check_pattern 'border-tea-border/[0-9]' \
  "Never add opacity to border-tea-border. Use border-tea-border alone."

# 2. border-tea-gold as structural DIVIDER (border-t/border-b with gold, not interactive)
#    Gold borders on cards/badges/decorative elements are intentional design choices.
#    But dividers (border-t, border-b) should always use border-tea-border.
check_pattern '(?<!focus:)(?<!hover:)(?<!active:)border-(t|b) border-tea-gold' \
  "Don't use border-tea-gold for dividers. Use border-tea-border."

# 3. border-white or border-black
check_pattern 'border-white|border-black' \
  "Never use border-white or border-black. Use border-tea-border."

# 4. Legacy tokens
check_pattern '(bg|text|border)-tea-(ink|paper|seal|charcoal)[^-a-z]' \
  "Legacy token detected. See COLOR_RULES.md for replacements."

# 4b. Gold-on-gold combos (bg-tea-gold[-lt] paired with text-tea-gold[-lt] on same element)
#     The two gold tokens are near-identical, so this combo is unreadable in both modes.
#     Use: bg-tea-gold/10 text-tea-text ring-1 ring-inset ring-tea-gold/40  (subtle badge)
#     Or:  bg-tea-gold text-tea-bg                                         (solid CTA)
#     Matches only when each token is a complete class (next char is space, quote, ` or end).
# Intermediate region excludes quotes, braces, and ':' — so hover:/focus:/dark: variants
# won't trigger false positives. Requires both tokens to be base classes on the same element.
check_pattern_ere 'bg-tea-gold(-lt)?[[:space:]][^"'"'"'`{}:]*text-tea-gold(-lt)?([[:space:]"'"'"'`]|$)' \
  "Gold-on-gold combo detected (bg-tea-gold[-lt] + text-tea-gold[-lt]). Unreadable in both modes — see COLOR_RULES.md."
check_pattern_ere 'text-tea-gold(-lt)?[[:space:]][^"'"'"'`{}:]*bg-tea-gold(-lt)?([[:space:]"'"'"'`]|$)' \
  "Gold-on-gold combo detected (text-tea-gold[-lt] + bg-tea-gold[-lt]). Unreadable in both modes — see COLOR_RULES.md."

# ── Progressive checks ────────────────────────────────────────────────────────

# 5. Hardcoded rgba() in className utility brackets — non-blocking notice.
#    Most legitimate uses (shadow-[...], style={{ boxShadow: rgba(...) }}, decorative
#    multi-stop gradients per COLOR_RULES.md Rule 2 exception) are excluded; what
#    remains is the long tail Phase C will address. Stays as a NOTICE.
#    Excludes: comment-only lines, `shadow-[` arbitrary shadows (Rule 2 exception),
#    `style=` blocks (boxShadow / inline gradients are inspected per-rule).
check_pattern_notice 'className=.*rgba\(' \
  "Hardcoded rgba() in className — use a semantic token instead. (non-blocking)" \
  -e '^[[:space:]]*//' -e 'shadow-\[' -e 'style='

# 6. Hardcoded hex colors in Tailwind bracket notation — BLOCKING.
#    e.g. text-[#4a3728], bg-[#fff], border-[#333]. New violations fail the commit.
#    Documented brand-color literals (WhatsApp #25D366) live in
#    src/components/samples/SampleOrderModal.tsx and are excluded by path.
HEX_BRACKET_VIOLATIONS=$(grep -rn --include='*.tsx' --include='*.ts' \
  -E '(text|bg|border|ring|from|to|via|fill|stroke)-\[#[0-9a-fA-F]' "$SRC_DIR" 2>/dev/null \
  | grep -vE '^\s*//' \
  | grep -v 'src/components/samples/SampleOrderModal.tsx' \
  || true)
if [ -n "$HEX_BRACKET_VIOLATIONS" ]; then
  echo ""
  echo "COLOR RULE VIOLATION: Hardcoded hex in Tailwind bracket notation — use a semantic token."
  echo "$HEX_BRACKET_VIOLATIONS"
  ERRORS=$((ERRORS + 1))
fi

if [ "$ERRORS" -gt 0 ]; then
  echo ""
  echo "=== $ERRORS color rule violation(s) found ==="
  echo "Fix them before committing. See COLOR_RULES.md."
  exit 1
fi

if [ "$NOTICES" -gt 0 ]; then
  echo ""
  echo "=== $NOTICES rgba() or hardcoded hex notice(s) found (not blocking — fix progressively) ==="
fi

echo "All color rules pass."
