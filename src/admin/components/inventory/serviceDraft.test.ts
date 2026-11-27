import { describe, expect, it, vi } from 'vitest';
import { companyFor, emptyDraft, serviceFromDraft } from './serviceDraft';

describe('adding a logistics company takes a name and a rate', () => {
  it('fills every other field with a default: air, per kg, the shop currency, named by how it travels', () => {
    expect(serviceFromDraft({ ...emptyDraft('Yuan'), companyName: ' Guangzhou Forwarder ', rate: '85' }, 'Yuan'))
      .toEqual({ companyName: 'Guangzhou Forwarder', service: { name: 'Air', mode: 'air', basis: 'kg', rate: 85, currency: 'Yuan' } });
    expect(serviceFromDraft({ ...emptyDraft('Yuan'), companyName: 'Keelung', rate: '12', mode: 'sea', currency: '' }, 'USD'))
      .toMatchObject({ service: { name: 'Boat', currency: 'USD' } });
  });
  it('keeps a typed zero, and asks for what is missing in words', () => {
    expect(serviceFromDraft({ ...emptyDraft('Yuan'), companyName: 'Free', rate: '0' }, 'Yuan')).toMatchObject({ service: { rate: 0 } });
    expect(serviceFromDraft({ ...emptyDraft('Yuan'), rate: '85' }, 'Yuan')).toEqual({ error: 'Name the logistics company.' });
    for (const rate of ['', '-1', 'lots']) expect(serviceFromDraft({ ...emptyDraft('Yuan'), companyName: 'GZ', rate }, 'Yuan')).toEqual({ error: 'Enter its rate, zero or more.' });
  });
  it('reuses a known company by name, any case, and creates one typed for the first time', async () => {
    const create = vi.fn(async (input: { name: string }) => ({ id: 'new', name: input.name }));
    expect(await companyFor('guangzhou forwarder', [{ id: 'gz', name: 'Guangzhou Forwarder' }], create)).toEqual({ id: 'gz', name: 'Guangzhou Forwarder' });
    expect(create).not.toHaveBeenCalled();
    expect(await companyFor('Keelung ', [{ id: 'gz', name: 'Guangzhou Forwarder' }], create)).toEqual({ id: 'new', name: 'Keelung' });
    expect(create).toHaveBeenCalledWith({ name: 'Keelung', type: 'logistics', tags: ['freight'] });
  });
});
