import { describe, expect, it } from 'vitest';
import {
  EMPTY_RECEIVING_STATE,
  previewWebsiteHandoff,
  publicTransportFor,
  type ReferenceReceivingState,
  type WebsiteHandoff,
} from './previewImporter';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
const HASH_C = 'c'.repeat(64);

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
  payloadSha256: HASH_A,
} as const;

function handoff(overrides: Partial<WebsiteHandoff> = {}): WebsiteHandoff {
  const result: WebsiteHandoff = {
    manifest: {
      schemaVersion: 1,
      siteModel: 'tea-wisdom-v1',
      mode: 'preview-only',
      claimsSha256: HASH_A,
      sourceSnapshotSha256: HASH_B,
      entityCount: 1,
      claimCount: 1,
      citationCount: 1,
      readyToPublishCount: 0,
      heldBackCount: 1,
      payloadSha256: HASH_C,
    },
    entities: [entity],
    claims: [commonClaim],
    citations: [citation],
    heldBack: [{ claimId: commonClaim.claimId, reason: commonClaim.holdReason }],
    ...overrides,
  };
  if (!overrides.heldBack) {
    result.heldBack = result.claims
      .filter(claim => claim.proposedAction === 'hold')
      .map(claim => ({ claimId: claim.claimId, reason: claim.holdReason }));
  }
  result.entities = result.entities.map(item => ({
    ...item,
    claimIds: result.claims.filter(claim => claim.resolutionId === item.resolutionId).map(claim => claim.claimId),
  }));
  if (!overrides.manifest) {
    result.manifest = {
      ...result.manifest,
      entityCount: result.entities.length,
      claimCount: result.claims.length,
      citationCount: result.citations.length,
      readyToPublishCount: result.claims.length - result.heldBack.length,
      heldBackCount: result.heldBack.length,
    };
  }
  return result;
}

function readyHandoff(overrides: Partial<WebsiteHandoff> = {}): WebsiteHandoff {
  const readyEntity = {
    ...entity,
    canonicalEntityId: 'tea-family:test',
    entityKind: 'tea_family',
    websiteHolding: 'vocabulary',
    proposedAction: 'create',
    resolutionStatus: 'resolved',
    reason: 'Resolved by a curated identity.',
  } as const;
  const readyClaim = {
    ...commonClaim,
    canonicalEntityId: readyEntity.canonicalEntityId,
    entityKind: readyEntity.entityKind,
    claimScope: 'identity',
    websiteHolding: readyEntity.websiteHolding,
    websiteField: 'description',
    compatibility: 'compatible',
    proposedAction: 'create',
    holdReason: '',
  } as const;
  return handoff({ entities: [readyEntity], claims: [readyClaim], heldBack: [], ...overrides });
}

describe('citation-aware receiving preview', () => {
  it('keeps common characteristics separate from exact-lot and personal tasting registers', () => {
    const exactLot = {
      ...commonClaim,
      claimId: 'CLAIM-LOT',
      resolutionId: 'RESOLUTION-LOT',
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
      holdReason: 'Personal tasting cannot be source-extracted.',
    } as const;
    const input = handoff({
      entities: [
        entity,
        {
          ...entity,
          resolutionId: exactLot.resolutionId,
          entityKind: 'exact_lot',
          websiteHolding: 'none',
          claimIds: [exactLot.claimId],
        },
      ],
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

  it('rejects a blank public parent entity ID', () => {
    const child = {
      ...entity,
      resolutionId: 'RESOLUTION-CHILD',
      canonicalEntityId: 'ENTITY-CHILD',
      parentEntityId: ' ',
    };

    expect(() => previewWebsiteHandoff(handoff({
      entities: [child],
      claims: [],
      citations: [],
      heldBack: [],
    }))).toThrow(/parent/i);
  });

  it.each([
    ['self resolution', 'RESOLUTION-CHILD'],
    ['self canonical entity', 'ENTITY-CHILD'],
    ['missing', 'RESOLUTION-MISSING'],
  ])('holds and omits an entity with a %s parent entity ID', (_case, parentEntityId) => {
    const child = {
      ...entity,
      resolutionId: 'RESOLUTION-CHILD',
      canonicalEntityId: 'ENTITY-CHILD',
      parentEntityId,
    };
    const result = previewWebsiteHandoff(handoff({ entities: [child], claims: [], citations: [], heldBack: [] }));

    expect(result.operations.find(operation => operation.resourceId === child.resolutionId)).toMatchObject({ action: 'held' });
    expect(result.privateVerification.find(record => record.resourceId === child.resolutionId)?.reason).toMatch(/parent/i);
    expect(result.publicPreview.sections.flatMap(section => section.entries)).toEqual([]);
  });

  it('holds and omits cyclic or inverted geography without flattening it', () => {
    const family = {
      ...entity,
      resolutionId: 'RESOLUTION-FAMILY',
      canonicalEntityId: 'tea-family:cycle',
      parentEntityId: 'RESOLUTION-STYLE',
      entityKind: 'tea_family',
      websiteHolding: 'vocabulary',
    } as const;
    const style = {
      ...entity,
      resolutionId: 'RESOLUTION-STYLE',
      canonicalEntityId: 'tea-style:cycle',
      parentEntityId: family.resolutionId,
      entityKind: 'tea_style',
      websiteHolding: 'styles',
    } as const;
    const village = {
      ...entity,
      resolutionId: 'RESOLUTION-VILLAGE',
      canonicalEntityId: 'place:village',
      entityKind: 'village',
      websiteHolding: 'regions',
    } as const;
    const area = {
      ...entity,
      resolutionId: 'RESOLUTION-AREA',
      canonicalEntityId: 'place:area',
      parentEntityId: village.resolutionId,
      entityKind: 'tea_area',
      websiteHolding: 'regions',
    } as const;
    const result = previewWebsiteHandoff(handoff({ entities: [family, style, village, area], claims: [], citations: [], heldBack: [] }));

    const cyclicIds = new Set<string>([family.resolutionId, style.resolutionId]);
    expect(result.privateVerification.filter(record => cyclicIds.has(record.resourceId))
      .every(record => /cyclic/i.test(record.reason))).toBe(true);
    expect(result.privateVerification.find(record => record.resourceId === area.resolutionId)?.reason).toMatch(/incompatible geographic parent/i);
    expect(result.publicPreview.sections.flatMap(section => section.entries).map(entry => entry.id)).toEqual([village.resolutionId]);
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

  it('classifies and projects publishable entities and facts idempotently against current state', () => {
    const input = readyHandoff();
    const first = previewWebsiteHandoff(input);
    expect(first.summary).toEqual({ create: 4, update: 0, noOp: 0, conflict: 0, held: 0 });
    expect(first.projectedState.entities).toHaveLength(1);
    expect(first.projectedState.facts).toHaveLength(1);

    const repeated = previewWebsiteHandoff(input, first.projectedState);
    expect(repeated.summary).toEqual({ create: 0, update: 0, noOp: 4, conflict: 0, held: 0 });
    expect(repeated.projectedState).toEqual(first.projectedState);

    const updatedClaim = {
      ...input.claims[0],
      claimScope: 'historical',
      websiteField: 'history',
    };
    const update = previewWebsiteHandoff(readyHandoff({ claims: [updatedClaim] }), first.projectedState);
    expect(update.operations.find(operation => operation.resourceType === 'fact')?.action).toBe('update');
    expect(update.projectedState.facts[0].scope).toBe('historical');

    const conflictedState = structuredClone(first.projectedState);
    conflictedState.facts[0].entityId = 'RESOLUTION-OTHER';
    const conflict = previewWebsiteHandoff(input, conflictedState);
    expect(conflict.operations.find(operation => operation.resourceType === 'fact')?.action).toBe('conflict');
    expect(conflict.projectedState.facts[0].entityId).toBe('RESOLUTION-OTHER');

    const previouslyHeld = previewWebsiteHandoff(handoff()).projectedState;
    const nowReady = previewWebsiteHandoff(input, previouslyHeld);
    expect(nowReady.projectedState.verification).toEqual([]);
  });

  it('is deterministic across input ordering and repeated calls', () => {
    const secondCitation = { ...citation, citationId: 'CITATION-TEADB-EVIDENCE-2', evidenceId: 'EVIDENCE-2' };
    const secondClaim = { ...commonClaim, claimId: 'CLAIM-GEOGRAPHY', claimScope: 'geography', citationId: secondCitation.citationId };
    const input = handoff({ claims: [secondClaim, commonClaim], citations: [secondCitation, citation] });
    const reversed = handoff({ claims: [commonClaim, secondClaim], citations: [citation, secondCitation] });

    expect(previewWebsiteHandoff(input)).toEqual(previewWebsiteHandoff(reversed));
    expect(previewWebsiteHandoff(input)).toEqual(previewWebsiteHandoff(input));
  });

  it('uses codepoint ordering rather than host locale ordering', () => {
    const zed = { ...entity, resolutionId: 'RESOLUTION-Z', preferredLabel: 'Zed', sourceLabel: 'Zed', entityKind: 'tea_family', websiteHolding: 'vocabulary' } as const;
    const umlaut = { ...entity, resolutionId: 'RESOLUTION-UMLAUT', preferredLabel: 'Äther', sourceLabel: 'Äther', entityKind: 'tea_family', websiteHolding: 'vocabulary' } as const;
    const result = previewWebsiteHandoff(handoff({ entities: [umlaut, zed], claims: [], citations: [], heldBack: [] }));

    expect(result.publicPreview.sections[0].entries.map(entry => entry.label)).toEqual(['Zed', 'Äther']);
  });

  it('keeps glossary and taxonomy entries out of the public projection', () => {
    const glossary = { ...entity, resolutionId: 'RESOLUTION-GLOSSARY', entityKind: 'glossary_term' } as const;
    const taxonomy = { ...entity, resolutionId: 'RESOLUTION-TAXONOMY', entityKind: 'taxonomy_term' } as const;
    const result = previewWebsiteHandoff(handoff({ entities: [glossary, taxonomy], claims: [], citations: [], heldBack: [] }));

    expect(result.publicPreview.sections).toEqual([]);
    expect(result.publicPreview.entryCount).toBe(0);
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

  it('strictly validates required identifiers, hashes, held references, and semantic vocabularies', () => {
    expect(() => previewWebsiteHandoff(handoff({
      manifest: { ...handoff().manifest, payloadSha256: 'not-a-hash' },
    }))).toThrow(/sha-256/i);
    expect(() => previewWebsiteHandoff(handoff({
      claims: [{ ...commonClaim, claimId: '' }],
    }))).toThrow(/claimId.*non-blank/i);
    expect(() => previewWebsiteHandoff(handoff({
      claims: [{ ...commonClaim, claimScope: 'marketing_claim' }],
    } as unknown as Partial<WebsiteHandoff>))).toThrow(/claimScope.*unsupported/i);
    expect(() => previewWebsiteHandoff(handoff({
      claims: [{ ...commonClaim, websiteField: 'salesCopy' }],
    } as unknown as Partial<WebsiteHandoff>))).toThrow(/websiteField.*unsupported/i);
    expect(() => previewWebsiteHandoff(handoff({
      claims: [{ ...commonClaim, compatibility: 'publishable' }],
    } as unknown as Partial<WebsiteHandoff>))).toThrow(/compatibility.*unsupported/i);
    expect(() => previewWebsiteHandoff(handoff({
      entities: [{ ...entity, resolutionStatus: 'publish_now' }],
    } as unknown as Partial<WebsiteHandoff>))).toThrow(/resolutionStatus.*unsupported/i);
    expect(() => previewWebsiteHandoff(handoff({
      citations: [{ ...citation, url: 'javascript:alert(1)' }],
    }))).toThrow(/URL.*HTTP/i);
    expect(() => previewWebsiteHandoff(handoff({
      heldBack: [{ claimId: 'CLAIM-MISSING', reason: 'Missing.' }],
    }))).toThrow(/missing claim reference/i);
  });

  it('prunes source metadata that is unreachable from surviving public facts', () => {
    const orphan = {
      ...citation,
      citationId: 'CITATION-ORPHAN',
      evidenceId: 'EVIDENCE-ORPHAN',
      sourceId: 'orphan-source',
      publisher: 'Orphan publisher',
      url: 'https://example.com/orphan',
    };
    const result = previewWebsiteHandoff(handoff({ citations: [citation, orphan] }));

    expect(result.publicPreview.sourceCount).toBe(1);
    expect(result.publicPreview.sources.map(source => source.sourceId)).toEqual([citation.sourceId]);
  });

  it('keeps source attribution unambiguous when two sources share a URL', () => {
    const secondCitation = {
      ...citation,
      citationId: 'CITATION-SECOND',
      evidenceId: 'EVIDENCE-SECOND',
      sourceId: 'second-source',
      publisher: 'Second publisher',
    };
    const secondClaim = {
      ...commonClaim,
      claimId: 'CLAIM-IDENTITY',
      claimScope: 'identity',
      websiteField: 'description',
      citationId: secondCitation.citationId,
    };
    const result = previewWebsiteHandoff(handoff({ claims: [commonClaim, secondClaim], citations: [citation, secondCitation] }));
    const publicCitations = result.publicPreview.sections.flatMap(section => section.entries)
      .flatMap(entry => entry.statements).map(statement => statement.citation);

    expect(new Set(publicCitations.map(item => item.url))).toEqual(new Set([citation.url]));
    expect(new Set(publicCitations.map(item => item.sourceId))).toEqual(new Set([citation.sourceId, secondCitation.sourceId]));
    expect(() => publicTransportFor(result)).not.toThrow();
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

  it('holds a resolved producer entity when its identity assertion comes from a retailer', () => {
    const producerEntity = {
      ...entity,
      canonicalEntityId: 'producer:example',
      entityKind: 'producer',
      websiteHolding: 'producers',
      proposedAction: 'create',
      resolutionStatus: 'resolved',
    } as const;
    const producerClaim = {
      ...commonClaim,
      canonicalEntityId: producerEntity.canonicalEntityId,
      entityKind: 'producer',
      claimScope: 'identity',
      websiteHolding: 'producers',
      websiteField: 'description',
      assertingPublisherRole: 'retailer_reseller',
      compatibility: 'compatible',
      proposedAction: 'create',
      holdReason: '',
    } as const;
    const result = previewWebsiteHandoff(handoff({
      entities: [producerEntity],
      claims: [producerClaim],
      citations: [{ ...citation, publisherRole: 'retailer_reseller' }],
      heldBack: [],
    }));

    expect(result.operations.find(operation => operation.resourceType === 'entity')?.action).toBe('held');
    expect(result.projectedState.entities).toEqual([]);
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

  it('rejects unsupported public kinds, fact labels, and URL schemes', () => {
    const kindPreview = previewWebsiteHandoff(handoff());
    kindPreview.publicPreview.sections[0].id = 'taxonomy_term';
    kindPreview.publicPreview.sections[0].entries[0].entityKind = 'taxonomy_term';
    expect(() => publicTransportFor(kindPreview)).toThrow(/not a public/i);

    const factPreview = previewWebsiteHandoff(handoff());
    factPreview.publicPreview.sections[0].entries[0].statements[0].label = 'Marketing claim';
    expect(() => publicTransportFor(factPreview)).toThrow(/public fact scope/i);

    const citationPreview = previewWebsiteHandoff(handoff());
    citationPreview.publicPreview.sections[0].entries[0].statements[0].citation.url = 'javascript:alert(1)';
    expect(() => publicTransportFor(citationPreview)).toThrow(/HTTP or HTTPS/i);

    const reportPreview = previewWebsiteHandoff(handoff());
    reportPreview.publicPreview.reportUrl = 'https://example.com/internal-review';
    expect(() => publicTransportFor(reportPreview)).toThrow(/mailto/i);
  });

  it('rejects dangling public parent IDs and unreachable source metadata', () => {
    const parentPreview = previewWebsiteHandoff(handoff());
    parentPreview.publicPreview.sections[0].entries[0].parentId = 'RESOLUTION-MISSING';
    expect(() => publicTransportFor(parentPreview)).toThrow(/parentId.*resolve/i);

    const sourcePreview = previewWebsiteHandoff(handoff());
    sourcePreview.publicPreview.sources.push({
      ...sourcePreview.publicPreview.sources[0],
      sourceId: 'unreachable-source',
    });
    sourcePreview.publicPreview.sourceCount += 1;
    expect(() => publicTransportFor(sourcePreview)).toThrow(/unreachable source/i);
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
