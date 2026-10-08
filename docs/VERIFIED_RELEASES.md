# Worker-first releases

A coordinated release deploys one immutable Git tag through `Deploy worker`, proves
its revision and Cloudflare runtime version on both API hosts, and uploads
`worker-release-proof`. Only then does a local machine publisher advance main,
using the operator's existing Git authentication. Cloudflare's Git integration
publishes the `teajiafinal` frontend from that commit. CI keeps the Worker release
lock until it has verified the frontend deployment's commit and compared its
version, HTML, and referenced JavaScript/CSS bytes with `https://teajia.com`.

The local publisher is `scripts/observe-verified-release.mjs`, run by launchd from
a stable directory under `~/.codex/releases/teajia/`. Its config pins the candidate,
expected main, immutable tag, Actions run and attempt, and an isolated bare Git
repository. State and logs live beside that config. It never pushes HEAD or forces
a ref, never redeploys on failure, and refuses a competing main revision. The local
publisher is needed because the Actions token does not grant workflow-file edits;
no personal token is copied into CI.

For an authorized release:

1. Complete the candidate's checks and commit it. Record the current remote main.
2. Push an immutable `release/...` tag and dispatch `deploy-worker.yml` on that tag,
   passing the full expected main SHA as `publish_main_expected`.
3. Start the local publisher as a LaunchAgent with its pinned config. Verify its
   state records the candidate, run URL, PID, state path and resumption command.
4. Confirm Actions has started and saved its `release-state` artifact. The release
   is **publishing in background**, not shipped.

The Actions artifacts are `release-state`, `worker-release-proof`, and
`release-result`. Only `release-result` with state `live` proves shipment; it records
build ID, candidate SHA, immutable Pages deployment URL and SHA-256 byte hashes.
The Actions run and local state record failures. A failure requires diagnosis,
not a deployment retry. Resume the observer using the exact command recorded in
its state; if main already equals the candidate it observes without publishing
again. If the CI observer itself needs resuming, download its Worker proof artifact
and run `publish-verified-release.mjs` with the same candidate/expected main,
`WORKER_PROOF_PATH`, `RELEASE_STATE_PATH`, and existing Cloudflare credentials.
This resumes read-only proof and does not deploy or push.

Empty `publish_main_expected` retains the ordinary Worker-only workflow. Direct
pushes to main retain the existing Git-integrated Pages behavior, so use the
coordinated release for changes whose frontend requires a newer API.
