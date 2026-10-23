# Read-only Library development preview

Implementation prepared 2026-10-23. Requires migration 0047, the worker routes,
and the live authorization page before it can connect to real data.

Start the existing development server bound to 127.0.0.1, port 7789, then open
`http://127.0.0.1:7789/dev/library-preview`. Choose Connect Library. The signed-in
live owner approves the named local destination, then returns to the same tab.
An eight-hour session survives reloads in that tab. Closing the tab discards it.
The owner can revoke connections at `/dev/library-preview/authorize` on the live
site. Local Disconnect clears the local session and displayed data; it does not
substitute for server revocation.

## Boundary

- No ordinary user JWT is sent to localhost. The capability is opaque, hashed
  at rest, and never accepted by the normal API, MCP, auth refresh or media.
- Issuance requires a current owner session and a live-site Origin. A random
  single-use code expires after 60 seconds and is bound to a SHA-256 verifier
  held only in the initiating localhost tab. It is consumed atomically.
- Only the exact local origin above is allowed. No wildcard ports, arbitrary
  redirects, or query-selected API hosts. The code travels in a URL fragment,
  removed before redemption. Snapshot and exchange responses are no-store.
- Snapshot access rechecks owner rights, account active status and session
  version every time. Session expiry and revocation fail closed. The shared
  sign-in rate limiter protects issue and redemption.
- The only read is a projected Library snapshot: suppliers, source quotes,
  tasting-present status, recorded order quantities, receipts and exchange
  rates. Private notes, tasting text, photos, audio and contacts are excluded.
- The local screen uses production BrowseCard, supplier grouping and purchase
  quantity calculations. Its actions open read-only details. No admin sync is
  mounted and no capability enters ordinary auth storage.

Browser-only drafts cannot be read from the server. The page says so. An order
without a durable arrival record has unknown received/incoming quantities;
stock on hand is not used to guess a receipt. This is read-only access to real
records, not a promise that code running on the local computer can be trusted
absolutely. Treat the preview workstation and its dependencies as trusted.

## Verification

`NODE_OPTIONS=--experimental-sqlite npx vitest run worker/tests/library-preview.test.ts src/lib/libraryPreviewSession.test.ts`

The worker tests use the migration ledger and cover concurrent redemption,
replay, wrong verifier/origin, expiry, revocation, loss of ownership, account
suspension, session-version invalidation, cross-account isolation, forbidden
writes/refresh/MCP, and minimal snapshot projection. Frontend tests cover
separate storage, expiry, fragment removal, single-flight redemption and fixed
API/destination URLs. The full live round trip still needs post-release proof.
