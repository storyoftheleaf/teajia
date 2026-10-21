# One tea record, connected source material

## Working in this change

Source, Library and Inventory retain the Compass entry ID and durable product link. Notes and recordings use the existing account-scoped Notes owner, anchored by Compass entry ID or the migrated tea key. The shared record reads both those notes and older entry notes/audio transcripts; exact duplicate text is considered once while attribution remains visible.

The embedded AI review reuses `/api/curate/said/file`. A person selects material or excerpts, requests extraction, reviews every proposed fact, and explicitly applies checked missing details. Current typed answers, descriptions, tasting judgments and originals are preserved. The endpoint accepts at most 4,000 characters and returns at most twelve parts. This is bounded extraction, not a claim to process an entire talk or generate a description.

## AR Create and description review

The [AR Create tea connection](AR_CREATE_TEA_CONNECTION.md) now implements outbound pairing, private library title/phrase search, exact reviewed source references and source-grounded description proposals. AR Create retains its originals. The same tea record accepts selected facts and approved wording; it does not create a second tea dossier or manuscript. Runtime activation and the one-time owner pairing are separate from implementation and synthetic verification.
