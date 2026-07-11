# Your Table Completion Plan

**Date:** 2026-05-10
**Scope:** Your Table, AccountPanel role views, direct account/admin routes, first-door operator onboarding, and no-membership access states.

## Goal

Your Table becomes the role-adaptive home for identity, current work, personal memory, and access. It should not be a route dump. A first external operator, especially a first Australia door, should be able to open Your Table and know what to do next.

## Sequence

### 1. Canonical Link And Workflow Model

Create one front-end contract for Your Table links:

- personal memory links
- reader explore links
- operator first-door links
- support/playbook links
- route status and access metadata

Outcome: component footers and checklist sections read from shared intent, not ad hoc route strings.

### 2. Readiness-Based First Door

Replace heuristic-only first-door guidance with a readiness model:

- account profile/contact/currency/public state
- public inventory state
- event state
- access/team state when available
- storefront preview state

Outcome: operators see progress, completed steps, and the next useful action.

### 3. Role Sections

Clarify the mental split inside Your Table:

- Member: personal memory and continuation
- Staff: shift access by granted bundle
- Owner/Tea Master: operating bench plus first-door launch workflow
- Platform: governance links and account switching

Outcome: each role sees fewer ambiguous links and a clearer job.

### 4. Waiting / No-Membership State

Improve the signed-in-but-uninvited screen:

- explain the state
- offer public browsing paths
- keep sign out visible
- give the user an obvious way to recover once invited

Outcome: a waiting invite user is not treated like an error.

### 5. Route And Bundle Alignment

Align route guards with the same capability language Your Table uses:

- Catalog opens Compass/Capture/Network catalog work
- Stock opens Inventory/Purchase-order work
- Sell opens Activity/People/Wholesale work
- Gather opens Events/Venues/session work
- Publish opens Magazine/Collections
- Members opens access-management surfaces when delegated

Outcome: clicking a visible Your Table workflow lands on a permitted route.

### 6. Operator Support Links

Add the launch/playbook support homes near the first-door workflow:

- launch playbook
- storefront preview
- members/access
- inventory/import path

Outcome: Australia-style first operators do not need to search docs to operate the first door.

### 7. Verification

Run:

- `npm run lint:colors`
- `npm run lint`
- `npm run test:mobile`

Outcome: no color-rule drift, no TypeScript errors, no mobile panel/page regressions.
