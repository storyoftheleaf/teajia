# Launch-to-Real-Use Release 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the private tasting-note curation loop, event-to-photo-essay draft flow, and distinct Journal/Favorites/Cellar member journeys without changing navigation labels or route names.

**Architecture:** Add two small, account-scoped D1 boundaries: tasting-note candidates/public impressions and an event source link on the existing article table. Reuse the existing transcription hook, journal store, article block editor, Favorites model, and API-backed Cellar UI; expose new behavior through focused worker handlers and thin frontend integrations. Release 2 is implemented after Release 1 is green, with migrations applied sequentially and every behavior developed test-first.

**Tech Stack:** React 19, TypeScript, React Router, React Query, Zustand, Tailwind v3 design tokens, Cloudflare Workers, D1/SQLite, Vitest, Playwright.

---

## Scope and file ownership

- `worker/migrations/108_tasting_note_curation.sql` owns the private candidate and published-impression schema.
- `worker/migrations/109_event_article_source.sql` owns the event/article association and idempotency constraint.
- `worker/src/tastingNoteCuration.ts` owns candidate validation and SQL-independent response mapping.
- `worker/src/eventArticleDraft.ts` owns deterministic event-to-article block construction.
- `worker/src/index.ts` wires authenticated, capability-checked handlers and routes only; do not broaden its refactor.
- `src/components/tasting/JournalSectionVoiceNote.tsx` owns section-scoped transcription and star controls.
- `src/admin/components/TastingNoteReviewQueue.tsx` owns promote/edit/dismiss UI.
- `src/pages/CellarPage.tsx` turns the existing `CellarView` into a real route.
- `src/components/account/PersonalTeaLinks.tsx` owns the quiet Journal/Favorites/Cellar cross-links.
- `src/admin/components/EventDetail.tsx` invokes draft creation; `ArticleEditorModal.tsx` remains the sole block editor.
- Do not edit global navigation labels or rename any route. Keep `/account/journal`, `/account/collection`, and the new approved `/account/cellar` path.

### Task 1: Add and rehearse the tasting-note curation schema

**Files:**
- Create: `worker/migrations/108_tasting_note_curation.sql`
- Create: `worker/tests/tasting-note-curation-migration.test.ts`

- [ ] **Step 1: Write the failing migration rehearsal test**

```ts
import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sql = readFileSync(resolve('migrations/108_tasting_note_curation.sql'), 'utf8');

describe('108 tasting-note curation migration', () => {
  it('creates private candidates and separately published impressions idempotently', () => {
    const db = new Database(':memory:');
    db.exec('CREATE TABLE customer_tasting_journal (id TEXT PRIMARY KEY, account_id TEXT, user_id TEXT, product_id TEXT);');
    db.exec('CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT);');
    db.exec(sql);
    db.exec(sql);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map((r: any) => r.name);
    expect(tables).toContain('tasting_note_candidates');
    expect(tables).toContain('product_impressions');
    const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index'").all().map((r: any) => r.name);
    expect(indexes).toContain('idx_tasting_candidates_account_status');
    expect(indexes).toContain('idx_product_impressions_product');
  });
});
```

- [ ] **Step 2: Run the test and verify the expected failure**

Run: `npx vitest run worker/tests/tasting-note-curation-migration.test.ts`

Expected: FAIL with `ENOENT ... 108_tasting_note_curation.sql`.

- [ ] **Step 3: Add the additive, rerunnable migration**

```sql
CREATE TABLE IF NOT EXISTS tasting_note_candidates (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  journal_entry_id TEXT NOT NULL,
  note_key TEXT NOT NULL,
  product_id TEXT NOT NULL,
  author_user_id TEXT NOT NULL,
  source_text TEXT NOT NULL,
  source_tasting TEXT,
  status TEXT NOT NULL DEFAULT 'starred' CHECK (status IN ('starred', 'promoted', 'dismissed')),
  edited_text TEXT,
  attribution_name TEXT,
  attribution_detail TEXT,
  promoted_at TEXT,
  promoted_by TEXT,
  dismissed_at TEXT,
  dismissed_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(author_user_id, journal_entry_id, note_key)
);

CREATE INDEX IF NOT EXISTS idx_tasting_candidates_account_status
  ON tasting_note_candidates(account_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_tasting_candidates_product
  ON tasting_note_candidates(account_id, product_id);

CREATE TABLE IF NOT EXISTS product_impressions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  candidate_id TEXT NOT NULL UNIQUE,
  text TEXT NOT NULL,
  attribution_name TEXT NOT NULL,
  attribution_detail TEXT,
  published_at TEXT NOT NULL DEFAULT (datetime('now')),
  published_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_product_impressions_product
  ON product_impressions(account_id, product_id, published_at DESC);
```

- [ ] **Step 4: Run the focused migration test**

Run: `npx vitest run worker/tests/tasting-note-curation-migration.test.ts`

Expected: PASS; running the SQL twice creates no duplicate-object error.

- [ ] **Step 5: Rehearse the full migration chain**

Run: `npx vitest run worker/tests/curate-inventory-migrations.test.ts worker/tests/tasting-note-curation-migration.test.ts`

Expected: both migration suites PASS from clean in-memory schemas.

- [ ] **Step 6: Commit the schema boundary**

```bash
git add worker/migrations/108_tasting_note_curation.sql worker/tests/tasting-note-curation-migration.test.ts
git commit -m "feat: add tasting note curation schema"
```

### Task 2: Implement private member starring and the admin review API

**Files:**
- Create: `worker/src/tastingNoteCuration.ts`
- Create: `worker/tests/tasting-note-curation.test.ts`
- Modify: `worker/src/index.ts`

- [ ] **Step 1: Write failing domain tests for candidate input and mapping**

```ts
import { describe, expect, it } from 'vitest';
import { parseCandidateInput, candidateToApi } from '../src/tastingNoteCuration';

describe('tasting-note curation domain', () => {
  it('requires a stable note key and non-empty source text', () => {
    expect(() => parseCandidateInput({ note_key: '', source_text: 'Stone fruit' })).toThrow('note_key is required');
    expect(() => parseCandidateInput({ note_key: 'tasting-1', source_text: '   ' })).toThrow('source_text is required');
  });

  it('never exposes source tasting JSON on the public impression shape', () => {
    expect(candidateToApi({ id: 'c1', product_id: 'p1', edited_text: 'Mineral finish', source_text: 'raw', attribution_name: 'A.', attribution_detail: 'Bali', status: 'promoted' } as any)).toEqual({
      id: 'c1', productId: 'p1', text: 'Mineral finish', attributionName: 'A.', attributionDetail: 'Bali', status: 'promoted',
    });
  });
});
```

- [ ] **Step 2: Run the domain test and verify it fails**

Run: `npx vitest run worker/tests/tasting-note-curation.test.ts`

Expected: FAIL because `worker/src/tastingNoteCuration.ts` does not exist.

- [ ] **Step 3: Add the focused domain module**

```ts
export type CandidateInput = { note_key?: unknown; source_text?: unknown; source_tasting?: unknown };

export function parseCandidateInput(body: CandidateInput) {
  const noteKey = String(body.note_key ?? '').trim();
  const sourceText = String(body.source_text ?? '').trim();
  if (!noteKey) throw new Error('note_key is required');
  if (!sourceText) throw new Error('source_text is required');
  return {
    noteKey,
    sourceText,
    sourceTasting: body.source_tasting == null
      ? null
      : typeof body.source_tasting === 'string' ? body.source_tasting : JSON.stringify(body.source_tasting),
  };
}

export function candidateToApi(row: Record<string, unknown>) {
  return {
    id: row.id,
    productId: row.product_id,
    text: row.edited_text || row.source_text,
    attributionName: row.attribution_name,
    attributionDetail: row.attribution_detail ?? null,
    status: row.status,
  };
}
```

- [ ] **Step 4: Run the domain test**

Run: `npx vitest run worker/tests/tasting-note-curation.test.ts`

Expected: PASS.

- [ ] **Step 5: Extend the worker test with route behavior before adding routes**

Add tests using the existing signed-JWT/Fake-D1 pattern from `worker/tests/auth-boundaries.test.ts` that assert:

```ts
it('stars only a journal entry owned by the caller and is idempotent', async () => {
  const first = await request('/api/tasting-journal/journal-1/candidates/tasting-1', { method: 'PUT', body: JSON.stringify({ source_text: 'Long mineral finish' }) });
  expect(first.status).toBe(200);
  const second = await request('/api/tasting-journal/journal-1/candidates/tasting-1', { method: 'PUT', body: JSON.stringify({ source_text: 'Long mineral finish' }) });
  expect(second.status).toBe(200);
  expect(db.candidates).toHaveLength(1);
});

it('denies another member journal row', async () => {
  const response = await request('/api/tasting-journal/other-journal/candidates/tasting-1', { method: 'PUT', body: JSON.stringify({ source_text: 'Private' }) });
  expect(response.status).toBe(404);
});

it('requires publish capability and active-account ownership for the review queue', async () => {
  expect((await request('/api/admin/tasting-note-candidates')).status).toBe(403);
  expect((await publishRequest('/api/admin/tasting-note-candidates')).status).toBe(200);
});

it('promotes edited copy once with durable attribution', async () => {
  const response = await publishRequest('/api/admin/tasting-note-candidates/candidate-1/promote', { method: 'POST', body: JSON.stringify({ edited_text: 'Apricot over warm stone', attribution_name: 'A.', attribution_detail: 'Bali' }) });
  expect(response.status).toBe(200);
  expect(db.impressions).toEqual([expect.objectContaining({ text: 'Apricot over warm stone', attribution_name: 'A.' })]);
  expect((await publishRequest('/api/admin/tasting-note-candidates/candidate-1/promote', { method: 'POST', body: JSON.stringify({ edited_text: 'Apricot over warm stone', attribution_name: 'A.' }) })).status).toBe(409);
});
```

- [ ] **Step 6: Run route tests and verify they fail**

Run: `npx vitest run worker/tests/tasting-note-curation.test.ts`

Expected: FAIL with route `404` responses.

- [ ] **Step 7: Add member and admin handlers to `worker/src/index.ts`**

Implement these exact contracts:

```ts
// PUT /api/tasting-journal/:id/candidates/:noteKey
// Require auth; locate customer_tasting_journal by id plus caller email and active account.
// Resolve author_user_id from JWT sub. INSERT ... ON CONFLICT(author_user_id,journal_entry_id,note_key)
// DO UPDATE only while status='starred'; return candidateToApi(row).

// DELETE /api/tasting-journal/:id/candidates/:noteKey
// Delete only caller-owned status='starred' candidate; promoted/dismissed returns 409.

// GET /api/admin/tasting-note-candidates?status=starred
// requireBundle(request, env, 'publish'); filter account_id and allowed status.

// PUT /api/admin/tasting-note-candidates/:id
// require publish; update edited_text/attribution fields only for caller account.

// POST /api/admin/tasting-note-candidates/:id/dismiss
// require publish; starred -> dismissed, capture dismissed_by/dismissed_at.

// POST /api/admin/tasting-note-candidates/:id/promote
// require publish; validate non-empty final text and attribution_name; batch INSERT product_impressions
// plus candidate status/promoted_by/promoted_at. UNIQUE candidate_id and status guard make repeats 409.

// GET /api/products/:id/impressions
// Public-safe SELECT from product_impressions joined to a public product in the same account.
```

Register exactly these routes in the existing route table. Return `400` for invalid input, `401/403` for auth/capability failure, `404` for cross-account/missing source, and `409` for terminal-state repeats.

- [ ] **Step 8: Run worker tests**

Run: `npx vitest run worker/tests/tasting-note-curation.test.ts worker/tests/auth-boundaries.test.ts`

Expected: PASS, including cross-account denial and repeat-promotion conflict.

- [ ] **Step 9: Commit the worker boundary**

```bash
git add worker/src/tastingNoteCuration.ts worker/src/index.ts worker/tests/tasting-note-curation.test.ts
git commit -m "feat: add tasting note curation API"
```

### Task 3: Add member voice capture and private star controls

**Files:**
- Create: `src/components/tasting/JournalSectionVoiceNote.tsx`
- Create: `src/components/tasting/JournalSectionVoiceNote.test.tsx`
- Modify: `src/lib/api.ts`
- Modify: `src/components/tasting/TastingJournal.tsx`

- [ ] **Step 1: Write the failing component test**

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { JournalSectionVoiceNote } from './JournalSectionVoiceNote';

vi.mock('../../hooks/useVoiceCapture', () => ({
  useVoiceCapture: ({ onTranscribed }: any) => ({ state: 'idle', error: null, toggle: () => onTranscribed('Warm apricot') }),
}));

it('adds a transcript to one section and privately stars that section', async () => {
  const onTextChange = vi.fn();
  const onStarChange = vi.fn();
  render(<JournalSectionVoiceNote text="" starred={false} onTextChange={onTextChange} onStarChange={onStarChange} />);
  fireEvent.click(screen.getByRole('button', { name: 'Record note for this tasting' }));
  expect(onTextChange).toHaveBeenCalledWith('Warm apricot');
  fireEvent.click(screen.getByRole('button', { name: 'Star this note for private review' }));
  expect(onStarChange).toHaveBeenCalledWith(true);
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npx vitest run src/components/tasting/JournalSectionVoiceNote.test.tsx`

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Add typed API methods**

Add under `api.tastingJournal` in `src/lib/api.ts`:

```ts
starCandidate: (entryId: string, noteKey: string, data: { source_text: string; source_tasting?: unknown }) =>
  authedFetch(`${API_URL}/api/tasting-journal/${entryId}/candidates/${encodeURIComponent(noteKey)}`, {
    method: 'PUT', body: JSON.stringify(data),
  }),
unstarCandidate: (entryId: string, noteKey: string) =>
  authedFetch(`${API_URL}/api/tasting-journal/${entryId}/candidates/${encodeURIComponent(noteKey)}`, { method: 'DELETE' }),
```

- [ ] **Step 4: Implement the focused control**

```tsx
import React from 'react';
import { Mic, Star } from 'lucide-react';
import { useVoiceCapture } from '../../hooks/useVoiceCapture';

export function JournalSectionVoiceNote({ text, starred, onTextChange, onStarChange }: {
  text: string; starred: boolean; onTextChange: (text: string) => void; onStarChange: (starred: boolean) => void;
}) {
  const voice = useVoiceCapture({ onTranscribed: transcript => onTextChange([text.trim(), transcript.trim()].filter(Boolean).join(' ')) });
  return <div className="flex flex-wrap items-center gap-2">
    <button type="button" onClick={voice.toggle} disabled={voice.state === 'transcribing'} aria-label="Record note for this tasting" className="tap-target inline-flex items-center gap-1.5 text-ui-12 text-tea-text-sec hover:text-tea-text">
      <Mic size={14} />{voice.state === 'recording' ? 'Stop' : voice.state === 'transcribing' ? 'Transcribing…' : 'Record'}
    </button>
    <button type="button" onClick={() => onStarChange(!starred)} aria-pressed={starred} aria-label={starred ? 'Remove private review star' : 'Star this note for private review'} className="tap-target inline-flex items-center gap-1.5 text-ui-12 text-tea-text-sec hover:text-tea-text">
      <Star size={14} fill={starred ? 'currentColor' : 'none'} />{starred ? 'Review candidate' : 'Mark for review'}
    </button>
    {voice.error && <span className="text-ui-11 text-tea-error">{voice.error}</span>}
  </div>;
}
```

- [ ] **Step 5: Wire it to each stable tasting section**

In `TastingJournal.tsx`, render `JournalSectionVoiceNote` inside each tasting-section editor. Use the existing tasting `id` as `noteKey`; save transcript through the existing journal update path, then call `api.tastingJournal.starCandidate(entry.id, tasting.id, { source_text: text, source_tasting: tasting.tasting })`. On unstar call `unstarCandidate`. Show API errors adjacent to that section and restore the previous pressed state.

- [ ] **Step 6: Run component and journal tests**

Run: `npx vitest run src/components/tasting/JournalSectionVoiceNote.test.tsx src/lib/tastingJournalSync.test.ts`

Expected: PASS; transcript changes only the selected section and starring calls no public endpoint.

- [ ] **Step 7: Commit the member loop**

```bash
git add src/components/tasting/JournalSectionVoiceNote.tsx src/components/tasting/JournalSectionVoiceNote.test.tsx src/components/tasting/TastingJournal.tsx src/lib/api.ts
git commit -m "feat: let members star tasting notes privately"
```

### Task 4: Add the admin queue and attributed product impression

**Files:**
- Create: `src/admin/components/TastingNoteReviewQueue.tsx`
- Create: `src/admin/components/TastingNoteReviewQueue.test.tsx`
- Modify: `src/admin/components/TeaReviewsPanel.tsx`
- Modify: `src/lib/api.ts`
- Modify: `src/pages/ProductPage.tsx`
- Create: `tests/tasting-note-curation.spec.ts`

- [ ] **Step 1: Write a failing admin queue test**

```tsx
it('edits, promotes, and dismisses candidates without ranking controls', async () => {
  render(<TastingNoteReviewQueue />);
  expect(await screen.findByText('Long mineral finish')).toBeVisible();
  fireEvent.change(screen.getByLabelText('Published impression'), { target: { value: 'Apricot over warm stone' } });
  fireEvent.change(screen.getByLabelText('Attribution name'), { target: { value: 'A.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Promote impression' }));
  await waitFor(() => expect(api.tastingNoteCandidates.promote).toHaveBeenCalled());
  expect(screen.queryByText(/vote|rank|score/i)).toBeNull();
});
```

- [ ] **Step 2: Run it and verify it fails**

Run: `npx vitest run src/admin/components/TastingNoteReviewQueue.test.tsx`

Expected: FAIL because the queue and API namespace do not exist.

- [ ] **Step 3: Add typed frontend API contracts**

```ts
tastingNoteCandidates: {
  list: (status = 'starred') => authedFetch(`${API_URL}/api/admin/tasting-note-candidates?status=${encodeURIComponent(status)}`),
  update: (id: string, data: { edited_text?: string; attribution_name?: string; attribution_detail?: string }) => authedFetch(`${API_URL}/api/admin/tasting-note-candidates/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  promote: (id: string, data: { edited_text: string; attribution_name: string; attribution_detail?: string }) => authedFetch(`${API_URL}/api/admin/tasting-note-candidates/${id}/promote`, { method: 'POST', body: JSON.stringify(data) }),
  dismiss: (id: string) => authedFetch(`${API_URL}/api/admin/tasting-note-candidates/${id}/dismiss`, { method: 'POST' }),
},
productImpressions: {
  list: async (productId: string) => handleResponse(await fetchWithTimeout(`${API_URL}/api/products/${encodeURIComponent(productId)}/impressions`)),
},
```

- [ ] **Step 4: Implement the queue with React Query**

Build `TastingNoteReviewQueue` with one candidate per flat bordered row, editable published text and attribution, Cancel/dismiss on the left, Promote on the right, loading/empty/error/retry states, and query invalidation after decisions. Mount it inside the existing `TeaReviewsPanel`; do not add an admin navigation item.

- [ ] **Step 5: Render approved impressions on products**

In `ProductPage.tsx`, query `api.productImpressions.list(product.id)`. Above ordinary public reviews, render only returned promoted impressions:

```tsx
<blockquote className="border-l-2 border-tea-gold pl-4">
  <p className="body-light italic text-tea-text">“{impression.text}”</p>
  <footer className="mt-2 text-ui-11 text-tea-text-sec">
    — {impression.attributionName}{impression.attributionDetail ? ` · ${impression.attributionDetail}` : ''}
  </footer>
</blockquote>
```

- [ ] **Step 6: Run component tests**

Run: `npx vitest run src/admin/components/TastingNoteReviewQueue.test.tsx`

Expected: PASS with no voting, aggregation, or ranking UI.

- [ ] **Step 7: Add the end-to-end journey test**

In `tests/tasting-note-curation.spec.ts`, mock journal candidate, admin queue, promotion, and public impression endpoints. Assert member transcript/star → admin edited promotion → product attribution, and assert the impression is absent before promotion.

- [ ] **Step 8: Run the browser journey**

Run: `npx playwright test tests/tasting-note-curation.spec.ts --project="Mobile Chrome"`

Expected: PASS; attribution is visible only after promotion.

- [ ] **Step 9: Commit the curated publication UI**

```bash
git add src/admin/components/TastingNoteReviewQueue.tsx src/admin/components/TastingNoteReviewQueue.test.tsx src/admin/components/TeaReviewsPanel.tsx src/lib/api.ts src/pages/ProductPage.tsx tests/tasting-note-curation.spec.ts
git commit -m "feat: curate attributed product impressions"
```

### Task 5: Add the event/article association and draft builder

**Files:**
- Create: `worker/migrations/109_event_article_source.sql`
- Create: `worker/src/eventArticleDraft.ts`
- Create: `worker/tests/event-article-draft.test.ts`
- Modify: `worker/src/index.ts`

- [ ] **Step 1: Write failing builder tests**

```ts
import { describe, expect, it } from 'vitest';
import { buildEventArticleDraft } from '../src/eventArticleDraft';

it('builds a draft from gallery, host notes, energy, and tea metadata', () => {
  const draft = buildEventArticleDraft({ id: 'e1', title: 'Cliff Tea Evening', subtitle: 'Wuyi after rain' }, {
    session_notes: 'A quiet table that opened slowly.', energy: 'contemplative', gallery_images: JSON.stringify(['https://media.teajia.co/a.jpg']), shared_tasting_notes: 'Warm rock and longan',
  });
  expect(draft.status).toBe('draft');
  expect(draft.layout_template).toBe('immersive_scroll');
  expect(draft.cover_image_url).toBe('https://media.teajia.co/a.jpg');
  expect(draft.blocks).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'image', url: 'https://media.teajia.co/a.jpg' })]));
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npx vitest run worker/tests/event-article-draft.test.ts`

Expected: FAIL because `eventArticleDraft.ts` does not exist.

- [ ] **Step 3: Add the association migration**

```sql
ALTER TABLE articles ADD COLUMN source_event_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_articles_account_source_event
  ON articles(account_id, source_event_id)
  WHERE source_event_id IS NOT NULL;
```

- [ ] **Step 4: Implement deterministic draft construction**

`buildEventArticleDraft(event, postSession)` must parse gallery JSON defensively, use the first owned-media image as cover, emit `cover`, `intro`, `section_heading`, `paragraph`, `image`, and `quote` blocks only when their source content exists, set category to `Field Notes`, set `layout_template` to `immersive_scroll`, and always set `status: 'draft'`. It must not publish or invent prose.

- [ ] **Step 5: Add failing endpoint tests**

```ts
it('creates one account-scoped draft for an event', async () => {
  const response = await request('/api/admin/events/event-1/article-draft', { method: 'POST', bundles: ['gather', 'publish'] });
  expect(response.status).toBe(201);
  expect(await response.json()).toMatchObject({ existing: false, article: { status: 'draft', source_event_id: 'event-1' } });
});

it('returns the existing draft instead of duplicating it', async () => {
  await request('/api/admin/events/event-1/article-draft', { method: 'POST', bundles: ['gather', 'publish'] });
  const response = await request('/api/admin/events/event-1/article-draft', { method: 'POST', bundles: ['gather', 'publish'] });
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ existing: true });
  expect(db.articles).toHaveLength(1);
});

it('denies wrong-account events and gather-only staff', async () => {
  expect((await request('/api/admin/events/other-account/article-draft', { method: 'POST', bundles: ['gather', 'publish'] })).status).toBe(404);
  expect((await request('/api/admin/events/event-1/article-draft', { method: 'POST', bundles: ['gather'] })).status).toBe(403);
});
```

- [ ] **Step 6: Implement `POST /api/admin/events/:id/article-draft`**

In `worker/src/index.ts`, require both `gather` and `publish`, verify `events.id + account_id`, query `event_post_session` with the same account, return an existing source-linked article when present, otherwise insert a normal `articles` row using `buildEventArticleDraft` plus `source_event_id`. Return `{ existing: false, article }` with `201`; the repeat returns `{ existing: true, article }` with `200`. Do not call the publish handler.

- [ ] **Step 7: Persist all draft source metadata in post-session updates**

Extend `handleUpsertPostSession` to include `energy` and `shared_tasting_notes` in both INSERT and UPDATE statements while preserving existing gallery, ledger, playlist, and notes behavior.

- [ ] **Step 8: Run endpoint and migration tests**

Run: `npx vitest run worker/tests/event-article-draft.test.ts worker/tests/auth-boundaries.test.ts`

Expected: PASS; wrong account/gather-only are denied and repeat creation returns one article.

- [ ] **Step 9: Commit event draft backend**

```bash
git add worker/migrations/109_event_article_source.sql worker/src/eventArticleDraft.ts worker/src/index.ts worker/tests/event-article-draft.test.ts
git commit -m "feat: create article drafts from events"
```

### Task 6: Open event-created drafts in the existing block editor

**Files:**
- Modify: `src/lib/api.ts`
- Modify: `src/admin/components/EventDetail.tsx`
- Modify: `src/admin/components/ArticleEditorModal.tsx`
- Create: `tests/event-photo-essay.spec.ts`

- [ ] **Step 1: Write the failing Playwright journey**

Mock event and draft endpoints, open `/admin/events/event-1?tab=post-session`, click `Create photo essay draft`, and assert `ArticleEditorModal` opens with event title, returned blocks, and a Draft status. Repeat with `{ existing: true }` and assert `Open existing draft` messaging; assert no Publish request occurs automatically.

- [ ] **Step 2: Run and verify failure**

Run: `npx playwright test tests/event-photo-essay.spec.ts --project="Desktop Chrome"`

Expected: FAIL because the draft action is absent.

- [ ] **Step 3: Add the API method**

```ts
createArticleDraft: (id: string): Promise<{ existing: boolean; article: DbArticle }> =>
  authedFetch(`${API_URL}/api/admin/events/${id}/article-draft`, { method: 'POST' }),
```

- [ ] **Step 4: Add the event action and editor state**

In `EventDetail.tsx`, keep `draftArticle: DbArticle | null`, `drafting`, and `draftExisting`. Place the action in `PostSessionEditor`, not global navigation. On success set returned article and open the existing `ArticleEditorModal`; when `existing` is true, show “An article draft already exists for this event. Open existing draft.” Publication remains the editor's separate button.

- [ ] **Step 5: Make editor initialization safe when initial data changes**

In `ArticleEditorModal.tsx`, add an effect keyed by `initialData?.id` that resets `articleId`, title, status, blocks, subtitle, author, category, tags, cover, and layout from the selected article. This prevents a previously edited article from leaking state into an event-created draft.

- [ ] **Step 6: Run the browser journey**

Run: `npx playwright test tests/event-photo-essay.spec.ts --project="Desktop Chrome"`

Expected: PASS for new and existing draft paths; publish endpoint has zero calls.

- [ ] **Step 7: Commit editor integration**

```bash
git add src/lib/api.ts src/admin/components/EventDetail.tsx src/admin/components/ArticleEditorModal.tsx tests/event-photo-essay.spec.ts
git commit -m "feat: open event photo essays in article editor"
```

### Task 7: Add `/account/cellar`, repair Remember, and add quiet cross-links

**Files:**
- Create: `src/pages/CellarPage.tsx`
- Create: `src/components/account/PersonalTeaLinks.tsx`
- Create: `src/components/account/PersonalTeaLinks.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/AccountPanel/LaunchpadView.tsx`
- Modify: `src/pages/JournalPage.tsx`
- Modify: `src/pages/CollectionPage.tsx`
- Modify: `src/components/AccountPanel/CellarView.tsx`
- Create: `tests/personal-tea-journey.spec.ts`

- [ ] **Step 1: Write the failing cross-link component test**

```tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PersonalTeaLinks } from './PersonalTeaLinks';

it('links the three distinct personal tea models without renaming routes', () => {
  render(<MemoryRouter><PersonalTeaLinks current="journal" /></MemoryRouter>);
  expect(screen.getByRole('link', { name: 'Favorites' })).toHaveAttribute('href', '/account/collection');
  expect(screen.getByRole('link', { name: 'Cellar' })).toHaveAttribute('href', '/account/cellar');
  expect(screen.queryByRole('link', { name: 'Journal' })).toBeNull();
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npx vitest run src/components/account/PersonalTeaLinks.test.tsx`

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement quiet editorial links**

```tsx
import { Link } from 'react-router-dom';

const destinations = [
  { key: 'journal', label: 'Journal', to: '/account/journal' },
  { key: 'favorites', label: 'Favorites', to: '/account/collection' },
  { key: 'cellar', label: 'Cellar', to: '/account/cellar' },
] as const;

export function PersonalTeaLinks({ current }: { current: 'journal' | 'favorites' | 'cellar' }) {
  return <nav aria-label="Your tea" className="flex flex-wrap gap-x-4 gap-y-2 border-t border-tea-border pt-4">
    {destinations.filter(item => item.key !== current).map(item => <Link key={item.key} to={item.to} className="tap-target text-ui-12 text-tea-text-sec hover:text-tea-text">{item.label} →</Link>)}
  </nav>;
}
```

- [ ] **Step 4: Create the real Cellar page**

```tsx
import { useNavigate } from 'react-router-dom';
import { CellarView } from '../components/AccountPanel/CellarView';
import { PersonalTeaLinks } from '../components/account/PersonalTeaLinks';

export default function CellarPage() {
  const navigate = useNavigate();
  return <main className="min-h-screen bg-tea-bg pb-nav-gap">
    <div className="mx-auto max-w-3xl px-4 pt-6 md:px-6">
      <button onClick={() => navigate(-1)} className="tap-target text-ui-13 text-tea-text-sec hover:text-tea-text">← Back</button>
      <h1 className="h1 mt-6">My Cellar</h1>
      <CellarView onBack={() => navigate(-1)} />
      <PersonalTeaLinks current="cellar" />
    </div>
  </main>;
}
```

Adjust `CellarView` so page composition does not duplicate outer padding/header; retain its existing CRUD, placement, shelf, loading and empty states unchanged.

- [ ] **Step 5: Wire exact routes and repair Remember**

In `src/App.tsx`, lazy-load `CellarPage` and add `/account/cellar` beside the existing account routes. In `LaunchpadView.tsx`, change only the Remember click target from `/account/journey?tab=collection` to `/account/collection`; retain the visible `remember` label.

- [ ] **Step 6: Add cross-links to the existing pages**

Render `<PersonalTeaLinks current="journal" />` in `JournalPage`, and `<PersonalTeaLinks current="favorites" />` in `CollectionPage`. Do not merge their state or copy entries among models.

- [ ] **Step 7: Run the unit test**

Run: `npx vitest run src/components/account/PersonalTeaLinks.test.tsx`

Expected: PASS with exact existing paths.

- [ ] **Step 8: Add the desktop/mobile personal-tea journey**

In `tests/personal-tea-journey.spec.ts`, mock `/api/tasting-journal`, `/api/user/favorites`, and `/api/me/cellar` independently. Assert Remember reaches `/account/collection`; Journal links to Favorites and Cellar; Cellar renders API-backed owned tea; a favorite does not appear as cellar stock and a cellar item does not appear in Journal. Run the same assertions at 1280×800 and 390×844 and assert `document.documentElement.scrollWidth <= innerWidth`.

- [ ] **Step 9: Run the focused browser test**

Run: `npx playwright test tests/personal-tea-journey.spec.ts --project="Desktop Chrome" --project="Mobile Chrome"`

Expected: PASS on both viewports with no horizontal overflow or bottom-nav obstruction.

- [ ] **Step 10: Commit personal-tea wiring**

```bash
git add src/pages/CellarPage.tsx src/components/account/PersonalTeaLinks.tsx src/components/account/PersonalTeaLinks.test.tsx src/App.tsx src/components/AccountPanel/LaunchpadView.tsx src/pages/JournalPage.tsx src/pages/CollectionPage.tsx src/components/AccountPanel/CellarView.tsx tests/personal-tea-journey.spec.ts
git commit -m "feat: wire cellar favorites and journal journeys"
```

### Task 8: Release 2 verification and handoff

**Files:**
- Modify only if results require a correction: files already listed in Tasks 1–7

- [ ] **Step 1: Run all Release 2 worker tests**

Run: `npx vitest run worker/tests/tasting-note-curation-migration.test.ts worker/tests/tasting-note-curation.test.ts worker/tests/event-article-draft.test.ts worker/tests/auth-boundaries.test.ts worker/tests/curate-inventory-migrations.test.ts`

Expected: all suites PASS; no cross-account read/write succeeds.

- [ ] **Step 2: Run Release 2 frontend unit tests**

Run: `npx vitest run src/components/tasting/JournalSectionVoiceNote.test.tsx src/admin/components/TastingNoteReviewQueue.test.tsx src/components/account/PersonalTeaLinks.test.tsx`

Expected: all suites PASS.

- [ ] **Step 3: Run static checks**

Run: `npm run lint && npm run lint:colors`

Expected: TypeScript exits 0 and color lint reports no violations.

- [ ] **Step 4: Build production assets**

Run: `npm run build`

Expected: Vite production build completes and writes `dist/` with no errors.

- [ ] **Step 5: Start the reserved development server**

Run in a persistent terminal: `npm run dev`

Expected: Vite reports the application at `http://localhost:7777`; do not start another port.

- [ ] **Step 6: Run focused Release 2 browser journeys**

Run: `npx playwright test tests/tasting-note-curation.spec.ts tests/event-photo-essay.spec.ts tests/personal-tea-journey.spec.ts`

Expected: all journeys PASS.

- [ ] **Step 7: Run the mandatory mobile regression suite**

Run: `npm run test:mobile`

Expected: mobile audit passes, including account routes, no console errors, no 404s, no horizontal overflow, and Inventory scroll remains intact.

- [ ] **Step 8: Manually verify the editorial boundaries**

At `http://localhost:7777`, confirm: a starred note is absent publicly until promoted; edited attribution persists after the source note changes; an event creates one draft and never auto-publishes; `/account/cellar` uses server data; Remember opens Favorites; Journal/Favorites/Cellar links remain distinct; no navigation label changed.

- [ ] **Step 9: Inspect the final diff for scope**

Run: `git status --short && git diff --stat HEAD~7..HEAD`

Expected: only Release 2 migrations, worker/API tests and handlers, tasting curation UI, event draft integration, and personal-tea routing/cross-links appear; no unrelated navigation or backend architecture changes.

- [ ] **Step 10: Record verification without claiming human-only gates**

Update the implementation handoff with exact passing commands and note that real mainland-China testing, real operator launch checks, and real contributor content remain human-only gates outside Release 2.

