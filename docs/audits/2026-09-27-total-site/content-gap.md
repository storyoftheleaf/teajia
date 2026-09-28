# Editorial, collections, Wisdom, and event admin contract audit

Source inspection on 2026-09-27. No browser, server, production data, product edit, or commit was used. Missing pictures were excluded. Existing security, business, and public reports were consulted to avoid repeating their findings. These are code-path findings; the manager owns browser reproduction and tests.

## Confirmed source defects

### CONTENT-01 — Article save can undo a successful publish (P1, high confidence)

The article payload always includes the editor's current `status` (`src/admin/components/ArticleEditorModal.tsx:545-564`). A field change schedules an auto-save, and the save sends that full payload (`:567-600`). Publish is enabled whenever the article has an ID, even while `saveState === 'saving'` (`:763-782`), and sends a separate request (`:606-623`). The Worker permits `status` in ordinary article updates (`worker/src/index.ts:21991-22002`), while the publish endpoint also writes it (`:22012-22026`).

Reproduction: open an existing draft, edit a field, wait for the auto-save request to start, then click Publish before that request settles. If Publish commits first and the older save commits second, the editor toasts “Article published” and shows Published locally, but the stored article ends as draft. Clicking Publish before the debounce fires can also publish stale body text briefly. The two operations need one ordered state transition; a plain content save should not write publication status.

### CONTENT-02 — Two overlapping saves can create duplicate new articles (P2, high confidence)

For a new article, `save()` chooses create whenever its captured `articleId` is null, and only sets the ID after create returns (`src/admin/components/ArticleEditorModal.tsx:567-577`). The manual Save button calls `save()` (`:778-785`) while a scheduled auto-save can independently call it (`:594-600`). The `saveState` check only disables the button after React rerenders and does not gate `save()` itself. The Worker create endpoint inserts a new UUID for every accepted request (`worker/src/index.ts:21918-21959`).

Reproduction: type a title, click Save as the 1.5-second auto-save timer fires, and keep both create responses pending. Both calls may use null `articleId`, so two drafts are created. The last response determines which one the editor keeps. Serialize creates or make the first in-flight create promise the single source of the article ID.

### CONTENT-03 — Failed event detail request leaves a permanent loading spinner (P2, high confidence)

`useEvent` rejects when the admin event fetch fails or returns no event (`src/admin/hooks/useEventData.ts:92-104`). `EventDetail` reads only `data` and `isLoading` from that query (`src/admin/components/EventDetail.tsx:285-290`), then renders the loading spinner whenever `!event`, regardless of `isError` (`:384-390`).

Reproduction: open `/admin/events/:id` while the event GET returns 500 or the event was deleted. After React Query settles, the page still shows the spinner indefinitely, without an error or retry control. Read `isError` and render a retryable failure state; reserve the spinner for an active load.

### CONTENT-04 — Event briefing cards can be saved to the wrong event after a route-ID change (P2, high confidence; route reuse needs browser confirmation)

`briefingCards` is component state initialized to null (`src/admin/components/EventDetail.tsx:327`). The ID-change effect resets the article draft but leaves those cards intact (`:333-338`). The event-load effect fills cards only while they are null (`:366-370`). The save handler sends `localBriefingCards` to the currently rendered event ID (`:420-425`).

Reproduction: keep the detail component mounted while its route changes from event A to B, open B's Briefing tab, then save. A's cards remain in component state and are submitted to B. The route has the same `events/:id` element for either ID (`src/admin/AdminApp.tsx:544`), but whether the app's normal navigation reuses the component should be checked in the browser. Reset card state on ID change or key the detail component by ID.

## Journey coverage without another confirmed defect

- **Collections:** traced create (`CollectionsView.tsx:66-78`), detail loading and retry (`CollectionEditView.tsx:244-250,452-465`), item patch and failure (`:74-105`), metadata save (`:312-324`), and person/tag/store publication (`:1109-1142`) through the Worker item and publication handlers (`worker/src/index.ts:22909-23099`). The highest-risk untested journey is response loss after a successful person publication: the UI may offer Retry while the first publication exists. A live delayed-response test is needed to tell whether duplicate links are material in normal use.
- **Wisdom:** traced relation proposal, approval, deletion, public-state override, query invalidation, and error display (`src/admin/components/wisdom/relations.tsx:342-400`) through the REST adapter (`relationsApi.ts:239-274`). The highest-risk untested journey is a two-operator approval/override conflict: the client refreshes after writes but has no explicit revision check. This is a concurrency test candidate, not a confirmed defect.
- **Event admin:** traced the event GET, briefing/venue edits, interest conversion, and event-to-article draft creation (`EventDetail.tsx:285-429`); draft creation checks the event ID before applying a late response (`:340-354`). The two event findings above concern the primary load and local briefing state. The event-to-article endpoint's production-data behavior was not exercised.

No visual defect is claimed from source inspection.
