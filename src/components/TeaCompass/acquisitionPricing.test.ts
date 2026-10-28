import { describe, expect, it } from 'vitest';
import { createEmptyEntry } from './types';
import { acquisitionPrice, acquisitionLine, acquisitionDraftLine, ledgerLineTotal } from './acquisitionPricing';

describe('capture quote to acquisition money', () => {
  it('keeps the quote denominator when buying loose tea', () => {
    const entry = { ...createEmptyEntry(), name: 'Tea', priceAmount: 100, pricePerUnitGrams: 100 };
    const line = acquisitionLine(entry, 250);
    expect(line.pricePerUnit).toBe(1);
    expect(ledgerLineTotal(line)).toBe(250);
    expect(acquisitionPrice({ ...entry, priceAmount: 200 }).pricePerUnit).toBe(2);
  });
  it('keeps deliberately free quotes and refuses unknown quotes', () => {
    const entry = { ...createEmptyEntry(), priceAmount: 0, pricePerUnitGrams: 100 };
    expect(ledgerLineTotal(acquisitionLine(entry, 250))).toBe(0);
    expect(() => acquisitionPrice({ ...entry, priceAmount: undefined })).toThrow(/price/i);
    expect(() => acquisitionPrice({ ...entry, pricePerUnitGrams: undefined })).toThrow(/grams/i);
  });
  it('uses a recorded negotiated total with its own acquisition quantity', () => {
    const entry = { ...createEmptyEntry(), priceAmount: 100, pricePerUnitGrams: 100, buyTotal: 180, buyQuantityGrams: 500 };
    expect(ledgerLineTotal(acquisitionLine(entry, 250))).toBe(90);
    const ware = { ...entry, category: 'teaware' as const, buyQuantityUnits: 2 };
    expect(ledgerLineTotal(acquisitionLine(ware, 3))).toBe(270);
    expect(ledgerLineTotal(acquisitionLine(entry, 250, 'free_sample'))).toBe(0);
  });
  it('accepts an explicitly free receipt while retaining unknown purchase quotes', () => {
    const sample = { ...createEmptyEntry(), name: 'Sample' };
    expect(ledgerLineTotal(acquisitionLine(sample, 10, 'free_sample'))).toBe(0);
    expect(() => acquisitionLine(sample, 10, 'purchase')).toThrow(/price/i);
  });
  it('keeps incomplete purchases explicitly unpriced in a draft', () => {
    const entry = { ...createEmptyEntry(), name: 'Unknown quote' };
    expect(acquisitionDraftLine(entry, 250)).toMatchObject({ quantityGrams: 250, unpriced: true, pricePerUnit: 0 });
    expect(acquisitionDraftLine({ ...entry, priceAmount: 0, pricePerUnitGrams: 100 }, 250)).not.toHaveProperty('unpriced');
  });
  it('treats compressed forms from import case-insensitively and keeps their actual weight', () => {
    const entry = { ...createEmptyEntry(), form: 'cake' as never, priceAmount: 100, pricePerUnitGrams: 200 };
    const line = acquisitionLine(entry, 2);
    expect(line).toMatchObject({ pricePerUnit: 100, priceIsPerGram: false, quantityUnits: 2, unitWeightGrams: 200 });
    expect(ledgerLineTotal(line)).toBe(200);
  });
});
