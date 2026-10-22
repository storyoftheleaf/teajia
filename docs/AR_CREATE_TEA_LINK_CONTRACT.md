# Transcript-first tea linking

Owner request: while reading transcripts in AR Create's Transcript Library,
connect the teas discussed to their existing Teajia Library records. A tea can
have many transcripts and a transcript can discuss several teas. AR Create owns
original wording; Teajia owns the existing tea and reviewed public description.

## First receiving contract

AR Create renders **Link to tea library** in its transcript reader, using the
opaque source ID returned by its existing `/api/sources/tree` and
`/api/sources/file?id=...` APIs. Open:

`https://www.teajia.com/admin/compass?tab=library&arSource=SOURCE_ID`

Use URLSearchParams to encode the ID. No text, filesystem path, hash, account,
authentication token or return URL belongs in this link. Never create a tea from
a title match. The signed-in person chooses their shop and existing tea records
inside Teajia. Opening the link is read-only. Explicit **Link selected teas**
accepts the reviewed full transcript for the checked records. A repeated link
keeps the same source/tea reference. An existing excerpt can be upgraded, and a
changed source refreshed, only by explicit selection and expected-hash checks.

This handoff reuses the installed outbound connector and the person's current
Teajia sourcing access. The connector's private credential is never exposed to
AR Create browser code or broadened into general shop access. Only the person
who paired the library may fetch the private original. A lost connection or
changed shop blocks acceptance rather than guessing from cached titles.

## Existing API plus reverse lookup

All these APIs use the normal Teajia session and `X-Teajia-Account`, never an AR
browser token. Server code continues checking current sourcing permission.

- `GET /api/curate/ar-create/links?sourceId=SOURCE_ID` returns that shop's
  references with `entryName`, `entryChineseName`, reference identity, hash,
  mode and offsets. Full transcript bodies are omitted so one source is not
  returned once per tea. Exactly one of `entryId` and `sourceId` is accepted.
- `POST /api/curate/ar-create/requests` with `{kind:"read",sourceId}` and
  `GET /api/curate/ar-create/requests/:id` obtain a fresh complete read proof.
- Existing `POST /api/curate/ar-create/links` accepts
  `{entryId,requestId,sourceId,title,hash,text,start:0,end:text.length,mode:"full"}`.
  Existing changed references also require `update:true` and their
  `expectedHash`. Source proof, paired person and account are verified server-side.
- Existing `DELETE /api/curate/ar-create/links/:id` removes only the reference.

The receiver does not save notes, generate public copy, publish inventory, or
change AR Create. Opening the linked tea exposes its existing Build this tea
workspace, which refreshes complete sources while connected and keeps AI notes
and public descriptions as separate reviewed stages.

## AR Create ownership

The AR Create build chat owns the placement and wording of the transcript-reader
action, source-identity availability, opening behavior and its local screen proof.
Its existing integrator owns installed app activation. This contract supplies a
working destination; it does not claim that AR Create's reader action is live.
