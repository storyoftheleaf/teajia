# Reproduction and verification commands

Run from the repository root. These commands document what was run; they do not authorize live mutations. Browser commands used audit-owned Vite at 7802 with `VITE_API_URL=http://localhost:7802`, so all APIs used the test mocks. The final real local sandbox frontend used `TEAJIA_API_PROXY=http://localhost:8788 VITE_API_URL=http://localhost:7803 npx vite --port 7803 --strictPort` and a temporary database copy.

```sh
npm run lint
npm run lint:colors
npm run build
npm run test:worker

PLAYWRIGHT_BASE_URL=http://localhost:7802 npx playwright test tests/shop-refinement.spec.ts tests/inquiry-delivery.spec.ts tests/order-detail.spec.ts tests/inventory-scroll.spec.ts tests/account-panel-mobile.spec.ts tests/customer-money-mobile.spec.ts tests/signin-email-code.spec.ts tests/operator-multi-store.spec.ts tests/personal-tea-journey.spec.ts --project='Desktop Chrome' --project='Mobile Chrome' --workers=3 --reporter=list --output=docs/audits/2026-09-27-total-site/evidence/playwright-results

PLAYWRIGHT_BASE_URL=http://localhost:7802 npx playwright test tests/account-panel-mobile.spec.ts --project='Mobile Chrome' --workers=1 --reporter=list --grep 'Read \(/read\)|Community \(/community\)|Find a Teahouse|Consult \(/consult\)|Admin Stock|Admin Events|Admin Platform|Admin Team|Admin Activity|Tea Master profile routes|Member sample continuation|Shop \(/shop\)' --output=docs/audits/2026-09-27-total-site/evidence/browser-followup-results

PLAYWRIGHT_BASE_URL=http://localhost:7802 npx playwright test tests/contributor-publishing-journey.spec.ts tests/event-photo-essay.spec.ts tests/collections-inbound.spec.ts tests/collections-public.spec.ts tests/inventory-import-review.spec.ts tests/compass-receipt-possession.spec.ts tests/inventory-movements.spec.ts tests/compass-import.spec.ts --project='Desktop Chrome' --workers=2 --reporter=list --output=docs/audits/2026-09-27-total-site/evidence/gap-tests-results

npm audit --omit=dev --json
```

Security probes have their exact build and run commands in [security-probes.md](evidence/security-probes.md). Once those bundles exist, run the additional real Worker probes with:

```sh
node --experimental-sqlite docs/audits/2026-09-27-total-site/evidence/invoice-persistence.mjs
node --experimental-sqlite docs/audits/2026-09-27-total-site/evidence/receipt-persistence.mjs
```

The real-component browser fixtures are the paired `*-fixture.html`/`.tsx` and `*-repro.mjs` files in evidence. They use current components with synthetic API responses and captured writes. Run the script with Node after starting the fixture server at 7802. Browser fixture writes are intercepted; the Worker probes use in-memory D1. No production customer/order records are needed.

The original route sweep was taken against live public GETs and the stale local sandbox. `focused-browser.mjs` replaces its important admin checks using the isolated copy. The temporary copy applied migration 0009 to add missing freight columns; that migration never ran against production or the original local database.
