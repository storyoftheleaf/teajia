import { createClaimDraft } from '../claim.mjs';
import { createEvidence, normalizeCapturedText } from '../evidence.mjs';
import {
  extractAttribute,
  extractElements,
  extractMetaContent,
  extractTitle,
  requireElement,
  SourceLayoutMismatchError,
} from './html.mjs';

const SCOPE_RULES = [
  ['geography', /geograph|region|mountain|village|county|area|yunnan|xishuangbanna|locality/i],
  ['processing', /process|rolling|sun.?dry|kill.?green|ferment|oxid|roast/i],
  ['common_characteristics', /character|taste|flavou?r|aroma|fragrance|sweet|bitter|body|aftertaste|mouthfeel/i],
  ['historical', /histor|dynasty|century|tradition|origin/i],
];

function permittedScope(source, heading, paragraph) {
  const context = `${heading} ${paragraph}`;
  const candidate = SCOPE_RULES.find(([, pattern]) => pattern.test(context))?.[0] ?? 'identity';
  if (source.permittedClaimScopes.includes(candidate)) return candidate;
  return source.permittedClaimScopes[0];
}

export function extractSpecialistArticle({ source, html }) {
  const article = requireElement(html, 'article', 'article root');
  const title = extractTitle(article.html) || extractTitle(html);
  if (!title) throw new SourceLayoutMismatchError('Expected article title was not found');

  const sequence = extractElements(article.html, ['h2', 'h3', 'p']);
  let heading = '';
  const paragraphs = [];
  for (const element of sequence) {
    if (element.tag === 'h2' || element.tag === 'h3') heading = element.text;
    if (element.tag === 'p') paragraphs.push({ heading, text: element.text });
  }
  if (paragraphs.length === 0) throw new SourceLayoutMismatchError('Expected article paragraphs were not found');

  const normalizedText = normalizeCapturedText(paragraphs.map(({ text }) => text).join('\n\n'));
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
      subject: title,
      predicate: 'source_description',
      value: paragraph.text,
      claimScope: permittedScope(source, paragraph.heading, paragraph.text),
      entityKind,
      sourceTerm: paragraph.heading,
      status: 'held',
      uncertaintyReason: 'Specialist descriptions remain attributed drafts until privately checked against the source and surrounding evidence.',
    }));
  }

  const time = extractElements(article.html, ['time'])[0];
  return Object.freeze({
    metadata: Object.freeze({
      title,
      author: extractMetaContent(html, 'author'),
      publishedDate: time ? extractAttribute(time.attributes, 'datetime') || time.text : '',
    }),
    normalizedText,
    evidence: Object.freeze(evidence),
    claims: Object.freeze(claims),
  });
}
