import { createClaimDraft } from '../claim.mjs';
import { createEvidence, normalizeCapturedText } from '../evidence.mjs';
import { extractMetaContent, extractTitle, SourceLayoutMismatchError } from './html.mjs';

export function extractJournalAbstract({ source, html }) {
  const title = extractMetaContent(html, 'citation_title') || extractMetaContent(html, 'dc.title') || extractTitle(html);
  const abstract = extractMetaContent(html, 'citation_abstract') || extractMetaContent(html, 'dc.description') || extractMetaContent(html, 'description');
  if (!title) throw new SourceLayoutMismatchError('Expected journal article title metadata was not found');
  if (!abstract) throw new SourceLayoutMismatchError('Expected journal abstract metadata was not found');

  const normalizedText = normalizeCapturedText(abstract);
  const item = createEvidence({
    sourceId: source.sourceId,
    normalizedText,
    exact: abstract,
    heading: 'Abstract',
    section: 'Abstract',
    extractorVersion: source.adapterVersion,
  });
  const claim = createClaimDraft({
    source,
    evidenceId: item.evidenceId,
    subject: source.captureSubject || title,
    predicate: 'study_abstract',
    value: abstract,
    claimScope: source.permittedClaimScopes[0],
    entityKind: source.permittedEntityKinds[0],
    sourceTerm: 'Abstract',
    qualifiers: { evidenceType: 'individual_study', studyScoped: true },
    status: 'held',
    uncertaintyReason: 'This is an individual study result. It must remain study-scoped and cannot be promoted to a general tea characteristic without broader corroboration.',
  });

  return Object.freeze({
    metadata: Object.freeze({
      title,
      author: extractMetaContent(html, 'citation_authors') || extractMetaContent(html, 'authors'),
      publishedDate: extractMetaContent(html, 'citation_publication_date') || extractMetaContent(html, 'prism.publicationDate'),
      doi: extractMetaContent(html, 'citation_doi') || extractMetaContent(html, 'DOI'),
    }),
    normalizedText,
    evidence: Object.freeze([item]),
    claims: Object.freeze([claim]),
  });
}
