import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import type { LogisticsAddress, LogisticsAddressInput, LogisticsService } from '../../../lib/logisticsTypes';
import { TYPOGRAPHY_CLASSES as T } from '../../../designTokens';
import type { LogisticsMutation } from './LogisticsControls';
import { TrackingTask } from './TrackingTask';
import { LogisticsActionError, useLogisticsAction } from './useLogisticsAction';

export function logisticsAddressText(address: LogisticsAddress | null | undefined): string {
  if (!address) return '';
  return [address.recipient, address.address_lines, address.city, address.region, address.postal_code, address.country_code, address.phone].filter(Boolean).join(' · ');
}
export function availableLogisticsAddresses(addresses: LogisticsAddress[], role: LogisticsAddress['role'], companyId?: string | null): LogisticsAddress[] {
  return addresses.filter(address => !address.archived && address.role === role && (role !== 'warehouse' || !address.logistics_company_id || address.logistics_company_id === companyId));
}
/** The empty choice clears a route; "keep" preserves the recorded snapshot, including archived addresses. */
export function AddressPicker({ addresses, role, companyId, current, value, onChange, busy, label }: { addresses: LogisticsAddress[]; role: LogisticsAddress['role']; companyId?: string | null; current?: LogisticsAddress | null; value: string; onChange: (value: string) => void; busy: boolean; label: string }) {
  const available = availableLogisticsAddresses(addresses, role, companyId);
  const chosen = value === 'keep' ? current : available.find(address => address.id === value);
  return <div className="min-w-0"><label>{label}<select aria-label={label} value={value} disabled={busy} onChange={event => onChange(event.target.value)}>{current && <option value="keep">Keep {current.label} as recorded</option>}<option value="">Address not set</option>{available.map(address => <option key={address.id} value={address.id}>{address.label}{address.id === current?.id ? ' · use current saved version' : ''}</option>)}</select></label>{chosen && <p className={`${T.accountMeta} text-tea-text-sec break-words mt-1`}>{logisticsAddressText(chosen)}</p>}</div>;
}

type Contact = { id: string; name: string };
export function LogisticsAddresses({ addresses, services, accountId, busy, mutate: save }: { addresses: LogisticsAddress[]; services: LogisticsService[]; accountId: string | null; busy: boolean; mutate: LogisticsMutation }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [role, setRole] = useState<LogisticsAddress['role']>('destination');
  const { mutate, error } = useLogisticsAction(save);
  const contactsQuery = useQuery({ queryKey: ['logistics-company-contacts', accountId], queryFn: async (): Promise<Contact[]> => {
    const data = await api.customers.list();
    const rows = Array.isArray(data) ? data : Array.isArray(data?.customers) ? data.customers : [];
    return rows.filter((row: Contact) => row.id && row.name).map((row: Contact) => ({ id: row.id, name: row.name }));
  }, enabled: open, staleTime: 60_000 });
  const contacts = [...new Map([...(contactsQuery.data || []), ...services.map(service => ({ id: service.logistics_company_id, name: service.logistics_company_name }))].map(contact => [contact.id, contact])).values()];
  const active = addresses.filter(address => !address.archived);
  const edit = addresses.find(address => address.id === editing);
  const start = (address?: LogisticsAddress) => { setEditing(address?.id || 'new'); setRole(address?.role || 'destination'); };
  return <><button type="button" className="tap-target purchase-tracking-button" onClick={() => { setOpen(true); setEditing(null); }}>Addresses <span className="text-tea-text-dim">{active.length}</span></button><TrackingTask open={open} onClose={() => setOpen(false)} title={editing ? edit ? 'Edit address' : 'Add address' : 'Saved addresses'}><div className="logistics-form">
    {!editing ? <><div className="logistics-actions"><p className={`${T.accountMeta} text-tea-text-sec`}>Warehouses receive supplier parcels. Destinations receive combined shipments.</p><button type="button" className="tap-target purchase-tracking-button" onClick={() => start()}>Add address</button></div>{active.map(address => <div className="logistics-service-row" key={address.id}><span><strong>{address.label}</strong><small className="text-tea-text-dim">{address.role === 'warehouse' ? 'Warehouse' : 'Destination'}{address.logistics_company_id && contacts.find(contact => contact.id === address.logistics_company_id) ? ` · ${contacts.find(contact => contact.id === address.logistics_company_id)!.name}` : ''}</small></span><span className="min-w-0 break-words text-tea-text-sec">{logisticsAddressText(address)}</span><button type="button" className="tap-target purchase-tracking-button" onClick={() => start(address)}>Edit</button></div>)}{!active.length && <p className="text-tea-text-dim">No saved addresses. Give the agent an address to save, or add it here.</p>}</> : <form key={editing} className="logistics-form" onSubmit={event => {
      event.preventDefault(); const form = new FormData(event.currentTarget); const text = (name: string) => String(form.get(name) || '').trim();
      const input: LogisticsAddressInput = { label: text('label'), role, recipient: text('recipient'), address_lines: text('address'), city: text('city') || null, region: text('region') || null, postal_code: text('postal') || null, country_code: text('country').toUpperCase(), phone: text('phone') || null, logistics_company_id: role === 'warehouse' ? text('company') || null : null };
      void mutate(async () => { await api.logistics.saveAddress(input, edit?.id); setEditing(null); });
    }}><div className="logistics-fields"><label>Name<input name="label" aria-label="Address name" required defaultValue={edit?.label || ''} placeholder="Studio or warehouse name" disabled={busy}/></label><label>Use<select aria-label="Address use" value={role} onChange={event => setRole(event.target.value as LogisticsAddress['role'])} disabled={busy}><option value="destination">Delivery destination</option><option value="warehouse">Logistics warehouse</option></select></label>{role === 'warehouse' && <label>Company<select name="company" aria-label="Address logistics company" defaultValue={edit?.logistics_company_id || ''} disabled={busy}><option value="">Any company</option>{edit?.logistics_company_id && !contacts.some(contact => contact.id === edit.logistics_company_id) && <option value={edit.logistics_company_id}>Saved logistics company</option>}{contacts.map(contact => <option value={contact.id} key={contact.id}>{contact.name}</option>)}</select></label>}<label>Recipient<input name="recipient" aria-label="Address recipient" required defaultValue={edit?.recipient || ''} disabled={busy}/></label></div><div className="logistics-fields"><label>Street / building<input name="address" aria-label="Street and building" required defaultValue={edit?.address_lines || ''} disabled={busy}/></label><label>City<input name="city" defaultValue={edit?.city || ''} disabled={busy}/></label><label>Province / region<input name="region" defaultValue={edit?.region || ''} disabled={busy}/></label><label>Postal code<input name="postal" defaultValue={edit?.postal_code || ''} disabled={busy}/></label><label>Country code<input name="country" aria-label="Address country code" required minLength={2} maxLength={2} pattern="[A-Za-z]{2}" placeholder="CN" defaultValue={edit?.country_code || ''} disabled={busy}/></label><label>Phone<input name="phone" type="tel" defaultValue={edit?.phone || ''} disabled={busy}/></label></div><p className={`${T.accountMeta} text-tea-text-dim`}>Saving changes this address book entry. A purchase or shipment keeps its recorded address until you select the updated address there.</p><div className="logistics-actions"><button className="tap-target purchase-tracking-button" type="submit" disabled={busy}>Save address</button><button className="tap-target purchase-tracking-button" type="button" disabled={busy} onClick={() => setEditing(null)}>Back to addresses</button>{edit && <button className="tap-target purchase-tracking-button" type="button" disabled={busy} onClick={() => void mutate(async () => { await api.logistics.archiveAddress(edit.id); setEditing(null); })}>Archive address</button>}</div></form>}
    <LogisticsActionError message={error} recovery="Your entries are kept. Retry the same address action."/>
  </div></TrackingTask></>;
}
