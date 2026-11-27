// What is waiting for a decision in the Wisdom Base, as review items.
// Shared by review-page.mjs (Adrian's page) and judge.mjs (the Opus judge).
import fs from 'node:fs/promises';
import path from 'node:path';
import { buildWisdom } from '../../tea-reference-markdown/lib/page-builder.mjs';
import { readEntries } from './entries.mjs';

const KIND = { tea_family: 'Tea family', tea_type: 'Style', major_region: 'Region', tea_area: 'Place', leaf_grade: 'Grade', named_tea: 'Named tea', reference_topic: 'Topic' };

/**
 * Waiting sections (draft or pending) and unapproved entries. With `keys`, exactly
 * those items instead, whatever their state, so a "what went up" page can show
 * items that are already approved.
 */
export async function reviewItems(root, { scopes = {}, pages: onlyPages = null, entries = true, keys = null } = {}) {
  const wisdom = await buildWisdom({
    pagesDirectory: path.join(root, 'data', 'tea-reference', 'pages'),
    translationsPath: path.join(root, 'data', 'tea-reference', 'private', 'translations.json'),
    claimsPath: path.join(root, 'data', 'tea-reference', 'claims.json'),
  });
  const sources = new Map(wisdom.draftSources.map(source => [source.sourceId, source]));
  const pages = new Map(wisdom.draftPages.map(page => [page.id, page]));
  const wanted = (key, waiting) => (keys ? keys.has(key) : waiting);

  const claimItems = wisdom.draftClaims
    .filter(claim => !claim.withdrawn && wanted(claim.claimId, claim.reviewState === 'draft' || claim.reviewState === 'pending'))
    .filter(claim => !onlyPages || onlyPages.has(claim.pageId))
    .map(claim => {
      const page = pages.get(claim.pageId);
      return {
        key: claim.claimId,
        kind: 'claim',
        group: claim.pageId,
        groupLabel: page?.label ?? claim.pageId,
        groupMeta: [KIND[page?.kind] ?? page?.kind, page?.nativeName, page?.parentId ? `inside ${pages.get(page.parentId)?.label ?? page.parentId}` : null].filter(Boolean).join(' · '),
        label: claim.label,
        text: claim.pendingText ?? claim.text,
        before: claim.reviewState === 'pending' ? claim.text : null,
        scope: claim.scope || scopes[claim.claimId] || page?.label || claim.pageId,
        sources: claim.sourceIds.map(id => sources.get(id)).filter(Boolean).map(source => ({ title: source.title, publisher: source.publisher, url: /^https:\/\//.test(source.url ?? '') ? source.url : null })),
        flags: claim.unresolvedSourceIds?.length ? [`${claim.unresolvedSourceIds.length} source(s) not captured yet`] : [],
      };
    });

  const entryItems = !entries ? [] : (await readEntries(path.join(root, 'data', 'tea-reference', 'entries')))
    .filter(({ file }) => wanted(`entry:${file.record.id}`, file.status !== 'approved'))
    .map(({ file }) => ({
      key: `entry:${file.record.id}`,
      kind: 'entry',
      group: 'entries',
      groupLabel: file.record.name,
      groupMeta: [file.record.type, file.record.form, file.record.year, file.record.origin].filter(Boolean).join(' · '),
      label: file.record.chineseName ?? '',
      paragraphs: (file.entry?.paragraphs ?? []).map(part => part.text),
      brewing: file.entry?.brewing ?? null,
      notice: file.entry?.notice ?? null,
      flags: [...(file.problems ?? []).map(problem => `${problem.where}: ${problem.problem}`), ...(file.unsupported ?? []).map(flag => `Not supported: "${flag.words}"${flag.why ? ` (${flag.why})` : ''}`)],
    }));

  return [...claimItems, ...entryItems];
}

export async function readJson(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch (error) { if (error?.code === 'ENOENT') return fallback; throw error; }
}
