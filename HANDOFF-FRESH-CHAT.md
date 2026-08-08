# Handoff to fresh chat: finish the Tea knowledge integration

Open a new chat in the Teajia project and paste the block below.

```
Execute the final Tea knowledge integration specified in docs/_notes/tea-knowledge-final-integration.md.

Before touching code, read in this order:
1. AGENTS.md in the Teajia project root.
2. docs/_notes/wisdom-integration-handoff.md, especially the 2026-08-08 audit deltas.
3. docs/_notes/tea-knowledge-final-integration.md.
4. context/knowledge/AI-Philosophy.md in the i64os repository.
5. context/knowledge/Tea.md in the i64os repository.

You do not need to re-survey the branch integration, database migration, public wisdom reference, product-page wisdom band, reference redesign, or old Phase 1.3 endpoint. They were verified complete on 2026-08-08. The Tea domain is not empty. MCP routing supersedes Phase 1.3. Direct knowledge_assimilate writes are forbidden.

Execute both bounded parts of the brief:
1. Build the deterministic, manual, hash-based proposal sync. Preview the complete eligible corpus, prove byte determinism and idempotency, then enqueue at most the first 25 new or changed proposals through capture. Leave them waiting for Adrian's review. Never approve or assimilate them.
2. Rehearse the live Curate importer with the specified Yunnan Sourcing Yi Bang record. Verify the untouched extracted description and processing notes plus the other required fields, preserve evidence, and abandon the draft without finalizing inventory. If the real record exposes an extraction defect, fix only that path, add a focused regression fixture, deploy the changed surface, repeat the rehearsal, and abandon the replacement draft.

Use isolated branches if both Teajia and i64os change. Do not disturb unrelated changes in either main checkout. For Teajia, run npm run lint, npm run lint:colors, npx vitest run src worker/tests, and npm run build. Run focused i64os tests and its relevant typecheck. Browser-verify the live rehearsal at mobile and desktop widths with no console errors or horizontal overflow. If worker code changes, deploy it manually and verify behavior; do not touch or document any Infisical or Cloudflare token.

Hard rails:
- No direct knowledge_assimilate call. capture plus Adrian's review click is the trust boundary.
- No automatic schedule or permanent sync service. Manual command, preview by default, maximum 25 proposals per apply.
- No finalizing the vendor import and no creation of products, inventory, receipts, vendors or sourcing runs.
- No secrets in output, files, logs, commits or handoff notes.
- No em-dashes in code comments or user-facing copy.
- Preserve Teajia's quiet design and existing interfaces. This is integration plumbing, not a new user-facing AI feature.
- Send a clickable dev-server URL when a visible fix is ready to inspect.

When the first proposal batch is waiting, the real import draft has been verified and abandoned, all checks pass, and any needed deploy is live, stop and report. Do not review captures, populate live cultivar fields, run later batches, repair deployment credentials, or start unrelated inventory work.
```

---

## Context for after this handoff lands

Adrian can review the first 25 Tea captures, then run later capped batches when ready.
Populating cultivar pointers on the 192 live products remains a separate curation task.
The unrelated `wip/inventory-mobile-sheet` branch also remains outside this handoff.
