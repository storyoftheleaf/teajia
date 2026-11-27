#!/usr/bin/env bash
# Reads PR_BODY and APPROVED (true/false) from the environment.
# Exit 0: the PR may merge. Exit 1: it may not, with the reason printed.
set -euo pipefail
body="${PR_BODY:-}"
approved="${APPROVED:-false}"

if ! printf '%s\n' "$body" | grep -qi '^##[[:space:]]*Merge danger'; then
  echo "::error::The PR description has no '## Merge danger' section. Run the review-pr skill, or copy .github/pull_request_template.md."
  exit 1
fi

# Strip HTML comments so the template's hint text never counts as an answer.
plain="$(printf '%s\n' "$body" | perl -0pe 's/<!--.*?-->//gs')"
door="$(printf '%s\n' "$plain" | grep -io -m1 -E '(one|two)-way door' | tr '[:upper:]' '[:lower:]' || true)"

case "$door" in
  "two-way door")
    echo "Two-way door: reverting the merge undoes it. OK to merge on green."
    ;;
  "one-way door")
    if [ "$approved" = "true" ]; then
      echo "One-way door, approved by the owner-approved label."
    else
      echo "::error::One-way door: this change can't simply be reverted. It waits for Adrian to add the owner-approved label."
      exit 1
    fi
    ;;
  *)
    echo "::error::The Merge danger section doesn't say 'two-way door' or 'one-way door'."
    exit 1
    ;;
esac
