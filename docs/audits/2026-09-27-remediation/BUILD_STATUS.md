# Audit remediation build status

Audit baseline: `2a09630333a9fe1fb449c205b73e51d4af7f7f19`.
Implementation base: `02d698128bc46343d63215e7515c610e746c276e` (current main including ordering PR 314).
Branch: `codex/audit-remediation`.
Checkout: `/Users/adrianrasmussen/.codex/worktrees/teajia-audit-fixes/teajia`.

All 22 code findings are implemented and verified; bounded acceptance corrections are included. No migrations, production writes, push or deployment performed. The release manager owns final integration and deployment.

| Finding | Result | Verification | Implementation commit |
|---|---|---|---|
| BIZ-01 | Preserve inherited freight and explicit zero retail/threshold values in shared product adapter. | Adapter unit cases; freight/default guards | ac40bd55 |
| SEC-01 | Check open/public store before child routes and before catalogue cache hits. | D1 request cases; fresh closure gate on cached response | ed7b8228; 5f7794cd |
| SEC-02 | Separate public discovery, direct unlisted links, private events and active/public host requirements. | D1 discovery/detail/RSVP cases | ed7b8228 |
| SEC-03 | Public shop collections require shown public products and an open store. | D1 collection cases; explicit recipient sharing preserved | ed7b8228 |
| BIZ-02 | Clear order items on identity change, ignore late loads, prohibit saves until current order loads. | Real modal delayed/failed load tests desktop/mobile | 07f2d713 |
| BIZ-03 | Keep committed invoice after PDF/share failure; retry sharing only. React-PDF upgraded for React 19. | Real PDF generation and failed-share retry; one invoice POST | 07f2d713 |
| BIZ-04 | Scope private queries by account/user/auth generation, clear on auth change, persist public allowlist only. | Mounted app A→failed B→late A→logout tests desktop/mobile | ac40bd55 |
| CONTENT-01 | Serialize article content and publication writes; ordinary saves omit status. | Delayed autosave/publish mounted editor; helper unit cases | 5f7794cd |
| OPS-03 | Retain receipt intent key through ambiguous outcomes and refresh failures; stop further writes while unresolved. | 20 transaction behavior cases, including rejection and late-account responses | 07f2d713; 0c8c6942 |
| SEC-04 | Authorize incident tenancy against live membership/platform access and prefix dedupe by tenant. | D1 authorization and tenant dedupe cases | ed7b8228 |
| BIZ-05 | Map raw story products through the shared admin adapter. | Raw response unit and actual route desktop/mobile | 07f2d713 |
| BIZ-06 | Use explicit vendor product contract and real purchase records; preserve economics honestly. | Seven units; restored USD metrics and zero PO total on desktop/mobile | 07f2d713; 0c8c6942 |
| BIZ-07 | Advance saved values only after successful writes and expose unchanged retry. | Unchanged retry plus two delayed-save/latest-edit mounted tests | 07f2d713; 0c8c6942 |
| BIZ-08 | Use shared authenticated client for MCP tokens and event/venue uploads. | Session-storage-only authentication contract tests | 07f2d713 |
| PUB-01 | Separate product inventory outage from genuine missing product and offer retry. | Desktop/mobile public failure-and-recovery browser | 5f7794cd |
| PUB-02 | Separate failed storefront catalogue from successfully empty stock and offer retry. | Desktop/mobile public failure-and-recovery browser | 5f7794cd |
| PUB-03 | Remove unsupported review totals and unearned verification badge. | Browser checks no unsupported request/claim | 5f7794cd |
| CONTENT-02 | Share one article creation across overlapping saves. | Pending create + subsequent autosave browser/helper cases | 5f7794cd |
| CONTENT-03 | Replace indefinite event spinner with failure/missing and retry states. | Event failure and same-route recovery desktop/mobile | 5f7794cd |
| OPS-01 | Report partial intake success and retry pending purchase records without replaying inventory insertion. | Delayed failure; clear staging then retry; one bulk create | 07f2d713 |
| OPS-02 | Create contacts and relationships through the existing single POST. | Actual contact form desktop/mobile: one create, zero relationship PUT | 07f2d713 |
| UI-01 | Wrap inventory purpose labels without changing their names or height chain. | 390/768/1440 screen checks; inventory scroll and rail clearance | 07f2d713; 0c8c6942 |

LIVE-01 remains an operational decision: read-only verification found Bali active/public, a linked published recipient, no order email or WhatsApp, and no eligible published payment methods. The ordering gate remains intact; configuration was not changed. Adrian must supply the intended contact/payment details to the release manager.

See [BUILD_REPORT.md](BUILD_REPORT.md) for exact verification outcomes, evidence, known limits and handoff details.
