# Customer / Contact Taxonomy

Last updated: 2026-05-09

## Purpose

The current `customers` surface carries several kinds of human relationships: buyers, vendors, event guests, collection recipients, contributors, and private relationship notes. Treating all of them as one generic "customer" makes authorization and product language too blunt.

This taxonomy defines the first durable relationship model so future route and UI work can ask: **why does this person exist in Teajia?**

## Relationship Kinds

| Kind | Product meaning | Primary bundle | Typical surfaces |
|---|---|---|---|
| Buyer | Someone connected to orders, invoices, WhatsApp checkout, pricing, and revenue history | `sell` | invoices, RFM, order history, customer profile commerce views |
| Vendor / Source | Someone connected to sourcing, origin, procurement context, or supplier reliability | `catalog` | product vendor links, source compass, tea profile provenance |
| Event Guest | Someone connected to hosted gatherings, RSVP, attendance, and post-session memory | `gather` | events, attendees, RSVP records, tasting notes |
| Collection Recipient | Someone receiving curated collections, shares, or editorially assembled tea lists | `publish` | collections, recent recipients, share sheets |
| Contributor | Someone whose expertise, authorship, photography, or tea practice appears publicly | `publish` | magazine articles, contributor pages, editorial credits |
| Personal Connection | A private relationship note or memory tied to a person/account context | personal/account scoped | journal, notes, private member memory |

The matching executable constant is `CONTACT_RELATIONSHIP_TAXONOMY` in `src/lib/contactTaxonomy.ts`. The database source of truth is `contact_relationships`, added by `worker/migrations/069_contact_relationships.sql`.

## Implementation State

The first release is now designed around one canonical person row plus many relationship rows.

Shipped foundation:

- `contact_relationships` stores relationship kind, account, customer/person id, source, and source entity.
- Existing data is backfilled from invoices, product vendor links, event attendees, collection publications, and legacy vendor/friend tags.
- Database triggers keep future invoice, vendor, event attendee, and collection-publication workflows synchronized.
- Customer list and profile responses include `relationship_kinds`.
- The admin People area shows relationship badges and filters.
- The person profile shows a relationship portrait before the operational history.

## Authorization Direction

Do not harden all `/api/customers*` routes to one bundle. That would flatten the product model.

Instead, split access by relationship context:

| Future route family | Bundle direction |
|---|---|
| Commerce customer profile, orders, RFM, invoice history | `sell` |
| Vendor/source profile, linked products, source notes | `catalog` |
| Event guest profile, RSVP, attendance, post-session notes | `gather` |
| Collection recipients and publication audiences | `publish` |
| Contributor editorial credit/profile management | `publish` |
| Private relationship memory | account/user scoped, stricter than generic staff |

## Implementation Pulls

1. Extend contributor/contact linking so editorial contributors can optionally point back to a private contact record.
2. Split richer profile sections behind bundle-aware loaders so partial-access staff see only their relationship surface.
3. Move remaining legacy `customers.type` and `vendor`/`friend` tag assumptions to relationship reads.
4. Add a dedicated relationship editor for nuanced manual corrections and privacy notes.
5. Add route tests after each split so buyers, vendors, guests, and recipients do not accidentally inherit the wrong permission model.

## Product Principle

Teajia should remember people in the way the tea practice knows them. A supplier, a guest, a buyer, and a contributor may be the same person, but those are different relationships with different levels of sensitivity and authority.
