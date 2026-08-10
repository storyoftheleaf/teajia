# Events Platform Rebuild Design

**Date:** 2026-08-10

**Status:** Approved

**Scope:** Public sessions, RSVP and attendance, Tea Master and team participation, store operations, post-session memory, content, inventory, communications, and human-led commerce.

## Purpose

Rebuild Events as dependable professional tea infrastructure. A session should connect the public shop, Tea Masters, event team, guests, teas served, customer history, private tasting memories, published recaps, and optional post-event inquiries without turning Teajia into a ticket marketplace, social network, or phone-at-the-table product.

The rebuild preserves the strongest existing work: the event landing experience, RSVP and approval surfaces, venues, tea menus, guest invitations, AccountPanel entry point, customer Journey, post-session editor, article drafting, stock holds, and source-event invoice attribution. It replaces contradictory lifecycle rules, broken client/server contracts, contact-based identity inference, unsafe capacity checks, incomplete team attribution, and automatic sales assumptions.

## Product Decisions

1. **Your Table remains the personal doorway.** Primary navigation is unchanged. Sessions appear through Your Table and contextual links on stores, Tea Master profiles, teas/products, recaps, Journey, and customer records.
2. **Global discovery is network-wide and opt-in.** The public Sessions directory includes public events from every opted-in public shop. Private and invitation-only events never enter the network projection.
3. **Paid-session checkout remains personal.** Booking and payment happen through a human WhatsApp conversation. Teajia records reservation and payment state afterward; it does not introduce automated ticket checkout.
4. **The table remains phone-free.** The separate live co-tasting interface is retired or hidden. Its stronger identity and journal-provenance patterns may be reused, but guests are not asked to operate an app during tea.
5. **There is no attendee social graph.** Guest connection is limited to explicit contact exchange or host-mediated introduction. There are no attendee directories, follows, likes, feeds, or algorithmic recommendations.
6. **Attendance is not purchase intent.** Completing an event never creates sales or invoices automatically. An attendee may deliberately select tasted teas or request a consultation afterward, which opens a store-scoped WhatsApp inquiry. An operator may later convert that human-confirmed inquiry into an order or invoice.

## Delivery Strategy

Use a domain-first staged rebuild inside the existing Events implementation. Establish one lifecycle, one capacity allocator, one verified identity path, one public projection, and explicit Tea Master/team relations before broadening the interface. Each release must leave the system coherent, usable, and covered by focused tests.

The four releases are:

1. Trust and identity.
2. Customer journey.
3. Operations.
4. Memory, contextual discovery, and human-led growth.

## Domain Architecture

### Account and public shop

Every event occurrence belongs to one account. The account owns the operational data: venue, inventory, CRM relationships, communication configuration, payment status, and staff access. Public event projection additionally requires the account and event to be public and opted into network discovery.

### Event series and occurrence

An `EventSeries` stores reusable defaults and recurrence intent. An `EventOccurrence` represents one gathering with its own date, venue, capacity, roster, tea service, team, communications, attendance, and closure records.

Existing `events` rows become occurrences. A series is optional. Creating the next occurrence copies only approved defaults; it does not copy attendees, communication history, attendance, stock usage, memories, or publication state.

### Event contributors and team

`EventContributor` connects an occurrence to the existing global Contributor identity. It records:

- lead host;
- co-host or guest host;
- photographer or content contributor;
- public visibility;
- display order;
- attribution/byline behavior.

Public contributors must have a valid account association for the event account unless the event owner explicitly adds an external guest contributor through the supported Contributor flow.

`EventTeamAssignment` connects account members to operational roles such as coordinator, service, assistant, inventory preparation, communications, and photographer. Contributor identity and operational assignment are separate because a public Tea Master is not necessarily the person managing the roster or communications.

### Participation and parties

`EventParticipation` is the authoritative booking identity. It can reference:

- a verified global `user_id`;
- the account-local `customer_id`;
- the event occurrence;
- the booking contact snapshot;
- participation and payment state;
- communication and privacy consent.

`EventPartyMember` replaces implicit `plus_one` and JSON-only guest accounting. It stores each reserved seat, guest name when known, invitation state, claim identity, and attendance result. One participation owns the primary attendee seat and zero or more party-member seats.

The account-local Customer remains the shop's private CRM record. Cross-store personal history is derived from verified User identity, never from raw phone or email matches across accounts.

### Tea service

`EventTeaServing` records what the host planned and what was actually served. It may reference:

- an account-owned product or listing;
- a canonical tea profile where available;
- a source lot or holding where available;
- an immutable served-name, origin, type, and year snapshot;
- planned grams per guest;
- planned total grams;
- actual used grams;
- waste or remaining grams;
- public reveal state and service order.

Inventory holds are derived from the current plan. Holds are recalculated when capacity, tea service, or relevant lifecycle state changes. Completion consumes actual usage and releases unused holds. Cancellation releases all holds.

### Attendance, memory, publication, and inquiry

Attendance is separate from booking. Each primary attendee and party member can be checked in, attended, marked no-show, or cancelled. Post-event tasting input requires confirmed attendance and a completed occurrence.

`EventMemory` is a private, server-authoritative attendee journal record connected to User, Customer where appropriate, occurrence, tea serving, attendance, and provenance. Anonymous guests may retain local drafts, but only verified server records feed Journey or Tea Discovery.

`EventConsent` stores granular choices for communications, photography, public quotation, review publication, and explicit contact exchange. Saving a private note never implies permission to publish it.

`EventPublication` separates operational completion from public storytelling. Recap and article content have draft and published states, public attribution, contributor bylines, consent-aware source material, and canonical links.

`EventInquiry` records deliberate post-event interest in selected teas or a consultation. It connects the event, attendee/User/Customer, account, selected tea servings, message, and WhatsApp handoff. It may later link to an order or invoice after human confirmation.

## Lifecycle Design

### Event lifecycle

The canonical operational states are:

- `draft`: private setup;
- `published`: publicly visible where policy allows and accepting the configured RSVP mode;
- `registration_closed`: public detail remains available, but new direct confirmations stop;
- `completed`: attendance and tea usage are final; post-event memory may open;
- `cancelled`: explicit terminal state retaining history and cancellation communication;
- `archived`: operationally quiet historical record.

Cancellation is not deletion or archive. Archiving is not cancellation. Recap publication is an independent draft/published state and does not depend on overloading the operational status.

Historical public detail remains available for eligible published events. A completed event can lead into a published recap. Journey seals link to the historical event or its recap rather than an active-only endpoint.

### Participation lifecycle

The normal approval path is:

`requested → confirmed → attended | no_show`

The waitlist path is:

`waitlisted → offered → confirmed | expired`

Other explicit outcomes are `denied` and `cancelled`. Historical participation records are retained rather than silently removed.

Waitlist offers hold the required seats until their expiry. Claim is single-use, capacity-protected, and idempotent. Expiry releases the seats and advances the next eligible party.

### Atomic seat invariant

For every event:

`available seats = capacity - held seats`

Held seats include confirmed primary attendees, confirmed/accepted party members, and unexpired waitlist offers. The value exposed publicly is clamped at zero.

RSVP, single approval, batch approval, waitlist claim, and guest-invite claim all use the same atomic allocator. No path may read capacity and insert or update later without a guarded transaction. A request that cannot reserve its full party never partially confirms.

## Identity and Tenant Boundaries

Authenticated RSVP atomically connects the signed-in User, the event account's Customer, and EventParticipation. Existing Customers may be claimed only through verified matching and conflict rules; raw contact coincidence does not silently merge records.

Legacy magic-link participants can claim their attendance into a signed-in account using a verified token. The claim records provenance and does not overwrite a Customer already bound to a different User without explicit operator resolution.

All operational queries remain account-scoped. Event child references must be verified against the parent event's account, including Customer, venue, space, product, listing, team member, contributor association, communication record, tea serving, and note.

Cross-store personal Journey uses verified `user_id`. Shop staff see only CRM and event data belonging to their account unless a separate platform-level authorization explicitly grants broader access.

Attendee and guest tokens return explicit allowlisted projections. Host notes, internal changes, staff discussions, financial data, other guests' private details, and unpublished content are never spread from database rows into token responses.

## Public and Customer Experience

### Your Table

Your Table presents:

1. the signed-in user's upcoming requested, waitlisted, offered, and confirmed sessions;
2. direct management actions for each participation;
3. relevant sessions from the current public shop;
4. network-wide public discovery;
5. past attendance, Journey seals, and private memories.

The existing primary navigation remains unchanged.

### Sessions directory

The public directory queries a canonical public event projection. It deliberately supports upcoming/current and historical results. Filters may include date, location, host, event format, and availability. Results are chronological and editorial, not algorithmically personalized.

Every result uses event-local timezone formatting and includes enough timezone context to avoid ambiguity. Network discovery requires both account and event opt-in.

### Event landing and RSVP

The event landing page keeps the flyer-first Teajia character but brings a quiet event summary and primary RSVP action to or before the first viewport. It shows public Tea Master identities, store, date/timezone, public location hint, tea preview when enabled, availability, accessibility information, and RSVP policy.

RSVP supports signed-in and guest flows. Contact inputs are validated consistently on client and server. Successful submission offers an immediate working management route and triggers only communication that actually exists. Recovery is described as delivery requested when no management token is returned directly.

Availability wording uses one server source. Full sessions show a waitlist action when waitlisting is enabled; they do not simultaneously say registration is closed.

### Guest invitations

Guest invitations use one normalized public response. They show inviter, event, public location hint, date/timezone, and claim state. Claims are atomic, single-use, capacity-protected, and recoverable. Hosts can view, copy, resend, revoke, expire, and audit invitations.

### Post-event experience

Post-event input opens after operational completion and only for verified attendees. Guests may create private reflections, submit consent-aware notes for host consideration, view a published recap, and select teas for a WhatsApp inquiry. No guest-facing live controls appear during the session.

## Contextual Connections

- **Store:** upcoming and historical public sessions.
- **Tea Master profile:** hosted and collaborated sessions, with backlinks from event and recap.
- **Tea/product:** sessions where the tea was served and relevant future tastings.
- **Journey:** verified attendance, teas experienced, and private memories.
- **Customer record:** account-scoped booking, attendance, interests, and human follow-up.
- **Recap/article:** event, host, store, teas, contributors, and next occurrence.
- **Inquiry/order:** deliberate attendee interest with retained source-event attribution.
- **Venue:** account-scoped operational history and safe public location projection.

## Operator Workspace

The workspace follows four phases:

### Plan

- event details and lifecycle;
- venue and spaces;
- Tea Masters and event team;
- tea service and stock plan;
- capacity, RSVP policy, privacy, price, and WhatsApp payment instructions;
- recurrence or series defaults.

### Fill

- requests, confirmed parties, waitlist, and guest invitations;
- manual attendee entry and import/export;
- audience selection and communication history;
- payment state recorded after human checkout;
- customer linkage and consent.

### Prepare

- roster search and bulk actions;
- run sheet, equipment, service timing, responsibilities, dietary and accessibility notes;
- stock holds and tea preparation;
- pre-session check-in support without guest-facing phone use at the table.

### Close

- attendance/no-show finalization;
- actual tea usage and stock reconciliation;
- host-only debrief;
- attendee memory opening;
- recap/article drafting and publication;
- consented follow-up and next-occurrence creation.

## Communications

Communications use an account-scoped outbox. Every record contains audience, recipient, channel, template/version, event, participation where applicable, scheduled time, idempotency key, and pending/sent/delivered/failed state.

Supported operational messages include RSVP confirmation, approval, denial, waitlist offer, waitlist expiry, guest invitation, event update, reminder, and cancellation. Email may be enabled only after a working provider-backed route exists. WhatsApp remains a deliberate handoff or operator action where automated delivery is not available.

Repeated generation must not duplicate messages. Delivery failures remain visible and retryable. Communications are operational and consent-based; the rebuild does not add engagement notifications.

## Error Handling

- Public request failures render retryable error states, never misleading empty states.
- Mutations return typed results and only show success after persisted state is returned.
- Capacity conflicts return the latest availability and the appropriate waitlist option.
- Idempotency protects RSVP submission, waitlist claim, invitation claim, communication send, journal commit, completion, and publication creation.
- Lifecycle transitions reject invalid source states and provide a stable error code.
- Partial multi-record operations use transactions or return a per-record result; they never silently partially succeed.
- Privacy-sensitive token responses are constructed from allowlists rather than raw row spreading.
- Inventory hold failures block the operation that would make the plan inconsistent.

## Migration and Compatibility

1. Add the canonical lifecycle and new relational tables without deleting existing attendee, guest, menu, or post-session data.
2. Backfill existing events as occurrences and infer safe lifecycle states from current status/date data.
3. Backfill primary party seats from attendees and party members from `plus_one`/guest invitation data where identity is known.
4. Retain legacy magic tokens during the reconciliation window.
5. Add normalized API projections, then migrate consumers one surface at a time.
6. Keep compatibility reads only while an old consumer remains; remove them after all consumers use the canonical model.
7. Disable the legacy live co-tasting entry points before deleting any provenance data.
8. Stop automatic zero-price invoice generation before connecting the new completion transition.

All migrations must be forward-only and safe with existing multi-account data. The existing uncommitted Tea Master sales work in the shared checkout is treated as external work and must not be overwritten or bundled into Events commits.

## Release Plan

### Release 1: Trust and identity

- repair current client/server contracts;
- canonicalize lifecycle states;
- introduce atomic capacity and party seats;
- lock down attendee-token and tenant boundaries;
- bind authenticated User, Customer, and participation;
- add EventContributor and EventTeamAssignment;
- correct tea-menu and stock-hold invariants;
- add route, migration, concurrency, and privacy tests.

Release 1 is complete when all current event actions either persist correctly or are intentionally unavailable, overbooking paths are closed, private host data is protected, and signed-in attendance is durable.

### Release 2: Customer journey

- canonical public projection and network-wide opt-in discovery;
- My Sessions in Your Table;
- working RSVP management and recovery;
- historical event detail and recap routing;
- normalized guest invitations;
- timezone-correct rendering;
- accessible validation and error states;
- crawler-visible Event metadata;
- mobile and desktop customer journey tests.

### Release 3: Operations

- roster, manual entry, search, bulk actions, import/export;
- attendance and no-show records;
- waitlist offers and expiry;
- invitation administration;
- communications outbox and delivery history;
- run sheet and team responsibilities;
- event series/next occurrence;
- payment-state recording after WhatsApp checkout;
- actual tea usage and stock closure.

### Release 4: Memory, discovery, and human-led growth

- server-authoritative private event memories;
- consent-aware public-note candidates;
- recap publication and contributor attribution;
- contextual event connections across stores, people, products, Journey, and content;
- event-scoped tea/consultation inquiries through WhatsApp;
- human-confirmed inquiry-to-order conversion;
- occupancy, waitlist, attendance, delivery, consumption, repeat-attendance, and inquiry conversion reporting;
- retirement of guest-facing live co-tasting controls.

## Verification Strategy

Development follows test-first red/green cycles. Each repaired behavior receives a failing regression test before production code changes.

### Worker and domain tests

- lifecycle transition matrix and migration compatibility;
- RSVP, approval, batch approval, waitlist offer/claim/expiry, and invitation claim capacity races;
- idempotency for every claim and completion path;
- account ownership of every referenced child entity;
- token response allowlists and PII boundaries;
- authenticated User/Customer/participation binding and legacy claim;
- communication generation and duplicate prevention;
- inventory hold recalculation, consumption, and release;
- note attendance/consent/provenance rules;
- public account/event opt-in projection.

### Browser tests

- public directory upcoming, current, historical, empty, and failure states;
- event detail, RSVP, immediate management, recovery, cancellation, waitlist, and guest claims;
- Your Table My Sessions and Journey continuity;
- store, Tea Master, product, recap, and inquiry links;
- create/edit/duplicate/series operator flows;
- roster, approval, communication, preparation, completion, and recap publication;
- mobile bottom-navigation clearance, no horizontal overflow, focus management, reduced motion, labels, error association, and tap targets;
- event-local timezone rendering at multiple viewer timezones.

### Release gates

Every release requires focused tests during development, the full relevant worker suite, TypeScript lint, color lint, production build, and customer/admin Playwright flows. Visual work must be inspected on the actual mobile and desktop screens. No release is called complete from tests alone; its acceptance statements are checked against working behavior.

## Out of Scope

- primary navigation changes;
- guest-facing phone-at-the-table controls;
- automatic ticket checkout;
- automatic invoices or sales from attendance;
- social feeds, attendee directories, follows, likes, or algorithmic recommendations;
- streaks, gamification, engagement notifications, or auto-replenishment;
- unrelated backend or UI refactors.

## Success Criteria

The rebuild succeeds when:

1. every visible Events action persists or reports a real, actionable error;
2. capacity cannot be oversubscribed through any supported path;
3. signed-in users retain their reservations, attendance, teas, and memories across devices and stores while shop CRM remains tenant-private;
4. every public event can identify its store and Tea Masters, and every assigned team member has appropriate operational access;
5. Your Table is the reliable personal doorway without a primary-navigation change;
6. public discovery includes opted-in sessions from all public shops and excludes private events;
7. hosts can plan, fill, prepare, and close an event without shadow spreadsheets for the supported workflow;
8. post-event memories and publication preserve attendance, source, attribution, and consent;
9. tea and consultation interest flows into a human WhatsApp conversation and only becomes commerce after confirmation;
10. the guest experience is useful before and after tea and quiet during the session.
