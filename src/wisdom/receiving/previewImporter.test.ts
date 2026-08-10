import { describe, expect, it } from 'vitest';
import {
  EMPTY_RECEIVING_STATE,
  previewWebsiteHandoff,
  publicTransportFor,
  type ReferenceReceivingState,
  type WebsiteHandoff,
} from './previewImporter';

const citation = {
  citationId: 'CITATION-TEADB-EVIDENCE-1',
  sourceId: 'teadb',
  evidenceId: 'EVIDENCE-1',
  publisher: 'TeaDB',
  publisherRole: 'specialist_editorial',
  title: 'Pu’erh Regions: Greater Yiwu',
  author: 'James',
  publishedDate: '2014-09-13',
  accessedDate: '2026-08-10',
  url: 'https://teadb.org/mengla-county-yiwu/',
} as const;

const entity = {
  resolutionId: 'RESOLUTION-YIWU',
  canonicalEntityId: '',
  preferredLabel: 'Greater Yiwu',
  sourceLabel: 'Greater Yiwu',
  entityKind: 'tea_area',
  websiteHolding: 'regions',
  proposedAction: 'hold',
  resolutionStatus: 'hold_unresolved',
  reason: 'No verified parent geography.',
  claimIds: ['CLAIM-COMMON'],
} as const;

const commonClaim = {
  claimId: 'CLAIM-COMMON',
  resolutionId: entity.resolutionId,
  canonicalEntityId: '',
  subject: 'Greater Yiwu',
  entityKind: 'tea_area',
  claimScope: 'common_characteristics',
  websiteHolding: 'regions',
  websiteField: 'commonCharacteristics',
  candidateValue: 'Yiwu is often described as having a softer base and a long-lasting sweet aftertaste.',
  qualifiers: {},
  assertingPublisherRole: 'specialist_editorial',
  compatibility: 'requires_model_extension',
  citationId: citation.citationId,
  proposedAction: 'hold',
  holdReason: 'Keep common characteristics separate from exact lots and personal tasting.',
  payloadSha256: 'claim-common-hash',
} as const;

function handoff(overrides: Partial<WebsiteHandoff> = {}): WebsiteHandoff {
  const result: WebsiteHandoff = {
    manifest: {
      schemaVersion: 1,
      siteModel: 'tea-wisdom-v1',
      mode: 'preview-only',
      claimsSha256: 'claims-hash',
      sourceSnapshotSha256: 'sources-hash',
      entityCount: 1,
      claimCount: 1,
      citationCount: 1,
      readyToPublishCount: 0,
      heldBackCount: 1,
      payloadSha256: 'payload-hash',
    },
    entities: [entity],
    claims: [commonClaim],
    citations: [citation],
    heldBack: [{ claimId: commonClaim.claimId, reason: commonClaim.holdReason }],
    ...overrides,
  };
  if (!overrides.manifest) {
    result.manifest = {
      ...result.manifest,
      entityCount: result.entities.length,
      claimCount: result.claims.length,
      citationCount: result.citations.length,
      heldBackCount: result.heldBack.length,
    };
  }
  return result;
}

describe('citation-aware receiving preview', () => {
  it('keeps common characteristics separate from exact-lot and personal tasting registers', () => {
    const exactLot = {
      ...commonClaim,
      claimId: 'CLAIM-LOT',
      claimScope: 'exact_lot',
      entityKind: 'exact_lot',
      websiteHolding: 'none',
      websiteField: 'sourceDescription',
      candidateValue: 'Seller description for one cake.',
      citationId: 'CITATION-TEADB-EVIDENCE-2',
      compatibility: 'prohibited',
      holdReason: 'An exact lot stays with its exact lot record.',
    } as const;
    const personalTasting = {
      ...commonClaim,
      claimId: 'CLAIM-TASTING',
      claimScope: 'personal_tasting',
      websiteField: 'personalTasting',
      candidateValue: 'Adrian tasted apricot.',
      citationId: 'CITATION-TEADB-EVIDENCE-3',
      compatibility: 'prohibited',
    } as const;
    const input = handoff({
      claims: [commonClaim, exactLot, personalTasting],
      citations: [
        citation,
        { ...citation, citationId: exactLot.citationId, evidenceId: 'EVIDENCE-2' },
        { ...citation, citationId: personalTasting.citationId, evidenceId: 'EVIDENCE-3' },
      ],
      heldBack: [
        { claimId: commonClaim.claimId, reason: commonClaim.holdReason },
        { claimId: exactLot.claimId, reason: exactLot.holdReason },
        { claimId: personalTasting.claimId, reason: 'Personal tasting cannot be source-extracted.' },
      ],
    });

    const result = previewWebsiteHandoff(input);
    const common = result.privateVerification.find(record => record.resourceId === commonClaim.claimId);
    const lot = result.privateVerification.find(record => record.resourceId === exactLot.claimId);
    const tasting = result.privateVerification.find(record => record.resourceId === personalTasting.claimId);

    expect(common?.register).toBe('common_characteristics');
    expect(lot?.register).toBe('exact_lot_source_description');
    expect(tasting?.register).toBe('personal_tasting');
    expect(result.operations.filter(operation => operation.resourceType === 'fact').map(operation => operation.action))
      .toEqual(['held', 'held', 'held']);

    const publicJson = JSON.stringify(result.publicPreview);
    expect(publicJson).toContain('Common characteristics');
    expect(publicJson).not.toContain('Seller description for one cake');
    expect(publicJson).not.toContain('Adrian tasted apricot');
    expect(publicJson).not.toMatch(/holdReason|evidenceId|privateVerification|candidateValue/);
  });

  it('preserves geographic depth and holds unplaced geography instead of flattening it', () => {
    const entities = [
      { ...entity, resolutionId: 'RESOLUTION-REGION', preferredLabel: 'Lincang', sourceLabel: 'Lincang', entityKind: 'major_region' },
      { ...entity, resolutionId: 'RESOLUTION-AREA', entityKind: 'tea_area' },
      { ...entity, resolutionId: 'RESOLUTION-MOUNTAIN', preferredLabel: 'Bulang Mountain', sourceLabel: 'Bulang Mountain', entityKind: 'mountain' },
      { ...entity, resolutionId: 'RESOLUTION-VILLAGE', preferredLabel: 'Lao Man’e', sourceLabel: 'Lao Man’e', entityKind: 'village' },
    ] as WebsiteHandoff['entities'];

    const result = previewWebsiteHandoff(handoff({ entities, claims: [], citations: [], heldBack: [] }));
    const geographic = result.operations.filter(operation => operation.resourceType === 'entity');

    expect(geographic.map(operation => operation.candidate?.geographicLevel)).toEqual([
      'major_region',
      'tea_area',
      'mountain',
      'village',
    ]);
    expect(geographic.every(operation => operation.action === 'held')).toBe(true);
    expect(geographic.every(operation => operation.reason.includes('verified parent'))).toBe(true);
  });

  it('carries a validated parent entity through the receiving preview and public transport', () => {
    const parent = {
      ...entity,
      resolutionId: 'RESOLUTION-PARENT',
      canonicalEntityId: 'ENTITY-PARENT',
      preferredLabel: 'Yunnan',
      sourceLabel: 'Yunnan',
      entityKind: 'major_region',
      claimIds: [],
    } as const;
    const child = {
      ...entity,
      resolutionId: 'RESOLUTION-CHILD',
      canonicalEntityId: 'ENTITY-CHILD',
      preferredLabel: 'Yiwu',
      sourceLabel: 'Yiwu',
      entityKind: 'tea_area',
      parentEntityId: parent.canonicalEntityId,
      claimIds: [],
    } as const;

    const received = previewWebsiteHandoff(handoff({
      entities: [child, parent],
      claims: [],
      citations: [],
      heldBack: [],
    }));
    const transported = publicTransportFor(received);
    const publicChild = transported.publicPreview.sections
      .flatMap(section => section.entries)
      .find(item => item.id === child.resolutionId);
    const childOperation = received.operations.find(operation => operation.resourceId === child.resolutionId);

    expect(childOperation?.candidate?.parentEntityId).toBe(parent.resolutionId);
    expect(publicChild?.parentId).toBe(parent.resolutionId);
  });

  it.each([
    ['blank', ' '],
    ['self resolution', 'RESOLUTION-CHILD'],
    ['self canonical entity', 'ENTITY-CHILD'],
    ['missing', 'RESOLUTION-MISSING'],
  ])('rejects a %s public parent entity ID', (_case, parentEntityId) => {
    const child = {
      ...entity,
      resolutionId: 'RESOLUTION-CHILD',
      canonicalEntityId: 'ENTITY-CHILD',
      parentEntityId,
    };

    expect(() => previewWebsiteHandoff(handoff({
      entities: [child],
      claims: [],
      citations: [],
      heldBack: [],
    }))).toThrow(/parent/i);
  });

  it('reports create, update, no-op, conflict and held without mutating the supplied state', () => {
    const first = previewWebsiteHandoff(handoff());
    expect(first.summary).toEqual({ create: 2, update: 0, noOp: 0, conflict: 0, held: 2 });
    expect(first.projectedState.verification).toHaveLength(2);

    const current = structuredClone(first.projectedState);
    const untouched = structuredClone(current);
    const same = previewWebsiteHandoff(handoff(), current);
    expect(same.summary).toEqual({ create: 0, update: 0, noOp: 2, conflict: 0, held: 2 });
    expect(current).toEqual(untouched);

    const updateState: ReferenceReceivingState = {
      ...EMPTY_RECEIVING_STATE,
      sources: [{ ...current.sources[0], title: 'Older title' }],
    };
    expect(previewWebsiteHandoff(handoff(), updateState).summary.update).toBe(1);

    const conflictState: ReferenceReceivingState = {
      ...EMPTY_RECEIVING_STATE,
      sources: [{ ...current.sources[0], publisherRole: 'retailer_reseller' }],
    };
    expect(previewWebsiteHandoff(handoff(), conflictState).summary.conflict).toBe(1);
  });

  it('is deterministic across input ordering and repeated calls', () => {
    const secondCitation = { ...citation, citationId: 'CITATION-TEADB-EVIDENCE-2', evidenceId: 'EVIDENCE-2' };
    const secondClaim = { ...commonClaim, claimId: 'CLAIM-GEOGRAPHY', claimScope: 'geography', citationId: secondCitation.citationId };
    const input = handoff({ claims: [secondClaim, commonClaim], citations: [secondCitation, citation] });
    const reversed = handoff({ claims: [commonClaim, secondClaim], citations: [citation, secondCitation] });

    expect(previewWebsiteHandoff(input)).toEqual(previewWebsiteHandoff(reversed));
    expect(previewWebsiteHandoff(input)).toEqual(previewWebsiteHandoff(input));
  });

  it('groups glossary and taxonomy entries into one reference terms section', () => {
    const glossary = { ...entity, resolutionId: 'RESOLUTION-GLOSSARY', entityKind: 'glossary_term' } as const;
    const taxonomy = { ...entity, resolutionId: 'RESOLUTION-TAXONOMY', entityKind: 'taxonomy_term' } as const;
    const result = previewWebsiteHandoff(handoff({ entities: [glossary, taxonomy], claims: [], citations: [], heldBack: [] }));

    expect(result.publicPreview.sections.filter(section => section.id === 'taxonomy_term')).toHaveLength(1);
    expect(result.publicPreview.sections.find(section => section.id === 'taxonomy_term')?.entries).toHaveLength(2);
  });

  it('rejects count mismatches and broken citation or entity references', () => {
    expect(() => previewWebsiteHandoff(handoff({
      manifest: { ...handoff().manifest, claimCount: 2 },
    }))).toThrow(/claim count/i);
    expect(() => previewWebsiteHandoff(handoff({
      claims: [{ ...commonClaim, citationId: 'CITATION-MISSING' }],
    }))).toThrow(/missing citation/i);
    expect(() => previewWebsiteHandoff(handoff({
      claims: [{ ...commonClaim, resolutionId: 'RESOLUTION-MISSING' }],
    }))).toThrow(/missing entity resolution/i);
  });

  it('does not expose conflicted source or citation candidates publicly', () => {
    const current = previewWebsiteHandoff(handoff()).projectedState;
    current.citations = [{ ...current.citations[0], evidenceId: 'EVIDENCE-OTHER' }];
    const incomingUrl = 'https://incoming.example/conflicted-source';
    const result = previewWebsiteHandoff(handoff({
      citations: [{ ...citation, url: incomingUrl }],
    }), current);

    expect(result.summary.conflict).toBe(2);
    expect(result.publicPreview.sourceCount).toBe(0);
    expect(JSON.stringify(result.publicPreview)).not.toContain(incomingUrl);
    expect(JSON.stringify(result.publicPreview)).not.toContain(commonClaim.candidateValue);
  });

  it('holds retailer-authored producer assertions without creating a producer', () => {
    const producerEntity = {
      ...entity,
      preferredLabel: 'Example Tea Factory',
      sourceLabel: 'Example Tea Factory',
      entityKind: 'producer',
      websiteHolding: 'producers',
    } as const;
    const producerClaim = {
      ...commonClaim,
      subject: producerEntity.sourceLabel,
      entityKind: 'producer',
      claimScope: 'identity',
      websiteHolding: 'producers',
      websiteField: 'description',
      candidateValue: 'The retailer describes this name as a producer.',
      assertingPublisherRole: 'retailer_reseller',
    } as const;
    const result = previewWebsiteHandoff(handoff({
      entities: [producerEntity],
      claims: [producerClaim],
      citations: [{ ...citation, publisherRole: 'retailer_reseller' }],
    }));
    const operation = result.operations.find(item => item.resourceId === producerClaim.claimId);

    expect(operation?.action).toBe('held');
    expect(operation?.reason).toMatch(/retailer.*cannot establish producer/i);
    expect(result.operations.some(item => item.resourceType === 'entity' && item.action === 'create')).toBe(false);
    expect(JSON.stringify(result.publicPreview)).not.toContain(producerClaim.candidateValue);
  });
});

describe('public receiving transport', () => {
  it('returns only the public manifest and a cloned public preview', () => {
    const preview = previewWebsiteHandoff(handoff());

    const transport = publicTransportFor(preview);

    expect(Object.keys(transport)).toEqual(['manifest', 'publicPreview']);
    expect(transport.manifest).toEqual({ schemaVersion: 1, mode: 'preview-only' });
    expect(transport.publicPreview).toEqual(preview.publicPreview);
    expect(transport.publicPreview).not.toBe(preview.publicPreview);
    expect(transport.publicPreview.sections).not.toBe(preview.publicPreview.sections);
    expect(JSON.stringify(transport)).not.toMatch(
      /operations|projectedState|privateVerification|evidenceIds?|holdReason|(?:inputPayload|sourceSnapshot|payload)Sha256|exact[ _-]lot|personal[ _-]tasting/i,
    );
  });

  it.each([
    'evidenceId',
    'evidenceIds',
    'candidateValue',
    'reason',
    'status',
    'operations',
    'verification',
    'privateVerification',
    'projectedState',
    'holdReason',
    'payloadSha256',
    'inputPayloadSha256',
    'sourceSnapshotSha256',
  ])('rejects a recursively nested %s key', forbiddenKey => {
    const preview = previewWebsiteHandoff(handoff());
    Object.assign(preview.publicPreview.sections[0].entries[0].statements[0].citation, {
      [forbiddenKey]: 'private',
    });

    expect(() => publicTransportFor(preview)).toThrow(/unsafe public preview/i);
  });

  it.each([
    'exact_lot_source_description',
    'exact-lot source description',
    'personal_tasting',
    'personal-tasting',
  ])('rejects the forbidden public register marker %s', forbiddenMarker => {
    const preview = previewWebsiteHandoff(handoff());
    preview.publicPreview.sections[0].entries[0].statements[0].excerpt = forbiddenMarker;

    expect(() => publicTransportFor(preview)).toThrow(/unsafe public preview/i);
  });

  it('rejects an unknown top-level public preview property', () => {
    const preview = previewWebsiteHandoff(handoff());
    Object.assign(preview.publicPreview, { internalNotes: 'private' });

    expect(() => publicTransportFor(preview)).toThrow(/unsafe public preview/i);
  });

  it('rejects an unknown nested public preview property', () => {
    const preview = previewWebsiteHandoff(handoff());
    Object.assign(preview.publicPreview.sections[0].entries[0].statements[0].citation, {
      internalNotes: 'private',
    });

    expect(() => publicTransportFor(preview)).toThrow(/unsafe public preview/i);
  });

  it('rejects a non-string public parentId', () => {
    const preview = previewWebsiteHandoff(handoff());
    Object.assign(preview.publicPreview.sections[0].entries[0], { parentId: 42 });

    expect(() => publicTransportFor(preview)).toThrow(/parentId.*string/i);
  });

  it('allows shared references within an otherwise valid public preview', () => {
    const preview = previewWebsiteHandoff(handoff());
    const statements = preview.publicPreview.sections[0].entries[0].statements;
    statements.push({
      ...statements[0],
      id: 'CLAIM-SHARED-CITATION',
      citation: statements[0].citation,
    });

    expect(() => publicTransportFor(preview)).not.toThrow();
  });

  it('rejects cyclic public preview data', () => {
    const preview = previewWebsiteHandoff(handoff());
    Object.assign(preview.publicPreview.sections[0], {
      entries: preview.publicPreview.sections,
    });

    expect(() => publicTransportFor(preview)).toThrow(/unsafe public preview/i);
  });
});
