# AR Create talks in the tea record

A local connector reads AR Create through its existing loopback library API. It
makes outbound authenticated requests to Teajia; AR Create itself is not exposed
on the network or changed. Pair it once with a signed-in store owner. Only the
person who paired the private library can search/read it. Reviewed excerpts
linked to a tea are available to that store's authorized curators.

In a tea record, choose **Link a talk from AR Create**. The search starts with the
tea's name; a title or literal phrase can find another talk. Select a result,
review a continuous excerpt, then link it. No source IDs or file paths need
entering. The durable link retains the original source UUID, original hash and
exact excerpt offsets. Linking the same source to the same tea is idempotent;
changing its passage requires an explicit reviewed update. Another tea may use a
separate passage from the same original. Unlinking removes only that reference.

The existing Source/Library/Inventory tea identity remains the owner. Selected
AR passages join linked Teajia notes and transcripts in the existing review.
Fact extraction changes only reviewed missing fields. Description drafting uses
scoped saved facts and exact selected excerpts; each proposed paragraph includes
exact source quotations. The person can edit, discard, explicitly use or undo
the description. Source quotations establish traceability rather than a claim
that every generated sentence is correct. A changed local description or source
selection prevents an older proposal replacing newer work. Drafting itself
writes no tea, product, transcript or manuscript.

The connector is `scripts/ar-create-teajia-connector.mjs` (Node 22+). `--pair`
prints an approval URL and short code; dedicated credentials are stored outside
Git in a private 0600 file. No shop JWT is copied into the connector. The default
command handles queued requests; `--once` handles one poll; `--status` reports
connection metadata. Pair approval expires after ten minutes. One active private
library is paired per store; replacing it revokes the old connector. A different
person's replacement never receives the former person's queued searches.

Search is bounded: up to thirty candidates, ten source reads, thirty results.
It uses title/name matching and literal text recall, not semantic retrieval or a
complete claim about every format in the archive. Unsupported or unavailable
sources remain unavailable rather than guessed. Read requests are limited to
200,000 characters. Full temporary read results expire after an hour and are
purged by bridge activity and the existing hourly Worker cleanup; only reviewed
excerpts are retained as references. The original archive stays authoritative.

The connector computer must be available for new searches and reads. Linked
passages already saved in Teajia remain usable for review when it is offline.
Use **Check original** to read its current version; a changed hash is disclosed
and never silently replaces the reviewed passage.

Migration 0045 adds device, request and link tables only. It changes no existing
tea, inventory, source or price rows. The new API routes use store permissions,
owner-only pairing/disconnect, dedicated connector credentials, bounded bodies,
per-IP pairing limits and the existing provider limit for generation. No live AI
provider or private talk is used by the synthetic test suite.
