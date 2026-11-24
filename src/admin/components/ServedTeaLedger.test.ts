import { describe, expect, it } from 'vitest';
import { duplicateServedTea, readLegacyTeaNames, readServedTeas, servedTeaFromMenu, updateServedTeas } from './ServedTeaLedger';
import { postSessionEditorState, postSessionSavePayload } from './PostSessionEditorContract';

describe('saved session teas', () => {
  const chest = { id: 'served-1', name: 'Spring Shui Xian', source: 'chest' as const, source_id: 'private-chest-1' };
  const shop = { id: 'served-2', name: 'Spring Mountain Oolong', source: 'shop' as const, source_id: 'sale-tea-1',
    product_id: 'sale-tea-1', shop_slug: 'teajia-bali' };

  it('persists exact row identities through recap draft save without replacing legacy tea notes', () => {
    const legacy = { teas: [{ name: 'Existing tea', notes: 'Keep this tasting.' }], other: 'keep' };
    const teaLedger = updateServedTeas(JSON.stringify(legacy), [chest, shop]);
    const payload = postSessionSavePayload(postSessionEditorState({ tea_ledger: teaLedger, session_notes: 'A quiet tea.' }));
    expect(JSON.parse(payload.tea_ledger)).toEqual({ ...legacy, served_teas: [chest, shop] });
    expect(readServedTeas(payload.tea_ledger)).toEqual([chest, shop]);
    expect(readLegacyTeaNames(payload.tea_ledger)).toEqual(['Existing tea']);
  });

  it('keeps older array and free text ledger values when adding or removing served teas', () => {
    const earlier = [{ product_name: 'Earlier lot', grams: 7 }];
    expect(JSON.parse(updateServedTeas(JSON.stringify(earlier), [chest]))).toEqual({
      legacy_tea_ledger: earlier,
      served_teas: [chest],
    });
    const preserved = updateServedTeas(updateServedTeas('Prior unstructured note', [chest]), []);
    expect(JSON.parse(preserved)).toEqual({ legacy_tea_ledger: 'Prior unstructured note', served_teas: [] });
    expect(readServedTeas(preserved)).toEqual([]);
  });

  it('keeps menu identity stable and deduplicates an exact Shop tea without collapsing names', () => {
    const menu = servedTeaFromMenu({ id: 'menu-1', eventId: 'event', productId: 'sale-tea-1', productName: 'Oolong' }, 'teajia-bali');
    expect(menu).toEqual({ id: 'menu-1', source: 'menu', source_id: 'menu-1', product_id: 'sale-tea-1', shop_slug: 'teajia-bali', name: 'Oolong' });
    expect(duplicateServedTea(shop, menu!)).toBe(true);
    expect(duplicateServedTea(chest, { ...chest, id: 'different-served-id' })).toBe(true);
    expect(duplicateServedTea(chest, { ...chest, id: 'different-served-id', source_id: 'different-lot' })).toBe(false);
  });
});
