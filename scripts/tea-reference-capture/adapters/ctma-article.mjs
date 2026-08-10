import { createClaimDraft } from '../claim.mjs';
import { createEvidence, normalizeCapturedText } from '../evidence.mjs';
import { extractElementByClass, extractElements, SourceLayoutMismatchError } from './html.mjs';

const SCOPE_RULES = [
  ['geography', /产区|茶区|茶山|山头|村|寨|县|州|市|云南|西双版纳|临沧/i],
  ['processing', /工艺|加工|制茶|晒青|杀青|揉捻|渥堆|发酵|生茶|熟茶|生、熟普洱茶/i],
  ['common_characteristics', /滋味|香气|口感|回甘|苦|涩|甜|品质|特征|特点/i],
  ['historical', /历史|古代|年代|世纪|朝|传统|起源/i],
];

function permittedScope(source, heading, paragraph) {
  const paragraphCandidate = SCOPE_RULES.find(([, pattern]) => pattern.test(paragraph))?.[0];
  const headingCandidate = SCOPE_RULES.find(([, pattern]) => pattern.test(heading))?.[0];
  const candidate = paragraphCandidate || headingCandidate;
  if (candidate && source.permittedClaimScopes.includes(candidate)) return candidate;
  return source.permittedClaimScopes[0];
}

function metadataValue(text, label) {
  const match = text.match(new RegExp(`${label}\\s*[：:]\\s*([^\\s]+)`));
  return match?.[1]?.trim() || '';
}

export function extractCtmaArticle({ source, html }) {
  const body = extractElementByClass(html, 'div', 'article-text');
  const title = extractElementByClass(html, 'h1', 'metas-title')?.text || '';
  if (!body || !title) throw new SourceLayoutMismatchError('Expected CTMA article body and title were not found');

  const metaText = extractElementByClass(html, 'div', 'metas-body')?.text || '';
  const elements = extractElements(body.html, ['p']);
  let heading = '';
  const paragraphs = [];
  for (const element of elements) {
    if (!element.text) continue;
    if (/^\s*<(strong|b)\b/i.test(element.html) && element.text.length <= 80) {
      heading = element.text;
      continue;
    }
    paragraphs.push({ heading, text: element.text });
  }
  if (paragraphs.length === 0) throw new SourceLayoutMismatchError('Expected CTMA article paragraphs were not found');

  const normalizedText = normalizeCapturedText(paragraphs.map(({ text }) => text).join('\n\n'));
  const subject = source.captureSubject || title;
  const entityKind = source.permittedEntityKinds[0];
  const evidence = [];
  const claims = [];
  for (const paragraph of paragraphs) {
    const item = createEvidence({
      sourceId: source.sourceId,
      normalizedText,
      exact: paragraph.text,
      heading: paragraph.heading,
      section: paragraph.heading,
      extractorVersion: source.adapterVersion,
    });
    evidence.push(item);
    claims.push(createClaimDraft({
      source,
      evidenceId: item.evidenceId,
      subject,
      predicate: 'source_description',
      value: paragraph.text,
      claimScope: permittedScope(source, paragraph.heading, paragraph.text),
      entityKind,
      sourceTerm: paragraph.heading,
      status: 'held',
      uncertaintyReason: 'Trade-association descriptions remain attributed drafts until privately checked against the credited publisher and surrounding evidence.',
    }));
  }

  return Object.freeze({
    metadata: Object.freeze({
      title,
      author: metadataValue(metaText, '来源'),
      publishedDate: metadataValue(metaText, '发布日期'),
    }),
    normalizedText,
    evidence: Object.freeze(evidence),
    claims: Object.freeze(claims),
  });
}
