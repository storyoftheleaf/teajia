import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useProducts } from '../../hooks/useAdminData';
import { serviceJourney } from './serviceJourney';
import { ServiceJourneyCard } from './ServiceJourneyCard';
import { useQueryClient } from '@tanstack/react-query';
import { refreshCommerceQueries } from '../../../lib/refreshCommerce';
import { TrackingTask } from './TrackingTask';
import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from '../../../lib/api';
import type { LogisticsService, LogisticsTracking } from '../../../lib/logisticsTypes';
import type { LogisticsMutation } from './LogisticsControls';
import { useLogisticsAction, LogisticsActionError } from './useLogisticsAction';
import { logisticsNumber } from './LogisticsControls';
import { ShopFreightDefault, shopDefaultLabel, shopFreightCurrency, useShopDefaultAccount } from './ShopFreightDefault';
import { addMySuitcase, hasSuitcase } from './mySuitcase';
import { companyFor, emptyDraft, rateLabel, serviceFromDraft, type ServiceDraft } from './serviceDraft';
export function serviceRateLabel(service: Pick<LogisticsService, 'rate' | 'currency' | 'basis'>): string {
  return `${logisticsNumber(service.rate)} ${service.currency}${service.basis === 'fixed' ? ' fixed' : service.basis === 'm3' ? '/m³' : '/kg'}`;
}
type CompanyContact = { id: string; name: string };
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function LogisticsServices({ services, tracking, accountId, busy, mutate: save }: { services: LogisticsService[]; tracking?: LogisticsTracking | null; accountId: string | null; busy: boolean; mutate: LogisticsMutation }) {
  const { mutate, error } = useLogisticsAction(save);
  const [params, setParams] = useSearchParams();
  // Shipping rates is a step in the address (Adrian, 2026-11-27): "shop default"
  // on a tea opens it at ?serviceId=shop, the header button at ?rates=open, and
  // back closes it. A service link opens it at that service.
  const linkedService = params.get('serviceId');
  const open = Boolean(linkedService) || params.get('rates') === 'open';
  const openRates = () => setParams(current => { const next = new URLSearchParams(current); next.set('rates', 'open'); return next; });
  useEffect(() => {
    if (!open || !linkedService) return;
    const frame = requestAnimationFrame(() => document.querySelector(linkedService === 'shop' ? '[data-testid="shop-freight-default"]' : `[data-testid="service-journey-${CSS.escape(linkedService)}"]`)?.scrollIntoView({ block: 'nearest' }));
    return () => cancelAnimationFrame(frame);
  }, [open, linkedService]);
  const close = () => setParams(current => { const next = new URLSearchParams(current); next.delete('serviceId'); next.delete('rates'); return next; });
  const { data: products = [] } = useProducts({ enabled: open });
  const queryClient = useQueryClient();
  const teaLabel = (product: (typeof products)[number]) => [product.givenName || product.productName, product.year].filter(Boolean).join(' ');
  const addTea = (serviceId: string) => (productId: string) => mutate(async () => {
    await api.products.updateCommercial(productId, { freight_service_id: serviceId });
    await refreshCommerceQueries(queryClient, undefined, { changedProductIds: [productId] });
  });
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<ServiceDraft>(() => emptyDraft('Yuan'));
  const [details, setDetails] = useState(false);
  const [draftError, setDraftError] = useState('');
  const contactsQuery = useQuery({ queryKey: ['logistics-company-contacts', accountId], queryFn: async (): Promise<CompanyContact[]> => {
    const data = await api.customers.list();
    const rows = Array.isArray(data) ? data : Array.isArray(data?.customers) ? data.customers : [];
    return rows.filter((row: CompanyContact) => row.id && row.name).map((row: CompanyContact) => ({ id: row.id, name: row.name }));
  }, enabled: open, staleTime: 60_000 });
  const contacts = [...new Map([...(contactsQuery.data || []), ...services.map(service => ({ id: service.logistics_company_id, name: service.logistics_company_name }))].map(contact => [contact.id, contact])).values()].sort((a, b) => a.name.localeCompare(b.name));
  // Read while closed too: the header button shows the shop default's figure.
  const shopDefault = useShopDefaultAccount(accountId, true);
  const active = services.filter(service => service.active);
  const activeIds = new Set(active.map(service => service.id));
  const teas = products.filter(product => product.type !== 'Teaware');
  const ownRate = teas.filter(product => product.shippingRatePerKg != null);
  const onShopDefault = teas.filter(product => product.shippingRatePerKg == null && (!product.freightServiceId || !activeIds.has(product.freightServiceId))).length;
  const addSuitcase = () => void mutate(async () => {
    try {
      await addMySuitcase({
        listContacts: async () => { const data = await api.customers.list(); return Array.isArray(data) ? data : Array.isArray(data?.customers) ? data.customers : []; },
        createContact: input => api.customers.create(input),
        saveService: input => api.logistics.saveService(null, input),
      }, shopFreightCurrency(shopDefault.data));
    } catch (cause) { if (cause instanceof ApiError && cause.status === 403) throw new Error('Adding My suitcase needs contact access. Ask the owner to add it.'); throw cause; }
    void contactsQuery.refetch();
  });
  const edit = services.find(service => service.id === editing);
  const shopCurrency = shopFreightCurrency(shopDefault.data);
  const chooseEditor = (service?: LogisticsService) => {
    setEditing(service?.id || 'new'); setDraftError(''); setDetails(false);
    setDraft(service ? { companyName: service.logistics_company_name, rate: String(service.rate), name: service.name, mode: service.mode, basis: service.basis, currency: service.currency } : emptyDraft(shopCurrency));
  };
  const change = (patch: Partial<ServiceDraft>) => { setDraft(current => ({ ...current, ...patch })); setDraftError(''); };
  const saveDraft = () => {
    const built = serviceFromDraft(draft, shopCurrency);
    if ('error' in built) { setDraftError(built.error); return; }
    void mutate(async () => {
      let company: CompanyContact;
      try { company = await companyFor(built.companyName, contacts, input => api.customers.create(input)); }
      catch (cause) { if (cause instanceof ApiError && cause.status === 403) throw new Error('Adding a logistics company requires contact access. Choose an existing company or ask the owner to add it.'); throw cause; }
      await api.logistics.saveService(edit?.id || null, { ...built.service, logistics_company_id: company.id, logistics_company_name: company.name });
      setEditing(null); void contactsQuery.refetch();
    });
  };
  const editorForm = <form key={editing} className="logistics-service-editor" aria-label={edit ? 'Edit logistics service' : 'Add a logistics company'} onSubmit={event => { event.preventDefault(); saveDraft(); }}>
      <div className="logistics-fields">
        <label>Company<input aria-label="Logistics company" list="logistics-company-names" value={draft.companyName} placeholder="Name" disabled={busy} onChange={event => change({ companyName: event.target.value })}/></label>
        <datalist id="logistics-company-names">{contacts.map(contact => <option key={contact.id} value={contact.name}/>)}</datalist>
        <label>{rateLabel(draft.basis)}<input aria-label="Service rate" inputMode="decimal" value={draft.rate} placeholder="0" disabled={busy} onChange={event => change({ rate: event.target.value })}/><span className="text-tea-text-dim">{draft.currency || shopCurrency}</span></label>
      </div>
      {details && <div className="logistics-fields">
        <label>Service<input aria-label="Service name" value={draft.name} placeholder={draft.mode === 'sea' ? 'Boat' : 'Air'} onChange={event => change({ name: event.target.value })}/></label>
        <label>By<select aria-label="Service transport" value={draft.mode} onChange={event => change({ mode: event.target.value as ServiceDraft['mode'] })}><option value="air">Air</option><option value="sea">Boat</option></select></label>
        <label>Charged by<select aria-label="Service rate basis" value={draft.basis} onChange={event => change({ basis: event.target.value as ServiceDraft['basis'] })}><option value="kg">kg</option><option value="m3">m³</option><option value="fixed">Fixed</option></select></label>
        <label>Currency<input aria-label="Service rate currency" value={draft.currency} placeholder={shopCurrency} onChange={event => change({ currency: event.target.value })}/></label>
      </div>}
      {draftError && <p role="alert" className="logistics-field-note text-tea-text-sec">{draftError}</p>}
      <div className="logistics-actions">
        <button type="submit" className="tap-target purchase-tracking-button" disabled={busy}>Save</button>
        <button type="button" className="tap-target purchase-tracking-button" disabled={busy} onClick={() => setEditing(null)}>Close</button>
        {!details && <button type="button" className="tap-target purchase-tracking-button" onClick={() => setDetails(true)}>More details</button>}
        {edit && <button type="button" className="tap-target purchase-tracking-button" disabled={busy} onClick={() => void mutate(async () => { await api.logistics.archiveService(edit.id); setEditing(null); })}>Archive service</button>}
        <span className="text-tea-text-dim">{details ? 'Saved rates fill new shipment estimates. Existing quotes and final bills stay as recorded.' : `${draft.mode === 'sea' ? 'By boat' : 'By air'}, ${draft.basis === 'fixed' ? 'a fixed price' : draft.basis === 'm3' ? 'per m³' : 'per kg'}, in ${draft.currency || shopCurrency}. More details to change.`}</span>
      </div>
    </form>;
  return <><button type="button" className="tap-target purchase-tracking-button" aria-label="Shipping rates" onClick={openRates}>Shipping rates <span className="text-tea-text-dim">{shopDefault.data ? shopDefaultLabel(shopDefault.data).replace(' (platform default)', '') : active.length}</span></button><TrackingTask open={open} onClose={close} title="Shipping rates"><div className="logistics-form journey-list">
    <p className="text-tea-text-sec" data-testid="shipping-rates-rule">Every tea pays the shop default, unless it travels by one of the services below. Freight is added at cost, after the tea cost × 3.</p>
    <ShopFreightDefault accountId={accountId} account={shopDefault.data} busy={busy} run={action => mutate(action)} startEditing={linkedService === 'shop'} teasFollowing={products.length ? onShopDefault : null}/>
    {active.length > 0 && <h3 className="label-caps text-tea-text-dim">Logistics services</h3>}
    {active.map(service => <ServiceJourneyCard key={service.id} service={service} journey={serviceJourney(service, tracking, products)} rate={serviceRateLabel(service)}
      busy={busy} onEdit={() => chooseEditor(service)} onGo={close}
      addable={products.filter(product => product.type !== 'Teaware' && product.freightServiceId !== service.id).map(product => ({ id: product.id, label: teaLabel(product) }))}
      onAddTea={addTea(service.id)}>{editing === service.id && editorForm}</ServiceJourneyCard>)}
    {!active.length && <p className="text-tea-text-sec">Save a company's services and quoted rates here, then choose one when preparing a shipment.</p>}
    {!editing && <div className="logistics-actions"><button type="button" className="tap-target purchase-tracking-button logistics-add-service" onClick={() => chooseEditor()}>+ Logistics company</button>{!hasSuitcase(services) && <button type="button" className="tap-target purchase-tracking-button" disabled={busy || shopDefault.isLoading} onClick={addSuitcase}>+ My suitcase</button>}</div>}
    {editing === 'new' && editorForm}
    {ownRate.length > 0 && <section className="journey-card journey-card-quiet" data-testid="teas-with-own-rate">
      <div className="text-ui-16 text-tea-text">Teas with their own older rate</div>
      <p className="text-tea-text-dim">These were given a rate before rates moved here. It wins over the shop default and any service until it is cleared on the tea.</p>
      <p className="flex flex-wrap gap-x-3">{ownRate.map(product => <Link key={product.id} className="tap-target underline text-tea-gold" to={`/admin/stock?panel=${encodeURIComponent(product.id)}`}>{teaLabel(product)}</Link>)}</p>
    </section>}
    <LogisticsActionError message={error} recovery="Your entries are kept. Retry the same company or service action."/>
  </div></TrackingTask></>;
}
