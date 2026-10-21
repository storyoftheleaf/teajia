# One tea record, connected source material

## Working in this change

Source, Library and Inventory retain the Compass entry ID and durable product link. Notes and recordings use the existing account-scoped Notes owner, anchored by Compass entry ID or the migrated tea key. The shared record reads both those notes and older entry notes/audio transcripts; exact duplicate text is considered once while attribution remains visible.

The embedded AI review reuses `/api/curate/said/file`. A person selects material or excerpts, requests extraction, reviews every proposed fact, and explicitly applies checked missing details. Current typed answers, descriptions, tasting judgments and originals are preserved. The endpoint accepts at most 4,000 characters and returns at most twelve parts. This is bounded extraction, not a claim to process an entire talk or generate a description.

## AR Create connection still required

AR Create owns its original talks, source UUIDs, source hashes and exact passage selections. There is no existing Teajia connector or tea-ID binding in the documented contract. Its installed local service is not a phone-accessible Teajia API. Do not expose its loopback service or represent a local URL as a working phone connection.

The proposed bridge would bind a selected AR source/version/passage to `(Teajia account ID, Compass entry ID)`, retain origin, author and exact selected text, and make that version available to the same review flow. Keep AR Create as the original owner. Refreshing a changed source must disclose staleness and preserve reviewed excerpts; it must not silently replace an accepted tea description. No separate editable tea dossier or second original transcript should be created.

Start with explicit talk/passage links as the recommended ownership model; automatic matches would remain unaccepted suggestions with exact supporting passages. Before implementing the bridge, confirm the retrieval choice, use an authenticated transport reachable by the phone, and define the minimal persistent reference/read contract with the AR Create owner. No private AR content has been retrieved, uploaded or changed by this UI work.

A source-grounded description proposal also needs a real generation/review contract. It should use only selected evidence and established facts, show citations, retain the current description alongside the proposal, and save approved wording into the existing Compass description. Inventory publication remains a separate decision.
