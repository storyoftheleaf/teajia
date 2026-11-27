# Coding standards — read by the reviewer, not the implementer

The agent writing a change already has a full job: find the code, change it,
make it pass. These standards are applied afterwards, by the `review-pr` skill
(`.claude/skills/review-pr/SKILL.md`), in its own context. Implement first,
then review: make it work, then make it good.

The mandatory rules in `CLAUDE.md` (colors, money, nullable numbers, the
inventory height chain, nav) still apply and the reviewer checks them too.
This file holds what CLAUDE.md does not.

When a human review catches something new, add it here as one rule with the
date and the PR it came from, so nobody has to say it twice.

## Tests that lie

A green run is only worth something if the tests could have failed.

1. **No test that restates the code.** `expect(LIMIT).toBe(280)` next to
   `const LIMIT = 280` proves nothing and breaks on every rename. Test the
   behaviour the constant causes (the 281st character is refused).
2. **No test that reads source files to check layout.** Reading a `.tsx`
   file as text and checking that one string comes after another tests the
   file's spelling, not the page. Render it and check what a person sees.
3. **No mock that removes the failure you care about.** Stubbing a browser
   API, D1, or `fetch` with something that always succeeds means the test
   can't fail the way production does. Mock at the edge (Cloudinary, the
   network) and keep the code under test real.
4. **Test through the front door.** Call the module's public function or
   route, not its internal helpers. If a test needs a private helper,
   the module's interface is probably too wide.

## Shape of the code

5. **Deep modules over wide ones.** Prefer one function with a small
   interface that hides a lot, over many small exported functions callers
   must stitch together. A change should touch one module, not ripple.
6. **One home for each rule.** If the same arithmetic, alias or check
   appears in two places, move it to the place that already owns it (for
   example money arithmetic lives in `worker/src/shippingRate.ts` and
   `worker/src/markup.ts`).
7. **No dead code left behind.** Removed features take their imports,
   routes, tests and docs with them in the same PR.

## The pull request itself

8. **Every PR says how risky it is** in a "Merge danger" section (the
   template in `.github/pull_request_template.md`). CI refuses a PR without
   one (`.github/workflows/merge-danger.yml`).
9. **One-way doors wait for Adrian.** A change that can't simply be
   reverted (a D1 migration that rewrites or deletes rows, anything that
   emails or messages customers, money or payment flow, deleting stored
   files) is a one-way door. CI holds it until he adds the
   `owner-approved` label.
