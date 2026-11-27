# Credit ledger review and M6 tool inventory (2026-11-26)

## Host credit ledger, correctness review (Astra, build/launch-5-credit c82972d4)

Rules kept: 1 (amounts only from stored rows) and 7 (no ceiling means no earning approval).
Rules not kept, being fixed on build/l5-credit-fixes:
- 2. A Void overlapping a Fill settlement can leave an earning unreversed (hostCreditLedger.ts:163 and :274).
- 3. A platform owner without shop membership passes the spend approval check (index.ts:24303). Only the shop owner should.
- 4. A Void after the credit was spent leaves a negative balance; posted ledger rows can be updated or deleted by direct SQL (no triggers in 0135).
- 5. A host who claims their own signed-out order after settlement keeps the credit from it (hostCreditLedger.ts:195, :202).
- 6. Unusable stored terms open no incident; a healthy shop's check clears another shop's open incident (hostCreditLedger.ts:331).

## M6: actions with no agent tool (Astra, main 56e4a266)

The largest gap is a person's own data: a guest or member has no tool for their own invitation, thank-you, journal, Tea Chest, shelf, favourites, received cards, orders and payment claims, personal page and pay access. Hosts lack tools for venue setup, menu and poured teas, private thank-you links, guest book review, recap credits and live tastings (Launch 2's fewHosts.ts covers hosted tables). Adrian's side lacks tools for sourcing evidence, purchases, specialist stock edits, wholesale, invoice exceptions, contact management, editorial review, moderation, shop and platform administration, and agent token management. Full table is in the Mac report; the point for M6 is whose data a tool acts on: get_session_thanks, set_tasting, get_invoice and set_photograph_use exist but none acts for the guest on their own record.
