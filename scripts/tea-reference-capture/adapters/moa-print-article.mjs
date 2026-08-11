import { createClaimDraft } from '../claim.mjs';
import { createEvidence, normalizeCapturedText } from '../evidence.mjs';
import { extractElementByClass, extractElements, SourceLayoutMismatchError } from './html.mjs';

const SCOPE_RULES = [
  ['identity', /是.{0,30}品種|品種名稱|別名|親緣|親本|分類|原生/],
  ['historical', /歷史|育成|選拔|命名|引進|發現|年/],
  ['cultivar_potential', /適製|香氣|滋味|風味|品質|特性|萌芽|樹型|抗|產量/],
  ['identity', /品種|名稱/],
];

function scopeFor(source, paragraph) {
  for (const [scope, pattern] of SCOPE_RULES) {
    if (pattern.test(paragraph) && source.permittedClaimScopes.includes(scope)) return scope;
  }
  return source.permittedClaimScopes[0];
}

export function extractMoaPrintArticle({ source, html }) {
  const title = extractElementByClass(html, 'div', 'title')?.text;
  const article = extractElementByClass(html, 'div', 'article');
  if (!title) throw new SourceLayoutMismatchError('Expected MOA print article title was not found');
  if (!article) throw new SourceLayoutMismatchError('Expected MOA print article body was not found');
  const paragraphs = extractElements(article.html, ['p']).map(({ text }) => text).filter(Boolean);
  if (paragraphs.length === 0) throw new SourceLayoutMismatchError('Expected MOA print article paragraphs were not found');

  const normalizedText = normalizeCapturedText(paragraphs.join('\n\n'));
  const evidence = [];
  const claims = [];
  for (const paragraph of paragraphs) {
    const item = createEvidence({
      sourceId: source.sourceId,
      normalizedText,
      exact: paragraph,
      heading: title,
      section: title,
      extractorVersion: source.adapterVersion,
    });
    evidence.push(item);
    claims.push(createClaimDraft({
      source,
      evidenceId: item.evidenceId,
      subject: title,
      predicate: 'source_description',
      value: paragraph,
      claimScope: scopeFor(source, paragraph),
      entityKind: source.permittedEntityKinds[0],
      sourceTerm: title,
      qualifiers: { describesPotentialNotEveryLot: true },
      status: 'held',
      uncertaintyReason: 'The Ministry article is retained as cited source description until its entity mapping and translation are privately checked.',
    }));
  }

  const dateText = extractElementByClass(html, 'div', 'p_date')?.text || '';
  return Object.freeze({
    metadata: Object.freeze({
      title,
      author: '',
      publishedDate: dateText.replace(/^發文日[：:]\s*/, ''),
    }),
    normalizedText,
    evidence: Object.freeze(evidence),
    claims: Object.freeze(claims),
  });
}
