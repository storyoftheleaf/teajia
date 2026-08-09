import { createClaimDraft } from '../claim.mjs';
import { createEvidence, normalizeCapturedText } from '../evidence.mjs';
import { extractElements, extractTitle, SourceLayoutMismatchError } from './html.mjs';

const FIELD_RULES = [
  { pattern: /英文名稱|english\s*name/i, predicate: 'english_name', claimScope: 'identity' },
  { pattern: /親本|親緣|parentage|parents?/i, predicate: 'parentage', claimScope: 'identity' },
  { pattern: /適製性|適製茶類|suitable|tea\s*type/i, predicate: 'suitable_styles', claimScope: 'cultivar_potential' },
  { pattern: /品種名稱|中文名稱|cultivar\s*name|variety\s*name/i, predicate: 'native_name', claimScope: 'identity' },
  { pattern: /命名|育成|選拔|release|selection|registration/i, predicate: 'development_history', claimScope: 'identity' },
  { pattern: /特性|品質|characteristic|quality/i, predicate: 'common_characteristics', claimScope: 'cultivar_potential' },
];

function labelledPairs(html) {
  const terms = extractElements(html, ['dt', 'dd']);
  const pairs = [];
  for (let index = 0; index < terms.length - 1; index += 1) {
    if (terms[index].tag === 'dt' && terms[index + 1].tag === 'dd') {
      pairs.push([terms[index].text, terms[index + 1].text]);
      index += 1;
    }
  }
  const rows = extractElements(html, ['tr']);
  for (const row of rows) {
    const cells = extractElements(row.html, ['th', 'td']);
    if (cells.length >= 2) pairs.push([cells[0].text, cells.slice(1).map(({ text }) => text).join(' ')]);
  }
  return pairs;
}

export function extractTbrsCultivar({ source, html }) {
  const title = extractTitle(html);
  if (!title) throw new SourceLayoutMismatchError('Expected cultivar title was not found');
  const fields = labelledPairs(html).map(([label, value]) => ({
    label,
    value,
    rule: FIELD_RULES.find(({ pattern }) => pattern.test(label)),
  })).filter(({ rule, value }) => rule && value);
  if (fields.length < 2) throw new SourceLayoutMismatchError('Expected at least two recognized labelled cultivar fields');

  const normalizedText = normalizeCapturedText(fields.map(({ value }) => value).join('\n\n'));
  const evidence = [];
  const claims = [];
  for (const field of fields) {
    const item = createEvidence({
      sourceId: source.sourceId,
      normalizedText,
      exact: field.value,
      heading: field.label,
      section: field.label,
      extractorVersion: source.adapterVersion,
    });
    evidence.push(item);
    claims.push(createClaimDraft({
      source,
      evidenceId: item.evidenceId,
      subject: title,
      predicate: field.rule.predicate,
      value: field.value,
      claimScope: field.rule.claimScope,
      entityKind: 'cultivar',
      sourceTerm: field.label,
      status: 'captured',
    }));
  }

  return Object.freeze({
    metadata: Object.freeze({ title, author: '', publishedDate: '' }),
    normalizedText,
    evidence: Object.freeze(evidence),
    claims: Object.freeze(claims),
  });
}
