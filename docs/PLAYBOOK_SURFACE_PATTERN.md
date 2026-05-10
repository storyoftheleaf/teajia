# Playbook Surface Pattern

This captures the visual and UX direction established by `/store-launch-playbook`. Use it when a Teajia surface should feel calm, guided, concrete, and easy for a smart nontechnical person to move through.

## Why This Works

The playbook surface works because it does not feel like a dashboard. It feels like a careful operating document that happens to be interactive.

The pattern is useful when a screen asks the user to prepare, capture, review, or complete a sequence of meaningful work.

## Core Traits

1. **Option groups with meaning**
   - Options are grouped by the decision the user is making.
   - Each group has a short sentence explaining the decision.
   - The option label says what the choice means, not just the internal value.
   - Selected options use restrained bronze and a clear border.
   - Unselected options stay quiet: `bg-tea-bg` or `bg-tea-surface`, `border-tea-border`, `text-tea-text-sec`.

2. **Plain-language hero**
   - One direct heading.
   - One short paragraph explaining what the page helps the user do.
   - No feature marketing, no abstract product language.

3. **Numbered orientation**
   - Three small blocks near the top.
   - Each block says what happens in human terms.
   - These are not “features.” They are the user’s mental model.

4. **Concrete action cards**
   - Cards represent real steps, not categories.
   - Each card has a number, title, one sentence, and one link or action.
   - Use icons sparingly. The icon supports the title; it does not carry the meaning.

5. **Grouped detail entry**
   - Forms are grouped by what the user thinks they are doing.
   - Each group has a short explanation.
   - Field labels say what the value is for, not the database name.
   - Hints clarify consequences: who sees this, where it appears, what happens later.

6. **“What must be true” checks**
   - A side panel or bottom panel lists readiness conditions.
   - Checks use practical language.
   - They should answer: “Can I move forward?”

7. **Restrained Teajia styling**
   - `bg-tea-bg` page background.
   - `bg-tea-surface border border-tea-border rounded-md` for panels.
   - Bronze is rare: use it for active/completed/focus, not decoration.
   - Headings use `TYPOGRAPHY_CLASSES`.
   - Avoid pills, heavy badges, dense toolbars, and horizontal scrolling.

## Color And Styling Formula

The playbook look is mostly surface discipline. It is not a new palette.

### Page

Use:
- Page background: `bg-tea-bg`.
- Main content max width: usually `max-w-6xl`.
- Outer spacing: `px-4 py-8 md:px-8 md:py-12`.
- Bottom clearance on public mobile pages: `pb-nav-gap` or `pb-nav-gap-lg`.

Avoid:
- Full-page gradients.
- Decorative glows or orbs.
- Bright bronze backgrounds across large areas.

### Panels

Use:
- `bg-tea-surface border border-tea-border rounded-md`.
- Padding: `p-4`, `p-5`, or `p-6` depending on density.
- `space-y-4` or `space-y-6` for internal rhythm.

Avoid:
- `rounded-xl` and `rounded-2xl` as the default for serious tool surfaces.
- Nested cards inside cards.
- Heavy shadows.
- Opacity-modified `border-tea-border`.

### Inputs

Use:
- `bg-tea-bg border border-tea-border rounded-md`.
- `text-tea-text`.
- `placeholder:text-tea-text-dim`.
- `focus:ring-2 focus:ring-tea-gold/40`.

This creates the “dark well inside quiet panel” look from the playbook.

Avoid:
- Transparent inputs that disappear into the panel.
- Bright filled inputs.
- `text-tea-text/40` for labels or important helper text.

### Option Buttons

Resting:
- `bg-tea-bg`
- `border border-tea-border`
- `text-tea-text-sec`
- `rounded-md`

Hover:
- `hover:bg-tea-accent-sub`
- `hover:text-tea-text`

Selected:
- `bg-tea-accent-sub` or `bg-tea-gold/10`
- `border-tea-gold/30`
- `text-tea-text`
- optional `CheckCircle2` in `text-tea-gold`

Avoid:
- Filled bronze for ordinary selected states.
- Pill shapes for major choices.
- Horizontal scrolling option rows.

### Typography

Use:
- `TYPOGRAPHY_CLASSES.h1`, `h2`, `h3`, `bodyLight`, `label`.
- `text-ui-*` scale for compact UI text.
- Mono only for numbers, counts, codes, URLs, and sequence markers.

Avoid:
- Raw `text-[Npx]` values covered by the named UI scale.
- Display-size type inside compact option controls.
- All-uppercase labels as decoration. Use them for true metadata only.

### Bronze Use

Bronze means state, focus, completion, or primary action.

Use bronze for:
- Selected option border/background.
- Completion checks.
- One primary action.
- Focus rings.

Avoid bronze for:
- Every icon.
- Decorative section accents.
- Large filled panels.
- Multiple competing CTAs.

## Copy Rules

Use:
- “Enter store details”
- “Store access”
- “Customer contact”
- “Opening stock”
- “What must be true”
- “Where each step happens”

Avoid:
- “Fill the worksheet”
- “Configure”
- “Manage”
- “Setup flow”
- “Customer” without context. Say “visitor,” “buyer,” “person placing an order,” or “customer contact path.”
- Fields that look active but do not save to the actual system without saying so.

## Component Shape

Recommended structure:

```tsx
<SurfaceShell>
  <SurfaceHero />
  <OrientationSteps />
  <ActionCards />
  <MainDetailArea>
    <GroupedOptionControls />
    <GroupedFields />
    <ReadinessChecks />
  </MainDetailArea>
</SurfaceShell>
```

The implementation can be local at first. Extract shared primitives only after two or three screens use the pattern successfully.

## Option Control Pattern

This is the most reusable part of the store launch playbook.

Use it anywhere the user chooses between meaningful options: tea type, form, status, capture path, filters, store access preset, event state, inventory visibility.

### Anatomy

Each option group should have:

1. A group title.
2. One sentence explaining the decision.
3. A responsive grid or wrapped row of options.
4. Optional helper text under complex options.
5. A selected state that is obvious but not loud.

```tsx
<section className="bg-tea-surface border border-tea-border rounded-md p-5 space-y-4">
  <div>
    <h2 className={TYPOGRAPHY_CLASSES.h3}>Tea type</h2>
    <p className="text-ui-12 text-tea-text-sec leading-[1.5]">
      Choose the family this tea belongs to. This helps organize tasting notes and inventory later.
    </p>
  </div>
  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
    {options.map(option => (
      <button className={selected ? selectedClass : unselectedClass}>
        <span>{option.label}</span>
        {option.hint && <span>{option.hint}</span>}
      </button>
    ))}
  </div>
</section>
```

### Visual Rules

Use:
- `rounded-md`, not large pill shapes.
- `border border-tea-border` for the resting state.
- `bg-tea-accent-sub` or `bg-tea-gold/10` only for selected or active state.
- `text-tea-text` for selected label.
- `text-tea-text-sec` for resting labels.
- `flex-wrap` or grids. Never horizontal option scrolling.

Avoid:
- `pill` / `pill-active` for important choices.
- Tiny icon-only choices when the consequence is not obvious.
- A selected state that relies on color alone.
- Dense toolbars where every option has the same visual weight.
- Rounded-xl / rounded-2xl for option buttons unless inherited from an older component being migrated gradually.

## First Target: Tea Compass

Tea Compass is the best first candidate because it already has strong function but its visual hierarchy is more tool-like than guided. The goal is not to remove density. The goal is to make the density feel sequenced and intentional.

### Current Friction

Observed files:
- `src/components/TeaCompass/index.tsx`
- `src/components/TeaCompass/CaptureCard.tsx`
- `src/components/TeaCompass/BrowseView.tsx`
- `src/components/TeaCompass/TypeGrid.tsx`
- `src/components/TeaCompass/StatusActions.tsx`
- `src/components/TeaCompass/IntentBar.tsx`
- `src/components/TeaCompass/LedgerView.tsx`
- `src/components/TeaCompass/CompassEntryDetailPanel.tsx`

Primary issues to address:
- Option controls vary by component: `pill`, `rounded-xl`, `rounded-2xl`, underline links, icon tiles, and horizontal filter rows.
- Capture has many powerful choices, but the user is not always told what each choice changes later.
- Browse filters use a horizontal overflow pill row, which conflicts with the new direction.
- Tea type and status choices are visually functional but do not yet feel like the store-launch playbook cards.
- Empty states are good, but should become playbook-style starting points.
- Some panels use rounded/pill/card vocabulary that does not match the launch playbook.

### Tea Compass Direction

Use this mental model:

**Tea Compass is a field notebook for sourcing tea.**

The first screen should answer:
- What am I capturing?
- What do I know already?
- What is missing before this becomes useful?
- What happens after I save it?

Styling translation:
- Replace pill-heavy controls with quiet boxed choices.
- Replace `rounded-xl` / `rounded-2xl` option tiles with `rounded-md` where practical.
- Use `bg-tea-surface` panels with `bg-tea-bg` inputs inside them.
- Use bronze only for selected options, completion, focus, and the primary save/commit action.
- Keep the page dark espresso and restrained; do not introduce a new Compass-specific palette.

### Proposed Tea Compass Structure

1. **Tea type options**
   - Replace `pill` / `pill-active` in `TypeGrid.tsx`.
   - Use a bordered responsive grid.
   - Each option can show the type name and a short hint where helpful.
   - Selected state: bronze check or border plus `bg-tea-accent-sub`.
   - Resting state should look like a quiet option card, not a tag.

2. **Capture status options**
   - Rework Want / Buy / Sample / Taste tiles in `CaptureCard.tsx` and `StatusActions.tsx`.
   - Each option should explain the consequence:
     - Want: remember for later.
     - Buy: add to buying record.
     - Sample: request or track as a sample.
     - Taste: start tasting notes.
   - Keep icons, but do not make the icon the only explanation.
   - Style these like playbook action options: border, short label, short consequence.

3. **Browse filters**
   - Replace horizontal filter pills in `BrowseView.tsx`.
   - Use wrapped option controls with visible counts.
   - Filters should read as states of the library, not tabs.
   - Counts can use mono text. The whole control should not become bronze unless active.

4. **Detected values**
   - Rework `IntentBar.tsx` from tiny underlined text into a small suggestion panel.
   - Example: “Found in notes” with apply/dismiss buttons for price, grams, year.

5. **Capture cards become grouped sections**
   - Tea identity: name, type, form, year, region.
   - Source: vendor, location, photos, contact.
   - Price and quantity: currency, price, grams, shipping.
   - Notes and tasting: voice, written notes, tasting profile.
   - Next action: want, buy, sample, save as draft.

6. **Readiness checks**
   - Has a name or photo.
   - Has a source or vendor note.
   - Has price/quantity if buying.
   - Has tasting notes if ready for library.
   - Can be promoted to draft product.

7. **Ledger view**
   - Reframe as “Buying record.”
   - Use grouped transaction cards with readiness checks: vendor, items, quantities, total, notes.

### First Implementation Pass

Keep scope narrow:

1. Add a playbook-style shell inside `TeaCompass/index.tsx`.
2. Replace `TypeGrid.tsx` pills with playbook-style option cards.
3. Replace `BrowseView` filter pills with a wrapped, bordered control row.
4. Rework Want / Buy / Sample / Taste option tiles in `CaptureCard.tsx`.
5. Rework `IntentBar.tsx` into a suggestion panel.
6. Add a readiness panel beside or below `CaptureCard`.
7. Do not change data behavior.
8. Do not change public navigation or bottom tabs.

### Acceptance Criteria

- No horizontal overflow on mobile.
- Existing capture, browse, ledger, share, and promote flows still work.
- No new route labels or bottom navigation changes.
- `npm run lint`, `npm run lint:colors`, and a mobile browser smoke check pass.
- A nontechnical user can describe the screen as “where I record a tea I found,” not “a form with many controls.”
