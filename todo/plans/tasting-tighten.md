# Tasting: the map and the tightening list

> Written 2026-11-11 from a read-only, line-by-line pass over `src/components/tasting/` and every door into it. Part of [manage-rebuild.md](manage-rebuild.md). Adrian's rule: the tasting interface is tightened, never stripped. Nothing marked "small visible" or "real change" is built without his yes. Items marked "invisible" change no look and may be built and proven with tests.
>
> Line numbers are as of commit `dc9dbd6`. Existing tasting unit tests pass (56 files, 280 tests).

## The six concepts (Hui Gan, Tang Gan, Qi, Yun, "Opens up", "Chest reach")

None of the six can be entered, changed or removed in the live flow today.

- `tasteQualityState.ts` only holds the five tastes (wired through the wheel) and `setReturningSweetness` (writes `huiGan`, `huiGanIntensity`; only a test calls it).
- The real controls are in `ThroatZone.tsx` (toggles at lines 361 to 382; "Opens up" and "Chest reach" at lines 29 to 30), and nothing imports that component. The live Texture tab draws from `SENSATION_GROUPS` in `connectedSensationsVocabulary.ts`, which has none of the six.
- They are still written by the AI import (`worker/src/curateImportTasting.ts:5`) and shown on the journal card (`TastingJournal.tsx:449`), the saved screen (`TastingSession.tsx:808-809`), the share card (`TastingCard.tsx:78-81`) and counted in the Texture badge (`TastingFlow.tsx:78`).
- To bring them back in the current style: add six terms to `SENSATION_GROUPS` drawn with the existing chip and intensity parts ("Opens up" and "Chest reach" are ordinary finish terms; the four concepts need a small field kind that maps a chip to a yes/no), or put returning sweetness on the Taste side as the v2 handoff intended. Either way new chips appear, so it is a real change. One mismatch to settle: `huiGanIntensity` is 0 to 3, the intensity control is 1 to 5.
- `ThroatZone.tsx:356-383` holds the only written explanations of the four concepts. Keep them.

## The map

**Doors in.** Curate v2: `CurateV2/BrowseCard.tsx:573` (Taste or score button), `CompassEntryDetailPanel.tsx:280`, `CaptureCard.tsx:695`; Today's "taste" opens `FastTastingSheet` (six one-tap questions written to `entry.tasting`), whose "Full tasting" calls `openFullTasting` (`CurateV2/index.tsx:615-621`). Old Curate: `TeaCompass/BrowseView.tsx:733`, `BrowseCard.tsx:220`, `CompassEntryDetailPanel.tsx:256`, `CaptureCard.tsx:810` and `:2172`. Admin: `TastingEditorModal.tsx:139`, `AddProductModal.tsx:1294`, `TeaReviewsPanel.tsx:135`, `InventoryView.tsx:3396`. Customer: `ProductPage.tsx:505`, `MyCollection.tsx:137`, `TastingJournalView.tsx:247`, `SamplePage.tsx:548`, `SessionPage.tsx:255` (group tasting by join code). The guest table card (`TableCardPage.tsx`) does not use this flow.

**Ways out.** Header X, the capsule's centre seal and Escape run `handleCloseRequest` ("Save this tasting?" with Cancel, Discard, Save when there are changes). Account, Search or Menu fire `dismiss-tasting-overlay` (`TastingSession.tsx:272-276`). The saved screen has Done, Order This Tea, Create Purchase Order. Browser back, swipe-back and refresh have no handling.

**What comes in.** `TastingItem` (`id, name, type, image, sourceType, compassEntryId, eventId, eventTitle, teaKey, sourceSampleId`) plus `initialData` from some callers. Pre-fill is `initialData ?? existingEntry?.note.tasting ?? {}` (`TastingSession.tsx:189`). Sample grams are separate (`CurateV2/sampleUse.ts`: typed in the fast sheet, otherwise 5 g, deducted once on close when answered). Storage facts are not carried in. `teaType` is passed and ignored.

**Steps.** Opens on Your impression.

| Zone | What is entered | Field |
| --- | --- | --- |
| Your impression | Love, Like, Neutral, Dislike; want to purchase; add to collection; rating 1 to 10; notes typed or spoken | `impression`, `wantToPurchase`, `inCollection`, `quality`, `notes[]` |
| Texture | Throat feel, texture, weight, after the sip, local sensation, persistence; intensity 1 to 5; own words | `body[]`, `finish[]`, `observationIntensity`, `sensoryCustom.body` |
| Effect | Mood, energy, mind, body, change noticed; own words | `feeling[]`, `sensoryCustom.state` |
| Taste (wheel) | Taste notes, aroma notes, a whole family, the five tastes | `flavor[]`, `aroma[]`, `flavorFamilies[]`, `basicTastes[]` |
| Storage | Character slider; unwanted notes with intensity | `storageCharacter`, `storageNotes[]` |
| Appearance | Liquor colour; clarity | `liquor-color[]`, `clarity` |

**Where it is saved** (`handleSave`, `TastingSession.tsx:373-464`). 1. The local journal (`useAppStore.tastingJournal`, localStorage). 2. `POST /api/tasting-journal/sync` to `customer_tasting_journal` (fire and forget; guests stay local). 3. The note thread when there is a Curate tea or tea key. 4. The caller's own step: Curate writes `tea_compass_entries.tasting`, `tasting_history`, `verdict` through compass sync; a sample calls `api.samples.addTasting`; a session posts a verdict. 5. Admin: the product's profile, and with a tea key a `tea_reviews` draft updated every 2 s.

**What flows back to the tea.** The Curate v2 card's Taste button reads `7/10 ×n`; its history lists date, score and the first two raw flavour ids; the profile strip shows only body, finish, feeling, flavour, liquor colour, brewing.

## Tightening list

Kind: **I** invisible, **S** small visible, **R** real change.

### 1. Anything entered that can be lost

| # | What | Where | Tightening | Kind |
| --- | --- | --- | --- | --- |
| T1 | Taste from a Curate v2 list card or detail panel can open blank, then saving replaces the tea's tasting | `CurateV2/BrowseCard.tsx:684-711`, `CurateV2/CompassEntryDetailPanel.tsx:340-349` (no `initialData`, unlike every other door) | Pass `entry.tasting ?? entry.tastingHistory?.at(-1)?.data` like the others | I |
| T2 | Leaving through Account, Search or Menu skips the journal write; in admin mode the edit is dropped | `TastingSession.tsx:272-276` | Run the real save path (I) or show the same save prompt (S) | I / S |
| T3 | Back, swipe-back and refresh lose an unsaved tasting with no warning | `TastingSession.tsx` (no `beforeunload`, no history entry) | Guard while dirty (I); optionally keep a per-tea draft and offer it on reopen (S) | I / S |
| T4 | The local journal keeps only 100 teas | `src/lib/store.ts:546`, `:630` | Never drop an unsynced or guest entry | I |
| T5 | A second device overwrites a tea's whole tasting history | `worker/src/index.ts:19041-19053` | Merge `tastings` by record id on the server; keep the newer note | I |
| T6 | Two tabs overwrite each other's journal (code read; not run) | `src/lib/store.ts` persist | Rehydrate on `storage` events | I |
| T7 | A failed sync says "Saved" and is not retried until something else changes | `TastingSession.tsx:453`, `tastingJournalSync.ts:155-158` | Retry on reconnect and on focus; optionally a quiet "not yet on the shop" line | I / S |
| T8 | Every new product's tasting lands in the personal journal under the id "new" | `AddProductModal.tsx:1296` with `TastingSession.tsx:406-454` | Skip the journal write when the item has no real id | I |
| T9 | A sample tasting stores "[object Object]" as its note | `SamplePage.tsx:128` | Read note text as `TastingSession.tsx:422` does | I |
| T10 | Saving a sample twice makes duplicate tastings | `SamplePage.tsx:120-154` | One tasting id per opening; update, not append | I |
| T11 | A group tasting's verdict can fail silently | `SessionPage.tsx:274-281` | Show the existing error line and retry | S |
| T12 | An admin review draft can be orphaned or left stale | `TastingSession.tsx:298-312`, `:385-392` | Await the create before submit; surface a failed submit | I |
| T13 | Old and imported words show in the recap but cannot be removed | `tastingRecap.ts:122-123` | A small remove action for recap words that have no chip | S |
| T14 | The fast sheet and the full tasting disagree after a full-tasting edit | `curateV2Model.ts:242-255`, `connectedSensationsVocabulary.ts:456-459` | Make the fast sheet read and write the ids the full tasting uses | I |
| T15 | "Begin new tasting" keeps the previous impression and purchase choice | `TastingSession.tsx:627` | Reset both with the data | I |
| T16 | Escape on an open intensity slider can close the whole tasting | `ObservationIntensity.tsx:177-181`, `TastingSession.tsx:361-371` | Stop the key at the slider | I |

### 2. Recorded but not shown again

| # | What | Where | Tightening | Kind |
| --- | --- | --- | --- | --- |
| T17 | Aroma, families, five tastes, storage, intensities and own words appear nowhere outside the tasting | `TastingProfileStrip.tsx`, `tastingTaxonomy.ts:16-17` | Let the strip read them with the recap's labels | S |
| T18 | The strip and journal print mechanical labels ("Throat Comfortable" where the flow says "Comfortable"); 18 ids affected | `tastingTaxonomy.ts:126-127` | Resolve labels through the flow's own vocabulary first | S |
| T19 | Curate history lines show raw ids ("dried-longan, citrus-peel") | `CurateV2/BrowseCard.tsx:498`, `CurateV2/CompassEntryDetailPanel.tsx:226` | Map through `tastingWordLabel` | S |
| T20 | Earlier tastings of a tea list only date, event and reason | `TastingJournal.tsx:549-570` | Each past row opens to its own read-only strip | S |
| T21 | Notes written in the tasting and the journal's note box are different fields; the journal's text vanishes on reopen | `TastingJournal.tsx:196-212`, `:535-548`; `YourImpression.tsx:85` | The journal box edits the same note | I |
| T22 | An impression chosen from the tea form never reaches the tea's verdict; un-choosing never clears it | `CurateV2/CaptureCard.tsx:1780`, `TeaCompass/CaptureCard.tsx:822`, `:2184` | Pass the verdict through; clear only on an explicit un-choose | I |
| T23 | Curate tasting history is written three different ways depending on the door | `CurateV2/BrowseCard.tsx:697-703`, `CaptureCard.tsx:1783-1788`, `CompassEntryDetailPanel.tsx:346`; old Curate writes none | One shared after-save helper | I |
| T24 | A journal entry opened from the account panel does not update its Curate tea | `TastingJournalView.tsx:247-252`, `:276-279` | Carry the Curate tea's id and update it after save | I |
| T25 | The saved screen shows raw ids and omits most of the tasting | `TastingSession.tsx:802-831` | Reuse `tastingRecap()` | S |

### 3. Dead ends and extra taps

| # | What | Where | Tightening | Kind |
| --- | --- | --- | --- | --- |
| T26 | Journal strip chips look removable and do nothing | `TastingJournal.tsx:494` | Render them read-only | S |
| T27 | The "Would you stock this?" block after saving can never appear | `TastingSession.tsx:868` | Leave, or remove with Adrian's yes | I |
| T28 | Full tasting from Today relies on a quarter-second timer (not run) | `CurateV2/index.tsx:620` | Open when the card reports ready | I |
| T29 | Whether the list returns to the same scroll position after closing | `CurateV2/index.tsx:1628` | Needs one browser check | ? |

### 4. Inconsistency inside the flow

| # | What | Where | Kind |
| --- | --- | --- | --- |
| T30 | Fresh-tasting prompt: Cancel sits beside the confirm on the right; small tap targets | `TastingSession.tsx:592-632` | S |
| T31 | Colour clear button is tiny and dim; the colour bar is 32 px tall and has no keyboard path | `ColorSwatches.tsx:86-104` | S |
| T32 | Saved screen: Done sits on the screen edge on phones without a notch | `TastingSession.tsx:712` | S |
| T33 | Two identical "Keep your tastings" cards can show at once | `TastingSession.tsx:779-800`, `:844-865` | S |
| T34 | Heading styles differ between Storage, Appearance, Taste and the saved screen | `ColorSwatches.tsx:66-71`, `AppearanceZone.tsx:41`, `TastingSession.tsx:745-753`, `:1029` | S |
| T35 | Gold borders at rest (two written rules disagree, see questions) | `TastingSession.tsx:780`, `:849`, `:948` | S |
| T36 | Journal controls below the text floor or under 44 px | `TastingJournal.tsx:269`, `:575-597`, `:616` | S |

### 5. Kept twice

| # | What | Kind |
| --- | --- | --- |
| T37 | Six tasting components are never rendered, about 1,150 lines: `ThroatZone`, `BodyZone`, `StateZone`, `FlavorSplit`, `NotesPanel`, `TeaReviewsComparison`. Keep ThroatZone's vocabulary and explanations; retire the rest only with Adrian's yes | I |
| T38 | Two label resolvers for the same words (`resolveTermLabel`, `tastingWordLabel`); one resolver fixes T18 and T19 | I |
| T39 | Notes flattened four different ways (`TastingSession.tsx:422`, `SamplePage.tsx:128`, `SessionPage.tsx:267-270`, the server); one helper | I |
| T40 | Seven Curate doors each hand-write their own save handler (see T22, T23) | I |

### 6. No test today

The dismiss handler (T2), back and refresh (T3), the 100 cap (T4), `tastingJournalSync` push, merge and hydrate, the server overwrite (T5), the fresh-tasting path (T15), the admin draft review (T12), Curate v2 Browse and Detail opening with the tea's tasting (T1), the fast-to-full round trip (T14), sample save (T9, T10), session verdict (T11), sample grams deduction.

## Questions for Adrian

1. **The six concepts.** Bring Hui Gan, Tang Gan, Qi, Yun, "Opens up" and "Chest reach" back as chips in the current style, or keep them read-only?
2. **Two Save buttons.** The header Save and "Save notes" in Your impression do the same thing. Keep both, or only the header Save?
3. **Earlier notes** are read-only inside the tasting. Should they be editable there?
4. **Group tasting banner** says "Adding to your note for this tea." while the save adds a separate session record. Hide it in sessions, or reword?
5. **Gold borders at rest.** CLAUDE.md says gold only on focus, hover or active; `docs/COLOR_RULES.md` line 102 allows a faint gold border. Which rule?
6. **Admin tastings in the personal journal.** Every admin profile edit also writes the personal journal. Keep, or only for personal tastings?
7. **Tea type hint.** The tea's type was meant to suggest likely flavour families (never preselect) and is ignored. Wanted, or drop it?

## Leave exactly alone

- The four-section capsule with the centre seal as the way out, its fold sequence and reduced-motion handling (`TastingNavigation.tsx`).
- The entrance-only panel swap (`TastingFlow.tsx:392-409`).
- The wheel: lazy loading with "Try again", independent taste and aroma, "Record family", the five tastes, the recap reveal that does not replay.
- Texture and Effect: the vocabulary, one-choice groups, "No clear change" clearing other effects, intensity attached to the chip, own words, the explanations.
- Storage: the character rail with drag, keyboard and settle; unwanted notes; Clear.
- The close prompt: an unchanged tea closes in one tap, Escape backs out of the prompt first, "Save and close".
- Save stays open after saving; "Retry" and the error line keep edits.
- The recap with resume links; opening on Your impression; the header name and "Impression".
- Guest honesty: "Saved on this device only", and the account invitation after saving, not before.
- Sample grams used once per opening, only when answered.
- The fast sheet's six one-tap questions.
- The legacy throat conversion and tolerant note reading.
