import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { InventoryItem } from '../../../types';
import { buildTeaAmountCells, TeaAmountList, type TeaAmountListProps } from './TeaAmountList';

vi.mock('../ShopCurrencyPicker', () => ({ ShopCurrencyPicker: () => <button>Currency control</button> }));

const props: TeaAmountListProps = {
  item: { id: 'amount-tea', category: 'tea', form: 'Loose' } as InventoryItem,
  pricePerGram: 0.15,
  maxGrams: 1000,
  formatPrice: (_, grams) => `quoted ${grams}`,
  formatPlainTotal: total => total.toFixed(2),
  formatRate: rate => ({ value: rate.toFixed(2), unit: '/g' }),
  onChoose: () => {},
  onCustom: () => {},
};

describe('shared tea amount list', () => {
  it('starts the catalogue without a chosen amount and keeps the product list captions and price roles', () => {
    const cells = buildTeaAmountCells(props);
    expect(cells.every(cell => !cell.active)).toBe(true);
    expect(cells.find(cell => cell.chooseGrams === 50)).toMatchObject({
      label: '50g', caption: 'a fortnight of it', sub: '9.50', subFull: 'quoted 50',
      rate: { value: '0.19', unit: '/g' },
    });
    const html = renderToStaticMarkup(<TeaAmountList {...props} variant="picker" inOrderLabel="2 × 50g" />);
    expect(html).not.toContain('aria-pressed="true"');
    expect(html).not.toContain('your amount');
    expect(html).toContain('Other amount');
    expect(html).toContain('Quantity provides a lower price.');
    expect(html).toContain('2 × 50g of this already in your order');
    expect(html.match(/Currency control/g)).toHaveLength(1);
  });

  it('keeps product selections distinct from custom selection and delegates their actions', () => {
    const onChoose = vi.fn();
    const onCustom = vi.fn();
    const cells = buildTeaAmountCells({ ...props, selectedGrams: 50, onChoose, onCustom });
    expect(cells.filter(cell => cell.active).map(cell => cell.key)).toEqual(['50']);
    cells.find(cell => cell.chooseGrams === 100)!.onSelect();
    expect(onChoose).toHaveBeenCalledWith(100);
    expect(onCustom).not.toHaveBeenCalled();
    cells.find(cell => cell.key === 'custom')!.onSelect();
    expect(onCustom).toHaveBeenCalledOnce();
    const custom = buildTeaAmountCells({ ...props, selectedGrams: 70 }).find(cell => cell.active);
    expect(custom).toMatchObject({ key: 'custom', label: '70g', sub: '12.50' });
    expect(buildTeaAmountCells({ ...props, customMode: true }).some(cell => cell.active)).toBe(false);
  });

  it('retains the whole cake row without adding handling to its price', () => {
    const cells = buildTeaAmountCells({ ...props, item: { ...props.item, form: 'Cake', pieceWeightG: 357 } });
    expect(cells.find(cell => cell.key === 'whole-piece')).toMatchObject({
      label: 'The cake', caption: '357g, unbroken, keeps ageing',
      chooseGrams: 357, sub: '53.55', ariaLabel: 'One whole cake, 357 grams',
    });
  });

  it('retains one to four sealed units and the larger whole-unit option', () => {
    const cells = buildTeaAmountCells({ ...props, item: { ...props.item, form: 'Box', pieceWeightG: 100, soldInWholeUnits: true } });
    expect(cells.map(cell => cell.label)).toEqual(['One box', 'Two boxes', 'Three boxes', 'Four boxes', 'Other amount']);
    expect(cells[0]).toMatchObject({ sub: '15.00', caption: '100g, sealed, the smallest amount there is' });
    expect(cells[1]).toMatchObject({ sub: '30.00', caption: '200g, sealed' });
    expect(cells.at(-1)?.caption).toBe('more than four, in whole boxes');
  });
});
