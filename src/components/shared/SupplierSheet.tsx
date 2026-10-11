import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { canonicalCurrency } from '../../lib/currency';
import { BottomSheet } from './BottomSheet';
import { useShippingRoutes } from './useShippingRoutes';
import { applySupplierRenameLocally } from './supplierRenameCaches';
import {
  CONTACT_FIELDS, describeRename,
  type SupplierCard, type SupplierFreightBill, type SupplierRenamePreview,
} from './supplierSheetTypes';

/**
 * The Supplier sheet: one place to see a supplier and correct it.
 *
 * Adrian, 2026-10-11: "I see someone called Master Bo. If that's not his name,
 * there needs to be a button that I can click and change the name and it will
 * update it across not only all the records, but permanently. From this place I
 * can access a way to update everything including the methods that I use when I
 * ship from him."
 *
 *   - The name is changed through the server's rename, which shows what it
 *     would touch first and lands everywhere in one step (worker/src/supplierRename.ts).
 *   - Contact details save on their own as each is edited, on the same card.
 *   - Shipping shows the freight bills recorded for this supplier and the
 *     shop's routes, with a way into Settings to change a route.
 *
 * Not wired into any list here: whoever lists suppliers opens it.
 */

export interface SupplierSheetProps {
  /** The supplier's customer id. Without it the sheet looks the name up among the shop's suppliers. */
  vendorId?: string | null;
  vendorName: string;
  open: boolean;
  onClose: () => void;
  /** Called after the rename has landed everywhere, so a list can show the new name. */
  onRenamed?: (newName: string) => void;
  /** Opens this supplier's stock (sums, teas, select all). Shown as a last row when given. */
  onShowStock?: () => void;
}

const label = 'font-sans text-ui-10 uppercase tracking-[0.1em] text-tea-text-dim leading-none';

/** Tap the value to type; Enter or leaving the field saves, Escape keeps what was there. */
const TapField: React.FC<{
  value: string; aria: string; placeholder: string; inputMode?: 'text' | 'tel' | 'email';
  disabled?: boolean; busy?: boolean; onSave: (text: string) => void; className?: string;
}> = ({ value, aria, placeholder, inputMode = 'text', disabled, busy, onSave, className = '' }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editing) { ref.current?.focus(); ref.current?.select(); } }, [editing]);
  if (editing) {
    return (
      <input
        ref={ref} aria-label={aria} inputMode={inputMode} value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { setEditing(false); if (draft.trim() !== value.trim()) onSave(draft.trim()); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') { setDraft(value); setEditing(false); }
        }}
        className={`block h-8 min-w-0 w-full bg-transparent border-0 border-b border-tea-border focus:border-tea-gold outline-none p-0 text-ui-14 text-tea-text ${className}`}
      />
    );
  }
  return (
    <button
      type="button" aria-label={aria} disabled={disabled}
      onClick={() => { setDraft(value); setEditing(true); }}
      className={`block h-8 min-w-0 w-full truncate text-left text-ui-14 leading-8 disabled:cursor-default ${value ? 'text-tea-text' : 'text-tea-text-dim'} ${busy ? 'opacity-60' : ''} ${className}`}
    >
      {value || placeholder}
    </button>
  );
};

const SYMBOL: Record<string, string> = { USD: '$', Yuan: '¥', CNY: '¥', HKD: 'HK$', NT: 'NT$', IDR: 'Rp ' };
function amount(n: number, currency: string): string {
  const key = canonicalCurrency(currency) ?? currency;
  const sym = SYMBOL[key] ?? `${key} `;
  const decimals = Math.abs(n - Math.round(n)) < 0.005 || n >= 100 ? 0 : 2;
  return `${sym}${n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

const MODE_WORD: Record<string, string> = { air: 'Air', sea: 'Boat', land: 'Land', courier: 'Courier' };

const FreightBills: React.FC<{ bills: SupplierFreightBill[] }> = ({ bills }) => (
  <ul className="m-0 p-0 list-none">
    {bills.map((b) => (
      <li key={b.id} data-testid="supplier-freight-bill" className={`py-2 border-b border-tea-border last:border-b-0 ${b.current ? '' : 'opacity-70'}`}>
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="min-w-0 truncate text-ui-14 text-tea-text">{b.leg}</span>
          {b.mode && <span className="shrink-0 text-ui-12 text-tea-text-sec">{MODE_WORD[b.mode] ?? b.mode}</span>}
          <span className="ml-auto shrink-0 num text-ui-14 text-tea-text">{amount(b.per_kg, b.currency)} <span className="text-ui-12 text-tea-text-sec">/ kg</span></span>
        </div>
        <div className="num text-ui-12 text-tea-text-sec">
          {amount(b.total_amount, b.currency)} for {b.weight_kg} kg · {b.observed_on}
          {b.transit_days != null ? ` · ${b.transit_days} days` : ''}
          {b.per_kg_usd != null && !/^usd$/i.test(b.currency) ? ` · about $${b.per_kg_usd}/kg` : ''}
          {b.current ? '' : ' · older'}
        </div>
      </li>
    ))}
  </ul>
);

export const SupplierSheet: React.FC<SupplierSheetProps> = ({ vendorId, vendorName, open, onClose, onRenamed, onShowStock }) => {
  const queryClient = useQueryClient();
  const [shownName, setShownName] = useState(vendorName);
  useEffect(() => { setShownName(vendorName); }, [vendorName]);

  // The supplier's id: given, or found by exact name among the shop's suppliers.
  const lookup = useQuery<{ id: string } | null>({
    queryKey: ['supplier-sheet', 'lookup', vendorName.trim().toLowerCase()],
    enabled: open && !vendorId,
    staleTime: 60_000,
    queryFn: async () => {
      const list = await api.customers.list('supplier') as Array<{ id: string; name: string }>;
      const hits = (list ?? []).filter((c) => c.name?.trim().toLowerCase() === vendorName.trim().toLowerCase());
      return hits.length === 1 ? { id: hits[0].id } : null;
    },
  });
  const id = vendorId || lookup.data?.id || null;

  const card = useQuery<SupplierCard>({
    queryKey: ['supplier-sheet', id],
    enabled: open && !!id,
    queryFn: async () => await api.customers.get(id!) as SupplierCard,
  });
  const freight = useQuery<SupplierFreightBill[]>({
    queryKey: ['supplier-freight', id],
    enabled: open && !!id,
    queryFn: () => api.suppliers.freight(id!),
  });
  const routes = useShippingRoutes();

  const currentName = card.data?.name ?? shownName;

  // ── Name ──
  const [draftName, setDraftName] = useState<string | null>(null);
  const [preview, setPreview] = useState<SupplierRenamePreview | null>(null);
  const [nameError, setNameError] = useState('');
  const [working, setWorking] = useState(false);

  const startRename = () => { setNameError(''); setPreview(null); setDraftName(currentName); };
  const cancelRename = () => { setDraftName(null); setPreview(null); setNameError(''); };

  const askPreview = async () => {
    const next = (draftName ?? '').trim();
    if (!id || !next) return;
    if (next === currentName) { cancelRename(); return; }
    setWorking(true); setNameError('');
    try { setPreview(await api.suppliers.renamePreview(id, next)); }
    catch (e) { setNameError(e instanceof Error ? e.message : 'Could not check that name.'); }
    finally { setWorking(false); }
  };

  const confirmRename = async () => {
    if (!id || !preview) return;
    setWorking(true); setNameError('');
    try {
      const done = await api.suppliers.rename(id, preview.new_name, preview.old_name);
      setShownName(done.new_name);
      queryClient.setQueryData<SupplierCard>(['supplier-sheet', id], (old) => (old ? { ...old, name: done.new_name } : old));
      applySupplierRenameLocally(queryClient, { vendorId: id, oldName: done.old_name, newName: done.new_name });
      cancelRename();
      onRenamed?.(done.new_name);
    } catch (e) {
      setNameError(e instanceof Error ? e.message : 'Could not rename. Nothing was changed.');
    } finally { setWorking(false); }
  };

  // ── Contact ──
  const [savingField, setSavingField] = useState<string | null>(null);
  const [contactError, setContactError] = useState('');
  const saveContact = async (key: string, text: string) => {
    if (!id) return;
    setSavingField(key); setContactError('');
    try {
      // An emptied field is cleared (null), never saved as a blank string.
      await api.customers.update(id, { [key]: text || null });
      queryClient.setQueryData<SupplierCard>(['supplier-sheet', id], (old) => (old ? { ...old, [key]: text || null } : old));
      void queryClient.invalidateQueries({ queryKey: ['customers'] });
    } catch (e) {
      setContactError(e instanceof Error ? e.message : 'Could not save that.');
      void card.refetch();
    } finally { setSavingField(null); }
  };

  const bills = freight.data ?? [];
  const shopRoutes = routes.data ?? [];
  const resolving = !vendorId && lookup.isLoading;
  const unresolved = !id && !resolving;
  const summary = useMemo(() => (preview ? describeRename(preview) : ''), [preview]);

  return (
    <BottomSheet open={open} onOpenChange={(o) => { if (!o) { cancelRename(); onClose(); } }} title={currentName} description="Supplier">
      <div data-testid="supplier-sheet" className="px-3 pb-2">
        {unresolved && (
          <p className="py-3 text-ui-13 text-tea-text-sec">
            There is no supplier card called {vendorName} yet, so there is nothing to change here. Save the supplier first.
          </p>
        )}
        {resolving && <p className="py-3 text-ui-13 text-tea-text-sec">Loading…</p>}

        {id && (
          <>
            {/* Name */}
            <section aria-label="Name" className="py-2 border-b border-tea-border">
              <div className={label}>Name</div>
              {draftName === null ? (
                <div className="mt-1 flex items-baseline gap-3 min-w-0">
                  <span data-testid="supplier-name" className="min-w-0 truncate font-display text-ui-20 text-tea-text">{currentName}</span>
                  <button type="button" onClick={startRename} className="tap-target ml-auto shrink-0 text-ui-13 text-tea-gold-lt hover:text-tea-gold">Rename</button>
                </div>
              ) : (
                <div className="mt-1">
                  <input
                    aria-label="New name" autoFocus value={draftName} disabled={!!preview || working}
                    onChange={(e) => setDraftName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') void askPreview(); if (e.key === 'Escape') cancelRename(); }}
                    className="w-full bg-transparent border-0 border-b border-tea-border focus:border-tea-gold outline-none p-0 pb-1 font-display text-ui-20 text-tea-text"
                  />
                  {preview ? (
                    <div role="status" data-testid="supplier-rename-preview" className="mt-2 text-ui-13 text-tea-text">
                      <p className="m-0">{summary}</p>
                      <p className="mt-1 mb-0 text-ui-12 text-tea-text-sec">
                        It is renamed from <span className="text-tea-text">{preview.old_name}</span> to <span className="text-tea-text">{preview.new_name}</span> everywhere, for good.
                      </p>
                    </div>
                  ) : (
                    <p className="mt-1 mb-0 text-ui-12 text-tea-text-sec">You will see what changes before anything does.</p>
                  )}
                  {nameError && <p role="alert" className="mt-2 mb-0 text-ui-12 text-tea-error">{nameError}</p>}
                  <div className="mt-3 flex items-center justify-between">
                    <button type="button" onClick={preview ? () => setPreview(null) : cancelRename} disabled={working}
                      className="tap-target text-ui-13 text-tea-text-sec hover:text-tea-text">{preview ? 'Back' : 'Cancel'}</button>
                    {preview ? (
                      <button type="button" onClick={() => void confirmRename()} disabled={working}
                        className="tap-target text-ui-13 text-tea-gold-lt hover:text-tea-gold disabled:opacity-60">{working ? 'Renaming…' : 'Rename everywhere'}</button>
                    ) : (
                      <button type="button" onClick={() => void askPreview()} disabled={working || !(draftName ?? '').trim()}
                        className="tap-target text-ui-13 text-tea-gold-lt hover:text-tea-gold disabled:opacity-60">{working ? 'Checking…' : 'See what changes'}</button>
                    )}
                  </div>
                </div>
              )}
            </section>

            {/* Contact */}
            <section aria-label="Contact" className="py-2 border-b border-tea-border">
              <div className={label}>Contact</div>
              {card.isLoading && <p className="py-2 m-0 text-ui-13 text-tea-text-sec">Loading…</p>}
              {card.isError && <p role="alert" className="py-2 m-0 text-ui-13 text-tea-error">Could not load the contact details.</p>}
              {card.data && (
                <div className="mt-1">
                  {CONTACT_FIELDS.map((f) => (
                    <div key={f.key} className="flex items-center gap-3 min-w-0">
                      <span className="w-16 shrink-0 text-ui-12 text-tea-text-sec">{f.label}</span>
                      <TapField
                        value={String(card.data?.[f.key] ?? '')} aria={f.label} placeholder={f.placeholder}
                        inputMode={f.inputMode} busy={savingField === f.key} className="num"
                        onSave={(text) => void saveContact(f.key as string, text)}
                      />
                    </div>
                  ))}
                </div>
              )}
              {contactError && <p role="alert" className="mt-1 mb-0 text-ui-12 text-tea-error">{contactError}</p>}
            </section>

            {/* Shipping */}
            <section aria-label="Shipping" className="py-2">
              <div className={label}>How you ship from {currentName}</div>
              {freight.isLoading ? <p className="py-2 m-0 text-ui-13 text-tea-text-sec">Loading…</p>
                : freight.isError ? <p role="alert" className="py-2 m-0 text-ui-13 text-tea-error">Could not load the freight bills.</p>
                : bills.length === 0 ? <p className="py-2 m-0 text-ui-13 text-tea-text-sec">No freight bills recorded for this supplier yet.</p>
                : <FreightBills bills={bills} />}

              <div className={`${label} mt-3`}>Shop routes</div>
              {routes.isLoading ? <p className="py-2 m-0 text-ui-13 text-tea-text-sec">Loading…</p>
                : shopRoutes.length === 0 ? <p className="py-2 m-0 text-ui-13 text-tea-text-sec">No routes yet. Air follows the shop freight rate.</p>
                : (
                  <ul className="m-0 p-0 list-none">
                    {shopRoutes.map((r) => (
                      <li key={r.id} data-testid="supplier-shop-route" className="py-1.5 flex items-baseline gap-2 min-w-0 border-b border-tea-border last:border-b-0">
                        <span className="shrink-0 text-ui-14 text-tea-text">{r.mode === 'air' ? 'Air' : 'Boat'}</span>
                        <span className="min-w-0 truncate text-ui-12 text-tea-text-sec">{r.carrier || 'no carrier named'}</span>
                        <span className="ml-auto shrink-0 num text-ui-14 text-tea-text">
                          {r.rate_per_kg == null ? <span className="text-tea-text-dim">no rate</span> : <>{amount(r.rate_per_kg, r.rate_currency ?? 'Yuan')} <span className="text-ui-12 text-tea-text-sec">/ kg</span></>}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              <Link to="/admin/account-settings" onClick={onClose} className="tap-target mt-2 inline-block text-ui-13 text-tea-gold-lt hover:text-tea-gold">
                Change routes in Store Settings
              </Link>
            </section>
          </>
        )}

        {onShowStock && (
          <button type="button" onClick={onShowStock}
            className="tap-target mt-1 w-full py-3 flex items-center justify-between gap-3 border-t border-tea-border text-left text-ui-14 text-tea-text hover:text-tea-gold">
            <span className="truncate">Stock from {currentName}</span>
            <ChevronRight size={16} className="shrink-0 text-tea-text-sec" aria-hidden="true" />
          </button>
        )}
      </div>
    </BottomSheet>
  );
};

export default SupplierSheet;
