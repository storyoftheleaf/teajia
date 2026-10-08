# Curate inventory review

The local bridge build includes a read-only report for reviewing legacy data.
It does not fetch credentials, contact the shop, modify an export, create samples,
delete sets, merge duplicates, or retag contacts.

Run against an authorized JSON export, with the account explicitly selected:

```sh
node scripts/curate-inventory-review.mjs /path/to/export.json --account ACCOUNT_ID --user USER_ID
```

The export must contain arrays named `tea_compass_entries`, `tea_samples`,
`tea_sample_sets`, `customers` and `products`. The aliases `entries`, `samples`,
`sets` and `vendors` are accepted. Include the stored IDs and account/user
columns. Omit `--user` only when deliberately reviewing the entire account.

The report shows ownership/counts, sampled Curate entries missing active shelf
samples, empty unnamed sets, repeated identities, missing vendor links, exact
single-name vendor candidates, and unmatched/ambiguous names. Name-only repeats
are ambiguous, never automatic merge candidates. Missing grams are unknown.

The three XWT IDs from the handoff are flagged as proposed received overrides
only if found within the selected scope. Their received status comes from the
handoff and requires review; the script does not claim it measured live stock.

After verifying scope and reviewing the report, existing `curate_update_tea`
previews can attach missing shelf samples using `sample_state` and, when known,
`sample_grams`. Confirm those previews only after approval. The bridge reuses an
active linked portion, so rerunning an approved update does not duplicate it.
Deleting empty batches or merging repeats remains a separate decision.

Live follow-up on 2026-10-08 verified shop-wide access and confirmed the
authorized LKY/XWT sample and structured-field cleanup. See
[Curate workspace](CURATE_WORKSPACE.md#existing-lkyxwt-data) for the exact scope.
The separate empty-set and ambiguous-duplicate report remains a review, not
a claim that those unrelated records were changed.
Freight allocation and richer cross-surface tasting summaries remain separate
work; shop tasting publication remains deliberate.
