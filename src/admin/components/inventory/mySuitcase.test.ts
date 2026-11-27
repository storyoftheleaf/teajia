import { describe, expect, it, vi } from 'vitest';
import { addMySuitcase, hasSuitcase, suitcaseService } from './mySuitcase';

const service = { id: 's', logistics_company_id: 'c', logistics_company_name: 'My luggage', name: 'My suitcase', mode: 'air' as const, basis: 'kg' as const, rate: 0, currency: 'Yuan', active: true };

describe('My suitcase as a logistics service', () => {
  it('is free by the kilo, by air, in the shop freight currency', () => {
    expect(suitcaseService({ id: 'c', name: 'My luggage' }, 'Yuan')).toEqual({ logistics_company_id: 'c', logistics_company_name: 'My luggage', name: 'My suitcase', mode: 'air', basis: 'kg', rate: 0, currency: 'Yuan' });
  });
  it('reuses the luggage contact instead of making a second one', async () => {
    const createContact = vi.fn();
    const saveService = vi.fn();
    await addMySuitcase({ listContacts: async () => [{ id: 'x', name: 'Bo' }, { id: 'c', name: ' my LUGGAGE ' }], createContact, saveService }, 'USD');
    expect(createContact).not.toHaveBeenCalled();
    expect(saveService).toHaveBeenCalledWith(expect.objectContaining({ logistics_company_id: 'c', rate: 0, currency: 'USD' }));
  });
  it('creates the luggage contact when there is none', async () => {
    const createContact = vi.fn(async () => ({ id: 'new', name: 'My luggage' }));
    const saveService = vi.fn();
    await addMySuitcase({ listContacts: async () => [], createContact, saveService }, 'Yuan');
    expect(createContact).toHaveBeenCalledWith({ name: 'My luggage', type: 'logistics', tags: ['freight'] });
    expect(saveService).toHaveBeenCalledWith(expect.objectContaining({ logistics_company_id: 'new', name: 'My suitcase' }));
  });
  it('refuses to save a service under an unconfirmed contact', async () => {
    const saveService = vi.fn();
    await expect(addMySuitcase({ listContacts: async () => [], createContact: async () => ({}), saveService }, 'Yuan')).rejects.toThrow('not confirmed');
    expect(saveService).not.toHaveBeenCalled();
  });
  it('counts only an active suitcase as already set up', () => {
    expect(hasSuitcase([service])).toBe(true);
    expect(hasSuitcase([{ ...service, active: false }])).toBe(false);
  });
});
