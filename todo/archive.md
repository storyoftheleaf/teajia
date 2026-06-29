# Teajia TODO — Archive

Finished work, moved here from TODO.md. Nothing is deleted; lineage is kept.

## Curate

- [x] Make Curate deletes survive being offline — done 2026-06-29 via tombstones: a deleted id is recorded locally and filtered out of hydrate so the still-on-server row can't reappear; the delete is retried on each hydrate until the server confirms it. Fixes "I deleted it and it came back."

## Read / Magazine

- [x] Build the immersive article reader that replaces the 4:5 carousel as the default, where writing leads and visuals plus text-effects punctuate it, reading great on phone and desktop _(done 2026-06-17 — AR.0–AR.6 shipped: scroll-driven reader, section families, ~12 text-effects, block-stack authoring, share-card generation; merged into main)_ → Plan: [immersive-article-system.md](plans/archive/immersive-article-system.md)
