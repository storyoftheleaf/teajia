# Track 1: Launch Integrity

> Close the last technical discrepancy in the launch program and keep public editorial controls trustworthy.

Status: one launch-program closure and one Read integrity fix remain. Human, production, and deployed-environment checks live only in [Launch Validation](../LAUNCH_VALIDATION.md).

## Active queue

- [ ] **Retire legacy reading memory coherently.** Remove the unused `MEMBER_MEMORY_LINKS` registry, legacy `teajia_saved_stories` and `teajia_progress_*` state, the unreachable `viewState === 'READER'` branch and `Reader.tsx`, and links from live Read pages to unpublished stories. The live routed D1 article reader remains the only reading path. Add focused route/state coverage proving no public entry reaches retired or unpublished destinations. This closes the final technical precondition named in `LAUNCH_VALIDATION.md`.

- [ ] **Fix owner edit controls on cold-loaded Read pages.** `StoryEditProvider` still relies on Zustand owner state that is not necessarily hydrated on a public cold load. Use the same token-claim-aware authorization pattern as `ReadIndex.tsx`, preserve fail-closed behavior, and cover direct navigation to an editable story.

## Validation

All manual and external completion evidence is tracked in [Launch Validation](../LAUNCH_VALIDATION.md).
