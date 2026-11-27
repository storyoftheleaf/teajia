/**
 * "My suitcase": Adrian carrying tea home in his own luggage (2026-11-27).
 *
 * It is an ordinary logistics service, not a flag on the tea or a setting on
 * the account: priced by the kilo at zero, by air, in the shop's freight
 * currency, under a company contact for his own luggage. So it appears in the
 * tea page's "Travels by" list like any other service, and its rate is edited
 * in Logistics like any other. Nothing about it is special after it is made.
 */
import type { LogisticsService, LogisticsServiceInput } from '../../../lib/logisticsTypes';

export const SUITCASE_SERVICE = 'My suitcase';
export const SUITCASE_COMPANY = 'My luggage';

const same = (a: string | null | undefined, b: string) => (a ?? '').trim().toLocaleLowerCase() === b.toLocaleLowerCase();

/** Already set up: an active service of that name, under any company. */
export const hasSuitcase = (services: readonly LogisticsService[]) =>
  services.some(service => service.active && same(service.name, SUITCASE_SERVICE));

/** The service as saved: free by the kilo, by air, in the shop's freight currency. */
export function suitcaseService(company: { id: string; name: string }, currency: string): LogisticsServiceInput {
  return { logistics_company_id: company.id, logistics_company_name: company.name, name: SUITCASE_SERVICE, mode: 'air', basis: 'kg', rate: 0, currency };
}

type Contact = { id?: string | null; name?: string | null };
export interface SuitcaseDeps {
  listContacts: () => Promise<Contact[]>;
  createContact: (input: { name: string; type: string; tags: string[] }) => Promise<Contact>;
  saveService: (input: LogisticsServiceInput) => Promise<unknown>;
}

/** Reuse the luggage contact when it exists, else create it, then save the service. */
export async function addMySuitcase(deps: SuitcaseDeps, currency: string): Promise<void> {
  let contact = (await deps.listContacts()).find(row => row.id && same(row.name, SUITCASE_COMPANY));
  if (!contact) contact = await deps.createContact({ name: SUITCASE_COMPANY, type: 'logistics', tags: ['freight'] });
  if (!contact?.id) throw new Error('The luggage contact was not confirmed. Refresh and try again.');
  await deps.saveService(suitcaseService({ id: contact.id, name: contact.name || SUITCASE_COMPANY }, currency));
}
