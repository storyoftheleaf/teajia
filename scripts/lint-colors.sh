#!/usr/bin/env bash
# lint-colors.sh: Enforces COLOR_RULES.md at build time.
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

  # POSIX ERE (BSD-grep compatible), no lookarounds. Use this for rules that
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
#    DesignSystemShowcase.tsx is excluded by path, it renders the banned form
#    inside <code> samples to document what NOT to do (same as Rule 7).
BORDER_OPACITY_VIOLATIONS=$(grep -rn --include='*.tsx' --include='*.ts' \
  -E 'border-tea-border/[0-9]' "$SRC_DIR" 2>/dev/null \
  | grep -v 'src/pages/DesignSystemShowcase.tsx' \
  || true)
if [ -n "$BORDER_OPACITY_VIOLATIONS" ]; then
  echo ""
  echo "COLOR RULE VIOLATION: Never add opacity to border-tea-border. Use border-tea-border alone."
  echo "$BORDER_OPACITY_VIOLATIONS"
  ERRORS=$((ERRORS + 1))
fi

# 2. border-tea-gold as structural DIVIDER (border-t/border-b with gold, not interactive)
#    Gold borders on cards/badges/decorative elements are intentional design choices.
#    But dividers (border-t, border-b) should always use border-tea-border.
#    Excluded by path, the regex can't see JSX conditionals, so these documented
#    cases would false-positive forever:
#      - Active-tab underlines toggled via ternaries (COLOR_RULES allows gold on
#        active state): TeaInventory, TaxonomyChipPicker, EventForm/BasicInfoSection,
#        EventForm/CreateWizard, PlatformAccessView, TeaCompass capture-option tabs.
#      - Intentional gold-emphasis surfaces (badge-like, not dividers):
#        GlobalSearch header, AdminApp impersonation banner.
#      - DesignSystemShowcase documents the patterns.
#    The rule still applies everywhere else, don't add new files here without
#    the same justification.
GOLD_DIVIDER_VIOLATIONS=$(grep -rn --include='*.tsx' --include='*.ts' \
  -P '(?<!focus:)(?<!hover:)(?<!active:)border-(t|b) border-tea-gold' "$SRC_DIR" 2>/dev/null \
  | grep -v 'src/components/TeaInventory.tsx' \
  | grep -v 'src/admin/components/tasting/TaxonomyChipPicker.tsx' \
  | grep -v 'src/admin/components/EventForm/sections/BasicInfoSection.tsx' \
  | grep -v 'src/admin/components/EventForm/CreateWizard.tsx' \
  | grep -v 'src/admin/views/PlatformAccessView.tsx' \
  | grep -v 'src/components/shared/GlobalSearch.tsx' \
  | grep -v 'src/components/TeaCompass/index.tsx' \
  | grep -v 'src/admin/AdminApp.tsx' \
  | grep -v 'src/pages/DesignSystemShowcase.tsx' \
  || true)
if [ -n "$GOLD_DIVIDER_VIOLATIONS" ]; then
  echo ""
  echo "COLOR RULE VIOLATION: Don't use border-tea-gold for dividers. Use border-tea-border."
  echo "$GOLD_DIVIDER_VIOLATIONS"
  ERRORS=$((ERRORS + 1))
fi

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
# Intermediate region excludes quotes, braces, and ':', so hover:/focus:/dark: variants
# won't trigger false positives. Requires both tokens to be base classes on the same element.
check_pattern_ere 'bg-tea-gold(-lt)?[[:space:]][^"'"'"'`{}:]*text-tea-gold(-lt)?([[:space:]"'"'"'`]|$)' \
  "Gold-on-gold combo detected (bg-tea-gold[-lt] + text-tea-gold[-lt]). Unreadable in both modes, see COLOR_RULES.md."
check_pattern_ere 'text-tea-gold(-lt)?[[:space:]][^"'"'"'`{}:]*bg-tea-gold(-lt)?([[:space:]"'"'"'`]|$)' \
  "Gold-on-gold combo detected (text-tea-gold[-lt] + bg-tea-gold[-lt]). Unreadable in both modes, see COLOR_RULES.md."

# ── Progressive checks ────────────────────────────────────────────────────────

# 5. Hardcoded rgba() in className utility brackets, non-blocking notice.
#    Most legitimate uses (shadow-[...], style={{ boxShadow: rgba(...) }}, decorative
#    multi-stop gradients per COLOR_RULES.md Rule 2 exception) are excluded; what
#    remains is the long tail Phase C will address. Stays as a NOTICE.
#    Excludes: comment-only lines, `shadow-[` arbitrary shadows (Rule 2 exception),
#    `style=` blocks (boxShadow / inline gradients are inspected per-rule).
check_pattern_notice 'className=.*rgba\(' \
  "Hardcoded rgba() in className, use a semantic token instead. (non-blocking)" \
  -e '^[[:space:]]*//' -e 'shadow-\[' -e 'style='

# 6. Hardcoded hex colors in Tailwind bracket notation: BLOCKING.
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
  echo "COLOR RULE VIOLATION: Hardcoded hex in Tailwind bracket notation, use a semantic token."
  echo "$HEX_BRACKET_VIOLATIONS"
  ERRORS=$((ERRORS + 1))
fi

# 7. text-[Npx] for values that have a defined UI text scale stop: BLOCKING.
#    Phase C1 established the ui-N scale (8/9/10/11/12/13/14/15/16/17/20/26/28).
#    Any new occurrence of the old arbitrary form for these px values must
#    use the named class (text-ui-N) instead. Long-tail values (e.g. text-[18px])
#    are allowed since they don't have a scale stop.
#    DesignSystemShowcase.tsx is excluded by path, it renders banned syntax
#    inside <code> samples to document what NOT to do.
TEXT_PX_VIOLATIONS=$(grep -rnE 'text-\[(8|9|10|11|12|13|14|15|16|17|20|26|28)px\]' \
  --include='*.tsx' --include='*.ts' "$SRC_DIR" 2>/dev/null \
  | grep -vE '^[[:space:]]*//' \
  | grep -v 'src/pages/DesignSystemShowcase.tsx' \
  || true)
if [ -n "$TEXT_PX_VIOLATIONS" ]; then
  echo ""
  echo "COLOR RULE VIOLATION: Use the UI text scale (text-ui-N) instead of text-[Npx], see designTokens.ts UI_TEXT_SCALE."
  echo "$TEXT_PX_VIOLATIONS"
  ERRORS=$((ERRORS + 1))
fi

# 8. Off-scale corner radius: BLOCKING.
#    Canonical scale is rounded-md (control) / rounded-xl (container) / rounded-full (pill).
#    See UI_CONSISTENCY.md. rounded-sm / rounded-lg / rounded-2xl are retired.
check_pattern_ere 'rounded(-(t|b|l|r))?-(sm|lg|2xl)([[:space:]"'"'"'`]|$)' \
  "Off-scale corner radius, use rounded-md / rounded-xl / rounded-full. See UI_CONSISTENCY.md."

# 9. .pill-primary / .pill-destructive used outside a toggle context: BLOCKING.
#    Action buttons must use <Button>. .pill-* is for toggle chips/filters only.
check_pattern_ere 'pill-(primary|destructive)' \
  "pill-* action class, use the <Button> component for actions. See UI_CONSISTENCY.md."

# 10. Colour literals inside a JSX inline style object.
#
#     Every rule above this one reads className strings, so an inline style has
#     been the standing blind spot: `style={{ color: '#a65d4e' }}` renders the
#     same defect the lint blocks one attribute over, and passes. Rounds six and
#     seven each closed one component by hand for exactly this reason (the shop
#     card's stock colours, the profile strip's eight category hexes). Closing
#     the components one at a time does not close the class, so the check reads
#     inside the style object now.
#
#     Line-based grep cannot do this: a style object spans lines and `background`
#     is an ordinary word elsewhere. The scanner below tracks brace depth from
#     each `style={{` and only inspects what is inside one, which is why it is
#     awk rather than another check_pattern call.
#
#     What is exempt, and how to claim it:
#
#       * `var(--token)` and `rgb(var(--token-rgb) / a)` are the correct forms
#         and are never flagged.
#       * A colour that IS data about the item, rather than styling applied to
#         it, is a genuine exception: the liquor colour of a tea is what the
#         liquid looks like in the cup, and it does not adapt to a theme any
#         more than a photograph does. Mark those lines `color-data` in a
#         comment on the same line, saying what the datum is.
#       * A whole file that renders an artifact leaving the app (a PNG export, a
#         PDF) has no theme to adapt to and cannot resolve custom properties at
#         rasterisation time. Put `@color-literals` in the file's header comment
#         with the reason. See components/tasting/TastingCard.tsx.
#
#     BLOCKING on the shop surfaces, which are the ones this rule was built out
#     of and which are clean. A NOTICE everywhere else: 505 lines across ~70
#     files predate the rule, most of them decorative art direction in
#     src/pages/read/*, and silently widening the blast radius of a new rule to
#     force a sweep nobody scheduled is how a lint gets disabled. The blocking
#     path list is the ratchet: extend it as each area is cleared.
INLINE_STYLE_SCANNER='
function scan(seg, file, ln) {
  if (seg ~ /color-data/) return
  if (fileExempt) return
  gsub(/(rgba?|hsla?)\([^()]*var\([^()]*\)[^()]*\)/, "", seg)
  gsub(/var\(--[a-zA-Z0-9_-]+\)/, "", seg)
  if (seg ~ /#[0-9a-fA-F]{3}/ || seg ~ /rgba?\(/ || seg ~ /hsla?\(/)
    printf "%s:%d:%s\n", file, ln, seg
}
FNR == 1 { instyle = 0; fileExempt = 0 }
/@color-literals/ { fileExempt = 1 }
{
  line = $0
  if (instyle > 0) {
    seg = line
    n = gsub(/\{/, "{", line); m = gsub(/\}/, "}", line)
    scan(seg, FILENAME, FNR)
    instyle += n - m
    if (instyle < 0) instyle = 0
    next
  }
  idx = index(line, "style={{")
  if (idx > 0) {
    rest = substr(line, idx + 7)
    seg = rest
    n = gsub(/\{/, "{", rest); m = gsub(/\}/, "}", rest)
    scan(seg, FILENAME, FNR)
    instyle = n - m
    if (instyle < 0) instyle = 0
  }
}'

# `@color-literals` is read on any line, but awk sees a file top to bottom, so a
# marker in a header comment only exempts what follows it. That is the intended
# reading: the marker documents the file, and every file that uses it puts it in
# the header.
INLINE_STYLE_HITS=$(find "$SRC_DIR" \( -name '*.tsx' -o -name '*.ts' \) -print0 \
  | xargs -0 awk "$INLINE_STYLE_SCANNER" 2>/dev/null || true)

# The ratchet. Paths listed here fail the build; everything else reports.
#
# Round nine added three entries. `src/components/shared/` and
# `src/components/reader/` were cleared by hand: 26 lines, and 12 of them were
# the same bug, a `var(--color-tea-gold, #c9a84c)` fallback naming a custom
# property the palette has never declared, so seven reader components had always
# painted the fallback in both themes.
#
# `src/pages/read/` is the other kind of entry. Its 363 lines are not fixed,
# they are claimed: every file there now carries `@color-literals` with a
# reason, because the Read section is one always-dark editorial surface with its
# own scoped palette. Blocking the directory does not touch those files. It
# means the next file added to it has to make the same claim on purpose instead
# of inheriting the exception by being in the right folder.
INLINE_STYLE_ENFORCED='^src/components/shop/|^src/components/tasting/|^src/components/wisdom/|^src/components/shared/|^src/components/reader/|^src/pages/read/|^src/pages/ProductPage\.tsx|^src/components/Shop\.tsx|^src/components/TeaInventory\.tsx'

INLINE_STYLE_BLOCKING=$(printf '%s\n' "$INLINE_STYLE_HITS" | grep -E "$INLINE_STYLE_ENFORCED" || true)
INLINE_STYLE_REST=$(printf '%s\n' "$INLINE_STYLE_HITS" | grep -vE "$INLINE_STYLE_ENFORCED" | grep -v '^$' || true)

if [ -n "$INLINE_STYLE_BLOCKING" ]; then
  echo ""
  echo "COLOR RULE VIOLATION: Hardcoded color inside an inline style. Use a token, or mark it 'color-data' / '@color-literals' with a reason. See COLOR_RULES.md Rule 11."
  echo "$INLINE_STYLE_BLOCKING"
  ERRORS=$((ERRORS + 1))
fi

if [ -n "$INLINE_STYLE_REST" ]; then
  echo ""
  echo "NOTICE: $(printf '%s\n' "$INLINE_STYLE_REST" | wc -l | tr -d ' ') hardcoded color(s) inside inline styles outside the enforced paths (non-blocking). Top offenders:"
  printf '%s\n' "$INLINE_STYLE_REST" | cut -d: -f1 | sort | uniq -c | sort -rn | head -8
  NOTICES=$((NOTICES + 1))
fi

# 11. The hand-written solid-CTA pairing.
#
#     `bg-tea-gold` with `text-tea-bg` is cream on bronze. In dark mode that is
#     4.84:1 and clears AA. In light mode the same two tokens resolve to #f4ec e0
#     on #8e6d2e, which is 4.10:1, under the floor, on whatever the surface calls
#     its primary action. Round eight measured it on the shop's buy button and
#     fixed it there with `--tea-gold-solid` and the `.cta-solid` class. Round
#     nine found the same pairing spelled out by hand 101 more times, including
#     in the shared `<Button variant="primary">`, which meant the one surface
#     that had been fixed was the only one that was right.
#
#     Reading is per quoted string rather than per line, because a row with a
#     Cancel and a Save on it is two class lists and only one of them is the
#     button. A string that names both tokens as whole classes is the defect.
#
#     Same ratchet as rule 10: blocking on the paths that are clean, a notice
#     with a count everywhere else. The remainder is almost all src/admin and
#     src/pages, which round nine did not own.
CTA_PAIR_SCANNER='
{
  line = $0
  if (line ~ /^[[:space:]]*(\/\/|\*|#)/) next
  n = split(line, seg, /["'"'"'`]/)
  for (i = 1; i <= n; i++) {
    s = " " seg[i] " "
    if (s ~ /[ ]bg-tea-gold(-lt)?[ ]/ && s ~ /[ ]text-tea-bg[ ]/)
      printf "%s:%d:%s\n", FILENAME, FNR, seg[i]
  }
}'
CTA_PAIR_HITS=$(find "$SRC_DIR" \( -name '*.tsx' -o -name '*.ts' \) -print0 \
  | xargs -0 awk "$CTA_PAIR_SCANNER" 2>/dev/null || true)

CTA_PAIR_ENFORCED='^src/components/|^src/pages/ProductPage\.tsx'
CTA_PAIR_BLOCKING=$(printf '%s\n' "$CTA_PAIR_HITS" | grep -E "$CTA_PAIR_ENFORCED" || true)
CTA_PAIR_REST=$(printf '%s\n' "$CTA_PAIR_HITS" | grep -vE "$CTA_PAIR_ENFORCED" | grep -v '^$' || true)

if [ -n "$CTA_PAIR_BLOCKING" ]; then
  echo ""
  echo "COLOR RULE VIOLATION: Hand-written solid-CTA pairing (bg-tea-gold + text-tea-bg) is 4.10:1 in light mode. Use the .cta-solid class, or <Button variant=\"primary\">. See COLOR_RULES.md Rule 12."
  echo "$CTA_PAIR_BLOCKING"
  ERRORS=$((ERRORS + 1))
fi

if [ -n "$CTA_PAIR_REST" ]; then
  echo ""
  echo "NOTICE: $(printf '%s\n' "$CTA_PAIR_REST" | wc -l | tr -d ' ') hand-written solid-CTA pairing(s) outside the enforced paths (non-blocking). Top offenders:"
  printf '%s\n' "$CTA_PAIR_REST" | cut -d: -f1 | sort | uniq -c | sort -rn | head -8
  NOTICES=$((NOTICES + 1))
fi

# 12. Em-dashes, in copy and in comments alike.
#
#     The ban is a project rule and it has never had a check, which is how the
#     stylesheet accumulated 111 of them in its own comments and this script
#     accumulated 20, eight of those inside the error strings it prints at
#     whoever it is correcting. Both files are clear and both are blocking.
#     `src/components/` still holds roughly 510, nearly all in comments, and it
#     is a notice until someone sweeps it.
#
#     Applies to comments as well as strings: the rule is about how this project
#     writes, and a code comment is writing.
#     The character is built with printf rather than typed, so this rule does
#     not report its own source line.
EMDASH=$(printf '\xe2\x80\x94')
EMDASH_ENFORCED_FILES="scripts/lint-colors.sh src/styles/card-utilities.css src/styles/tailwind.css src/styles/reader-animations.css"
EMDASH_BLOCKING=$(grep -nF "$EMDASH" $EMDASH_ENFORCED_FILES 2>/dev/null || true)
if [ -n "$EMDASH_BLOCKING" ]; then
  echo ""
  echo "COPY RULE VIOLATION: em-dash. The project uses periods, commas, colons or parentheses. Applies to comments too."
  echo "$EMDASH_BLOCKING"
  ERRORS=$((ERRORS + 1))
fi

EMDASH_REST=$(grep -rnF --include='*.tsx' --include='*.ts' "$EMDASH" "$SRC_DIR" 2>/dev/null || true)
if [ -n "$EMDASH_REST" ]; then
  echo ""
  echo "NOTICE: $(printf '%s\n' "$EMDASH_REST" | wc -l | tr -d ' ') em-dash(es) in src/ (non-blocking). Top offenders:"
  printf '%s\n' "$EMDASH_REST" | cut -d: -f1 | sort | uniq -c | sort -rn | head -8
  NOTICES=$((NOTICES + 1))
fi

if [ "$ERRORS" -gt 0 ]; then
  echo ""
  echo "=== $ERRORS color rule violation(s) found ==="
  echo "Fix them before committing. See COLOR_RULES.md."
  exit 1
fi

if [ "$NOTICES" -gt 0 ]; then
  echo ""
  echo "=== $NOTICES rgba() or hardcoded hex notice(s) found (not blocking, fix progressively) ==="
fi

echo "All color rules pass."
