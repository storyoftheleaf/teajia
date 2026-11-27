// Pure rules for the Wisdom review page's apply step (apply-review.mjs).

/** Section claim ids of a page's Markdown, in order. */
export function sectionClaimIds(pageId, markdown) {
  return [...markdown.matchAll(/^## .*\{#([a-z0-9-]+)\}\s*$/gm)].map(match => `${pageId}:${match[1]}`);
}

/**
 * True when a draft page may become public: every section approved, and no
 * legacy-import revision anywhere in any section's history (the ledger allows
 * those only on draft pages, so Palace Grade stays a draft).
 */
export function mayPublish(pageId, markdown, ledgerClaims) {
  if (!/^visibility:\s*draft\s*$/m.test(markdown)) return false;
  const byClaim = new Map(ledgerClaims.map(entry => [entry.claim_id, entry]));
  const keys = sectionClaimIds(pageId, markdown);
  return keys.length > 0 && keys.every(key => {
    const entry = byClaim.get(key);
    return entry?.status === 'approved' && !(entry.revisions ?? []).some(rev => rev.origin === 'legacy_import');
  });
}

export const publishedMarkdown = (markdown) => markdown.replace(/^visibility:\s*draft\s*$/m, 'visibility: public');
