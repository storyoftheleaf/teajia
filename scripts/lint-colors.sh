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

check_pattern_notice() {
  local pattern="$1"
  local message="$2"
  local exclude="${3:-}"  # optional grep -v pattern to exclude false positives
  local matches

  # Use grep -E (POSIX extended regex, works on macOS BSD grep).
  # Notice checks intentionally do NOT use -P (PCRE) since macOS grep lacks it
  # and we don't need lookbehinds here — exclusions are handled via pipe instead.
  if [ -n "$exclude" ]; then
    matches=$(grep -rn --include='*.tsx' --include='*.ts' -E "$pattern" "$SRC_DIR" 2>/dev/null \
              | grep -v "$exclude" || true)
  else
    matches=$(grep -rn --include='*.tsx' --include='*.ts' -E "$pattern" "$SRC_DIR" 2>/dev/null || true)
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

# ── Progressive checks (non-blocking) ─────────────────────────────────────────
# These catch existing violations that are too numerous to fix at once.
# They print a NOTICE but do NOT increment $ERRORS or fail the build.
# Track the NOTICES count and reduce it to zero over time.

# 5. Hardcoded rgba() inside className attributes
#    Lines where rgba( appears only after style= are excluded (intentional).
#    Comment-only lines (//) are excluded via the exclude argument.
check_pattern_notice 'className=.*rgba\(' \
  "Hardcoded rgba() in className — use a semantic token instead. (non-blocking)" \
  '^\s*//'

# 6. Hardcoded hex colors in Tailwind bracket notation
#    e.g. text-[#4a3728], bg-[#fff], border-[#333]
check_pattern_notice '(text|bg|border|ring|from|to|via|fill|stroke)-\[#[0-9a-fA-F]' \
  "Hardcoded hex in Tailwind bracket notation — use a semantic token instead. (non-blocking)" \
  '^\s*//'

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
