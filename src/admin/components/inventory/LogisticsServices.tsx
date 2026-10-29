import React, { useState } from 'react';
import { TrackingTask } from './TrackingTask';
import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from '../../../lib/api';
import type { LogisticsService, LogisticsServiceInput } from '../../../lib/logisticsTypes';
import type { LogisticsMutation } from './LogisticsControls';
import { useLogisticsAction, LogisticsActionError } from './useLogisticsAction';
import { logisticsNumber } from './LogisticsControls';
export function serviceRateLabel(service: Pick<LogisticsService, 'rate' | 'currency' | 'basis'>): string {
  return `${logisticsNumber(service.rate)} ${service.currency}${service.basis === 'fixed' ? ' fixed' : service.basis === 'm3' ? '/m³' : '/kg'}`;
}
type CompanyContact = { id: string; name: string };
export function LogisticsServices({ services, accountId, busy, mutate: save }: { services: LogisticsService[]; accountId: string | null; busy: boolean; mutate: LogisticsMutation }) {
  const { mutate, error } = useLogisticsAction(save);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState('');
  const [newCompany, setNewCompany] = useState('');
  const [createdCompany, setCreatedCompany] = useState<CompanyContact | null>(null);
  const contactsQuery = useQuery({ queryKey: ['logistics-company-contacts', accountId], queryFn: async (): Promise<CompanyContact[]> => {
    const data = await api.customers.list();
    const rows = Array.isArray(data) ? data : Array.isArray(data?.customers) ? data.customers : [];
    return rows.filter((row: CompanyContact) => row.id && row.name).map((row: CompanyContact) => ({ id: row.id, name: row.name }));
  }, enabled: open, staleTime: 60_000 });
  const contacts = [...new Map([...(contactsQuery.data || []), ...services.map(service => ({ id: service.logistics_company_id, name: service.logistics_company_name })), ...(createdCompany ? [createdCompany] : [])].map(contact => [contact.id, contact])).values()].sort((a, b) => a.name.localeCompare(b.name));
  const active = services.filter(service => service.active);
  const edit = services.find(service => service.id === editing);
  const chooseEditor = (service?: LogisticsService) => { setEditing(service?.id || 'new'); setCompanyId(service?.logistics_company_id || ''); setNewCompany(''); };
  return <><button type="button" className="tap-target purchase-tracking-button" aria-label="Logistics services" onClick={() => setOpen(true)}>Services <span className="text-tea-text-dim">{active.length}</span></button><TrackingTask open={open} onClose={() => setOpen(false)} title="Logistics services"><div className="logistics-form">
    {active.map(service => <div className="logistics-service-row" key={service.id}><span>{service.logistics_company_name}<small className="text-tea-text-sec">{service.name} · {service.mode === 'sea' ? 'Boat' : 'Air'}</small></span><span>{serviceRateLabel(service)}</span><button type="button" className="tap-target purchase-tracking-button" disabled={busy} onClick={() => chooseEditor(service)}>Edit</button></div>)}
    {!active.length && <p className="text-tea-text-sec">Save a company's services and quoted rates here, then choose one when preparing a shipment.</p>}
    {!editing && <button type="button" className="tap-target purchase-tracking-button logistics-add-service" onClick={() => chooseEditor()}>Add service</button>}
    {editing && <form key={editing} className="logistics-service-editor" onSubmit={event => {
      event.preventDefault(); const form = new FormData(event.currentTarget); const contact = contacts.find(item => item.id === companyId); if (!contact) return;
      const input: LogisticsServiceInput = { logistics_company_id: contact.id, logistics_company_name: contact.name, name: String(form.get('serviceName') || '').trim(), mode: form.get('mode') as 'air' | 'sea', basis: form.get('basis') as 'kg' | 'm3' | 'fixed', rate: Number(form.get('rate')), currency: String(form.get('currency') || '').trim() };
      void mutate(async () => { await api.logistics.saveService(edit?.id || null, input); setEditing(null); });
    }}><div className="logistics-fields"><label>Company<select aria-label="Service company contact" value={companyId} disabled={busy} onChange={event => setCompanyId(event.target.value)}><option value="">Choose contact</option>{contacts.map(contact => <option key={contact.id} value={contact.id}>{contact.name}</option>)}<option value="new">New logistics company…</option></select></label>{companyId === 'new' && <><label>Name<input aria-label="New logistics company name" value={newCompany} disabled={busy} onChange={event => setNewCompany(event.target.value)}/></label><button type="button" className="tap-target purchase-tracking-button" disabled={busy || contactsQuery.isPending || contactsQuery.isError || !newCompany.trim()} onClick={() => void mutate(async () => {
      const name = newCompany.trim(); const existing = contacts.find(contact => contact.name.toLocaleLowerCase() === name.toLocaleLowerCase());
      let contact = existing;
      if (!contact) {
        try { contact = await api.customers.create({ name, type: 'logistics', tags: ['freight'] }); }
        catch (cause) { if (cause instanceof ApiError && cause.status === 403) throw new Error('Adding a logistics company requires contact access. Choose an existing company or ask the owner to add it.'); throw cause; }
      }
      if (!contact?.id) throw new Error('The company was not confirmed. Refresh contacts before trying again.');
      setCreatedCompany({ id: contact.id, name: contact.name || name }); setCompanyId(contact.id); setNewCompany(''); void contactsQuery.refetch();
    })}>Add company</button></>}{contactsQuery.isError && <span className="text-tea-text-sec">Contacts unavailable.<button type="button" className="tap-target underline" onClick={() => void contactsQuery.refetch()}>Retry</button></span>}</div><div className="logistics-fields"><label>Service<input name="serviceName" aria-label="Service name" placeholder="Airmail" required defaultValue={edit?.name || ''}/></label><label>By<select name="mode" aria-label="Service transport" defaultValue={edit?.mode || 'air'}><option value="air">Air</option><option value="sea">Boat</option></select></label><label>Charged by<select name="basis" aria-label="Service rate basis" defaultValue={edit?.basis || 'kg'}><option value="kg">kg</option><option value="m3">m³</option><option value="fixed">Fixed</option></select></label><label>Rate<input name="rate" aria-label="Service rate" type="number" required min="0" step="any" defaultValue={edit?.rate ?? ''}/></label><label>Currency<input name="currency" aria-label="Service rate currency" placeholder="CNY" required defaultValue={edit?.currency || ''}/></label></div><div className="logistics-actions"><button type="submit" className="tap-target purchase-tracking-button" disabled={busy || !contacts.some(contact => contact.id === companyId)}>Save service</button><button type="button" className="tap-target purchase-tracking-button" disabled={busy} onClick={() => setEditing(null)}>Close</button>{edit && <button type="button" className="tap-target purchase-tracking-button" disabled={busy} onClick={() => void mutate(async () => { await api.logistics.archiveService(edit.id); setEditing(null); })}>Archive service</button>}<span className="text-tea-text-dim">Saved rates fill new shipment estimates. Existing quotes and final bills stay as recorded.</span></div></form>}
    <LogisticsActionError message={error} recovery="Your entries are kept. Retry the same company or service action."/>
  </div></TrackingTask></>;
}
