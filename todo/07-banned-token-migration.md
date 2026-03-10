# TODO 07: Migrate Banned Color Tokens Across 49 Files

> **Branch progress:** Design system plan exists on `claude/teajia-palettes-design-KozBZ` and admin audit on `claude/airtable-design-analysis-QFXcz`. Full token migration still needed.

**Priority:** P2 — MEDIUM
**Impact:** Theme reliability, dark/light mode correctness
**Effort:** Medium (3–5 days)
**Category:** Design System

---

## Problem

49 files use legacy color token aliases that have misleading names and cause theme bugs:

| Banned Token | Why It's Dangerous | Replace With |
|---|---|---|
| `tea-ink` | Maps to `var(--tea-text)` — is **cream** in dark mode, not "ink" | `tea-text` |
| `tea-paper` | Hardcoded `#ede4d4` — does **not** adapt to theme | `tea-bg` or `tea-text` |
| `tea-seal` | Just an alias for `tea-gold` | `tea-gold` |
| `tea-charcoal` | Maps to `var(--tea-bg)` — is **parchment** in light mode | `tea-bg` |
| `tea-muted` | Just an alias for `tea-text-dim` | `tea-text-dim` |
| `tea-beige` | Just an alias for `tea-elevated` | `tea-elevated` |

Also: `border-white` and `border-black` (4 instances) should use `border-tea-border`.

## Known Violators (High Priority)

| File | Token Used | Line |
|------|-----------|------|
| `src/components/Shop.tsx` | `border-tea-seal/30`, `text-tea-ink`, `bg-tea-seal` | 162, 165, 172 |
| `src/components/BottomTabBar.tsx` | `text-tea-paper/60` | 72 |
| `src/components/shop/CollectionTab.tsx` | Various legacy tokens | Multiple |

## Approach

### Step 1: Find All Instances
```bash
grep -rn "tea-ink\|tea-paper\|tea-seal\|tea-charcoal\|tea-muted\|tea-beige" src/ --include="*.tsx" --include="*.ts"
grep -rn "border-white\|border-black" src/ --include="*.tsx" --include="*.ts"
```

### Step 2: Replace by File
For each file, replace tokens per the mapping table above. **Do not blindly find-and-replace** — some usages may need context-specific replacements:
- `bg-tea-ink` (expecting dark) → probably `bg-tea-bg` (not `bg-tea-text`)
- `text-tea-paper` (expecting light text) → probably `text-tea-text`
- `border-tea-seal` → `border-tea-gold`

### Step 3: Verify Each Replacement
Toggle dark/light mode on the affected page. Check that:
- Text is readable against its background
- Borders are visible but subtle
- The component looks correct in BOTH themes

### Step 4: Remove Legacy Aliases (Optional)
Once all usages are replaced, remove the legacy aliases from `tailwind.config.ts` and `index.html` inline config to prevent future use.

## Verification

- `grep -rn "tea-ink\|tea-paper\|tea-seal\|tea-charcoal" src/` returns 0 results
- All pages render correctly in both dark and light themes
- No invisible text or invisible borders in either theme

## Related Issues

- #06 (rgba remediation — overlapping files, can be done together)
