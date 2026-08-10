import { describe, expect, it } from 'vitest';

import { CULTIVARS, MARKS, NAMED_TEAS, PRODUCERS, REGIONS, STYLES, TEA_TYPES } from '../../src/wisdom';

import {
  deriveWisdomFindings,
  nodeKey,
  validateWisdomRelationInput,
  wisdomManifestNodes,
} from '../src/wisdomRelations';

describe('wisdom relation domain', () => {
  it('keys Wisdom targets by subtype and reports a hidden node as unpublished rather than missing', () => {
    const findings = deriveWisdomFindings({
      nodes: [],
      relations: [{
        node_type: 'cultivar', node_id: 'rou-gui', target_type: 'wisdom_node',
        target_id: 'wuyi', target_subtype: 'region', review_status: 'approved',
      }],
      targets: [{ id: 'wuyi', target_type: 'wisdom_node', target_subtype: 'region', is_public: false }],
      articles: [],
    });
    expect(findings).toEqual([expect.objectContaining({
      kind: 'unpublished_dependency', target_type: 'wisdom_node', target_id: 'wuyi', target_subtype: 'region',
    })]);
  });
  it('keys nodes by type and id', () => {
    expect(nodeKey('cultivar', 'rou-gui')).toBe('cultivar:rou-gui');
    expect(nodeKey('producer', 'rou-gui')).toBe('producer:rou-gui');
  });

  it('mirrors every authoritative static Wisdom node ID without bundling its prose', () => {
    const manifest = wisdomManifestNodes();
    const expected = {
      cultivar: CULTIVARS.map(node => node.id),
      region: REGIONS.map(node => node.id),
      tea_type: TEA_TYPES.map(node => node.toLowerCase()),
      producer: PRODUCERS.map(node => node.id),
      mark: MARKS.map(node => node.id),
      style: STYLES.map(node => node.id),
      named_tea: NAMED_TEAS.map(node => node.id),
    };
    for (const [nodeType, nodeIds] of Object.entries(expected)) {
      expect(manifest.filter(node => node.node_type === nodeType).map(node => node.node_id).sort()).toEqual([...nodeIds].sort());
    }
  });

  it('requires a subtype only for wisdom-node targets', () => {
    expect(validateWisdomRelationInput({
      node_type: 'cultivar', node_id: 'rou-gui', target_type: 'wisdom_node', target_id: 'wuyi',
      target_subtype: null, relationship_kind: 'is_example_of', review_status: 'proposed',
    })).toMatchObject({ ok: false, code: 'target_subtype_required' });

    expect(validateWisdomRelationInput({
      node_type: 'cultivar', node_id: 'rou-gui', target_type: 'article', target_id: 'article-1',
      target_subtype: null, relationship_kind: 'supports', review_status: 'approved',
    })).toEqual({ ok: true });
  });

  it('rejects unsupported types, kinds, and review states', () => {
    expect(validateWisdomRelationInput({
      node_type: 'cultivar', node_id: 'rou-gui', target_type: 'private_journal', target_id: 'journal-1',
      target_subtype: null, relationship_kind: 'supports', review_status: 'approved',
    })).toMatchObject({ ok: false, code: 'invalid_target_type' });
    expect(validateWisdomRelationInput({
      node_type: 'unknown', node_id: 'rou-gui', target_type: 'article', target_id: 'article-1',
      target_subtype: null, relationship_kind: 'supports', review_status: 'approved',
    })).toMatchObject({ ok: false, code: 'invalid_node_type' });
    expect(validateWisdomRelationInput({
      node_type: 'cultivar', node_id: 'rou-gui', target_type: 'wisdom_node', target_id: 'wuyi',
      target_subtype: 'unknown', relationship_kind: 'supports', review_status: 'approved',
    })).toMatchObject({ ok: false, code: 'invalid_target_subtype' });
    expect(validateWisdomRelationInput({
      node_type: 'cultivar', node_id: 'not-in-the-wisdom-base', target_type: 'article', target_id: 'article-1',
      target_subtype: null, relationship_kind: 'supports', review_status: 'proposed',
    })).toMatchObject({ ok: false, code: 'source_node_not_found' });
    expect(validateWisdomRelationInput({
      node_type: 'cultivar', node_id: 'rou-gui', target_type: 'wisdom_node', target_id: 'not-real',
      target_subtype: 'region', relationship_kind: 'mentions', review_status: 'proposed',
    })).toMatchObject({ ok: false, code: 'target_node_not_found' });
    expect(validateWisdomRelationInput({
      node_type: 'cultivar', node_id: 'rou-gui', target_type: 'article', target_id: 'article-1',
      target_subtype: null, relationship_kind: 'is_example_of', review_status: 'proposed',
    })).toMatchObject({ ok: false, code: 'illegal_relationship_kind' });
  });

  it('derives missing, unpublished, and orphan findings without inventing links', () => {
    expect(deriveWisdomFindings({
      nodes: [{ node_type: 'cultivar', node_id: 'rou-gui', expects_writing: true }],
      relations: [{ node_type: 'cultivar', node_id: 'rou-gui', target_type: 'article', target_id: 'missing', review_status: 'approved' }],
      targets: [],
      articles: [{ id: 'orphan', status: 'published' }],
    }).map(finding => finding.kind)).toEqual([
      'missing_writing',
      'missing_target',
      'orphaned_article',
    ]);
  });
});
