import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ChevronDown } from 'lucide-react';
import { api, hasToken } from '../../lib/api';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import { useLedgerStore } from '../../lib/ledgerStore';
import { quotedUnit, tastingLine } from './curateV2Model';
import { CURRENCY_LABELS } from './PricingRow';
import { Section } from './TodayView';
import { VendorInfoPanel } from './VendorInfoPanel';
import type { TeaCompassEntry, VendorDetails } from './types';

interface Contact { channel: string; handle: string; label?: string }
interface Record_ {
  id?: string; name: string; chinese_name?: string | null; city?: string | null; country?: string | null; address?: string | null;
  wechat?: string | null; whatsapp?: string | null; phone?: string | null; notes?: string | null; contacts?: Contact[] | string | null;
}

type Field = 'chinese_name' | 'where' | 'wechat' | 'whatsapp' | 'website' | 'notes';

const contactsOf = (r: Record_ | null): Contact[] => {
  const raw = r?.contacts;
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') { try { const v = JSON.parse(raw); return Array.isArray(v) ? v : []; } catch { return []; } }
  return [];
};
const websiteOf = (r: Record_ | null) => contactsOf(r).find((c) => c.label === 'website' || /^https?:\/\/|\.\w{2,}$/i.test(c.handle))?.handle ?? '';
const whereOf = (r: Record_ | null) => [r?.address, r?.city, r?.country].filter((x) => x && String(x).trim()).join(', ');

interface VendorCardProps {
  vendor: { id?: string; name: string };
  teas: TeaCompassEntry[];
  onBack: () => void;
  onOpenTea: (entryId: string) => void;
  onAddTea: (vendor: { id?: string; name: string }) => void;
  onAddTeaware: (vendor: { id?: string; name: string }) => void;
}

/**
 * A vendor, as drawn: what the shop knows, one line each, a blank saying
 * "add". Tap a line to fill it in. Then their teas with what each costs and
 * how it tasted, their teaware, and the orders with them. The card photo,
 * storefront and map are kept under "Card, storefront and map".
 */
export const VendorCard: React.FC<VendorCardProps> = ({ vendor, teas: all, onBack, onOpenTea, onAddTea, onAddTeaware }) => {
  const updateEntry = useTeaCompassStore((s) => s.updateEntry);
  const transactions = useLedgerStore((s) => s.transactions);
  const [record, setRecord] = useState<Record_ | null>(null);
  const [vendorId, setVendorId] = useState(vendor.id);
  const [editing, setEditing] = useState<Field | null>(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    if (!vendorId || !hasToken()) return;
    api.customers.get(vendorId).then((r: any) => setRecord(r ?? null)).catch(() => {});
  }, [vendorId]);

  const teas = all.filter((t) => t.category === 'tea');
  const ware = all.filter((t) => t.category === 'teaware');
  const detailsSource = all.find((t) => t.vendorDetails && Object.values(t.vendorDetails).some((x) => x != null));
  const orders = useMemo(() => transactions.filter((tx) => tx.direction === 'purchase'
    && ((vendorId && tx.counterpartyId === vendorId) || tx.counterpartyName?.trim().toLowerCase() === vendor.name.trim().toLowerCase())), [transactions, vendorId, vendor.name]);
  const tasted = teas.filter((t) => tastingLine(t.tasting)).length;
  const bought = teas.filter((t) => t.decision === 'selected' || ['buying', 'incoming', 'in_stock'].includes(String(t.status))).length;

  const value: Record<Field, string> = {
    chinese_name: record?.chinese_name ?? '',
    where: whereOf(record),
    wechat: record?.wechat ?? detailsSource?.vendorDetails?.wechat ?? '',
    whatsapp: record?.whatsapp ?? record?.phone ?? detailsSource?.vendorDetails?.whatsapp ?? '',
    website: websiteOf(record) || detailsSource?.vendorDetails?.storefrontUrl || '',
    notes: record?.notes ?? '',
  };

  const start = (f: Field) => { setEditing(f); setDraft(value[f]); setError(null); };

  const save = async () => {
    if (!editing) return;
    const text = draft.trim();
    const f = editing;
    setSaving(true);
    setError(null);
    try {
      let id = vendorId;
      if (!id) {
        // A vendor known only by name becomes a vendor record the first time something is saved.
        const made: any = await api.customers.create({ name: vendor.name, tags: ['vendor'], source: 'compass' });
        id = made?.id;
        if (id) { setVendorId(id); for (const t of all) if (!t.vendorId) updateEntry(t.id, { vendorId: id }); }
      }
      if (!id) throw new Error('This vendor could not be saved yet.');
      const body: Record<string, unknown> = {};
      if (f === 'chinese_name') body.chinese_name = text || null;
      if (f === 'where') body.city = text || null;
      if (f === 'wechat') body.wechat = text || null;
      if (f === 'whatsapp') body.whatsapp = text || null;
      if (f === 'notes') body.notes = text || null;
      if (f === 'website') {
        body.contacts = [...contactsOf(record).filter((c) => !(c.label === 'website' || /^https?:\/\//i.test(c.handle))), ...(text ? [{ channel: 'other', handle: text, label: 'website' }] : [])];
      }
      const saved: any = await api.customers.update(id, body);
      setRecord(saved && typeof saved === 'object' && saved.name ? saved : { ...(record ?? { name: vendor.name }), ...body, ...(f === 'where' ? { address: null, country: null } : {}) } as Record_);
      setEditing(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const line = (f: Field, label: string, hint?: string, zh?: boolean) => editing === f ? (
    <form key={f} className="flex min-h-11 items-center gap-2 border-b border-tea-border px-4 py-1" onSubmit={(e) => { e.preventDefault(); void save(); }}>
      <span className="curate-v2-label w-20 shrink-0">{label}</span>
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Escape') setEditing(null); }}
        aria-label={label}
        className="min-w-0 flex-1 border-0 border-b border-tea-gold bg-transparent py-1.5 text-right text-ui-15 text-tea-text outline-none"
      />
      <button type="submit" disabled={saving} className="tap-target text-ui-13 font-medium text-tea-gold">{saving ? 'Saving' : 'Save'}</button>
    </form>
  ) : (
    <button key={f} type="button" onClick={() => start(f)} className="flex min-h-11 w-full items-center gap-3 border-b border-tea-border px-4 text-left">
      <span className="curate-v2-label w-20 shrink-0">{label}</span>
      <span className="min-w-0 flex-1 truncate text-right text-ui-14 text-tea-text" style={zh ? { fontFamily: "'Noto Serif SC', serif" } : undefined}>
        {value[f] || <span className="text-ui-13 text-tea-text-dim">{hint ?? 'add'}</span>}
      </span>
    </button>
  );

  const fact = (label: string, children: React.ReactNode) => (
    <div key={label} className="flex min-h-11 items-center gap-3 border-b border-tea-border px-4">
      <span className="curate-v2-label w-20 shrink-0">{label}</span>
      <span className="min-w-0 flex-1 truncate text-right text-ui-14 text-tea-text tabular-nums">{children}</span>
    </div>
  );

  return (
    <div className="curate-v2 -mx-4" data-testid="curate-vendor-card">
      <div className="flex items-center gap-1 px-2 pb-2">
        <button type="button" onClick={onBack} className="tap-target flex h-11 w-11 items-center justify-center text-tea-text-sec hover:text-tea-text" aria-label="Back to vendors">
          <ArrowLeft size={18} />
        </button>
        <span className="min-w-0 flex-1 truncate font-display text-[30px] leading-none text-tea-text">{vendor.name}</span>
        {orders.length > 0 && <span className="pr-2 font-mono text-ui-13 text-tea-gold">Working with</span>}
      </div>
      <div className="border-t border-tea-border">
        {line('chinese_name', 'Chinese', undefined, true)}
        {line('where', 'Where')}
        {line('wechat', 'WeChat', 'add · or photo their card')}
        {line('whatsapp', 'WhatsApp')}
        {line('website', 'Website')}
        {fact('Teas', teas.length ? `${teas.length} · ${tasted} tasted · ${bought} bought` : <span className="text-ui-13 text-tea-text-dim">none yet</span>)}
        {fact('Teaware', ware.length ? ware.map((w) => w.name || 'piece').join(', ') : <span className="text-ui-13 text-tea-text-dim">none yet</span>)}
        {fact('Orders', orders.length ? `${orders.length} · ${orders[0].status === 'confirmed' ? 'confirmed' : 'draft'} ${new Date(orders[0].updatedAt || orders[0].createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}` : <span className="text-ui-13 text-tea-text-dim">none yet</span>)}
        {line('notes', 'Note')}
      </div>
      {error && <p className="px-4 pt-2 text-ui-12 text-tea-error">{error}</p>}

      <button type="button" onClick={() => setMoreOpen((v) => !v)} aria-expanded={moreOpen} className="flex min-h-11 w-full items-center gap-2 border-b border-tea-border px-4 text-left">
        <span className="flex-1 text-ui-13 text-tea-text-sec">Card, storefront and map</span>
        <ChevronDown size={14} className={`text-tea-text-dim ${moreOpen ? 'rotate-180' : ''}`} />
      </button>
      {moreOpen && (
        <div className="border-b border-tea-border px-4 py-3">
          <VendorInfoPanel
            vendorName={vendor.name}
            vendorId={vendorId}
            vendorDetails={detailsSource?.vendorDetails}
            onDetailsChange={(details: VendorDetails) => { for (const t of all) updateEntry(t.id, { vendorDetails: details }); }}
          />
        </div>
      )}

      <Section title="Teas" count={teas.length} />
      {teas.map((t) => {
        const sym = CURRENCY_LABELS[t.priceCurrency] ?? '';
        const unit = quotedUnit(t);
        const taste = tastingLine(t.tasting).split(' · ').slice(0, 2).join(' · ');
        return (
          <button key={t.id} type="button" onClick={() => onOpenTea(t.id)} className="curate-v2-row w-full text-left">
            <span className="curate-v2-name">{t.name || 'Untitled tea'}</span>
            {taste ? <span className="min-w-0 truncate text-ui-12 text-tea-gold tabular-nums">{taste}</span>
              : t.year != null && <span className="text-ui-12 text-tea-text-dim tabular-nums">{t.year}</span>}
            <span className="flex-1" />
            {t.priceAmount != null
              ? <span className="text-ui-13 font-medium text-tea-text-sec tabular-nums">{sym}{t.priceAmount.toLocaleString()}{unit && <span className="ml-1 text-ui-12 font-normal text-tea-text-dim">{unit}</span>}</span>
              : <span className="text-ui-12 text-tea-text-dim">add cost</span>}
          </button>
        );
      })}
      {ware.length > 0 && <Section title="Teaware" count={ware.length} />}
      {ware.map((t) => (
        <button key={t.id} type="button" onClick={() => onOpenTea(t.id)} className="curate-v2-row w-full text-left">
          <span className="curate-v2-name">{t.name || 'Untitled piece'}</span>
          <span className="flex-1" />
          {t.priceAmount != null && <span className="text-ui-13 text-tea-text-sec tabular-nums">{CURRENCY_LABELS[t.priceCurrency] ?? ''}{t.priceAmount.toLocaleString()}</span>}
        </button>
      ))}
      <div className="grid grid-cols-2 gap-2 px-4 pt-3">
        <button type="button" onClick={() => onAddTeaware({ id: vendorId, name: vendor.name })} className="min-h-11 rounded-md border border-tea-border text-ui-13 text-tea-text-sec hover:text-tea-text">+ Teaware</button>
        <button type="button" onClick={() => onAddTea({ id: vendorId, name: vendor.name })} className="min-h-11 rounded-md border border-tea-border text-ui-13 text-tea-text-sec hover:text-tea-text">+ Tea</button>
      </div>
    </div>
  );
};
