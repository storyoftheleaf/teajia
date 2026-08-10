import { createClaimDraft } from '../claim.mjs';
import { createEvidence, normalizeCapturedText } from '../evidence.mjs';
import { extractBoundedClassRegion, extractElements, extractMetaContent, SourceLayoutMismatchError } from './html.mjs';

const SCOPE_RULES = [
  ['geography', /region|mountain|village|county|area|yunnan|xishuangbanna|yiwu|menghai|lincang/i],
  ['processing', /process|rolling|sun.?dry|kill.?green|ferment|oxid|roast|compression/i],
  ['storage', /stor|aging|aged|humidity|temperature/i],
  ['common_characteristics', /character|taste|flavou?r|aroma|fragrance|sweet|bitter|body|aftertaste|mouthfeel/i],
  ['historical', /histor|dynasty|century|tradition|origin|year|199\d|200\d|201\d|202\d/i],
  ['relationship', /name|term|label|designation|refer|classification|nomenclature/i],
];

function permittedScope(source, paragraph) {
  const candidate = SCOPE_RULES.find(([, pattern]) => pattern.test(paragraph))?.[0];
  if (candidate && source.permittedClaimScopes.includes(candidate)) return candidate;
  return source.permittedClaimScopes[0];
}

export function extractMarshalnArticle({ source, html }) {
  const rootHtml = extractBoundedClassRegion(html, 'entry', ['sharedaddy', 'jp-relatedposts']);
  const title = extractMetaContent(html, 'og:title');
  if (!rootHtml || !title) throw new SourceLayoutMismatchError('Expected MarshalN post body and title were not found');
  const paragraphs = extractElements(rootHtml, ['p']).map(({ text }) => text).filter(Boolean);
  if (paragraphs.length === 0) throw new SourceLayoutMismatchError('Expected MarshalN post paragraphs were not found');

  const normalizedText = normalizeCapturedText(paragraphs.join('\n\n'));
  const subject = source.captureSubject || title;
  const entityKind = source.permittedEntityKinds[0];
  const evidence = [];
  const claims = [];
  for (const paragraph of paragraphs) {
    const item = createEvidence({
      sourceId: source.sourceId,
      normalizedText,
      exact: paragraph,
      extractorVersion: source.adapterVersion,
    });
    evidence.push(item);
    claims.push(createClaimDraft({
      source,
      evidenceId: item.evidenceId,
      subject,
      predicate: 'source_description',
      value: paragraph,
      claimScope: permittedScope(source, paragraph),
      entityKind,
      status: 'held',
      uncertaintyReason: 'Independent specialist commentary remains attributed and held; it cannot establish official identity, exact-lot origin, or Adrian tasting.',
    }));
  }

  return Object.freeze({
    metadata: Object.freeze({
      title,
      author: source.captureAuthor || '',
      publishedDate: extractMetaContent(html, 'article:published_time'),
    }),
    normalizedText,
    evidence: Object.freeze(evidence),
    claims: Object.freeze(claims),
  });
}
