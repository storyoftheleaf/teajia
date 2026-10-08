import { CurateRecordTools } from './CurateRecordTools';
import React, { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { useAppStore } from '../../lib/store';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { readQuoteFields, type CurateQuoteFields, type CurateQuoteLine, type RouteQuote } from '../../lib/curateStructuredFields';
import { StructuredTeaFields } from '../TeaCompass/StructuredTeaFields';

const inputClass = 'input-field min-h-11 min-w-0 px-3 py-2 text-ui-16';
const buttonClass = 'tap-target min-h-11 px-3 py-2 text-ui-12 text-tea-text-sec hover:text-tea-text';
type HeaderKey = 'reference' | 'issued_to' | 'quote_date' | 'validity_days' | 'valid_until' | 'minimum_order_amount' | 'currency' | 'payment_terms' | 'discount_percent' | 'discount_condition_type' | 'discount_min_amount' | 'discount_min_currency' | 'discount_min_weight_grams' | 'discount_min_quantity';
type LineDraft = { id: string; compass_entry_id: string; vendor_item_number: string; price_amount: string; price_currency: string; unitKind: string; price_per_unit_grams: string; discount_percent: string; route_quotes: RouteQuote[] };
export type QuoteDraft = Record<HeaderKey, string> & { id?: string; requestId?: string; lines: LineDraft[] };
const emptyDraft = (): QuoteDraft => ({ requestId: crypto.randomUUID(), reference: '', issued_to: '', quote_date: '', validity_days: '', valid_until: '', minimum_order_amount: '', currency: '', payment_terms: '', discount_percent: '', discount_condition_type: '', discount_min_amount: '', discount_min_currency: '', discount_min_weight_grams: '', discount_min_quantity: '', lines: [] });
const optionalText = (value: string) => value.trim() || null;
const optionalNumber = (value: string) => value.trim() ? Number(value) : null;

export function quoteDraftPayload(vendorId: string, draft: QuoteDraft): CurateQuoteFields {
  const lines: CurateQuoteLine[] = draft.lines.map(line => {
    const amount = optionalNumber(line.price_amount);
    const currency = optionalText(line.price_currency);
    if ((amount == null) !== (currency == null)) throw new Error('State the line amount and currency together.');
    if (amount != null && !line.unitKind) throw new Error('Choose whether the line price is per piece or by weight.');
    if (line.unitKind === 'grams' && optionalNumber(line.price_per_unit_grams) == null) throw new Error('State the weight the line price covers.');
    return { id: line.id, compass_entry_id: line.compass_entry_id, vendor_item_number: optionalText(line.vendor_item_number), price_amount: amount,
      price_currency: currency, price_per_unit_grams: line.unitKind === 'grams' ? optionalNumber(line.price_per_unit_grams) : null,
      discount_percent: optionalNumber(line.discount_percent), route_quotes: line.route_quotes };
  });
  return readQuoteFields({ vendor_id: vendorId, reference: optionalText(draft.reference), issued_to: optionalText(draft.issued_to),
    quote_date: optionalText(draft.quote_date), validity_days: optionalNumber(draft.validity_days), valid_until: optionalText(draft.valid_until),
    minimum_order_amount: optionalNumber(draft.minimum_order_amount), currency: optionalText(draft.currency), payment_terms: optionalText(draft.payment_terms),
    discount_percent: optionalNumber(draft.discount_percent), discount_condition_type: optionalText(draft.discount_condition_type),
    discount_min_amount: optionalNumber(draft.discount_min_amount), discount_min_currency: optionalText(draft.discount_min_currency),
    discount_min_weight_grams: optionalNumber(draft.discount_min_weight_grams), discount_min_quantity: optionalNumber(draft.discount_min_quantity), lines });
}
export function quoteToDraft(quote: CurateQuoteFields & { id: string }): QuoteDraft {
  const value = (key: HeaderKey) => String(quote[key] ?? '');
  return { id: quote.id, reference: value('reference'), issued_to: value('issued_to'), quote_date: value('quote_date'), validity_days: value('validity_days'), valid_until: value('valid_until'),
    minimum_order_amount: value('minimum_order_amount'), currency: value('currency'), payment_terms: value('payment_terms'),
    discount_percent: value('discount_percent'), discount_condition_type: value('discount_condition_type'),
    discount_min_amount: value('discount_min_amount'), discount_min_currency: value('discount_min_currency'),
    discount_min_weight_grams: value('discount_min_weight_grams'), discount_min_quantity: value('discount_min_quantity'),
    lines: (quote.lines ?? []).map(line => ({ id: line.id, compass_entry_id: line.compass_entry_id, vendor_item_number: line.vendor_item_number ?? '',
      price_amount: String(line.price_amount ?? ''), price_currency: line.price_currency ?? '',
      unitKind: line.price_per_unit_grams != null ? 'grams' : line.price_amount != null ? 'piece' : '', price_per_unit_grams: String(line.price_per_unit_grams ?? ''),
      discount_percent: String(line.discount_percent ?? ''), route_quotes: line.route_quotes ?? [] })) };
}

export function CurateQuotesPanel({ vendorId }: { vendorId: string }) {
  const account = useAppStore(state => state.activeAccountId);
  const generation = useRef(0);
  const savingRef = useRef(false);
  const editRevision = useRef(0);
  const [headers, setHeaders] = useState<Array<CurateQuoteFields & { id: string }>>([]);
  const [teas, setTeas] = useState<Array<{ id: string; name?: string; chinese_name?: string; vendor_id?: string }>>([]);
  const [draft, setDraft] = useState<QuoteDraft | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const revision = ++generation.current;
    setHeaders([]); setTeas([]); setDraft(null); setError(''); setSaving(false); setSaved(false);
    Promise.all([api.curateWorkspace.quotes(vendorId), api.compass.list({ vendor_id: vendorId })]).then(([quotes, data]) => {
      if (revision !== generation.current || useAppStore.getState().activeAccountId !== account) return;
      setHeaders(quotes); setTeas(data.entries ?? []);
    }).catch(() => { if (revision === generation.current) setError('Quotes and vendor teas could not be loaded. Retry before editing.'); });
    return () => { ++generation.current; };
  }, [vendorId, account, retry]);
  const current = (revision: number) => revision === generation.current && useAppStore.getState().activeAccountId === account;
  const open = async (id: string) => {
    const revision = generation.current;
    setError(''); setSaved(false);
    try { const quote = await api.curateWorkspace.quote(id); if (current(revision)) setDraft(quoteToDraft(quote)); }
    catch { if (current(revision)) setError('This quote could not be opened. Retry when the connection is available.'); }
  };
  const change = (patch: Partial<QuoteDraft>) => { ++editRevision.current; setDraft(value => value ? { ...value, ...patch } : value); setSaved(false); };
  const save = async () => {
    if (!draft || savingRef.current || useAppStore.getState().activeAccountId !== account) return;
    savingRef.current = true;
    const revision = generation.current;
    const sentEditRevision = editRevision.current;
    setSaving(true); setError('');
    try {
      const payload = quoteDraftPayload(vendorId, draft);
      const quote = await api.curateWorkspace.saveQuote({ ...payload, ...(!draft.id && draft.requestId ? { id: draft.requestId } : {}) }, draft.id);
      if (!current(revision)) return;
      setSaved(editRevision.current === sentEditRevision); setDraft(value => value ? { ...value, id: quote.id } : value);
      try { const quotes = await api.curateWorkspace.quotes(vendorId); if (current(revision)) setHeaders(quotes); } catch { /* The quote save remains acknowledged. */ }
    } catch {
      if (current(revision)) setError('Could not confirm the save. Check the dates, paired amount and currency, selected teas and price units. Discounts must be from 0 to 100; a known condition needs its positive threshold. Retry to confirm.');
    } finally { savingRef.current = false; if (current(revision)) setSaving(false); }
  };
  const field = (label: string, value: string, update: (value: string) => void, type = 'text') => <label className="block min-w-0 space-y-1">
    <span className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-sec`}>{label}</span>
    <input className={inputClass} type={type} step={type === 'number' ? 'any' : undefined} value={value} onChange={event => update(event.target.value)} />
  </label>;
  return <details className="border-t border-tea-border pt-3" data-testid="curate-quotes-panel">
    <summary className={`${TYPOGRAPHY_CLASSES.label} cursor-pointer min-h-11 text-tea-text-sec`}>Vendor quotes</summary>
    <div className="space-y-4 pb-3">
      {error && <p role="alert" className="text-ui-12 text-tea-text-sec">{error}</p>}
      <div className="flex flex-wrap gap-2">
        {headers.map(quote => <button type="button" key={quote.id} className={buttonClass} onClick={() => { void open(quote.id); }}>{quote.reference || quote.quote_date || 'Quote without a reference'}</button>)}
        <button type="button" className={buttonClass} onClick={() => { setDraft(emptyDraft()); setSaved(false); }}>New vendor quote</button>
        {error && <button type="button" className={buttonClass} onClick={() => setRetry(value => value + 1)}>Reload vendor quotes</button>}
      </div>
      {draft && <div className="space-y-4" role="group" aria-label="Vendor quote editor">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {field('Quote reference', draft.reference, reference => change({ reference }))}
          {field('Issued to', draft.issued_to, issued_to => change({ issued_to }))}
          {field('Quote date', draft.quote_date, quote_date => change({ quote_date }), 'date')}
          {field('Validity (days)', draft.validity_days, validity_days => change({ validity_days }), 'number')}
          {field('Valid until', draft.valid_until, valid_until => change({ valid_until }), 'date')}
          {field('Minimum order amount', draft.minimum_order_amount, minimum_order_amount => change({ minimum_order_amount }), 'number')}
          {field('Minimum order currency', draft.currency, currency => change({ currency }))}
          {field('Payment terms', draft.payment_terms, payment_terms => change({ payment_terms }))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {field('Quote discount (%)', draft.discount_percent, discount_percent => change({ discount_percent }), 'number')}
          <label className="block min-w-0 space-y-1">
            <span className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-sec`}>Discount condition</span>
            <select aria-label="Discount condition" className={inputClass} value={draft.discount_condition_type} onChange={event => {
              const discount_condition_type = event.target.value;
              change({ discount_condition_type,
                discount_min_amount: discount_condition_type === 'min_order_amount' ? draft.discount_min_amount : '',
                discount_min_currency: discount_condition_type === 'min_order_amount' ? draft.discount_min_currency : '',
                discount_min_weight_grams: discount_condition_type === 'min_order_weight' ? draft.discount_min_weight_grams : '',
                discount_min_quantity: discount_condition_type === 'min_quantity' ? draft.discount_min_quantity : '' });
            }}>
              <option value="">Not recorded</option><option value="none">Unconditional</option>
              <option value="min_order_amount">Minimum order amount</option><option value="min_order_weight">Minimum order weight</option>
              <option value="min_quantity">Minimum quantity</option><option value="unknown">Threshold unknown</option>
            </select>
            {draft.discount_condition_type === 'unknown' && <span className="block text-ui-12 text-tea-text-sec">Conditional, threshold not known yet.</span>}
          </label>
          {draft.discount_condition_type === 'min_order_amount' && <>
            {field('Discount minimum amount', draft.discount_min_amount, discount_min_amount => change({ discount_min_amount }), 'number')}
            {field('Discount minimum currency', draft.discount_min_currency, discount_min_currency => change({ discount_min_currency }))}
          </>}
          {draft.discount_condition_type === 'min_order_weight' && field('Discount minimum weight (g)', draft.discount_min_weight_grams, discount_min_weight_grams => change({ discount_min_weight_grams }), 'number')}
          {draft.discount_condition_type === 'min_quantity' && field('Discount minimum quantity', draft.discount_min_quantity, discount_min_quantity => change({ discount_min_quantity }), 'number')}
        </div>
        <div className="space-y-4">
          {draft.lines.map((line, index) => {
            const update = (patch: Partial<LineDraft>) => change({ lines: draft.lines.map(row => row.id === line.id ? { ...row, ...patch } : row) });
            return <div className="space-y-3 border-t border-tea-border pt-3" key={line.id}>
              <p className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-sec`}>Quote line {index + 1}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block space-y-1"><span className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-sec`}>Line {index + 1} tea</span>
                  <select className={inputClass} aria-label={`Line ${index + 1} tea`} value={line.compass_entry_id} onChange={event => update({ compass_entry_id: event.target.value })}>
                    <option value="">Choose a Curate tea</option>{teas.map(tea => <option value={tea.id} key={tea.id}>{tea.name || tea.chinese_name || 'Unnamed tea'}</option>)}
                  </select>
                </label>
                {field(`Line ${index + 1} vendor item`, line.vendor_item_number, vendor_item_number => update({ vendor_item_number }))}
                {field(`Line ${index + 1} amount`, line.price_amount, price_amount => update({ price_amount }), 'number')}
                {field(`Line ${index + 1} currency`, line.price_currency, price_currency => update({ price_currency }))}
                <label className="block space-y-1"><span className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-sec`}>Line {index + 1} price unit</span>
                  <select className={inputClass} aria-label={`Line ${index + 1} price unit`} value={line.unitKind} onChange={event => update({ unitKind: event.target.value })}>
                    <option value="">Choose</option><option value="grams">By weight</option><option value="piece">Per piece</option>
                  </select>
                </label>
                {line.unitKind === 'grams' && field(`Line ${index + 1} unit weight (g)`, line.price_per_unit_grams, price_per_unit_grams => update({ price_per_unit_grams }), 'number')}
                {field(`Line ${index + 1} discount (%)`, line.discount_percent, discount_percent => update({ discount_percent }), 'number')}
              </div>
              <StructuredTeaFields routeOnly entry={{ id: line.id, routeQuotes: line.route_quotes }} onChange={patch => update({ route_quotes: patch.routeQuotes ?? line.route_quotes })} />
              <button type="button" className={buttonClass} onClick={() => change({ lines: draft.lines.filter(row => row.id !== line.id) })}>Remove quote line {index + 1}</button>
            </div>;
          })}
          {!teas.length && <p className="text-ui-12 text-tea-text-sec">Add this vendor’s teas in Curate before linking quote lines.</p>}
          <button type="button" className={buttonClass} disabled={!teas.length} onClick={() => change({ lines: [...draft.lines, { id: crypto.randomUUID(), compass_entry_id: '', vendor_item_number: '', price_amount: '', price_currency: '', unitKind: '', price_per_unit_grams: '', discount_percent: '', route_quotes: [] }] })}>Add quote line</button>
        </div>
        {draft.id && <CurateRecordTools entityType="quote" entityId={draft.id} onChanged={() => { if (saved) void open(draft.id!); }} />}
        {saved && <p role="status" className="text-ui-12 text-tea-text-sec">Vendor quote saved</p>}
        <div className="flex justify-between gap-2">
          <button type="button" className={buttonClass} disabled={saving} onClick={() => setDraft(null)}>Cancel vendor quote</button>
          <button type="button" className={`${buttonClass} text-tea-gold`} disabled={saving} onClick={() => { void save(); }}>{saving ? 'Saving quote' : 'Save vendor quote'}</button>
        </div>
      </div>}
    </div>
  </details>;
}
