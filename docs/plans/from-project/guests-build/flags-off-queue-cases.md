# Waiting-list cases with ANYONE_HOSTS_OPEN off: before PR 560, and now

Found by the switches-off parity check on 2026-11-27. Left untouched for fix-seats on build/review. Each case gives the input, what happened before 560, and what happens now.

1. **Expired claim.** Before 560: 410 `{error:'Claim window has expired'}` with no code. The offer was cleared, and the cascade offered the first waitlisted guest, who could be the same guest again. Now: 410 with `code:'offer_expired'`. An offer made by the new code is lapsed, and the next guest is offered, never the same one.
2. **Claim with no deadline but `offer_lapsed_at` set.** Before 560: 400 "No claim offer pending". Now: 410 `offer_expired`.
3. **Cascade with no seat free** (for example, denying a requested guest at a full table). Before 560: the first waitlisted guest got a claim window, and a `waitlist_promotion` row was written. Now: no offer.
4. **Cascade when the first waitlisted guest already holds a live offer.** Before 560: that guest's deadline was renewed. Now: no offer to them. The next guest is offered only if a seat is free.
5. **Deny a waitlisted guest who holds a live offer.** Before 560: 200 `denied`, then the cascade ran. Now: 409 `state_conflict`.
6. **Deny a requested guest.** Before 560: the cascade ran after the deny. Now: no promotion.
7. **Move a guest to the waiting list.** Before 560: any guest was accepted, and a cancelled or already-waitlisted guest got a new position. No offer was made. Now: 409 unless the guest is requested, denied or lapsed. If a seat is free, an offer goes out right away.
8. **One release frees several seats.** Before 560: one seat was offered per release. Now: every free seat is offered.
9. **A seat frees at a request-door table.** Before 560: the first waitlisted guest got a claim window. Now: that guest goes back to `requested` (`returnWaitingToAsking`).
10. **Scheduled run.** Before 560: it did nothing. Now: it lapses expired offers made by the new code and offers the next guest. This is dormant while off, because only the new code writes the 'offered' notices it looks for.
11. **Removing a plus-one.** Before 560: it used its own cascade. Now: `offerFreedSeats`.
12. **Cancel, release and claim.** Before 560: no seat notices were written. Now: rows go to `event_seat_notices`, which nobody sees while the switch is off.
13. **Admin cancel or link cancel when the guest's status changed in between.** Before 560: always 200. Now: 409 `state_conflict`. This only happens in a race.
