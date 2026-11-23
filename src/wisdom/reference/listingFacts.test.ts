import { describe, expect, it } from 'vitest';
import { wisdomNodeExists } from '../../../worker/src/wisdomRelations';
import { GENERATED_CLAIMS } from './generatedClaims';
import { GENERATED_TEA_REFERENCE_REGISTRY } from './generatedPages';
import { resolveListingPassages } from './listingPassages';
import { matchNamedTea } from '../namedTeas';
import { listingFacts, listingFactsFromInventoryItem, listingFactsFromPublicProduct } from './listingFacts';

describe('listingFacts', () => {
  it('builds Naka exactly as the contract table says', () => {
    expect(listingFactsFromPublicProduct({
      type: 'Shou Puer',
      form: 'Cake',
      originRegion: 'Mengsong, Menghai, Yunnan',
      productName: 'Naka Gushu',
    })).toEqual({
      type: 'Shou',
      originParts: ['mengsong', 'menghai', 'yunnan'],
      nameTokens: ['naka', 'gushu'],
      form: 'Cake',
    });
  });

  it('never reads a grade, type, form or place from the name', () => {
    const facts = listingFacts({ name: 'Jingmai Gong Ting Shou Cake' });
    expect(facts.grade).toBeUndefined();
    expect(facts.type).toBeUndefined();
    expect(facts.form).toBeUndefined();
    expect(facts.originParts).toEqual([]);
    expect(facts.nameTokens).toEqual(['jingmai', 'gong', 'ting', 'shou', 'cake']);
  });

  it('links a named history by Stock identity alone across both product adapters', () => {
    const id = 'cb7efd7b-9da6-4dc8-be76-3c7e69bdb02e';
    expect(listingFactsFromPublicProduct({ id, productName: 'Local title' }).namedTeaId).toBe('y562');
    expect(listingFactsFromInventoryItem({ id, name: 'Changed title' }).namedTeaId).toBe('y562');
    expect(listingFactsFromInventoryItem({ id: 'other', name: 'Y562' }).namedTeaId).toBeUndefined();
    expect(matchNamedTea('Y562', 'Jixing Black Box')).toBeNull();
  });

  it.each([
    ['9b5b05f1-a6d6-4651-9126-0fe42c5c5e86', 'Malaysian Returned Liu Bao', 'malaysian-returned-liu-bao', 3],
    ['186380ba-6839-448f-baaf-2b84ef7e5556', 'Mahei Gushu Red', 'mahei-gushu-red', 1],
    ['b11a8bad-89d9-4518-9406-25145d4c6e2c', 'San He Liu Bao', 'san-he-liu-bao', 5],
    ['8c24430b-49d5-4c9d-9ea8-2d353057e2b9', 'Nanqiao Ruigong Brick', 'nanqiao-ruigong-brick', 2],
  ] as const)('projects the public named history only on its documented lot %s', (id, name, teaId, count) => {
    expect(wisdomNodeExists('named_tea', teaId)).toBe(true);
    const facts = listingFactsFromPublicProduct({ id, productName: name });
    expect(facts.namedTeaId).toBe(teaId);
    expect(listingFactsFromInventoryItem({ id, name }).namedTeaId).toBe(teaId);
    expect(listingFactsFromPublicProduct({ id: 'another-lot', productName: name }).namedTeaId).toBeUndefined();
    expect(matchNamedTea(name)).toBeNull();
    const result = resolveListingPassages(facts, GENERATED_CLAIMS, GENERATED_TEA_REFERENCE_REGISTRY.pages);
    expect(result.passages).toHaveLength(count);
    expect(result.passages.every(({ claim, wisdomHref }) =>
      claim.sourceIds.length > 0 && wisdomHref.startsWith('/wisdom/named/' + teaId + '#'))).toBe(true);
  });

  it('uses the village account only when Mahei and Yiwu are recorded in the origin', () => {
    const page = GENERATED_TEA_REFERENCE_REGISTRY.pages;
    const project = (originRegion: string) => resolveListingPassages(listingFactsFromPublicProduct({
      id: 'another-lot', productName: 'Mahei', type: 'Shou', originRegion,
    }), GENERATED_CLAIMS, page).passages;
    expect(project('Mahei, Yiwu, Yunnan').map(p => p.wisdomHref)).toContain('/wisdom/region/mahei#village-road-and-harvest');
    expect(project('Yiwu, Yunnan').map(p => p.claim.pageId)).not.toContain('mahei');
    expect(project('Mahei, Yiwu, Yunnan').map(p => p.claim.pageId)).not.toContain('mahei-gushu-red');
  });

  it('takes a grade only from the explicit field', () => {
    expect(listingFacts({ grade: 'gong-ting' }).grade).toBe('gong-ting');
    expect(listingFactsFromInventoryItem({ name: 'Gong Ting', type: 'Shou' }).grade).toBeUndefined();
  });

  it('keeps the inventory origin whole-part, country included', () => {
    expect(listingFactsFromInventoryItem({ origin: 'Mengsong, Menghai, Yunnan, China', variant: 'Naka Gushu' }).originParts)
      .toEqual(['mengsong', 'menghai', 'yunnan', 'china']);
  });

  it('returns no type for an unknown spelling rather than guessing', () => {
    expect(listingFacts({ type: 'Mystery' }).type).toBeUndefined();
  });
});
