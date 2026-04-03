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

if [ "$ERRORS" -gt 0 ]; then
  echo ""
  echo "=== $ERRORS color rule violation(s) found ==="
  echo "Fix them before committing. See COLOR_RULES.md."
  exit 1
fi

echo "All color rules pass."
