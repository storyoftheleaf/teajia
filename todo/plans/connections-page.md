# Connections page

Captured 2026-09-06 at the end of the desktop sidebar redesign, so the idea does not get lost. Nothing here is built yet.

## What Adrian said it is

"Connections" replaces the old "Our spaces" (locations) link. It is not a new kind of place in the navigation. It is one destination that holds everyone and everywhere the shop is connected to:

- people and their profiles (tea masters, contributors, customers who have a public profile)
- the places that supply or work with the shop (suppliers, venues, partner spaces)

It should be reachable from two spots: the mark in the sidebar's foot pod (where the locations pin used to be) and from inside Your Table.

## Where things stand today

- The sidebar foot mark is already labelled "Connections" (people icon) in both the expanded and collapsed sidebar. It still opens the old spaces page, so today it shows venues only.
- Your Table has no connections entry yet.
- Adrian reported the spaces page erroring on the live site. It did not reproduce locally (dev, sandbox, production build all rendered it), so check it on teajia.com itself, signed in and signed out, before assuming it is fixed.

## What has to be decided before building (design call, Adrian's)

1. What one screen shows both people and places without becoming two lists glued together. Candidate: one list, each row a name, a role line (supplier, venue, tea master, member) and a place, filterable by kind.
2. Whether a visitor sees the same page as the shop owner, or a smaller public one. The admin already has People, Tea Masters and Sources pages under Manage; connections should read those, not become a fourth copy.
3. What the collapsed foot mark and the Your Table entry each lead to when the page has kinds (the whole list, or the kind you last looked at).

## Reference

- Design canvas with the sidebar directions and the passes that led here: https://claude.ai/code/artifact/2b58b16f-69a4-43d3-a8d4-60649756928a (page "Two pods", pass P2 is what shipped).
- The sidebar principles that now describe the shipped design are in CLAUDE.md under "Desktop / mobile layout principles".
