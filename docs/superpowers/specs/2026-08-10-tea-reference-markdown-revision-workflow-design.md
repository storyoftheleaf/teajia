# Tea Reference Markdown Revision Workflow Design

**Date:** 2026-08-10

**Status:** Proposed for implementation

**Scope:** Fast English reference launch, Markdown source of truth, and head-admin revision flags

## Outcome

Launch the current supported Tea Reference material as a small set of polished English pages without asking Adrian to review atomic research claims. The website remains a reading surface. Markdown remains the editing and regeneration surface. Teajia adds only a head-admin revision flag and a grouped issue queue.

For the current batch, the normal editorial unit is one of the nine supported public reference pages. The 193 atomic facts remain provenance beneath those pages and do not become a website inbox. The three unresolved taxonomy candidates and the inventory-derived Oolong, Dark, Red, and White gaps remain private until a later sourced batch supports them.

## Product principles

1. Adrian reviews finished pages, not source fragments.
2. Public prose is polished English. Untranslated Chinese source prose never appears publicly.
3. Original-language evidence is preserved privately and remains traceable from every generated paragraph.
4. Regeneration happens through Markdown files and local agent work, not through the website.
5. The website records what feels wrong and exports one regeneration brief.
6. A revision flag never edits, regenerates, approves, publishes, or unpublishes a page.
7. Public and private source boundaries remain as strict as the existing receiving layer.

## Canonical content

Tracked English page files live under:

```text
data/tea-reference/pages/<page-slug>.md
```

Each file contains stable front matter and reader-facing Markdown:

```yaml
---
id: lincang
kind: major_region
label: Lincang
parent: yunnan
source_ids:
  - source-teadb-puerh-regions
---
```

The body contains ordinary English sections and citation markers. It does not contain exact private evidence, internal verification reasons, capture hashes, retailer-as-producer inference, or personal tasting presented as reference consensus.

The page Markdown is the source of truth for public wording. A deterministic builder validates it and produces the existing Wisdom reference projection. Generated JSON remains an output, not an editing surface.

## Source and translation layers

The existing private capture package remains the evidence source. Each cited Chinese passage retains:

- exact original Chinese;
- evidence locator and hash;
- English translation stored separately;
- translation method, model or translator, version, and date;
- the public page and section that use the evidence.

Public pages use English paraphrase with citations. They do not display machine-translated quotations in the fast launch. Source titles shown publicly receive an English display title; the original title remains available to the head admin.

Native tea and place names may remain as secondary identity labels where useful. Full sentences, descriptions, headings, source titles, and excerpts must be English. The page builder rejects Han-script prose outside explicitly allowlisted native-name fields.

## Public page presentation

The nine supported pages use the existing Teajia Wisdom frame and retain:

- clear family, type, and origin hierarchy;
- polished English reference sections;
- compact numbered citations;
- source publisher, English title, date, and outbound link;
- qualifying available and previously offered teas;
- scoped elevation and the neutral `View map` action where supported;
- the public correction sentence and email action.

They do not show raw reference IDs, held/conflict language, original Chinese evidence, machine-translation metadata, revision flags, or private issue notes.

## Head-admin flag

When the authenticated user is the platform owner, each reference page shows one discreet action:

**Flag for revision**

It opens a small sheet containing:

- issue category: incorrect information, translation, unclear writing, wrong source, geography or hierarchy, or missing information;
- affected section, selected from that page's real Markdown section keys;
- a required plain-language note;
- a read-only preview of the current section text.

Submission automatically records the page, route, section, current text snapshot, attached source IDs, account, user, and creation time. The UI never asks Adrian for an internal page, claim, citation, or evidence ID.

The action is enforced as head-admin-only by the Worker. Hiding the button in React is not the authorization boundary.

## Private issue queue

The existing `/admin/wisdom` surface gains a local **Reference issues** view without changing global navigation or adding a public route. It shows open issues grouped by reference page:

```text
Lincang · 3 issues
Greater Yiwu · 1 issue
Sheng · 2 issues
```

Each row shows the category, affected section, Adrian's note, current English text, source count, and creation date. Exact evidence remains behind a private source disclosure and is not expanded by default.

The queue supports selection and `Resolve selected` after the Markdown work has been completed. It does not accept replacement prose, regeneration prompts, or publication decisions.

## Persistence model

A small account-scoped D1 table stores the revision flags:

```text
tea_reference_issues
  id
  account_id
  page_id
  page_slug
  route
  section_key
  category
  note
  public_text_snapshot
  source_ids_json
  status              # open | resolved
  created_by_user_id
  created_at
  resolved_by_user_id
  resolved_at
```

Only issue metadata and the public text snapshot enter D1. Exact Chinese evidence and full source packets remain in the private capture package.

Required operations are intentionally narrow:

- create an issue;
- list account-scoped issues;
- export open issues as Markdown;
- resolve selected issues.

There is no website endpoint for page editing, content regeneration, Markdown writing, approval, or publication.

## Markdown regeneration brief

The queue provides **Export regeneration brief**. The Worker returns a downloadable Markdown file; it does not attempt to modify Git or a local filesystem.

The export is deterministically grouped by page and section and includes:

- readable page title and Markdown file path;
- issue category and Adrian's note;
- current public section text;
- source metadata and private evidence pointers;
- a stable issue ID in machine-readable Markdown metadata;

The export is safe for ordinary local agent work and contains issue context plus source pointers, not full source snapshots or exact evidence. During regeneration, the local agent resolves those pointers against the private capture package and reads the original Chinese and stored English translation there. A repeated export over unchanged open issues is byte-identical.

The regeneration workflow is:

1. Adrian flags issues while reading Teajia.
2. Adrian exports one grouped Markdown brief.
3. Local agent work reads the brief, the affected page Markdown, and the private evidence packet.
4. The agent edits or regenerates the tracked English page Markdown.
5. Validation and the local website preview run against the changed pages.
6. Adrian reviews the finished pages as pages.
7. After the content change is accepted through the normal Git/deployment workflow, Adrian resolves the corresponding queue items.

Issue resolution never implies publication. Publication remains the existing explicit Git and deployment action.

## Failure and safety behavior

- An invalid or unknown page/section is rejected before issue creation.
- A missing note is rejected with an inline, plain-language error.
- Failed submissions preserve the typed note and offer retry.
- Duplicate open flags for the same page, section, category, and normalized note return the existing issue rather than creating noise.
- Queue reads and mutations are account-scoped and platform-owner authorized.
- Export escapes unsafe Markdown content and uses deterministic code-point ordering.
- Markdown validation fails closed on missing sources, unsupported citations, untranslated public prose, malformed front matter, or unsafe fact-register mixing.
- Original Chinese, exact evidence, translation provenance, private notes, and issue records never enter the public reference payload or production page markup.

## Verification

Focused tests must prove:

- nine supported page Markdown files build deterministically;
- unresolved taxonomy and inventory-gap candidates remain excluded;
- public prose is English while native-name fields remain allowed;
- every public citation resolves to stored private provenance;
- the flag button is absent for non-head-admin users;
- the Worker rejects unauthorized and cross-account issue access;
- duplicate flags are idempotent;
- exports are deterministic and grouped by page;
- public bundles contain no exact evidence, Chinese source prose, translation metadata, or issue notes;
- resolving issues does not modify page content or publication state;
- desktop and mobile pages, flag sheet, queue, and Markdown download have no overflow or bottom-navigation obstruction.

The implementation gate includes focused tests, Worker tests, TypeScript lint, colour lint, normal and preview builds, and actual desktop/mobile browser inspection.

## Explicit exclusions

This fast phase does not build an on-site Markdown editor, on-site regeneration, autonomous recapture, automatic publication, bulk fact approval, inventory or product creation, public issue submission, or a general project task manager. It does not write directly to the repository from Cloudflare and does not add or change global navigation routes or labels.
