# J9 audit: the waiting list and a released seat (Astra, at main 0bf5faf, 2026-11-26)

Findings 6 (public answer carries the address) and 8 (copies lose visibility) are fixed by H0, PR 492.
Patch the rest in J9, after Launch 2's H5. All line numbers at 0bf5faf, worker/src/index.ts unless named.

1. Cancel frees the RSVP but not its party seats (eventDomain.ts 294-308 counts party seats regardless of RSVP status). The offered guest then gets 409 capacity_conflict. Waitlist positions can tie under concurrent host actions; selection has no final tie-breaker.
2. Concurrency: two cancels (or a repeated cancel) give two offers to the same guest and overwrite the deadline; cancel does not require a previously confirmed RSVP; selection includes guests who already hold an offer. Generic attendee editor (13976-13988) writes status directly, bypassing the guarded allocator. Deny promotes without checking a seat was freed. Claim at exact expiry: SQLite whole-second compare; expiry cleanup clears by attendee id only, so a stale cleanup can wipe a renewed deadline.
3. A cancelled two-person party returns zero seats; an unclaimed companion invitation stays pending. A companion who already claimed keeps their own seat (correct).
4. An expired offer never advances the queue (scheduled worker 32581-32608 does nothing); an expired claim (410) re-offers to the same guest, so the next guest waits forever.
5. Host can lower capacity below confirmed plus live offers (13745-13759); MCP confirm does not repeat the preview check (mcpTools/events.ts 603-643).
7. The host gets no notice of cancel, promotion, expiry or claim; a claim record is marked 'sent' with no delivery.
