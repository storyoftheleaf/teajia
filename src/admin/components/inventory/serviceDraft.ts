/**
 * Adding a logistics company should take almost nothing (Adrian, 2026-11-27):
 * its name and its rate. Everything else has a default and sits behind "More
 * details": by air, charged by the kilo, in the shop's freight currency, and a
 * service name that says how it travels. A company typed for the first time is
 * created as a contact on save; one already known is reused by name.
 */
import type { LogisticsServiceInput } from '../../../lib/logisticsTypes';

export interface ServiceDraft {
  companyName: string;
  rate: string;
  name: string;
  mode: 'air' | 'sea';
  basis: 'kg' | 'm3' | 'fixed';
  currency: string;
}

export const defaultServiceName = (mode: 'air' | 'sea') => (mode === 'sea' ? 'Boat' : 'Air');

export const emptyDraft = (shopCurrency: string): ServiceDraft => ({ companyName: '', rate: '', name: '', mode: 'air', basis: 'kg', currency: shopCurrency });

export function rateLabel(basis: ServiceDraft['basis']): string {
  return basis === 'fixed' ? 'Price per shipment' : basis === 'm3' ? 'Rate per m³' : 'Rate per kg';
}

/** The service without its company id, or why it cannot be saved yet. */
export function serviceFromDraft(draft: ServiceDraft, shopCurrency: string):
  { service: Omit<LogisticsServiceInput, 'logistics_company_id' | 'logistics_company_name'>; companyName: string } | { error: string } {
  const companyName = draft.companyName.trim();
  if (!companyName) return { error: 'Name the logistics company.' };
  const rate = draft.rate.trim() === '' ? NaN : Number(draft.rate);
  if (!Number.isFinite(rate) || rate < 0) return { error: 'Enter its rate, zero or more.' };
  const currency = draft.currency.trim() || shopCurrency;
  if (!/^[A-Za-z]{2,10}$/.test(currency)) return { error: 'The currency is a name like Yuan or USD.' };
  return { companyName, service: { name: draft.name.trim() || defaultServiceName(draft.mode), mode: draft.mode, basis: draft.basis, rate, currency } };
}

type Contact = { id?: string | null; name?: string | null };

/** The contact with this name (any case), or a new logistics contact. */
export async function companyFor(name: string, contacts: readonly Contact[], create: (input: { name: string; type: string; tags: string[] }) => Promise<Contact>): Promise<{ id: string; name: string }> {
  const wanted = name.trim().toLocaleLowerCase();
  const found = contacts.find(contact => contact.id && (contact.name ?? '').trim().toLocaleLowerCase() === wanted);
  const contact = found ?? await create({ name: name.trim(), type: 'logistics', tags: ['freight'] });
  if (!contact?.id) throw new Error('The company was not confirmed. Refresh and try again.');
  return { id: contact.id, name: contact.name || name.trim() };
}
