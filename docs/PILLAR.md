# Teajia — the pillar

> What this site is and how it works, in one read. Written 2026-09-20 from a full survey of the code (four agents, every public and signed-in route, the worker API, the git history of the home page). Linked from the top of `CLAUDE.md` so every session sees it. When the site changes shape, change this file in the same commit; a pillar that lags the code is worse than none.

## What it is, in three sentences

Teajia is a home for fine tea: a place to source it, study it, and share it with the people who gather around the cup. It is one person's twenty years of sourcing relationships, turned into a shop, a magazine, a reference library, a calendar of sessions, and a set of professional tools that other tea people can run their own practice on. It is not a wellness app, not a social network, not a SaaS dashboard, and it never sits at the tea table.

## The four words a visitor is given

The whole public site hangs off four sections, and they are the mobile tab bar, the desktop sidebar, and the four grounding lines on the home page. Same four, three renderings, kept in sync by rule.

| Word | Route | What is actually there today |
|---|---|---|
| **Read** | `/read`, `/article/:slug` | The Art of Tea reading room. A hand-built list of fourteen long-form pieces, of which four are live to a visitor (ritual, atlas, tasting, porcelain and tea) plus the flagship leaf-to-liquor piece. Editor-written articles from the database render at `/article/:slug` and are what event recaps become. |
| **Craft** | `/craft` | The learning hub: a course, glossary, journeys, playlists, videos, visual guides, tea spaces, community wisdom. All static content in the repo. Links on to Tea Wisdom. |
| **Advise** | `/advise`, `/for-your-space` | Adrian's consulting page (services, projects, a testimonial) and the business page for people who want tea in their own space. The consulting inquiry form is a stub that sends nothing; the space form composes a WhatsApp message. |
| **Shop** | `/shop`, `/shop/product/:id` | The live catalogue from the worker: tea, teaware, sets, a collection tab. Products open in an alcove over the grid, or as a full page from a shared link, and show which tea master selected them. |

Behind those four, reachable but not from the mobile nav:

- **Events** `/events`, `/event/:slug`, `/event/:slug/recap`: live sessions with seats, RSVP, waitlist, a public tea menu, and a recap afterwards. Only signed-in surfaces link here. This is the one genuinely time-bound thing the site has and the public nav does not show it.
- **People** `/people/:slug`: the tea masters and contributors, each with a profile, favourites, and a private pay page behind a gate. Footer only.
- **Tea Wisdom** `/wisdom/*`: the reference: cultivars, regions, producers, marks, styles, named teas, tea types. Footer and Craft only.
- **Spaces** `/spaces`: the network of tea rooms, each with a WhatsApp line. Desktop sidebar only.
- **Discover** `/discover`: a questionnaire that gives a visitor a level and threads to follow. Linked from the home page.
- **Start** `/start`: seven path cards for a newcomer. Nothing links to it.
- **Store fronts** `/store/:slug` or a subdomain (au.teajia.com): a partner's own shop, events and identity.
- **About** `/about`, **MCP** `/mcp`: thin and orphaned respectively.

## How a purchase happens

There is no card checkout, by decision. A visitor fills a cart, gives a name and a contact, and the site records the inquiry and opens a pre-written WhatsApp message (or email, or copies it). Adrian prices the request into an invoice, the visitor watches it at `/order/:ref`, and the money moves by transfer or a payment link on a tea master's pay page. Every order is a conversation. The shop copy should say so plainly, never apologise for it.

## What a signed-in person gets

**Your Table** (the emblem, top right on mobile, a word in the rail's foot on desktop) is the person's own room. A visitor sees Discover, Read, Shop, Find a Table. A member sees a day line, a "what needs you" queue if they run a shop, and tiles: steep (tasting journal), sessions, remember (favourites), cellar (tea they own, with grams, placeable at a location), discover, profile, orders, collections, and for owners the Manage room.

The personal records are deliberately separate and stay that way: **Journal** is what you tasted and thought, **Favourites** is what you want, **Cellar** is what you own, **Journey** is where you have been (sessions, teas met, seals). No streaks, no scores, no feed.

**Manage** (`/admin/*`) is the operator's room, grouped Sell (orders, invoices, customers), Source (stock, intake, Curate field sourcing, vendors), Gather (events, tasting sessions, venues), Publish (articles, collections, product stories, Tea Wisdom), Network (carry teas from the network, wholesale, adoptions), and account (members and access, settings, MCP tokens). Every write is gated by one of six capability bundles: catalog, stock, publish, gather, sell, members.

## How it is built

- **Accounts.** Every account is its own store: catalogue, stock, prices, currency, customers, invoices. Kinds are platform (Adrian), location (a tea room), master (a tea master with no address). One database, every table scoped by account id, one gatekeeper that resolves the acting account on every request.
- **Network.** A tea profile has an originator and a curator. A store carries a network tea by making its own listing over it. Cross-store movement routes through the platform account.
- **Money rules** (in full in `CLAUDE.md`): freight is a per-kilo rate on the account, inside the ×3 markup; one exchange-rate table refreshed daily; nothing entered is NULL and zero is zero; a tea is not created without its cost and its currency.
- **Events** are a closed state machine: draft, published, registration closed, completed, archived. A completed session can become a recap and then a magazine draft.
- **Agents.** Roughly seventy authenticated MCP tools (stock, sales, customers, intake, events, collections, articles) with preview-then-confirm on every write, plus four public read-only tools for the shopping public. `.mcp.json` connects a Claude session; the token lives in Infisical.
- **Stack.** React 19, Vite, Tailwind with CSS-variable tokens, Zustand for client state, React Query for server state, Cloudflare Pages for the site, a Cloudflare Worker on D1 for the API. Live at teajia.com (Pages project `teajiafinal`); the API at api.teajia.com.

## What the home page is, and what it has refused to be

Today `/` is two acts and nothing else. Act one: the emblem (opens Your Table), one line ("Tea deepens with what you bring to the table and what you leave behind."), the four grounding lines, and two hairline links (a scroll to the brand story, and Discover your tea). Act two, on scroll: the wordmark, the three characters 佳 家 嘉 with their meanings, a paragraph of philosophy, and the email field. No footer, no data, one write call (the newsletter).

It has twice grown data-backed blocks and twice had them removed within days, both times on purpose: living previews under the grounding lines (April 2026, reverted as "a sales dashboard"), and a third act listing network stores (built and stripped the same week, along with a sticky cart bar and a scroll-snap controller that a smoke test now guards against). The four grounding lines are locked in words, font, case and size. The characters are equal-sized and bronze. The email field is underline-only.

The open question, asked 2026-09-20: the page is a good place to land, but is it the best use of the landing. The four directions are in `todo/plans/home-page-directions.md`.

## What is live today (measured on the public API, 2026-09-20)

20 teas and 117 pieces of teaware in the shop; 5 published articles, all from one April batch; 0 upcoming sessions; 1 space (Teajia Home, Penestanan); 1 tea master profile; 1 shop collection named Featured with nothing flagged into it. Products carry no public date, so "new arrivals" cannot be computed without a worker change. The consequence for any surface that wants to show "what's happening": today it would show nothing, so the signal has to be written by a person until the calendar and the shelf move on their own.

## The boundaries, so nobody rebuilds them

No streaks, gamification, engagement notifications, algorithmic recommendations, social feeds, likes, followers, auto-replenish. No live tasting mode. No card checkout. Curation is by hand. Journal, Favourites, Cellar, Curate stay separate. Nav labels and routes change only with explicit confirmation.

## Where the detail lives

`docs/INDEX.md` routes everything. `docs/VISION.md` is the philosophy and the five layers (tools, sourcing, education, scaffolding, community). `docs/STATE_OF_THE_SITE.md` is the verified snapshot. `docs/SITE_MAP.md` lists routes by tier but its home page line is stale (it describes the April build). `CLAUDE.md` carries the styling rules and the money rules in full.
