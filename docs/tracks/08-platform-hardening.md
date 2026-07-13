# Track 8: Platform Hardening

> Keep authorization, migrations, test infrastructure, and failure handling dependable enough for a second store and a second developer.

Status: launch-critical tenancy coverage is shipped; the active queue contains actionable hardening with observable completion criteria. Manual environment checks live in [Launch Validation](../LAUNCH_VALIDATION.md).

## Active queue

- [ ] **Make Playwright reproducible.** Release checkpoints record successful browser runs, but `@playwright/test` is not declared in the project dependencies. Commit the supported dependency/runner setup, document any required browser installation, and prove `npm run test:mobile` works from a clean install.

- [ ] **Resolve dead Sources and Personal admin navigation.** Make `/admin/sources` land on the intended Sources view with correct role access. Either give `/admin/personal` a distinct supported destination or remove the redundant nav child after explicit navigation approval.

- [ ] **Remove the final `.pill-*` action buttons and block regressions.** Migrate the remaining Platform Admin primary/destructive actions to the shared `Button` variants, then promote lint Rule 9 from notice to blocking.

- [ ] **Delete confirmed dead reference code.** Remove orphaned `src/components/advise/ServiceContent.tsx` and the unimported `src/data/tea-database/` tree. Run focused type/build checks to prove no runtime consumer depended on either.

- [ ] **Set and enforce the customer-route bundle policy.** Decide the correct capability boundary for customer reads and writes from the contact taxonomy, then align `GET`, `PUT`, and `DELETE /api/customers/:id` with tests for allowed roles and denials.

- [ ] **Remove the generic product-update fallback.** Delete the unused `api.products.update()` wrapper, `handleUpdateProduct`, and `PUT /api/products/:id` route after confirming all callers use the domain command routes.

- [ ] **Standardize API error envelopes and stable codes.** Establish `{ error, code?, details? }`, migrate handlers in bounded domain slices, and replace frontend matching on the literal “Account access denied” message with a stable code. Preserve fail-closed auth behavior throughout.

- [ ] **Resolve duplicate migration 017.** Inspect production `d1_migrations`, identify the canonical applied file, remove the duplicate safely, and rehearse clean and legacy migration paths before renumbering any forward migration.

- [ ] **Use durable rate limits for verification and join-code redemption.** Move `handleVerifyRequest` and `handleRedeemJoinCode` off per-isolate memory limiting to a Cloudflare rate-limit binding with distinct keys, then cover limit and recovery behavior.

- [ ] **Enable frontend `strictNullChecks`.** Turn it on without enabling unrelated strictness flags, fix the resulting errors in bounded batches, and keep the Worker’s existing strict configuration intact.

- [ ] **Make transcription failures lossless.** When Worker→Groq transcription fails, preserve the raw recording or a durable reference and keep a client retry path. A provider or mainland-network failure must never silently discard sourcing audio.

## Future only when evidence demands it

Worker modularization, further admin code splitting or idle prefetch, a general IndexedDB mutation queue, and server-side unified search are not active obligations. Open a focused plan only when measured bundle/runtime cost, recurring change risk, offline field use, or search behavior supplies concrete acceptance criteria.

## Validation

Physical-device, mainland-network, deployed-environment, and production checks are tracked in [Launch Validation](../LAUNCH_VALIDATION.md).
