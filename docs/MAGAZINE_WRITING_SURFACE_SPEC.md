# Magazine Writing Surface — Build Spec

A spec to hand to whatever builds the writing surface. Portable: it does not assume which app hosts it. Read the **Non-negotiables** first — they are the whole point. Everything else is detail.

---

## What this is

A screen for working the tea-magazine pipeline: see every story and which stage it's in, move a story forward, and write the draft — all in one place. It replaces the need for a separate Obsidian Kanban add-on by folding the board *into* the writing tool, reading the same files.

The magazine is a 6-stage interview-to-article pipeline. Each story is a markdown file that moves through folders as it matures. Today there are 8 stories: 7 at the Source stage, 1 published.

---

## The single most important rule (read twice)

**The markdown files in the vault are the source of truth. The surface is a window onto them, never a second copy.**

Every failure this pipeline has had came from the same process being written down in more than one place and the copies drifting apart. The surface must not become another copy. Concretely:

- The surface reads the folder of story files and renders the board from what it finds.
- Moving a story to a new stage = **moving/renaming the actual file**. The board never holds stage state that the files don't.
- Editing a draft = **writing back into that same file**.
- The surface stores **no story content of its own**. No private database of stories. At most it may cache for speed, but the files always win on conflict.

If you ever find yourself adding a "stories" table that holds the text or the stage, stop — you are rebuilding the drift bug.

---

## The pipeline (the columns of the board)

Stages, in order. Each maps to a folder on disk.

| Stage | Folder | What a file here means |
|---|---|---|
| Ideas | `Workflow/0-Ideas/` | A wish to interview someone. Not a story file yet — lines inside one shared `IDEAS.md`, not separate files. |
| Inbox | `Workflow/0-Inbox/` | A raw transcript, being cleaned to the format standard. |
| Source | `Workflow/1-Source/` | The clean transcript + metadata. Filename: `SRC - <Title>.md` |
| Guidance | `Workflow/2-Guidance/` | The chosen story-type decision. Filename: `GUIDE - <Title>.md` |
| Develop | `Workflow/3-Develop/` | The draft: subject's words in sections + author's intro/closing. Filename: `DEV - <Title>.md` |
| Review | `Workflow/4-Review/` | The draft in the quality gate (incl. the voice-fidelity check). |
| Published | `Issues/<Issue Name>/Stories/` | Done. The finish line. Filename: clean title, no prefix. |

Notes:
- **Ideas is special.** It is a list of lines in one file, not a folder of story files. Render it as a column of simple text cards; "graduating" an idea means starting a transcript in Inbox and removing the line. Treat it differently from the other columns.
- The filename **prefix changes** as a story moves (`SRC -` → `GUIDE -` → `DEV -` → none). The surface must handle the rename on a move. The story's identity is its **title**, not its filename.
- `STORY-TYPES-REPOSITORY.md` lives in the Guidance folder but is **not a story** — it is a reference doc. Exclude files that aren't stories (see "What counts as a story" below).

---

## What counts as a story (so the board doesn't show junk)

A file is a story card if its frontmatter `type` is one of: `SRC`, `DEV`, or a published story. Exclude anything whose `type` is `Reference`, `System Reference`, `Magazine Issue`, `Magazine Status`, `Project Workflow`, `Magazine Ideas`, `story-guide`/`Story Guide` reference docs, etc. When in doubt, show only files that carry a story `title` + a `Story Subject` metadata line.

Each story file carries this shape (read it, don't fight it):

```
---
type: SRC | DEV
title: <Story Title — dashes not colons>
aliases: [...]
tags: [story, ...]
created: YYYY-MM-DD
updated: YYYY-MM-DD
---

# <Title>

**Interview by:** Adrian Rasmussen
**Interview Date:** ...
**Story Subject:** <person/role>
**Photography, Words, Translation:** As credited
**Location:** ...

---

## <sections>
```

The card on the board should show: **title**, **story subject**, **stage** (from folder), and **last updated**. That's enough.

---

## Powers — what the surface may do to files

Spec'd for the full writing tool. If you want a lighter first version, ship only level 1 and add the rest later — the data model is identical.

1. **Read + render board** (always). Watch the folders, show stories in columns. Live-refresh when a file changes on disk (someone might still edit in Obsidian — that must not break the surface).
2. **Move a story between stages.** A drag (or a button) moves the file to the new folder and applies the filename-prefix rename. On reaching Published, it also drops the prefix and asks which issue. **This is a real file move, audited, reversible.**
3. **Write drafts.** Open a story in an editor pane, edit the body, save back to the same file. Preserve frontmatter exactly. Never touch the subject's quoted words silently (see voice fidelity).

---

## The one feature that protects the magazine's soul: Voice Fidelity

This is the rule the whole pipeline exists to protect: **the subject's words are never paraphrased.** The surface should make this *visible*, not just documented.

At the Review stage, offer a side-by-side: the draft's "their voice" sections next to the original transcript (the `SRC -` file of the same title). Highlight any sentence in a topic section that does **not** trace to a line in the transcript. The author either restores the original wording or moves that thought into their own intro/closing (author's voice, where interpretation is allowed).

This does not need AI to ship a useful v1 — a plain text-diff / "is this line found in the source" check is enough to flag drift. AI can make it smarter later. Build the dumb version first.

Why it matters: it is the single editorial law of the publication. Making it a screen the author looks at — not a checkbox they tick — is the real reason to build a surface at all.

---

## Editorial rules the surface must respect (do not let the UI violate these)

These come from the magazine's written law. The surface should embody them, never fight them:

- **Two voices, kept separate.** Intro + Closing are the author's voice ("I/we"). Topic sections are the subject's voice, their exact words. If the editor styles or labels these, keep the distinction visible.
- **Calm tone.** No hype, no engagement mechanics, no streaks/badges/notifications. This is a contemplative craft tool. (Matches the host brand's stated "do not build" list.)
- **Mobile-readable output.** Stories are read on phones and shared to social; sections are short. The editor should not encourage walls of text.
- **Titles use dashes, not colons.** `Water – Ceramics`, never `Water: Ceramics`. Enforce on save.
- **Foreign terms carry English in parentheses**, e.g. `ye lu (叶露)`. Don't strip this.
- **Internal links between stories** use the `[[Title]]` form. Keep them working across moves/renames.

---

## Nuances that will bite if ignored

1. **Filename ≠ identity.** A story's stable identity is its `title`. The filename and its prefix change every stage. Match stories by title (normalised), or you'll show the same story twice across a move.
2. **Renames mid-move.** Moving Develop → Published renames the file (drops `DEV -`). Any open links to it must survive. Update `[[wikilinks]]` on rename, or you create broken links — the exact bug we just cleaned up.
3. **The vault auto-stamps files.** A background sync process writes extra frontmatter keys (prefixed `i64os-`) into these files shortly after they're created or edited. The surface must **tolerate unknown frontmatter keys** — read what it knows, leave the rest untouched on write. Never overwrite the whole frontmatter block; merge.
4. **Spaces and special chars in paths.** Folder and file names contain spaces, en-dashes (–), and em-dashes. Handle them; don't assume slug-safe names.
5. **Concurrent edits.** Obsidian (and the sync process) may change a file while the surface has it open. Watch for external changes and reconcile rather than blindly overwriting. Files win.
6. **Ideas column is not file-per-card.** It's lines in one file. Don't try to render each idea as a story file.
7. **Issues are containers.** Published stories live grouped under an issue folder with its own index. Moving to Published means choosing/creating an issue and updating that issue's index list.
8. **No story content in a database.** Said already; repeating because it's the one that ruins everything. The DB (if any) holds only ephemeral UI state — column scroll position, last-opened — never the stage or the text.

---

## Suggested shape (non-binding)

- A folder-watcher that builds the board model from the story files on load and on change.
- A board view (columns = stages) + an editor pane (markdown, frontmatter-preserving).
- A move action = file system move + prefix rename + link fixups + an audit line.
- A review view = draft beside its source transcript with drift highlighting.
- State that is *purely* derived from files; nothing authoritative stored elsewhere.

Build the read-only board first. It is useful on day one and proves the file-watching works before you let the surface write anything.

---

## What NOT to build

- A separate stories database that holds stage or text.
- Engagement mechanics (streaks, gamification, notifications, recommendations) — against the brand.
- An AI auto-writer that fills in sections. The pipeline forbids paraphrasing the subject; an auto-writer is the paraphrasing machine. AI may *suggest* and *flag*, never silently rewrite the subject's voice.
- A heavy import/sync step. The files are already there; read them in place.

---

## Acceptance: you've built it right when

- Deleting the surface's own storage and reopening it loses **nothing** — the board rebuilds perfectly from the files alone.
- Editing a story in Obsidian shows up on the board without a manual refresh.
- Moving a story to Published renames it, files it under an issue, and leaves no broken links.
- Opening a draft at Review shows, in red or similar, any line claiming to be the subject's voice that isn't in the transcript.
