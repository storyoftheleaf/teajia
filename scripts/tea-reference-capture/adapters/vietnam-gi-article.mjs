import { createClaimDraft } from '../claim.mjs';
import { createEvidence, normalizeCapturedText } from '../evidence.mjs';
import { extractElementByClass, extractElements, SourceLayoutMismatchError } from './html.mjs';

const SCOPE_RULES = [
  ['legal', /registration|certificate|decision no\.|geographical indication|protected/i],
  ['geography', /geograph|province|district|commune|village|area|altitude|mountain|soil|slope/i],
  ['processing', /process|cultivat|pick|packag|fertil|pesticide|bud|young leaves/i],
  ['common_characteristics', /character|quality|liquor|aroma|fragrance|taste|astring|aftertaste|tannin|soluble/i],
  ['identity', /includes?|product types?|variety|tea products?/i],
];

function scopeFor(source, paragraph, legalSummary = false) {
  if (legalSummary && source.permittedClaimScopes.includes('legal')) return 'legal';
  for (const [scope, pattern] of SCOPE_RULES) {
    if (pattern.test(paragraph) && source.permittedClaimScopes.includes(scope)) return scope;
  }
  return source.permittedClaimScopes[0];
}

function isArticleText(text) {
  return text && !/^(figure\b|source:|translator:)/i.test(text);
}

export function extractVietnamGiArticle({ source, html }) {
  const title = extractElementByClass(html, 'h3', 'text-change-size')?.text;
  const body = extractElementByClass(html, 'div', 'journal-content-article');
  if (!title) throw new SourceLayoutMismatchError('Expected Vietnam GI article title was not found');
  if (!body) throw new SourceLayoutMismatchError('Expected Vietnam GI article body was not found');

  const summary = extractElementByClass(html, 'p', 'sapo')?.text || '';
  const parts = [];
  if (summary) parts.push({ text: summary, legalSummary: true, section: 'Summary' });
  for (const { text } of extractElements(body.html, ['p'])) {
    if (isArticleText(text)) parts.push({ text, legalSummary: false, section: 'Article' });
  }
  if (parts.length === 0) throw new SourceLayoutMismatchError('Expected Vietnam GI article paragraphs were not found');

  const normalizedText = normalizeCapturedText(parts.map(({ text }) => text).join('\n\n'));
  const evidence = [];
  const claims = [];
  for (const part of parts) {
    const item = createEvidence({
      sourceId: source.sourceId,
      normalizedText,
      exact: part.text,
      heading: part.section,
      section: part.section,
      extractorVersion: source.adapterVersion,
    });
    evidence.push(item);
    claims.push(createClaimDraft({
      source,
      evidenceId: item.evidenceId,
      subject: title,
      predicate: part.legalSummary ? 'registration_summary' : 'source_description',
      value: part.text,
      claimScope: scopeFor(source, part.text, part.legalSummary),
      entityKind: source.permittedEntityKinds[0],
      sourceTerm: part.section,
      qualifiers: { registryDescription: true, exactLot: false },
      status: 'held',
      uncertaintyReason: 'The registry description is cited evidence, not Adrian tasting and not a description of every lot from the region.',
    }));
  }

  return Object.freeze({
    metadata: Object.freeze({
      title,
      author: '',
      publishedDate: extractElementByClass(html, 'span', 'metadata-publish-date')?.text || '',
    }),
    normalizedText,
    evidence: Object.freeze(evidence),
    claims: Object.freeze(claims),
  });
}
