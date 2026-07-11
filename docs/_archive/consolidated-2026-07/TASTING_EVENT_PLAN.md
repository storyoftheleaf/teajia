# Tasting Event — Build Plan (Saturday Tasting)

> Status: **Awaiting Adrian's review**. Once approved, this is the spec the build executes against. Push back on anything.

## What we're building

A real, persistent in-person tasting flow:

1. **Host** (Adrian) creates a tasting event from the admin: picks teas from the products catalog, names it, taps create.
2. **Host** sees a screen with a 6-digit code + QR code. Reads code aloud or shows QR.
3. **Guest** scans QR or types code on their phone. Enters first name + email. Instant.
   - If email already has a Teajia account → logged in to that account.
   - If new → account created passwordless, logged in.
4. **Guest** sees the teas in front of them. Taps a tea, walks through the **full structured TastingSession** (body, finish, flavor, qi, huiGan, quality 1–10, freeform notes, voice notes, verdict love/like/neutral/pass, would-buy).
5. **On save**, data writes to BOTH:
   - `tasting_session_verdicts` → host live view sees it instantly.
   - `customer_tasting_journal` → permanently in the guest's account, accessible from any device, forever.
6. **Guest** finishes their teas, taps **Send my picks** → WhatsApp message to Adrian with their loves/likes/wouldBuys.
7. **Host** monitors a live admin view showing every guest's progress in real time.
8. **Three weeks later**, guest can sign back in (forgot-password to set one) and see their notes at `/account`.

---

## Decisions locked

| Decision | Value |
|---|---|
| Auth | 6-digit code + first name + email. No password ever at signup. |
| Re-login later | Forgot-password flow → sets a password. (Verified working for passwordless users.) |
| Existing email collision | Log into the existing account. Their previous journal entries surface. |
| Session model | Reuse `tasting_sessions` / `tasting_session_teas` / `tasting_session_verdicts` / `tasting_session_members` tables. Don't make a new event table. |
| Tea linkage | Each session tea links to `products.id`. Host picks from products catalog. |
| Journal bridge | Worker writes to journal on every verdict save (not client only). Single source of truth on server. |
| Bronze rule | `.impeccable.md` rules apply throughout — one bronze element per screen. |

---

## Migrations

Three additive migrations. None drop or rewrite data.

### `058_session_product_link.sql`
```sql
ALTER TABLE tasting_session_teas ADD COLUMN product_id TEXT REFERENCES products(id);
CREATE INDEX IF NOT EXISTS idx_session_teas_product ON tasting_session_teas(product_id);
```

### `059_tasting_join_codes.sql`
```sql
CREATE TABLE IF NOT EXISTS tasting_join_codes (
  code TEXT PRIMARY KEY,                 -- 6-digit zero-padded
  session_id TEXT NOT NULL REFERENCES tasting_sessions(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,              -- created_at + 24h
  revoked_at TEXT,
  redemption_count INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_join_codes_session ON tasting_join_codes(session_id);
```

### `060_journal_session_provenance.sql`
```sql
ALTER TABLE customer_tasting_journal ADD COLUMN session_id TEXT;
ALTER TABLE customer_tasting_journal ADD COLUMN session_title TEXT;
CREATE INDEX IF NOT EXISTS idx_ctj_session ON customer_tasting_journal(session_id);
```

---

## Worker changes (`worker/src/index.ts`)

### New routes

#### `POST /api/auth/join-code/issue` — host issues a code
- Auth: `requireAccount` (host of the session).
- Body: `{ session_id }`
- Returns: `{ code: "048217", expires_at }`
- Idempotent: if a non-expired non-revoked code already exists for this session, return it (so the host can refresh the screen and see the same code).

#### `POST /api/auth/join-code/redeem` — guest redeems
- Auth: **public**, rate-limited 20/min/IP.
- Body: `{ code, first_name, email }`
- Returns: `{ token, user, memberships, active_account_id, session_id, is_new_user }`
- Logic:
  1. Validate code (active, not expired, not revoked).
  2. Lookup user by `lower(email)`.
  3. **Existing**: take that user, no password check (the code IS the auth factor).
  4. **New**: insert users row with `password_hash = NULL` (D1 column needs to be nullable — verify in pre-flight; if not, sentinel `'JOIN_ONLY'`).
  5. `INSERT OR IGNORE` into `tasting_session_members` for this guest+session.
  6. Increment `redemption_count`.
  7. Capacity check: if `member_count >= max_participants`, return 400 "Session is full".
  8. Issue JWT via existing `createToken`. For new guests, `memberships=[]`, `active_account_id=null`.
- **Audit log**: write a row to `audit_log` for both new and existing-account redeems, so we can trace any abuse.

#### `POST /api/auth/join-code/:code/revoke` — host kills a code

#### `GET /api/sessions/:id/host-live` — host live view data
- Auth: `requireAccount`, host only.
- Returns: `{ session, teas, members, verdicts, progress: [{ user_id, completed, total }] }`
- Frontend polls every 7 seconds.

### Modified routes

#### `POST /api/sessions` (create)
- Accept `product_ids: string[]` (new) **or** `entry_ids: string[]` (legacy compass).
- For each product_id: snapshot `name/type/image` into `tea_metadata`, set `product_id` column, `compass_entry_id=NULL`.
- Default `max_participants` bumped from 4 → 8 (Adrian + 6 guests + buffer).

#### `POST /api/sessions/:id/teas/:teaId/verdict` (submit verdict)
- **Critical change**: switch from `requireAccount` to `requireAuth` + session-membership check. Otherwise guests with no memberships hit 403.
- Same change for `handleJoinSession` and `handleGetSessionVerdicts`.
- Skip `_upsertTasteProfile` for non-account-members (writing to host's account on a guest's behalf is the wrong owner).
- Block submits when `session.status='completed'` → return 409.
- **NEW: journal bridge**. After the existing verdict upsert succeeds, run inside `try/catch`:
  ```ts
  const tea = SELECT product_id, tea_metadata FROM tasting_session_teas WHERE id = ?
  if (!tea.product_id) return success;  // legacy compass session, skip bridge
  
  const session = SELECT title, account_id FROM tasting_sessions WHERE id = ?
  const user    = SELECT email FROM users WHERE id = ?
  
  // Build CustomerTasting note shape matching upsertTastingByProductId in store.ts
  const newRecord = { id, createdAt, tasting: tasting_data, sourceType: 'event', eventId: session.id, eventTitle: session.title }
  const noteShape = { tasting: tasting_data, personalNote: notes, rating: tasting_data.quality, verdict, wouldBuy, updatedAt }
  
  // Upsert. If a record with this eventId already exists in tastings[], replace it (re-saves don't duplicate). Otherwise append.
  INSERT INTO customer_tasting_journal (...)
  ON CONFLICT(user_id, product_id) DO UPDATE SET note=..., tastings=..., session_id=..., session_title=..., source_type='session'
  ```
- If bridge throws, log + return 200 anyway. Client's `syncTastingJournal()` is the safety net.

### Other backend audit

- Verify `users.password_hash` allows NULL. If not, plan an additional migration. Or use sentinel `'JOIN_ONLY'`.
- Verify `handleForgotPassword` + `handleResetPassword` work for users with NULL/sentinel password_hash. (Integration agent confirmed: yes, they do.)
- One-pass audit: any handler used from `/account` that uses `requireAccount` instead of `requireAuth` will silently break for guests. Suspicion list to grep before launch: notes sync, compass favorites, sample requests.

---

## Frontend changes

### New routes

`src/App.tsx`:
```
/join                 → JoinPage  (code-entry screen)
/join/:code           → JoinPage  (code prefilled from QR)
/session/:id          → SessionPage  (rewritten body)
```

`src/admin/AdminApp.tsx`:
```
/admin/tasting-events                     → TastingEventsList
/admin/tasting-events/new                 → TastingEventForm
/admin/tasting-events/:sessionId          → TastingControlRoom (Share tab default)
/admin/tasting-events/:sessionId/live     → TastingControlRoom (Live tab)
```

### New components

| Path | Purpose |
|---|---|
| `src/pages/JoinPage.tsx` | Two-step join flow (code, then name+email) |
| `src/admin/components/tasting/TastingEventsList.tsx` | Index of past + active sessions |
| `src/admin/components/tasting/TastingEventForm.tsx` | Create panel (title + tea picker) |
| `src/admin/components/tasting/TeaPicker.tsx` | Searchable multi-select tea picker with order pills |
| `src/admin/components/tasting/TastingControlRoom.tsx` | Tabbed shell (Share / Live) |
| `src/admin/components/tasting/ShareScreen.tsx` | 6-digit code + QR + joined-strip |
| `src/admin/components/tasting/LiveMatrix.tsx` | Guest × tea verdict grid |
| `src/components/tasting/SessionTeaCard.tsx` | One tea row in guest tasting list |
| `src/lib/whatsapp.ts` | Add `buildTastingPicksMessage` |

### Modified components

| Path | Change |
|---|---|
| `src/pages/SessionPage.tsx` | Full rewrite. Replaces minimal verdict UI with header + tea cards + sticky "Send my picks" footer. Each card opens `TastingSession` modal on tap. |
| `src/lib/api.ts` | Add `auth.redeemJoinCode`, `sessions.issueJoinCode`, `sessions.revokeJoinCode`, `sessions.hostLive`. Modify `sessions.create` to accept `product_ids`. |
| `src/hooks/useAuth.ts` | Add `redeemJoinCode` callback (mirrors existing `login` and `signup`). |
| `src/admin/components/CommandPalette.tsx` | Add "New tasting event" entry. |
| `src/lib/store.ts` | Tweak `upsertTastingByProductId` to append a TastingRecord when `record.sourceType === 'session'` (otherwise re-saves overwrite the most recent record). |

### TastingSession integration (no prop changes needed)

The existing component handles everything via its current `onAfterSave(data, verdict, wouldBuy)` callback. The new `SessionPage` wraps it like:

```tsx
<TastingSession
  item={{
    id: tea.product_id,
    name: meta.name ?? tea.tea_name,
    type: meta.type,
    image: meta.photo,
    sourceType: 'event',
    eventId: session.id,
    eventTitle: session.title,
  }}
  showVerdict
  onClose={() => setActiveTeaId(null)}
  onAfterSave={(data, verdict, wouldBuy) => {
    api.sessions.submitVerdict(session.id, tea.id, {
      verdict, would_buy: wouldBuy, tasting_data: data, notes: data.notes?.[0]?.text,
    });
    queryClient.invalidateQueries({ queryKey: ['session', session.id] });
  }}
/>
```

---

## UX details (key screens)

### Host Share screen
- Massive 6-digit code: `font-display text-[88px] font-light tracking-[0.08em] text-tea-text`. Centered. Click to copy.
- QR code (240px) below, on `bg-tea-elevated` rounded card.
- Caption: `"Guests open teajia.app/join and enter this code"`.
- Tea list (Roman numerals + names) for visual confirmation.
- "Joined" strip — name pills as guests appear (5s polling).
- Sticky "Open live view →" CTA.

### Guest Join — Screen 1 (code)
- Single eyebrow: `Tasting · Tea Jia`.
- Headline: `"Enter your code"`.
- Six underline cells, auto-advance, paste fills all six.
- Bronze `Continue →` text button.

### Guest Join — Screen 2 (name + email)
- Headline: `"Your name"`.
- Two bottom-bordered fields (no boxes): First name, Email.
- Footnote: `"We'll save your notes to this email so you can come back to them later."`
- Filled bronze pill: `Join the tasting →`.
- Below: tiny `"Already on Teajia? Sign in"` link.
- Auto-lowercase + trim email. Show double-check hint while typing.

### Guest Tasting page (`/session/:id`)
- Header: `Leave` top-left, session title centered, metadata "with Adrian · 6 teas".
- Progress strip: bronze fill on a 1px track, `"3 of 6 tasted"` caption.
- Tea cards: photo + name + meta + state circle (empty → in-progress → saved-checkmark).
- Tap a card → opens `TastingSession` full-screen modal.
- Sticky bottom: `Send my picks →` when ≥1 tasted.

### Send my picks
WhatsApp message structure (via `buildTastingPicksMessage`):
```
From <name> (<email>) at <session title>
At Adrian's tasting today, here's what I want:

I. <Tea name>  — Love · would order
II. <Tea name>  — Like
...

Send via wa.me/<adrianNumber>?text=<encoded>
```

### Host Live view
- Aggregate strip: `"5 of 6 guests · 18 tastings recorded · 2 wouldBuys"`.
- Guest × Tea matrix. Mobile transposes (tea down the page, guest pills inside).
- Cell content: bronze disc (filled=love, ring+dot=like, ring=neutral, dim X=pass), tiny quality number, bookmark icon for would-buy.
- Footer: `Complete tasting` ghost button → confirm modal.

---

## Risks + mitigations

| Risk | Mitigation |
|---|---|
| Email typo creates an unreachable account | Show double-check hint while typing. Adrian fixes manually in admin if needed later. Accepted. |
| Guest's phone sleeps mid-tasting, loses in-progress data | TastingSession state lost. Mitigation: existing `syncTastingJournal()` already saves on each section completion. Add inline warning `"Stay on this screen until you save."` |
| Adrian completes session early | Confirm modal: `"End the session for everyone? Notes are kept."` Block guest verdict POSTs with 409 after. Show banner to guest. |
| Worker bridge fails partial-write | Verdict succeeds (primary), journal bridge wrapped in try/catch, returns 200. Client sync is the safety net. |
| Host completes session, guest hasn't saved | Save still works on existing in-flight verdicts (handler hasn't been called yet). Once status='completed', new POSTs return 409 with "Adrian closed the session" message. |
| 6 phones same wifi, polling thrash | Pause SessionPage polling while TastingSession modal is open. Tighten guest poll to 20s. Host live poll at 7s. |
| Existing-account guest's old tastings appear | Desired. Their previous notes deepen with the new session. New TastingRecord appends (after the store.ts fix). |
| Code leakage to a stranger | 24h expiry, session-scoped, `max_participants=8`, host can revoke. Stranger creates an account at their own email; can't impersonate. |
| Two different humans, same email | First-writer-wins. Accepted; rare. |
| Existing-account password bypass | Per Adrian, acceptable (possession of code = host's blessing). Audit-logged. |
| `_upsertTasteProfile` writes guest data to host's account | Skip the call when caller isn't a member of `session.account_id`. |

---

## Sequencing (build order)

Strict dependencies:

1. **Migrations 058, 059, 060** — must land first.
2. **Worker** (parallel after migrations):
   - 2a. Verdict + Join + Members handlers: switch `requireAccount` → `requireAuth` + session-membership check. Skip `_upsertTasteProfile` for non-members.
   - 2b. New `/api/auth/join-code/issue`, `/redeem`, `/revoke` endpoints.
   - 2c. Modify `handleCreateSession` to accept `product_ids`.
   - 2d. Add journal bridge inside `handleSubmitSessionVerdict`.
   - 2e. New `GET /api/sessions/:id/host-live` endpoint.
3. **Worker smoke test via curl** (10 cases listed at end).
4. **Frontend** (parallel after worker smoke test passes):
   - 4a. `src/lib/store.ts` — append-record fix for `sourceType: 'session'`.
   - 4b. `src/lib/api.ts` — new auth + sessions methods.
   - 4c. `src/hooks/useAuth.ts` — `redeemJoinCode` callback.
   - 4d. `JoinPage` (public).
   - 4e. `SessionPage` rewrite (public, wraps TastingSession).
   - 4f. Admin: `TastingEventsList`, `TastingEventForm`, `TeaPicker`, `TastingControlRoom`, `ShareScreen`, `LiveMatrix`.
   - 4g. CommandPalette entry.
   - 4h. `buildTastingPicksMessage` + Send-my-picks wiring.
5. **Pre-flight** — see checklist below.

---

## Pre-flight checklist (must pass before declaring done)

- [ ] GABA exists in `products` table. Grep + DB check, not just .md content files.
- [ ] `npm run lint` (tsc --noEmit) clean.
- [ ] `npm run lint:colors` clean.
- [ ] `npm run test:mobile` clean.
- [ ] Worker curl smoke tests (10 cases): create session, issue code, redeem-new, redeem-existing, submit verdict, re-submit verdict (replaces, doesn't duplicate), guest fetches journal from "different device", host-live, revoke + redeem rejected, capacity check.
- [ ] Manual on real phone: scan QR → join → taste 1 tea end-to-end → save → verify in `/account/journal`.
- [ ] Forgot-password flow works for a passwordless user.
- [ ] Live view in second tab updates when guest submits verdict.
- [ ] `Send my picks` opens WhatsApp with correct number + correct message body.

---

## Out of scope (explicit)

These are deliberately NOT in this build:

- Voice notes redesign (existing TastingSession voice flow used as-is).
- Backfilling old `tasting_session_verdicts` rows into journal entries.
- Email magic-link re-login (forgot-password is the documented path).
- Social features (sharing tastings between guests, comparing notes mid-session).
- Algorithmic recommendations from gathered data.
- Streak / gamification / engagement notifications. (Per CLAUDE.md "DO NOT build" list.)

---

## Things I want Adrian to push back on before I start

1. **Bridge granularity.** Plan: every verdict save writes to journal. Alternative: only on session-complete. I picked per-save (richer, lower-risk). Fine?
2. **Re-saves.** Plan: re-saving same tea in same session **replaces** the TastingRecord (latest-wins). Alternative: append every save (history of edits). I picked replace (avoids 12 records when guest fiddles). Fine?
3. **Guest's first save: account_id stamping.** Plan: bridged journal row gets `account_id = host's account_id`, so it appears in Adrian's customer-tasting view. Alternative: leave it null. I picked host's account because it makes the onboarding-tool framing work — Adrian sees who tasted what, not just disconnected guest accounts. Fine?
4. **Voice notes during session.** TastingSession has voice capture. Stays enabled for guests. Six phones recording voice locally is fine technically; the recordings transcribe and become text notes. Confirm.
5. **GABA SKU.** Need to confirm a real `products` row exists for the GABA you're pouring. I'll grep, then ask.
6. **Other teas Saturday.** Just GABA, or a flight of multiple teas? The flow is built for N teas but I'd like to know what to pre-load.
