import { CapturePhotoImage, getStockCapturePhotoId, useCapturePhotoUrl } from '../../components/curate/CapturePhotoImage';
import { VendorFace } from '../../components/vendors/VendorFace';
import { VendorFaceSheet, VendorFacesButton } from '../../components/vendors/VendorFaceSheet';
import { toFaceVendor } from '../../components/vendors/vendorFaces';
import { capturePhotoApi } from '../../lib/capturePhotoApi';
import { enteredYear } from '../enteredYear';
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { TeaAction } from './inventory/phone/PhoneTeaHeader';
import { ROOM_TAB_TO_SECTION, TeaJumpBar, TeaLine, TeaMissing, TeaSection, sectionLabel, teaSectionId, type MissingItem, type TeaPageSection } from './inventory/stock/TeaPage';
import { fmtNum } from '../../utils/formatNumber';
import { Button } from '../../components/shared/Button';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  X as XIcon, ChevronLeft, ChevronRight, ChevronDown, QrCode, Star, Sparkles,
  FlaskConical, RefreshCw, Pencil, Plus, Loader2, Check, Globe, Receipt, BookOpen,
  Camera, Upload, Crop, Download, MoreHorizontal, Trash2, Wand2, Mic, Square, Package,
} from 'lucide-react';
import { refreshCommerceQueries } from '../../lib/refreshCommerce';
import { api } from '../../lib/api';
import { SquareCropModal } from '../../components/shared/SquareCropModal';
import { useAppStore } from '../store';
import { selectHasBundle, selectIsOwnerTier } from '../../lib/store';
import type { Product, ExchangeRate, Currency } from '../types';
import { calculatePricing } from '../utils';
import { useCustomers } from '../hooks/useAdminData';
import { useToast } from './Toast';
import { TastingEditorModal } from './TastingEditorModal';
import { QrCodeModal } from './QrCodeModal';
import { ProductCollectionsSection } from './collections/ProductCollectionsSection';
import { SalesPermissionsPanel } from './sales/SalesPermissionsPanel';
import { CollectionPill } from './collections/CollectionPill';
import { AutocompleteInput } from '../../components/TeaCompass/AutocompleteInput';
import { buildVarietyDataMap, getTeaVarietySuggestions } from '../../data/teaVarieties';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import { sharedTeaRecordId, sharedTeaRecordHref } from '../../lib/sharedTeaRecord';
import { hydrateCompassEntries } from '../../lib/teaCompassSync';
import { useLedgerStore } from '../../lib/ledgerStore';
import { addTeaToDraftOrder } from '../../components/CurateV2/orderBuy';
import { buildProductUpdatePayload } from '../productUpdatePayload';
import { shopRateInCurrency, shippingRateUsdFor } from '../../lib/shippingRate';
import { isoCurrencyCode, rateToUsd } from '../../lib/currency';
import { useShopFreightDefault, teaFallbackFreightUsd } from '../hooks/useAdminData';
import { TeaFreight } from './inventory/stock/TeaFreight';
import { getThemeColor } from '../themeUtils';
import { INVENTORY_TEA_TYPES } from '../../wisdom';
import { effectivePurpose, getTeaReadiness } from './inventory/domain';
import { StockListingReview } from './inventory/StockListingReview';
import { StockOfferSource } from './inventory/StockPersonalOffer';
import {
  flattenTastingNotes,
  resolveTermLabel,
  LIQUOR_COLORS,
  TASTING_CATEGORY_ORDER,
  SECTION_ICONS,
} from '../../data/tastingTaxonomy';

// The Wisdom pages are heavy; the tea's Wisdom Base list loads them on its own.
const WisdomNeedsList = React.lazy(() => import('./inventory/stock/WisdomNeedsList'));

/* ------------------------------------------------------------------ */
/* Shared inline-edit sub-components                                   */
/* ------------------------------------------------------------------ */

type FieldVariant = 'ghost' | 'bordered';

const GHOST_TEXTAREA_BASE = 'w-full bg-transparent border border-dashed border-tea-accent-sub focus:border-solid focus:border-tea-accent-sub focus:bg-tea-gold/[0.06] rounded-md py-1.5 px-2 outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg transition-all resize-none text-xs leading-relaxed whitespace-pre-line placeholder-tea-text-dim min-h-[80px] overflow-hidden';
// Bordered variant uses the admin neutral palette: dark recessed bg, ghost border, gold focus accent.
const BORDERED_TEXTAREA_BASE = 'admin-input w-full py-2 px-3 resize-none text-ui-14 leading-relaxed whitespace-pre-line min-h-[88px]';

export const GhostTextarea = ({
  value, onSave, className = '', placeholder = '', rows = 3, ariaLabel, variant = 'ghost',
}: {
  value: string;
  onSave: (val: string) => void | Promise<void>;
  className?: string;
  placeholder?: string;
  rows?: number;
  ariaLabel?: string;
  variant?: FieldVariant;
}) => {
  const [localValue, setLocalValue] = useState(value);
  const [justSaved, setJustSaved] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const savingRef = useRef(false);
  const errorRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  useEffect(() => { if (!savingRef.current && !errorRef.current) setLocalValue(value); }, [value]);
  const handleBlur = async () => {
    if (savingRef.current || localValue === value) return;
    savingRef.current = true; setSaving(true); setSaveError(''); errorRef.current = false;
    try {
      await onSave(localValue); setJustSaved(true);
      setTimeout(() => setJustSaved(false), 600);
    } catch (error) { errorRef.current = true; setSaveError(error instanceof Error ? error.message : 'Save failed. Retry.'); }
    finally { savingRef.current = false; setSaving(false); }
  };
  useEffect(() => {
    const el = textareaRef.current;
    if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }
  }, [localValue]);
  const base = variant === 'bordered' ? BORDERED_TEXTAREA_BASE : GHOST_TEXTAREA_BASE;
  return (
    <span className="block min-w-0 w-full"><textarea
      ref={textareaRef}
      disabled={saving}
      aria-invalid={Boolean(saveError)}
      aria-label={ariaLabel}
      value={localValue || ''}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={handleBlur}
      placeholder={placeholder}
      rows={rows}
      autoComplete="off"
      autoCorrect="off"
      spellCheck={false}
      data-1p-ignore
      data-lpignore="true"
      className={`${base} ${justSaved ? '!text-tea-gold' : ''} ${className}`}
    />{saving && <span role="status" className="text-ui-10 text-tea-text-sec">Saving…</span>}{saveError && <span role="alert" className="text-ui-11 text-tea-text-sec">{saveError} <button type="button" onClick={() => void handleBlur()} className="tap-target underline">Retry save</button></span>}</span>
  );
};

const GHOST_INPUT_BASE = 'w-full bg-transparent border-0 border-b-0 hover:border-b hover:border-tea-accent-sub focus:border-b focus:border-tea-gold/40 focus:bg-tea-gold/[0.03] rounded-none py-1 px-0 outline-none focus-visible:ring-0 transition-colors placeholder-tea-text-dim/60 leading-none';
// Both BORDERED_INPUT and BORDERED_SELECT must compute to the SAME box height:
//   2*8px py + 14px font * 1.25 leading + 2px border = 35.5px. Don't change one
//   without changing the other.
const BORDERED_INPUT_BASE = 'admin-input w-full h-9 py-2 px-3 text-ui-14 leading-tight';

export const GhostInput = ({
  value, onSave, type = 'text', align = 'left', className = '', placeholder = '', inputMode, id, ariaLabel, variant = 'ghost', disabled = false,
}: {
  value: string | number;
  onSave: (val: any) => void | Promise<void>;
  type?: 'text' | 'number';
  align?: 'left' | 'right';
  className?: string;
  placeholder?: string;
  inputMode?: string;
  id?: string;
  ariaLabel?: string;
  variant?: FieldVariant;
  /** For a field with no honest value to show, such as a freight rate whose
   *  currency the shop has no rate for. Reads, but cannot be saved. */
  disabled?: boolean;
}) => {
  const [localValue, setLocalValue] = useState(value);
  const savingRef = useRef(false);
  const errorRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  useEffect(() => { if (!savingRef.current && !errorRef.current) setLocalValue(value); }, [value]);
  const [justSaved, setJustSaved] = useState(false);
  const handleBlur = async () => {
    if (disabled || savingRef.current || String(localValue ?? '') === String(value ?? '')) return;
    savingRef.current = true; setSaving(true); setSaveError(''); errorRef.current = false;
    try {
      await onSave(localValue); setJustSaved(true);
      setTimeout(() => setJustSaved(false), 600);
    } catch (error) { errorRef.current = true; setSaveError(error instanceof Error ? error.message : 'Save failed. Retry.'); }
    finally { savingRef.current = false; setSaving(false); }
  };
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') e.currentTarget.blur();
  };
  const base = variant === 'bordered' ? BORDERED_INPUT_BASE : GHOST_INPUT_BASE;
  return (
    <span className="block min-w-0 w-full"><input
      id={id}
      aria-label={ariaLabel}
      disabled={disabled || saving}
      aria-invalid={Boolean(saveError)}
      type={type}
      /* A zero is a value, not an absence. `localValue || ''` blanked it, so a
         freight rate of zero (Adrian saying this tea ships free) looked exactly
         like a field nobody had filled in, in the one control that tells those
         two apart. Same for a stock or a cost of zero anywhere else this input
         is used. */
      value={localValue === 0 ? '0' : (localValue ?? '')}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      inputMode={inputMode || (type === 'number' ? 'decimal' : undefined) as any}
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
      data-1p-ignore
      data-lpignore="true"
      className={`${base} text-${align} ${justSaved ? '!text-tea-gold' : ''} ${className}`}
    />{saving && <span role="status" className="text-ui-10 text-tea-text-sec">Saving…</span>}{saveError && <span role="alert" className="text-ui-11 text-tea-text-sec">{saveError} <button type="button" onClick={() => void handleBlur()} className="tap-target underline">Retry save</button></span>}</span>
  );
};

export const GhostAutocompleteInput = ({
  value, onSave, suggestions, itemData, onAutoFill, className = '', placeholder = '', variant = 'ghost',
}: {
  value: string;
  onSave: (val: string) => void | Promise<void>;
  suggestions: string[];
  itemData?: Record<string, any>;
  onAutoFill?: (data: any) => void;
  className?: string;
  placeholder?: string;
  variant?: FieldVariant;
}) => {
  const [localValue, setLocalValue] = useState(value);
  const localValueRef = useRef(value);
  const [justSaved, setJustSaved] = useState(false);
  const [saveError,setSaveError]=useState('');
  const savingRef=useRef(false);
  const errorRef=useRef(false);
  useEffect(() => {
    if (!savingRef.current && !errorRef.current) {setLocalValue(value); localValueRef.current = value;}
  }, [value]);
  const save = useCallback(async (val: string) => {
    if (val === value || savingRef.current) return;
    savingRef.current=true;errorRef.current=false;setSaveError('');
    try {await onSave(val);setJustSaved(true);setTimeout(()=>setJustSaved(false),600);}
    catch(error){errorRef.current=true;setSaveError(error instanceof Error?error.message:'Save failed. Retry.');}
    finally{savingRef.current=false;}
  }, [value, onSave]);
  const handleChange = (val: string) => { localValueRef.current = val; setLocalValue(val); };
  const handleSelect = (data: any) => { save(localValueRef.current); onAutoFill?.(data); };
  const base = variant === 'bordered' ? BORDERED_INPUT_BASE : GHOST_INPUT_BASE;
  return (
    <div
      className="flex-1 min-w-0"
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) save(localValueRef.current); }}
    >
      <AutocompleteInput
        value={localValue}
        onChange={handleChange}
        suggestions={suggestions}
        itemData={itemData}
        onSelect={handleSelect}
        placeholder={placeholder}
        className={`${base} text-left ${justSaved ? '!text-tea-gold' : ''} ${className}`}
      />
<span role="alert" className="text-ui-11 text-tea-text-sec">{saveError}{saveError && <button type="button" className="tap-target underline" onClick={()=>void save(localValueRef.current)}>Retry save</button>}</span>
    </div>
  );
};

const GHOST_SELECT_BASE = 'w-full bg-transparent border-0 border-b-0 hover:border-b hover:border-tea-accent-sub focus:border-b focus:border-tea-gold/40 focus:bg-tea-gold/[0.03] rounded-none py-1 px-0 pr-4 outline-none focus-visible:ring-0 transition-colors text-left appearance-none cursor-pointer leading-none';
// h-9 + leading-tight = same height as BORDERED_INPUT_BASE.
const BORDERED_SELECT_BASE = 'admin-input w-full h-9 py-2 pl-2.5 pr-6 text-ui-14 leading-tight text-left appearance-none cursor-pointer';

export const GhostSelect = ({ value, onSave, options, className = '', ariaLabel, variant = 'ghost' }: {
  value: string; onSave: (val: string) => void | Promise<void>; options: string[]; className?: string; ariaLabel?: string; variant?: FieldVariant;
}) => {
  const [saveError,setSaveError]=useState('');
  const [saving,setSaving]=useState(false);
  const change=async(value:string)=>{setSaving(true);setSaveError('');try{await onSave(value)}catch(error){setSaveError(error instanceof Error?error.message:'Save failed. Choose it again to retry.')}finally{setSaving(false)}};
  const base = variant === 'bordered' ? BORDERED_SELECT_BASE : GHOST_SELECT_BASE;
  const chevronPos = variant === 'bordered' ? 'right-2' : 'right-0';
  return (
    <div className="relative flex-1">
      <select
        aria-label={ariaLabel}
        value={value}
        disabled={saving}
        onChange={(e) => void change(e.target.value)}
        className={`${base} ${className}`}
      >
        {options.map(opt => (
          <option key={opt} value={opt} className="bg-tea-surface text-tea-text">{opt}</option>
        ))}
      </select>
      <ChevronDown size={variant === 'bordered' ? 12 : 10} aria-hidden="true" className={`absolute ${chevronPos} top-1/2 -translate-y-1/2 text-tea-text-dim/70 pointer-events-none`} />
      {saveError && <span role="alert" className="text-ui-11 text-tea-text-sec">{saveError}</span>}
    </div>
  );
};

export const VendorPicker = ({ value, onChange, productId, className }: {
  value: string; onChange: (name: string) => void; productId?: string; className?: string;
}) => {
  const { data: customers = [], refetch: refetchCustomers } = useCustomers();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [vendorError, setVendorError] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [facesOpen, setFacesOpen] = useState(false);
  // Opening the faces fetches the list again, so a face added a moment ago
  // (on another device, or on the vendor's page) shows straight away.
  useEffect(() => { if (facesOpen) void refetchCustomers(); }, [facesOpen]); // eslint-disable-line react-hooks/exhaustive-deps
  const faceVendors = useMemo(
    () => customers.filter(c => c.tags?.includes('vendor')).map(c => toFaceVendor(c)),
    [customers]
  );
  const photoByName = useMemo(
    () => new Map(faceVendors.map(v => [v.name.toLowerCase(), v.photo])),
    [faceVendors]
  );

  const vendors = useMemo(
    () => customers.filter(c => c.tags?.includes('vendor')).map(c => c.name).sort((a, b) => a.localeCompare(b)),
    [customers]
  );
  const allOptions = useMemo(() => {
    const set = new Set(vendors);
    if (value && !set.has(value)) set.add(value);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [vendors, value]);
  const filtered = useMemo(() => {
    if (!query) return allOptions;
    const q = query.toLowerCase();
    return allOptions.filter(v => v.toLowerCase().includes(q));
  }, [allOptions, query]);

  useEffect(() => { setQuery(value); }, [value]);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const isNew = query.trim() && !vendors.some(v => v.toLowerCase() === query.trim().toLowerCase());

  const handleSelectVendor = async (name: string) => {
    if (/\p{Script=Han}/u.test(name)) { setVendorError('Use an English supplier name. Keep Chinese in the supplier’s Chinese name field.'); return; }
    setVendorError('');
    onChange(name);
    setOpen(false);
    if (!name) return;
    let vendorCustomer = customers.find(c => c.name.toLowerCase() === name.toLowerCase());
    if (!vendorCustomer) {
      try {
        const created = await api.customers.create({ name, tags: ['vendor'] });
        refetchCustomers();
        if (productId && created?.id) await api.customers.linkProduct(created.id, productId);
        return;
      } catch (err) { console.error('Failed to create vendor customer:', err); return; }
    }
    if (!vendorCustomer.tags?.includes('vendor')) {
      try {
        await api.customers.update(vendorCustomer.id, { tags: [...(vendorCustomer.tags || []), 'vendor'] });
        refetchCustomers();
      } catch (err) { console.error('Failed to add vendor tag:', err); }
    }
    if (productId && vendorCustomer.id) {
      try { await api.customers.linkProduct(vendorCustomer.id, productId); } catch { /* link may exist */ }
    }
  };

  return (
    <div ref={wrapperRef} className="relative flex-1">
      <div className="flex items-center gap-1 min-w-0">
      <input
        type="text"
        value={query}
        onChange={e => { setVendorError(''); setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => { setTimeout(() => { setQuery(value); setOpen(false); }, 150); }}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); const name = query.trim(); if (!name || allOptions.some(option => option.toLowerCase() === name.toLowerCase())) handleSelectVendor(name); else setOpen(true); } }}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        data-1p-ignore
        data-lpignore="true"
        className={className}
        aria-label="Supplier for this tea"
        placeholder="Pick a supplier for this tea..."
      />
      <VendorFacesButton onClick={() => { setOpen(false); setFacesOpen(true); }} label="" />
      </div>
      <VendorFaceSheet
        open={facesOpen}
        onClose={() => setFacesOpen(false)}
        vendors={faceVendors}
        selectedName={value}
        onPick={v => { setQuery(v.name); void handleSelectVendor(v.name); }}
      />
      {vendorError && <p role="alert" className="mt-1 text-ui-12 text-tea-text-sec">{vendorError}</p>}
      {open && (filtered.length > 0 || (query.trim() && isNew)) && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-tea-surface border border-tea-accent-sub rounded-xl shadow-lg max-h-48 overflow-y-auto">
          {isNew && query.trim() && (
            <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => handleSelectVendor(query.trim())}
              className="w-full text-left px-3 py-2 text-xs text-tea-gold hover:bg-tea-bg transition-colors border-b border-tea-accent-sub">
              + Add "{query.trim()}" as new source
            </button>
          )}
          {filtered.map(v => (
            <button key={v} type="button" onMouseDown={e => e.preventDefault()} onClick={() => { setQuery(v); handleSelectVendor(v); }}
              className={`w-full text-left px-3 py-2 text-xs hover:bg-tea-bg transition-colors flex items-center gap-2 ${v === value ? 'text-tea-gold font-medium' : 'text-tea-text'}`}>
              <VendorFace name={v} photo={photoByName.get(v.toLowerCase())} size={24} />
              <span className="truncate">{v}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export const CollapsibleSection = ({ title, description, defaultOpen = true, mobileDefault, children }: {
  title: string; description?: string; defaultOpen?: boolean; mobileDefault?: boolean; children: React.ReactNode;
}) => {
  const [open, setOpen] = useState(() => {
    if (mobileDefault !== undefined && typeof window !== 'undefined' && !window.matchMedia('(min-width: 768px)').matches) {
      return mobileDefault;
    }
    return defaultOpen;
  });
  return (
    <div className="admin-card mx-3 mb-3 overflow-hidden">
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="w-full flex items-start justify-between gap-3 px-4 py-3.5 group text-left">
        <div className="min-w-0">
          <span className="block font-sans text-ui-14 font-medium text-admin-text leading-[1.35]">{title}</span>
          {description && (
            <span className="block text-ui-13 text-admin-text-sec leading-[1.5] mt-1">{description}</span>
          )}
        </div>
        <ChevronRight size={14} aria-hidden="true" className={`mt-1 shrink-0 text-admin-text-dim transition-transform duration-200 group-hover:text-admin-text-sec ${open ? 'rotate-90' : ''}`} />
      </button>
      <div className="grid transition-[grid-template-rows] duration-200 ease-out" style={{ gridTemplateRows: open ? '1fr' : '0fr' }}>
        <div className="overflow-hidden">
          <div className="px-4 pb-4 pt-1 border-t border-admin-border">{children}</div>
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Field primitives for the Quick Entry block                          */
/* ------------------------------------------------------------------ */

/** Labeled cell in a multi-column quick-entry row. Caps label above input. */
export const FieldCell = ({ label, labelAdornment, children }: {
  label: string;
  labelAdornment?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <label className="flex flex-col gap-1.5 min-w-0">
    <span className="text-ui-11 text-admin-text-dim uppercase tracking-[0.08em] flex items-center gap-1 leading-none">
      {label}
      {labelAdornment}
    </span>
    <div className="flex items-center min-w-0">{children}</div>
  </label>
);

/** Multi-column row of FieldCells. cols=2 -> 2-up; cols=3 -> 3-up. */
export const FieldGrid = ({ cols, children }: { cols: 2 | 3; children: React.ReactNode }) => (
  <div className={`mt-4 grid gap-x-3 gap-y-4 ${cols === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
    {children}
  </div>
);

/** Single full-width labeled row. */
export const FieldRowFull = ({ label, labelAdornment, children }: {
  label: string;
  labelAdornment?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <div className="mt-4 flex flex-col gap-1.5">
    <span className="text-ui-11 text-admin-text-dim uppercase tracking-[0.08em] flex items-center gap-1.5 leading-none">
      {label}
      {labelAdornment}
    </span>
    <div className="flex items-center min-w-0">{children}</div>
  </div>
);

/** Hairline divider between logical sub-groups in Quick Entry. */
export const FieldGroupDivider = () => (
  <div className="mt-5 mb-1 border-t border-admin-border" />
);

/* ------------------------------------------------------------------ */
/* Tasting notes editor, listed inside the Story & background section */
/* ------------------------------------------------------------------ */

/** Inline microphone button. Mirrors the standalone VoiceRecorder logic
 *  but renders as a compact inline pill so it can sit alongside an
 *  "Add note" button instead of as a fixed floating action button. */
const InlineMicButton: React.FC<{ onTranscript: (text: string) => void }> = ({ onTranscript }) => {
  const [state, setState] = useState<'idle' | 'recording' | 'transcribing'>('idle');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const mountedRef = useRef(true);
  useEffect(() => () => {
    mountedRef.current = false;
    streamRef.current?.getTracks().forEach(t => t.stop());
  }, []);

  const pickMime = () => {
    if (typeof MediaRecorder === 'undefined') return 'audio/mp4';
    for (const m of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/wav']) {
      if (MediaRecorder.isTypeSupported(m)) return m;
    }
    return 'audio/mp4';
  };

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mountedRef.current) { stream.getTracks().forEach(t => t.stop()); return; }
      streamRef.current = stream;
      const mime = pickMime();
      const rec = new MediaRecorder(stream, { mimeType: mime });
      recorderRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        const blob = new Blob(chunksRef.current, { type: mime });
        chunksRef.current = [];
        if (blob.size < 100) { if (mountedRef.current) setState('idle'); return; }
        if (mountedRef.current) setState('transcribing');
        try {
          const result = await api.transcribeAudio(blob);
          if (!mountedRef.current) return;
          if (result.text && result.text.trim()) onTranscript(result.text.trim());
        } catch { /* silent */ }
        finally { if (mountedRef.current) setState('idle'); }
      };
      rec.start(250);
      setState('recording');
    } catch {
      setState('idle');
    }
  };
  const stop = () => recorderRef.current?.stop();

  const recording = state === 'recording';
  const transcribing = state === 'transcribing';

  return (
    <button
      type="button"
      onClick={recording ? stop : start}
      disabled={transcribing}
      aria-label={recording ? 'Stop recording' : transcribing ? 'Transcribing' : 'Record voice note'}
      className={`admin-pill ${recording ? 'admin-pill-on' : ''}`}
    >
      {recording ? <Square size={10} fill="currentColor" /> : transcribing ? <Loader2 size={10} className="animate-spin" /> : <Mic size={10} />}
      {recording ? 'Stop' : transcribing ? 'Transcribing' : 'Record'}
    </button>
  );
};

/** One row in the notes list, textarea with inline save on blur + delete. */
const TastingNoteRow: React.FC<{
  value: string;
  onSave: (text: string) => void;
  onDelete: () => void;
  autoFocus?: boolean;
}> = ({ value, onSave, onDelete, autoFocus }) => {
  const [local, setLocal] = useState(value);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => setLocal(value), [value]);
  useEffect(() => {
    const el = ref.current;
    if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }
  }, [local]);
  useEffect(() => { if (autoFocus) ref.current?.focus(); }, [autoFocus]);
  return (
    <div className="flex items-start gap-2">
      <textarea
        ref={ref}
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => { if (local !== value) onSave(local); }}
        rows={1}
        placeholder="Note…"
        className="admin-input flex-1 py-1.5 px-2.5 text-ui-13 leading-[1.45] resize-none min-h-0"
      />
      <button
        type="button"
        onClick={onDelete}
        aria-label="Delete note"
        title="Delete note"
        className="shrink-0 p-1 mt-0.5 text-admin-text-dim hover:text-admin-text rounded-md transition-colors"
      >
        <XIcon size={13} />
      </button>
    </div>
  );
};

const TastingNotesEditor: React.FC<{
  product: Product;
  onUpdate?: (id: string, field: keyof Product, value: any) => void | Promise<void>;
  onOpenFullEditor: () => void;
}> = ({ product, onUpdate, onOpenFullEditor }) => {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [autoFocusIdx, setAutoFocusIdx] = useState<number | null>(null);

  // Normalize current notes to {text} entries so editing has stable shape.
  const tasting = (product as any).tasting as Record<string, any> | null | undefined;
  const sourceNotes: any[] = useMemo(() => (
    Array.isArray(tasting?.notes) ? tasting!.notes : []
  ), [tasting]);

  // Hoist any legacy single voiceNote into the notes array so the editor
  // can manage it uniformly, saved out via the same pipeline.
  const initialDisplay = useMemo(() => {
    const arr = sourceNotes.map((n: any) => typeof n === 'string' ? { text: n } : { ...n, text: n?.text ?? '' });
    const legacy = typeof tasting?.voiceNote === 'string' && tasting.voiceNote.trim() ? tasting.voiceNote.trim() : null;
    if (legacy && !arr.some((n: any) => n.text === legacy)) arr.push({ text: legacy });
    return arr;
  }, [sourceNotes, tasting]);

  const writeNotes = useCallback(async (nextNotes: any[]) => {
    const nextTasting = { ...(tasting || {}), notes: nextNotes };
    // Optimistic: patch local query cache so the panel reflects immediately.
    queryClient.setQueriesData<Product[]>(
      { predicate: q => Array.isArray(q.queryKey) && q.queryKey[0] === 'products' && q.queryKey[1] !== 'public' },
      (old) => old?.map(p => p.id === product.id ? { ...p, tasting: nextTasting as any } : p),
    );
    try {
      await api.products.updateByDomain(product.id, { tasting: nextTasting });
      if (onUpdate) await onUpdate(product.id, 'tasting' as any, nextTasting);
    } catch (err: any) {
      showToast(`Failed to save note: ${err?.message || 'unknown error'}`, 'error');
    }
  }, [tasting, product.id, queryClient, onUpdate, showToast]);

  const onChangeAt = (i: number, text: string) => {
    const next = [...initialDisplay];
    next[i] = { ...next[i], text };
    writeNotes(next);
  };
  const onDeleteAt = (i: number) => writeNotes(initialDisplay.filter((_, idx) => idx !== i));
  const onAddBlank = () => {
    writeNotes([...initialDisplay, { text: '' }]);
    setAutoFocusIdx(initialDisplay.length);
  };
  const onTranscribed = (text: string) => {
    writeNotes([...initialDisplay, { text }]);
  };

  return (
    <div className="rounded-md border border-admin-border bg-admin-input-bg/40 px-3 py-2.5 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-ui-11 text-admin-text-dim uppercase tracking-[0.06em]">Tasting notes</span>
        <button
          type="button"
          onClick={onOpenFullEditor}
          className="text-ui-11 text-admin-text-sec hover:text-admin-text transition-colors"
          title="Open the full tasting profile editor"
        >
          Full editor ›
        </button>
      </div>

      {product.mood && (
        <p className="text-ui-12 text-admin-text-sec">{product.mood}</p>
      )}

      {initialDisplay.length === 0 ? (
        <p className="text-ui-12 text-admin-text-dim leading-[1.5]">No notes yet. Add one below or tap the mic to record.</p>
      ) : (
        <div className="space-y-1.5">
          {initialDisplay.map((n, i) => (
            <TastingNoteRow
              key={i}
              value={n.text}
              onSave={(text) => onChangeAt(i, text)}
              onDelete={() => onDeleteAt(i)}
              autoFocus={autoFocusIdx === i}
            />
          ))}
        </div>
      )}

      <div className="flex items-center gap-1.5 pt-1">
        <button
          type="button"
          onClick={onAddBlank}
          className="admin-pill"
          aria-label="Add note"
        >
          <Plus size={10} /> Add note
        </button>
        <InlineMicButton onTranscript={onTranscribed} />
      </div>
    </div>
  );
};

// Slot index → stable R2 slot key the worker uses for in-place writes.
// Slot 3 is the bag photo: the capture-time bag shot keeps its own slot so
// product photo edits never displace it. Replaceable, but not removable.
const SLOT_KEYS = ['main', '1', '2', 'bag'] as const;
type SlotKey = typeof SLOT_KEYS[number];
const BAG_SLOT = 3;

export const ImageManager = ({ product, onUpdate }: {
  product: Product; onUpdate: (field: keyof Product, value: any) => void | Promise<void>;
}) => {
  const [uploadingSlot, setUploadingSlot] = useState<number | null>(null);
  const [justUploadedSlot, setJustUploadedSlot] = useState<number | null>(null);
  const [enhancingSlot, setEnhancingSlot] = useState<number | null>(null);
  const [cropper, setCropper] = useState<{ source: File | string; slotIndex: number } | null>(null);
  const cropPhotoUrl = useCapturePhotoUrl(typeof cropper?.source === 'string' ? cropper.source : undefined, true);
  const [openMenu, setOpenMenu] = useState<number | null>(null);
  const { showToast } = useToast();
  const account = useAppStore((s) => s.activeAccount);
  const hasOpenAIKey = Boolean((account as any)?.has_openai_key);

  const images = [product.imageUrl || '', ...(product.additionalImages || [])].slice(0, 3);
  while (images.length < 3) images.push('');
  images.push(product.bagPhotoUrl || '');

  const writeSlot = async (slotIndex: number, url: string) => {
    if (slotIndex === 0) {
      await onUpdate('imageUrl', url);
    } else if (slotIndex === BAG_SLOT) {
      await onUpdate('bagPhotoUrl' as keyof Product, url);
    } else {
      const additional = [...(product.additionalImages || [])];
      additional[slotIndex - 1] = url;
      await onUpdate('additionalImages' as keyof Product, additional);
    }
  };

  const uploadCroppedBlob = async (blob: Blob, slotIndex: number) => {
    setUploadingSlot(slotIndex);
    try {
      const url = await api.uploadImage(blob, {
        filename: `${product.id}-${SLOT_KEYS[slotIndex]}-${crypto.randomUUID()}.jpg`,
      });
      await writeSlot(slotIndex, url);
      setJustUploadedSlot(slotIndex);
      setTimeout(() => setJustUploadedSlot(null), 1200);
    } catch (err: any) {
      showToast(`Upload failed: ${err.message}`, 'error');
      throw err;
    } finally {
      setUploadingSlot(null);
    }
  };

  // Open a hidden file input. `useCamera` switches to the rear camera on
  // mobile via the `capture` attribute; on desktop browsers it's ignored
  // and the standard file picker opens.
  const pickFile = (slotIndex: number, useCamera: boolean) => {
    setOpenMenu(null);
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (useCamera) input.setAttribute('capture', 'environment');
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (file) setCropper({ source: file, slotIndex });
    };
    document.body.appendChild(input);
    input.click();
    input.remove();
  };

  const recrop = (slotIndex: number) => {
    setOpenMenu(null);
    const url = images[slotIndex];
    if (!url) return;
    setCropper({ source: url, slotIndex });
  };

  const downloadImage = async (slotIndex: number) => {
    setOpenMenu(null);
    const url = images[slotIndex];
    if (!url) return;
    try {
      const approvalId = getStockCapturePhotoId(url);
      let blob: Blob;
      if (approvalId) {
        const { activeAccountId: accountId, activeUserId: userId } = useAppStore.getState();
        if (!accountId || !userId) throw new Error('Sign in to download this photo.');
        blob = await capturePhotoApi.stockBlob(approvalId, { accountId, userId });
      } else {
        const res = await fetch(url, { mode: 'cors', cache: 'no-cache' });
        if (!res.ok) throw new Error(`Failed to download (${res.status})`);
        blob = await res.blob();
      }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      const safeName = (product.productName || 'product').replace(/[^a-zA-Z0-9-_]+/g, '-').toLowerCase();
      a.download = `${safeName}-${SLOT_KEYS[slotIndex]}.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch (err: any) {
      showToast(`Download failed: ${err.message}`, 'error');
    }
  };

  const handleRemove = async (slotIndex: number) => {
    setOpenMenu(null);
    if (slotIndex === BAG_SLOT) return; // bag photo can be replaced, never removed
    if (slotIndex === 0) await onUpdate('imageUrl', '');
    else {
      const additional = [...(product.additionalImages || [])];
      additional.splice(slotIndex - 1, 1);
      await onUpdate('additionalImages' as keyof Product, additional);
    }
  };

  const handleEnhance = async (slotIndex: number) => {
    setOpenMenu(null);
    if (!hasOpenAIKey) {
      showToast('Add an OpenAI API key in Settings → Integrations to enable AI enhance.', 'error');
      return;
    }
    setEnhancingSlot(slotIndex);
    try {
      const res = await api.products.enhanceImage(product.id, SLOT_KEYS[slotIndex]);
      if (res?.url) {
        await writeSlot(slotIndex, res.url);
        setJustUploadedSlot(slotIndex);
        setTimeout(() => setJustUploadedSlot(null), 1200);
      }
    } catch (err: any) {
      showToast(`AI enhance failed: ${err.message}`, 'error');
    } finally {
      setEnhancingSlot(null);
    }
  };

  const slotLabels = ['Primary', 'Second', 'Third', 'Bag'];
  return (
    <>
      <div className="flex gap-2">
        {images.map((img, i) => (
          <div key={i} className="flex-1 aspect-square relative group">
            {img ? (
              <>
                <CapturePhotoImage src={img} stockPreview alt={slotLabels[i]} className="w-full h-full object-cover rounded-md" loading="lazy" />
                {i === BAG_SLOT ? (
                  <span aria-hidden="true" className="absolute top-1 left-1 px-1.5 h-4 rounded-full bg-tea-bg/80 text-tea-text-dim text-ui-9 font-serif uppercase tracking-[0.08em] flex items-center justify-center">Bag</span>
                ) : (
                  <span aria-hidden="true" className="absolute top-1 left-1 w-4 h-4 rounded-full bg-tea-bg/80 text-tea-text-dim text-ui-10 font-serif tabular-nums flex items-center justify-center">{i + 1}</span>
                )}

                {justUploadedSlot === i ? (
                  <div className="absolute inset-0 rounded-md bg-tea-bg/70 flex items-center justify-center pointer-events-none">
                    <Check size={20} className="text-tea-gold" aria-hidden="true" />
                  </div>
                ) : enhancingSlot === i || uploadingSlot === i ? (
                  <div className="absolute inset-0 rounded-md bg-tea-bg/70 flex items-center justify-center pointer-events-none">
                    <Loader2 size={18} className="text-tea-gold animate-spin" aria-hidden="true" />
                  </div>
                ) : (
                  <>
                    {/* Action menu trigger, always visible top-right so it works on touch */}
                    <button
                      onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === i ? null : i); }}
                      aria-label={`Image actions for ${slotLabels[i].toLowerCase()}`}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-tea-bg/85 border border-tea-border flex items-center justify-center text-tea-text-sec hover:text-tea-text tap-target"
                    >
                      <MoreHorizontal size={12} />
                    </button>

                    {openMenu === i && (
                      <>
                        {/* Click-away overlay */}
                        <button
                          aria-label="Close menu"
                          onClick={() => setOpenMenu(null)}
                          className="fixed inset-0 z-10 cursor-default"
                        />
                        <div
                          role="menu"
                          className="absolute top-8 right-1 z-20 min-w-[150px] bg-tea-bg border border-tea-border rounded-md shadow-lg py-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <SlotMenuItem icon={Crop} label="Re-crop" onClick={() => recrop(i)} />
                          <SlotMenuItem icon={Upload} label="Replace" onClick={() => pickFile(i, false)} />
                          <SlotMenuItem icon={Camera} label="Take photo" onClick={() => pickFile(i, true)} />
                          <SlotMenuItem icon={Download} label="Download" onClick={() => downloadImage(i)} />
                          <SlotMenuItem
                            icon={Wand2}
                            label="AI enhance"
                            onClick={() => handleEnhance(i)}
                            disabled={!hasOpenAIKey}
                            hint={hasOpenAIKey ? undefined : 'Add OpenAI key'}
                          />
                          {i !== BAG_SLOT && (
                            <>
                              <div className="my-1 border-t border-tea-border" />
                              <SlotMenuItem icon={Trash2} label="Remove" onClick={() => void handleRemove(i).catch(error => showToast(`Photo could not be removed: ${error.message}`, 'error'))} destructive />
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </>
                )}
              </>
            ) : (
              <button
                onClick={() => pickFile(i, false)}
                disabled={uploadingSlot !== null}
                aria-label={`Add ${slotLabels[i].toLowerCase()} image`}
                className="w-full h-full rounded-md bg-admin-input hover:bg-admin-elevated transition-colors flex flex-col items-center justify-center gap-1.5 cursor-pointer group"
              >
                {uploadingSlot === i ? (
                  <Loader2 size={16} className="text-admin-text-dim animate-spin" aria-hidden="true" />
                ) : (
                  <>
                    <Plus size={14} className="text-admin-text-dim group-hover:text-admin-text-sec transition-colors" aria-hidden="true" />
                    <span className="text-ui-10 text-admin-text-dim group-hover:text-admin-text-sec uppercase tracking-[0.06em] transition-colors">{slotLabels[i]}</span>
                  </>
                )}
              </button>
            )}
          </div>
        ))}
      </div>

      <SquareCropModal
        isOpen={cropper !== null}
        source={typeof cropper?.source === 'string' ? cropPhotoUrl ?? null : cropper?.source ?? null}
        title={cropper ? `Crop ${slotLabels[cropper.slotIndex].toLowerCase()} photo` : 'Crop photo'}
        onClose={() => setCropper(null)}
        onConfirm={async (blob) => {
          if (!cropper) return;
          await uploadCroppedBlob(blob, cropper.slotIndex);
          setCropper(null);
        }}
      />
    </>
  );
};

const SlotMenuItem = ({
  icon: Icon, label, onClick, destructive, disabled, hint,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  onClick: () => void;
  destructive?: boolean;
  disabled?: boolean;
  hint?: string;
}) => (
  <button
    role="menuitem"
    onClick={onClick}
    disabled={disabled}
    title={hint}
    className={`w-full flex items-center gap-2 px-3 py-1.5 text-ui-12 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed ${
      destructive
        ? 'text-tea-text-sec hover:text-tea-text hover:bg-tea-elevated'
        : 'text-tea-text hover:bg-tea-gold/[0.06]'
    }`}
  >
    <Icon size={13} className={destructive ? 'text-tea-text-sec' : 'text-tea-text-sec'} />
    <span className="flex-1">{label}</span>
    {hint && <span className="text-ui-10 text-tea-text-dim">{hint}</span>}
  </button>
);

/* ------------------------------------------------------------------ */
/* Field → DB column mapping (shared between panel and inventory)      */
/* ------------------------------------------------------------------ */

// Re-exported so `import { ..., buildProductUpdatePayload } from './ProductEditPanel'`
// keeps working; the implementation lives in its own module now.
export { buildProductUpdatePayload } from '../productUpdatePayload';

/* ------------------------------------------------------------------ */
/* ProductEditPanel: the inventory sidebar, now reusable              */
/* ------------------------------------------------------------------ */

export interface ProductEditPanelProps {
  /** The product being edited. When null, the panel is closed. */
  product: Product | null;
  /** Exchange rates for pricing calculations. */
  rates: ExchangeRate[];
  /** Called when the user closes the panel (X button, Esc, backdrop). */
  onClose: () => void;
  /**
   * Called when the user edits a field. The parent is responsible for:
   *   - persisting the change (or let the panel do it if this returns nothing)
   *   - updating the `product` prop so the panel reflects the change
   * If unset, the panel will call the domain-scoped product update endpoint.
   */
  onUpdate?: (id: string, field: keyof Product, value: any) => void | Promise<void>;
  onSaveField?: (id: string, field: keyof Product, value: any) => Promise<void>;
  /**
   * Optional list of other products, used for:
   *   - prev/next navigation (pass products in desired order)
   *   - name-autocomplete suggestions
   */
  products?: Product[];
  /** When navigating via prev/next, called with the new product. */
  onNavigate?: (product: Product) => void;
  /** Label for filter context shown in header (e.g. "Needs Attention"). */
  filterLabel?: string;
  /** Distance from the viewport right edge, in px (desktop only). Lets the panel
   *  sit to the LEFT of the action rail when both are open, so the order reads
   *  spreadsheet -> edit panel -> rail. Ignored on mobile (full-screen overlay). */
  rightOffset?: number;
  /** Open the store preview (the Alcove / shop-card view) for this product.
   *  Surfaced high in the panel so full edit shows how it looks in the shop. */
  onCorrectSupplierName?: (product: Product) => void;
  /** Opens movement-first stock entry instead of directly overwriting stock. */
  onOpenStockMovement?: (product: Product, trigger: HTMLElement) => void;
  /** Phone tea page: Count it opens the movement panel on Recount. */
  onRecount?: (product: Product, trigger: HTMLElement) => void;
  /** Phone tea page: the single-tea actions (collection, publish, invoice...). */
  onTeaAction?: (action: TeaAction, product: Product) => void;
  /** Phone tea page: what is on the way for this tea, if anything. */
  incoming?: { quantity: number; eta?: string | null } | null;
  /** False when this holding is not yet eligible for public shop visibility. */
  canPublish?: boolean;
  canShowWhileCountPending?: boolean;
  publicationProblem?: string | null;
  /** Open the focused Shop listing review when arriving from a Stock card. */
  openListingReview?: boolean;
  listingReturnTo?: string;
  onListingReviewOpened?: () => void;
  /** The row's own tools (list in shop, Photo, Taste, next step), shown on the Shelf tab. */
  shelfTools?: React.ReactNode;
}

function countedDate(at?: string | null): string {
  if (!at) return 'never';
  const d = new Date(at);
  return Number.isNaN(d.getTime()) ? 'never' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const STATUS_COLORS: Record<string, string> = {
  Active: 'var(--admin-text)',
  Draft: 'var(--admin-text-dim)',
  Archived: 'var(--admin-text-sec)',
  'Sold Out': 'var(--tea-error)',
};

const ProductEditPanelImpl: React.FC<ProductEditPanelProps> = ({
  product,
  rates,
  onClose,
  onUpdate,
  onSaveField,
  products = [],
  onNavigate,
  filterLabel,
  rightOffset = 0,
  onCorrectSupplierName,
  onOpenStockMovement,
  onRecount,
  onTeaAction,
  incoming,
  canPublish = true,
  canShowWhileCountPending,
  publicationProblem,
  openListingReview = false,
  listingReturnTo,
  onListingReviewOpened,
  shelfTools,
}) => {
  const navigate = useNavigate();
  /* The part of the page last jumped to. It survives moving to the next tea,
     so a pass through every tea's price is one press of Next per tea. */
  const scrollRef = useRef<HTMLDivElement>(null);
  const [section, setSection] = useState<TeaPageSection | null>(null);
  const scrollToSection = useCallback((target: TeaPageSection, behavior: ScrollBehavior) => {
    const root = scrollRef.current;
    const el = root?.querySelector<HTMLElement>(`#${teaSectionId(target)}`);
    const bar = root?.querySelector<HTMLElement>('[data-testid="tea-page-jump"]');
    if (!root || !el) return;
    const top = el.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop - (bar?.offsetHeight ?? 0);
    root.scrollTo({ top: Math.max(0, top), behavior });
  }, []);
  const jumpTo = useCallback((target: TeaPageSection) => { setSection(target); scrollToSection(target, 'smooth'); }, [scrollToSection]);
  useEffect(() => { if (openListingReview) setSection('listed'); }, [openListingReview]);
  useEffect(() => {
    const show = (event: Event) => {
      const target = ROOM_TAB_TO_SECTION[(event as CustomEvent<string>).detail];
      if (target) window.setTimeout(() => jumpTo(target), 0);
    };
    window.addEventListener('stock-room-tab', show);
    return () => window.removeEventListener('stock-room-tab', show);
  }, [jumpTo]);
  const { showToast } = useToast();
  const panelQueryClient = useQueryClient();
  /* The shop's own freight rate, for teas that have not entered one. Read from
     the hook rather than passed down, because it is one cached row and every
     surface that shows this field needs the same answer. */
  const shopFreight = useShopFreightDefault();
  // The tea's fallback rate: what the server priced from its logistics service, else the shop's.
  const freightFallbackUsd = product ? teaFallbackFreightUsd(product, shopFreight.perKgUsd) : shopFreight.perKgUsd;

  // Stock spine step 2: only the location owner curates what shows in the shop.
  const isOwnerTier = useAppStore(selectIsOwnerTier);
  const canList = useAppStore(state => selectIsOwnerTier(state) || selectHasBundle(state, 'publish'));
  const activeUserId = useAppStore((state) => state.activeUserId);
  const activeAccountId = useAppStore((state) => state.activeAccountId);
  const compassEntries = useTeaCompassStore((s) => s.entries);
  const compassAccountId = useTeaCompassStore(s => s.accountScopeId);
  const sharedRecordId = product ? sharedTeaRecordId(product, compassAccountId === activeAccountId ? compassEntries : []) : undefined;
  const readiness = product ? getTeaReadiness(product) : null;
  const readinessLabels: Record<string, string> = {
    description: 'description', retail_price: 'retail price', classification: 'classification', stock_amount: 'stock amount',
  };
  const missingSentence = readiness?.missing.map(key => readinessLabels[key]).reduce((text, item, index, all) => {
    if (index === 0) return item;
    if (index === all.length - 1) return `${text}${all.length > 2 ? ',' : ''} and ${item}`;
    return `${text}, ${item}`;
  }, '') || '';

  /* What this tea still needs, each one a jump to the part that fixes it. */
  const missingItems: MissingItem[] = [];
  if (product && !product.imageUrl) missingItems.push({ key: 'photo', label: 'Add a photo', section: 'tea' });
  const missingWords: Record<string, [string, TeaPageSection]> = {
    classification: ['Choose the type', 'tea'], retail_price: ['Set a price', 'price'],
    stock_amount: ['Count the stock', 'stock'], description: ['Write the description', 'later'],
  };
  for (const key of readiness?.missing ?? []) {
    const word = missingWords[key];
    if (word) missingItems.push({ key, label: word[0], section: word[1] });
  }
  const missingMarks: Partial<Record<TeaPageSection, boolean>> = {};
  for (const item of missingItems) missingMarks[item.section] = true;

  const [openingOrder, setOpeningOrder] = useState(false);
  const openReorder = async () => {
    if (!sharedRecordId || !product || !activeAccountId || openingOrder) return;
    const accountId = activeAccountId;
    const productId = product.id;
    const recordId = sharedRecordId;
    setOpeningOrder(true);
    try {
      const compass = useTeaCompassStore.getState();
      compass.switchAccount(accountId);
      if (!useTeaCompassStore.getState().getEntry(recordId)) await hydrateCompassEntries(accountId);
      if (useAppStore.getState().activeAccountId !== accountId || useTeaCompassStore.getState().accountScopeId !== accountId) return;
      if (!useTeaCompassStore.getState().getEntry(recordId)) throw new Error('The tea record could not load. Try again.');
      useLedgerStore.getState().switchAccount(accountId);
      const orderId = addTeaToDraftOrder(recordId, productId);
      if (!orderId) throw new Error('The tea could not be added to a draft. Try again.');
      navigate('/admin/compass?tab=ledger');
    } catch (error) { showToast(error instanceof Error ? error.message : 'Could not open a reorder.', 'error'); }
    finally { setOpeningOrder(false); }
  };

  // Local state for modals mounted inside the panel
  const [tastingEditorProduct, setTastingEditorProduct] = useState<Product | null>(null);
  const [qrProduct, setQrProduct] = useState<Product | null>(null);
  const [breakdownOpen, setBreakdownOpen] = useState(false);

  // Events & tasting aggregate
  const [productEvents, setProductEvents] = useState<any[]>([]);
  const [productEventsLoading, setProductEventsLoading] = useState(false);
  // Guests' words only: a guest's score or pick is their own, never averaged or counted.
  const [productTastingAgg, setProductTastingAgg] = useState<{
    totalNotes: number; impressions: string[];
  } | null>(null);

  // Compute prev/next from products array
  const { productIndex, totalCount, prevProduct, nextProduct } = useMemo(() => {
    if (!product || products.length === 0) {
      return { productIndex: -1, totalCount: products.length, prevProduct: null, nextProduct: null };
    }
    const idx = products.findIndex(p => p.id === product.id);
    return {
      productIndex: idx,
      totalCount: products.length,
      prevProduct: idx > 0 ? products[idx - 1] : null,
      nextProduct: idx >= 0 && idx < products.length - 1 ? products[idx + 1] : null,
    };
  }, [product, products]);

  /* A new tea opens at the part last jumped to, or at the top. */
  useEffect(() => {
    if (!product) return;
    const frame = window.requestAnimationFrame(() => {
      if (section) scrollToSection(section, 'auto');
      else scrollRef.current?.scrollTo({ top: 0 });
    });
    return () => window.cancelAnimationFrame(frame);
    // Only a change of tea moves the page; jumping within a tea scrolls itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id]);

  // Autocomplete data
  const nameSuggestions = useMemo(() => {
    if (!product) return [];
    const varieties = getTeaVarietySuggestions(product.type as any);
    const otherNames = products.filter(p => p.id !== product.id && p.productName).map(p => p.productName);
    return [...new Set([...varieties, ...otherNames])];
  }, [product, products]);

  const nameItemData = useMemo(() => {
    if (!product) return {};
    const varietyMap = buildVarietyDataMap(product.type as any);
    const productMap: Record<string, any> = {};
    for (const p of products) if (p.productName && !productMap[p.productName]) productMap[p.productName] = p;
    return { ...varietyMap, ...productMap };
  }, [product, products]);

  // Default onUpdate if parent didn't supply one, persist directly
  const handleUpdate = useCallback(async (id: string, field: keyof Product, value: any) => {
    if (onUpdate) { await onUpdate(id, field, value); return; }
    const payload = buildProductUpdatePayload(field, value);
    if (!payload) return;
    try { await api.products.updateByDomain(id, payload); await refreshCommerceQueries(panelQueryClient, undefined, { changedProductIds: [id] }); }
    catch (err: any) { showToast(`Update failed: ${err.message}`, 'error'); }
  }, [onUpdate, showToast]);

  const persistField = useCallback(async (id:string,field:keyof Product,value:unknown) => {
    if (onSaveField) return onSaveField(id,field,value);
    if (onUpdate) return onUpdate(id,field,value);
    const payload=buildProductUpdatePayload(field,value);
    if (!payload) throw new Error('This field could not be saved.');
    await api.products.updateByDomain(id,payload);
    await refreshCommerceQueries(panelQueryClient, undefined, { changedProductIds: [id] });
  }, [onSaveField,onUpdate,panelQueryClient]);

  // Fetch events / tasting aggregate when product changes
  useEffect(() => {
    if (!product) {
      setProductEvents([]);
      setProductTastingAgg(null);
      return;
    }
    let cancelled = false;
    const loadTastings = async (events: Array<{ id: string }>, productName: string) => {
      try {
        interface TastingNoteRow {
          teaName?: string; rating?: number; isFavorite?: boolean; is_favorite?: boolean; impression?: string;
        }
        const allNotes: TastingNoteRow[] = [];
        for (const event of events.slice(0, 5)) {
          try {
            const notes = await api.events.getTastingNotes(event.id);
            const rawList = Array.isArray(notes) ? notes : (notes as { tasting_notes?: TastingNoteRow[] }).tasting_notes ?? [];
            const productNotes = (rawList as TastingNoteRow[]).filter(n =>
              n.teaName && n.teaName.toLowerCase().includes(productName.toLowerCase())
            );
            allNotes.push(...productNotes);
          } catch { /* skip */ }
        }
        if (!cancelled && allNotes.length > 0) {
          setProductTastingAgg({
            totalNotes: allNotes.length,
            impressions: allNotes.filter(n => n.impression).map(n => n.impression as string).slice(0, 5),
          });
        }
      } catch { /* silent */ }
    };
    const load = async () => {
      setProductEventsLoading(true);
      setProductTastingAgg(null);
      try {
        const data = await api.products.getEvents(product.id);
        const events = Array.isArray(data) ? data : ((data as { events?: Array<{ id: string }> }).events ?? []);
        if (!cancelled) {
          setProductEvents(events);
          if (events.length > 0) loadTastings(events, product.givenName || product.productName || '');
        }
      } catch { if (!cancelled) setProductEvents([]); }
      finally { if (!cancelled) setProductEventsLoading(false); }
    };
    load();
    return () => { cancelled = true; };
  }, [product?.id]);

  // Keyboard nav
  useEffect(() => {
    if (!product) return;
    const handler = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing || (e.target instanceof HTMLElement &&
        (e.target.isContentEditable || e.target.closest('input,textarea,select,[contenteditable="true"],[data-vaul-drawer]')))) return;
      if (e.key === 'Escape') { onClose(); e.preventDefault(); }
      else if (e.key === 'ArrowLeft' && prevProduct && onNavigate) {
        onNavigate(prevProduct); e.preventDefault();
      } else if (e.key === 'ArrowRight' && nextProduct && onNavigate) {
        onNavigate(nextProduct); e.preventDefault();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [product, prevProduct, nextProduct, onNavigate, onClose]);

  // Focus management: trap tab inside the panel, set initial focus, return on close.
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const restoreFocusToRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!product) return;
    // Remember the element to return focus to after close
    restoreFocusToRef.current = (document.activeElement as HTMLElement) ?? null;
    // Move focus into the panel on open
    const t = setTimeout(() => closeButtonRef.current?.focus(), 50);
    return () => {
      clearTimeout(t);
      // Return focus on unmount/close
      const el = restoreFocusToRef.current;
      if (el && typeof el.focus === 'function') el.focus();
    };
  }, [product?.id]);
  // Tab key trap
  useEffect(() => {
    if (!product) return;
    const node = panelRef.current;
    if (!node) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const focusables = node.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement;
      if (e.shiftKey && active === first) { last.focus(); e.preventDefault(); }
      else if (!e.shiftKey && active === last) { first.focus(); e.preventDefault(); }
    };
    node.addEventListener('keydown', onKeyDown);
    return () => node.removeEventListener('keydown', onKeyDown);
  }, [product?.id]);

  const titleId = product ? `panel-title-${product.id}` : undefined;

  /* Units of the tea's cost currency per USD, the one number that turns a
     freight rate entered in dollars into the figure the column stores. 1 when
     the table has no rate for it, which keeps the arithmetic honest rather
     than silently scaling by nothing. */
  const costRateToUsd = useMemo(() => {
    /* 'UNK' rather than 'USD', so a cost with no recorded currency cannot be
       converted and the surface shows a dash. Guessing dollars here is what
       turned a 1,200 CNY invoice into a $1,200 tea.

       Null rather than 1 for the same reason one step along: 'CNY' is the
       'Yuan' row spelled differently, and where it genuinely is not in the
       table there is no figure to show. */
    return rateToUsd(rates, product?.costCurrency || 'UNK');
  }, [product?.costCurrency, rates]);

  // Memoize pricing calc, only recompute when relevant fields change
  const pricingCalc = useMemo(() => {
    if (!product) return null;
    const freight = product.type === 'Teaware' ? 0
      : product.shippingRatePerKg ?? shopRateInCurrency(freightFallbackUsd, costRateToUsd);
    if (freight === null) return null;
    return calculatePricing(
      product.costAmount,
      // The stored rate is in the tea's own cost currency, which is what
      // calculatePricing wants. Nothing recorded means the shop default, and
      // the readout below must show the same freight the shelf is charging.
      // Missing shop or tea FX is refused above rather than priced as free.
      freight,
      product.quantityPurchased || 0,
      product.costCurrency || 'UNK',
      rates,
      product.type === 'Teaware'
    );
  }, [
    product?.costAmount,
    product?.shippingRatePerKg,
    product?.quantityPurchased,
    product?.costCurrency,
    product?.type,
    rates,
    freightFallbackUsd,
    costRateToUsd,
  ]);

  // Memoize tasting flatten, only recompute when product.tasting changes
  const flattenedTastingCount = useMemo(() => {
    const tasting = (product as any)?.tasting;
    return tasting ? flattenTastingNotes(tasting).length : 0;
  }, [(product as any)?.tasting]);

  const statusColor = product ? (STATUS_COLORS[product.status] || 'var(--admin-text-sec)') : 'var(--admin-text-sec)';
  const inventoryCategory: 'tea' | 'teaware' = product?.type === 'Teaware' ? 'teaware' : 'tea';

  return (
    <>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-hidden={!product}
        style={{ backgroundColor: 'var(--admin-bg)', willChange: 'transform', ['--panel-right' as any]: `${rightOffset}px` }}
        className={`fixed inset-0 md:inset-auto md:right-[var(--panel-right)] md:top-0 md:bottom-0 md:w-[360px] lg:w-[420px] xl:w-[440px] z-modal flex flex-col transition-transform duration-300 ease-out ${product ? 'translate-x-0 pointer-events-auto panel-sidebar' : 'translate-x-full pointer-events-none invisible'}`}
      >
        {product && (<>
          {/* Header, Row 1: Nav. Sits on the panel bg with a single hairline border. */}
          <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5 border-b border-admin-border">
            <button
              ref={closeButtonRef}
              onClick={onClose}
              aria-label="Close product panel"
              title="Close (Esc)"
              className="p-2 -ml-0.5 text-admin-text-sec hover:text-admin-text transition-colors rounded-md hover:bg-admin-elevated"
            >
              <XIcon size={17} aria-hidden="true" />
            </button>
            <div className="flex flex-col items-center gap-0">
              <span className="font-mono text-ui-11 text-admin-text-sec tabular-nums leading-none">
                {productIndex >= 0 ? `${productIndex + 1} / ${totalCount}` : ''}
              </span>
              {filterLabel && (
                <span className="text-ui-10 text-admin-text-dim uppercase tracking-[0.06em] leading-none mt-1">
                  {filterLabel}
                </span>
              )}
              {onNavigate && nextProduct && (
                <span data-testid="tea-page-next-at" className="text-ui-11 text-tea-gold leading-none mt-1">
                  Next opens at {section ? sectionLabel(section) : 'the top'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-0">
              <button
                onClick={() => prevProduct && onNavigate?.(prevProduct)}
                aria-label="Previous product"
                title="Previous (←)"
                className="p-2 text-admin-text-sec hover:text-admin-text transition-colors rounded-md hover:bg-admin-elevated disabled:opacity-30"
                disabled={!prevProduct || !onNavigate}
              ><ChevronLeft size={17} aria-hidden="true" /></button>
              <button
                onClick={() => nextProduct && onNavigate?.(nextProduct)}
                aria-label="Next product"
                title="Next (→)"
                className="p-2 text-admin-text-sec hover:text-admin-text transition-colors rounded-md hover:bg-admin-elevated disabled:opacity-30"
                disabled={!nextProduct || !onNavigate}
              ><ChevronRight size={17} aria-hidden="true" /></button>
            </div>
          </div>

          {/* Keyboard hint bar: quiet, single-line */}
          {onNavigate && (
            <div className="hidden md:flex items-center justify-center gap-3 px-4 py-1.5 border-b border-admin-border">
              <span className="text-ui-10 text-admin-text-dim uppercase tracking-[0.06em]">Esc close</span>
              <span className="text-ui-10 text-admin-text-faint">·</span>
              <span className="text-ui-10 text-admin-text-dim uppercase tracking-[0.06em]">← → navigate</span>
            </div>
          )}

          {product.personalOfferSourceId ? <StockOfferSource product={product} titleId={titleId} /> : <div ref={scrollRef} data-room-tab="page" data-testid="tea-page" className="curate-v2 flex-1 overflow-y-auto custom-scrollbar">
            <TeaJumpBar value={section} marked={missingMarks} onJump={jumpTo} />
            <TeaMissing items={missingItems} onJump={jumpTo} />

            {/* THE TEA: photos, name and year, what it is, where it is from. */}
            <TeaSection section="tea" aside={<div className="relative">
              <label className="sr-only" htmlFor={`panel-status-${product.id}`}>Product status</label>
              <select id={`panel-status-${product.id}`} value={product.status} onChange={e => handleUpdate(product.id, 'status', e.target.value)}
                className="admin-input text-ui-11 uppercase tracking-[0.08em] pl-2.5 pr-6 py-1.5 cursor-pointer appearance-none" style={{ color: statusColor }}>
                {['Active', 'Draft', 'Archived', 'Sold Out'].map(s => <option key={s} value={s} className="bg-admin-surface text-admin-text">{s}</option>)}
              </select>
              <ChevronDown size={11} className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-admin-text-dim" aria-hidden="true" />
            </div>}>
              <div id="tea-section-photos" className="tea-page-photos">
                <ImageManager product={product} onUpdate={(field, value) => persistField(product.id, field, value)} />
              </div>
              <div id="tea-section-details" className="tea-page-name">
                <h3 id={titleId} className="sr-only">{product.productName}</h3>
                <GhostAutocompleteInput
                  value={product.productName}
                  placeholder="Name"
                  onSave={(val) => persistField(product.id, 'productName', val)}
                  suggestions={nameSuggestions}
                  itemData={nameItemData}
                  onAutoFill={(data) => {
                    const type = data.type || data.product_type;
                    const region = data.originRegion || data.origin_region;
                    const year = data.year;
                    const chineseName = data.chineseName || data.chinese_name;
                    if (type && !product.type) handleUpdate(product.id, 'type', type);
                    if (region && !product.originRegion) handleUpdate(product.id, 'originRegion', region);
                    if (year && !product.year) handleUpdate(product.id, 'year', year);
                    if (chineseName && !product.chineseName) handleUpdate(product.id, 'chineseName', chineseName);
                  }}
                />
                <div className="tea-page-year">
                  <GhostInput variant="bordered" ariaLabel="Year" placeholder="Year" value={product.year || ''} onSave={(val) => persistField(product.id, 'year', enteredYear(val))} type="text" className="tabular-nums" />
                </div>
              </div>
              <TeaLine label="Given"><GhostInput ariaLabel="Given name" placeholder="Add" align="right" value={product.givenName || ''} onSave={(val) => persistField(product.id, 'givenName', val)} /></TeaLine>
              <TeaLine label="中文"><GhostInput ariaLabel="Chinese name" placeholder="Add" align="right" value={product.chineseName || ''} onSave={(val) => persistField(product.id, 'chineseName', val)} /></TeaLine>
              {inventoryCategory === 'teaware' ? <div className="tea-page-split">
                <TeaLine label="Category"><GhostInput ariaLabel="Category" placeholder="Add" align="right" value={product.teawareCategory || ''} onSave={(val) => persistField(product.id, 'teawareCategory', val)} /></TeaLine>
                <TeaLine label="Material"><GhostInput ariaLabel="Material" placeholder="Add" align="right" value={product.material || ''} onSave={(val) => persistField(product.id, 'material', val)} /></TeaLine>
              </div> : <>
                <div className="tea-page-split">
                  <TeaLine label="Type"><GhostSelect ariaLabel="Type" value={product.type} onSave={(val) => persistField(product.id, 'type', val)} options={[...INVENTORY_TEA_TYPES, 'Misc']} /></TeaLine>
                  <TeaLine label="Form"><GhostSelect ariaLabel="Form" value={product.form || ''} onSave={(val) => persistField(product.id, 'form', val)} options={['Loose', 'Cake', 'Tuo', 'Brick', 'Rolled', 'Ball', 'Powder', 'Bag', 'Other']} /></TeaLine>
                </div>
                {/* Only pressed or sealed tea has a piece, and only this tells the
                    shop how heavy it is. Left blank the shop offers no whole
                    piece, which beats a guessed weight and so a guessed price. */}
                {((product.form && ['Cake', 'Tuo', 'Brick', 'Ball'].includes(product.form)) || product.soldInWholeUnits) && (
                  <TeaLine label={product.soldInWholeUnits ? 'One unit weighs' : 'One piece weighs'}>
                    <GhostInput ariaLabel={product.soldInWholeUnits ? 'One unit weighs (g)' : 'One piece weighs (g)'} placeholder="Add" align="right" type="number" className="tabular-nums"
                      value={product.pieceWeightG != null ? String(product.pieceWeightG) : ''} onSave={(val) => persistField(product.id, 'pieceWeightG', val)} />
                    <span className="text-ui-12 text-admin-text-dim">g</span>
                  </TeaLine>
                )}
              </>}
              <div className="tea-page-split">
                <TeaLine label="Country"><GhostInput ariaLabel="Country" placeholder="Add" align="right" value={product.originCountry || ''} onSave={(val) => persistField(product.id, 'originCountry', val)} /></TeaLine>
                <TeaLine label="Region"><GhostInput ariaLabel="Region" placeholder="Add" align="right" value={product.originRegion || ''} onSave={(val) => persistField(product.id, 'originRegion', val)} /></TeaLine>
              </div>
              <TeaLine label="From">
                <VendorPicker value={product.vendor || ''} productId={product.id} onChange={(val) => handleUpdate(product.id, 'vendor', val)} className="w-full bg-transparent border-0 text-right text-ui-15 text-admin-text outline-none" />
              </TeaLine>
              <div className="tea-page-note flex flex-wrap gap-x-4 gap-y-1">
                {product.vendor && (onCorrectSupplierName
                  ? <button type="button" className="tap-target text-tea-gold" onClick={() => onCorrectSupplierName(product)}>Correct the supplier name everywhere</button>
                  : <button type="button" className="tap-target text-tea-gold" onClick={() => navigate(`/admin/people?tab=sources&search=${encodeURIComponent(product.vendor || '')}`)}>Supplier profile</button>)}
                {sharedRecordId && <button type="button" data-testid="inventory-open-tea-record" data-compass-entry-id={sharedRecordId}
                  onClick={() => navigate(sharedTeaRecordHref(sharedRecordId))} className="tap-target text-tea-gold">View in Library</button>}
                {sharedRecordId && <button type="button" data-testid="inventory-reorder-ledger" disabled={openingOrder}
                  onClick={() => void openReorder()} className="tap-target text-tea-gold disabled:opacity-50">{openingOrder ? 'Opening draft…' : 'Reorder in Ledger'}</button>}
                {readiness?.state === 'not_ready' && !sharedRecordId && (
                  <button type="button" data-compass-entry-id={product.sourceCompassEntryId || undefined} className="tap-target text-tea-gold"
                    onClick={() => navigate(product.sourceCompassEntryId
                      ? `/admin/compass?tab=sourcing&entry=${encodeURIComponent(product.sourceCompassEntryId)}`
                      : `/admin/compass?tab=sourcing&developProduct=${encodeURIComponent(product.id)}&developName=${encodeURIComponent(product.givenName || product.productName)}&developType=${encodeURIComponent(product.type)}`)}
                  >Develop in Curate</button>
                )}
              </div>
            </TeaSection>

            {/* PRICE: what it cost, the freight inside it, what it sells for. */}
            <TeaSection section="price" aside={<span className="curate-v2-label">{inventoryCategory === 'teaware' ? 'each' : 'per gram'}</span>}>
              {inventoryCategory === 'teaware' ? <>
                <TeaLine label="It cost"><GhostInput ariaLabel="Cost" placeholder="Add" align="right" value={product.costAmount ?? ''} onSave={(val) => persistField(product.id, 'costAmount', val)} type="number" className="tabular-nums" /></TeaLine>
                <TeaLine label="Sells for"><span className="text-ui-12 text-admin-text-dim">$</span><GhostInput ariaLabel="Retail price" placeholder="Set a price" align="right" value={product.pricePerGramUSD ?? ''} onSave={(val) => persistField(product.id, 'pricePerGramUSD', val)} type="number" className="tabular-nums" /></TeaLine>
              </> : <>
                <TeaLine label="It cost">
                  <GhostInput ariaLabel="Cost" placeholder="Add" align="right" value={product.costAmount ?? ''} onSave={(val) => persistField(product.id, 'costAmount', val)} type="number" className="tabular-nums" />
                  {/* A currency nobody recorded shows as "—", never as a guessed USD:
                      that guess is how a 1,200 CNY invoice once read as $1,200. */}
                  <label className="relative shrink-0 cursor-pointer">
                    <select
                      value={product.costCurrency || 'UNK'}
                      onChange={(e) => handleUpdate(product.id, 'costCurrency', e.target.value)}
                      className={`bg-transparent border-0 outline-none text-ui-12 uppercase tracking-[0.06em] cursor-pointer appearance-none${product.costCurrency ? ' text-admin-text-sec' : ' text-tea-error'}`}
                      aria-label="Cost currency"
                      title={product.costCurrency ? undefined : 'No currency recorded. The cost is a number with no unit.'}
                    >
                      <option value="UNK" className="bg-admin-surface text-admin-text">—</option>
                      {['USD', 'NT', 'Yuan', 'IDR', 'JPY', 'MYR', 'HKD'].map(c => (
                        <option key={c} value={c} className="bg-admin-surface text-admin-text">{isoCurrencyCode(c)}</option>
                      ))}
                    </select>
                  </label>
                </TeaLine>
                <TeaLine label="For a batch of">
                  <GhostInput ariaLabel="Batch grams" align="right" value={product.quantityPurchased || 0} onSave={(val) => persistField(product.id, 'quantityPurchased', val)} type="number" className="tabular-nums" />
                  <span className="text-ui-12 text-admin-text-dim">g</span>
                </TeaLine>
                <TeaFreight product={product} shopPerKgUsd={shopFreight.perKgUsd} rates={rates} costRateToUsd={costRateToUsd}
                  onChoose={(serviceId) => persistField(product.id, 'freightServiceId', serviceId)}
                  onOpenLogistics={() => navigate('/admin/purchase-orders')} />
                {(() => {
                  const calc = pricingCalc && pricingCalc.suggestedRetailUSD > 0 ? pricingCalc : null;
                  const hasOverride = product.fixedRetailPriceUSD != null;
                  const overrideBelowCost = calc && hasOverride && product.fixedRetailPriceUSD! < calc.trueCostUSD;
                  return <>
                    <TeaLine label="Sells for">
                      <span className="text-ui-12 text-admin-text-dim">$</span>
                      <GhostInput
                        ariaLabel="Shop price per gram"
                        align="right"
                        value={product.fixedRetailPriceUSD ?? ''}
                        placeholder={calc ? calc.suggestedRetailUSD.toFixed(2) : 'Set a price'}
                        onSave={(val) => persistField(product.id, 'fixedRetailPriceUSD', val === '' || val === null ? null : Number(val))}
                        type="number"
                        className="tabular-nums"
                      />
                      <span className="text-ui-12 text-admin-text-dim">/ g</span>
                    </TeaLine>
                    {calc && <div className="tea-page-note">
                      {overrideBelowCost && <span className="text-tea-error">Below what it cost you. </span>}
                      Cost and freight, times 3, comes to <span className="font-mono text-admin-text-sec">${calc.suggestedRetailUSD.toFixed(2)} / g</span>
                      {hasOverride ? '. ' : ', which is what the shop charges. '}
                      <button type="button" aria-expanded={breakdownOpen} className="tap-target text-tea-gold" onClick={() => setBreakdownOpen(!breakdownOpen)}>{breakdownOpen ? 'Hide the sums' : 'Show the sums'}</button>
                      {breakdownOpen && <div className="mt-2 space-y-1.5">
                        <div className="flex justify-between"><span>Source cost / g</span><span className="text-admin-text tabular-nums">{calc.costPerGramSource.toFixed(3)} {product.costCurrency || '—'}</span></div>
                        <div className="flex justify-between"><span>Exchange rate</span><span className="text-admin-text tabular-nums">{calc.rateUsed}</span></div>
                        <div className="flex justify-between"><span>True cost (USD)</span><span className="text-admin-text tabular-nums">${calc.trueCostUSD.toFixed(3)} / g</span></div>
                        <div className="flex justify-between"><span>3× markup</span><span className="text-admin-text tabular-nums">${calc.suggestedRetailUSD.toFixed(2)} / g</span></div>
                      </div>}
                    </div>}
                  </>;
                })()}
              </>}
            </TeaSection>

            {/* STOCK: how much is on the shelf, when it was counted, what is coming. */}
            <TeaSection section="stock" aside={<span className="curate-v2-label">{inventoryCategory === 'teaware' ? 'pieces' : 'grams'}</span>}>
              {inventoryCategory === 'teaware' ? <>
                <TeaLine label="On the shelf">
                  <button type="button" aria-label={`Change stock for ${product.productName || product.givenName}`} onClick={(event) => onOpenStockMovement?.(product, event.currentTarget)} className="tap-target tabular-nums text-admin-text">{product.quantityUnits ?? 0} units</button>
                  <Button type="button" variant="quiet" size="sm" onClick={(event) => onOpenStockMovement?.(product, event.currentTarget)}>Change</Button>
                </TeaLine>
                <TeaLine label="Holds"><GhostInput ariaLabel="Capacity ml" placeholder="Add" align="right" value={product.capacityMl || ''} onSave={(val) => persistField(product.id, 'capacityMl', val)} type="number" className="tabular-nums" /><span className="text-ui-12 text-admin-text-dim">ml</span></TeaLine>
              </> : (() => {
                const stock = product.stockGrams;
                const threshold = product.lowStockThreshold || 0;
                const isOut = stock === 0;
                const isLow = threshold > 0 && stock <= threshold;
                const bought = Number(product.quantityPurchased);
                return <>
                  <TeaLine label="On the shelf">
                    <button type="button" aria-label={`Change stock for ${product.productName || product.givenName}`} onClick={(event) => onOpenStockMovement?.(product, event.currentTarget)}
                      className={`tap-target tabular-nums ${isOut ? 'text-tea-error' : isLow ? 'text-tea-gold' : 'text-admin-text'}`}>{stock.toLocaleString('en-US')} g</button>
                    <Button type="button" variant="quiet" size="sm" onClick={(event) => onOpenStockMovement?.(product, event.currentTarget)}>Change</Button>
                  </TeaLine>
                  <TeaLine label="Counted">
                    <span className={product.stockVerifiedAt ? 'text-admin-text' : 'text-tea-warn'}>{countedDate(product.stockVerifiedAt)}</span>
                    {onRecount && <button type="button" className="tap-target text-tea-gold" onClick={(event) => onRecount(product, event.currentTarget)}>Count now</button>}
                  </TeaLine>
                  <TeaLine label="Warn below">
                    <GhostInput ariaLabel="Low alert grams" align="right" value={threshold} onSave={(val) => persistField(product.id, 'lowStockThreshold', val)} type="number" className="tabular-nums" />
                    <span className="text-ui-12 text-admin-text-dim">g</span>
                  </TeaLine>
                  <div className="tea-page-note">
                    {incoming && incoming.quantity > 0 ? `${fmtNum(incoming.quantity)} g on the way${incoming.eta ? `, due ${countedDate(incoming.eta)}` : ''}` : 'Nothing on the way'}
                    {bought > 0 && ` · ${bought.toLocaleString('en-US')} g bought`}
                    {isOut ? ' · empty' : isLow ? ' · running low' : ''}
                  </div>
                </>;
              })()}
            </TeaSection>

            {/* WHERE IT'S LISTED: the shop listing, its switches, its collections. */}
            <TeaSection section="listed" title="Where it's listed">
              <StockListingReview key={`${activeAccountId}:${product.id}`}
                product={product} entryId={sharedRecordId}
                openRequested={openListingReview} onOpenHandled={onListingReviewOpened} returnTo={listingReturnTo}
                canList={canList} canPublish={canPublish} isOwner={isOwnerTier} problem={publicationProblem}
                canShowWhileCountPending={canShowWhileCountPending}
                applyWording={text => persistField(product.id, 'description', text)}
                markReady={() => persistField(product.id, 'status', 'Active')}
                save={async (gate, value) => {
                  if (gate !== 'shownInShop' || onSaveField || onUpdate) return persistField(product.id, gate, value);
                  await api.products.updateShown(product.id, value);
                  await refreshCommerceQueries(panelQueryClient, undefined, { changedProductIds: [product.id] });
                }}
              />
              <TeaLine label="Purpose">
                <div role="group" aria-label="Inventory purpose" className="flex flex-wrap justify-end gap-1.5">
                  {(['working', 'sample', 'personal'] as const).map((purpose) => (
                    <Button key={purpose} type="button" variant="chip" size="sm"
                      aria-label={`${purpose[0].toUpperCase()}${purpose.slice(1)} purpose`}
                      aria-pressed={effectivePurpose(product) === purpose}
                      onClick={() => handleUpdate(product.id, 'inventoryPurpose', purpose)}>
                      {purpose === 'working' ? 'Shop stock' : purpose === 'sample' ? 'Sample' : 'Personal'}
                    </Button>
                  ))}
                </div>
              </TeaLine>
              <div className="tea-page-switches">
                {([
                  ['isFeatured', 'Starred', 'Starred, promoted on collection pages'],
                  // "Curated", never "Top Pick": it is one person's switch and the same shelf for everyone.
                  ['isCurated', 'Curated', 'On the curator\'s shelf. Shows as Curated on the storefront, the same for every reader.'],
                  ['canReorder', 'Restockable', 'Restockable when sold out'],
                  ['isSample', 'Sample size', 'Sample-size offering'],
                  // Sealed tea: the shop offers whole multiples of one unit and nothing smaller.
                  ['soldInWholeUnits', 'Whole units only', 'Sold only as whole sealed units'],
                ] as const).map(([field, label, hint]) => (
                  <button key={field} type="button" title={hint} aria-pressed={Boolean(product[field])}
                    aria-label={field === 'isSample' ? 'Sample-size offering' : field === 'soldInWholeUnits' ? 'Sold only in whole units' : label}
                    onClick={() => handleUpdate(product.id, field, !product[field])}>
                    <span className="curate-v2-label">{label}</span><span className="tea-page-toggle" aria-hidden="true" />
                  </button>
                ))}
              </div>
              <TeaLine label="Collections"><CollectionPill productId={product.id} /></TeaLine>
              {product?.id && <div className="px-4 py-2 border-b border-tea-border"><ProductCollectionsSection productId={product.id} /></div>}
            </TeaSection>

            {/* LATER: tasting, story, links, events and the rest of the tools. */}
            <div id={teaSectionId('later')} className="tea-page-section tea-page-later">Later</div>
            <div id="tea-section-tasting">
              <TeaLine label="Tasting">
                <span className="text-admin-text-sec">{flattenedTastingCount > 0 ? `${flattenedTastingCount} notes` : 'None yet'}</span>
                <Button type="button" variant="quiet" size="sm" onClick={() => setTastingEditorProduct(product)}
                  aria-label={flattenedTastingCount > 0 ? `Edit tasting profile (${flattenedTastingCount} notes)` : 'Add tasting profile'}>
                  {flattenedTastingCount > 0 ? 'Open tasting' : 'Add tasting'}
                </Button>
              </TeaLine>
            </div>
            <div id="tea-section-story" className="px-4 pt-3 pb-3 border-b border-tea-border">
              <div className="flex items-center justify-between mb-1.5">
                <span className="curate-v2-label">Introduction</span>
                <span className="text-ui-11 text-admin-text-dim">What the shop page says</span>
              </div>
              <GhostTextarea variant="bordered" ariaLabel="Introduction" value={product.description || ''} placeholder="Your personal introduction to this tea..." rows={4} onSave={(val) => persistField(product.id, 'description', val)} className="" />
            </div>
            <CollapsibleSection title="More story" description="Tasting words, terroir, processing and lore." defaultOpen={false}>
              <div className="space-y-5">
                <TastingNotesEditor product={product} onUpdate={onUpdate} onOpenFullEditor={() => setTastingEditorProduct(product)} />
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-ui-11 text-admin-text-dim uppercase tracking-[0.06em]">Terroir</span>
                    <span className="text-ui-11 text-admin-text-dim">Soil, altitude, climate</span>
                  </div>
                  <GhostTextarea variant="bordered" ariaLabel="Terroir" value={product.terroir || ''} placeholder="Where this tea grew and why it matters..." rows={3} onSave={(val) => persistField(product.id, 'terroir', val)} className="" />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-ui-11 text-admin-text-dim uppercase tracking-[0.06em]">Processing</span>
                    <span className="text-ui-11 text-admin-text-dim">Craft & method</span>
                  </div>
                  <GhostTextarea variant="bordered" ariaLabel="Processing notes" value={product.processingNotes || ''} placeholder="How this tea was made..." rows={3} onSave={(val) => persistField(product.id, 'processingNotes', val)} className="" />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-ui-11 text-admin-text-dim uppercase tracking-[0.06em]">Lore & history</span>
                    {product.isCustomWisdom
                      ? <span className="flex items-center gap-1 text-ui-11 text-admin-text-sec"><Pencil size={10} /> hand-edited</span>
                      : <span className="text-ui-11 text-admin-text-dim">AI generated</span>}
                  </div>
                  <GhostTextarea
                    variant="bordered"
                    ariaLabel="Lore and history"
                    value={product.lore || ''}
                    placeholder="History, story, or lore..."
                    rows={3}
                    onSave={(val) => {
                      handleUpdate(product.id, 'lore', val);
                      if (!product.isCustomWisdom) handleUpdate(product.id, 'isCustomWisdom', true);
                    }}
                    className=""
                  />
                </div>
              </div>
            </CollapsibleSection>

            {inventoryCategory !== 'teaware' && (
              <CollapsibleSection title="Wisdom Base" description="What its entry can draw on, and what still needs writing." defaultOpen={false}>
                <React.Suspense fallback={null}><WisdomNeedsList product={product} /></React.Suspense>
              </CollapsibleSection>
            )}

            <div id="tea-section-placement" />
            <CollapsibleSection title="Links" description="Where this tea came from, its orders and its story page." defaultOpen={false}>
              <div className="divide-y divide-admin-border border-y border-admin-border">
                {(() => {
                  const compassEntryId = product.sourceCompassEntryId;
                  const compassEntry = compassEntryId
                    ? compassEntries.find(e => e.id === compassEntryId)
                    : compassEntries.find(e => e.draftProductId === product.id);
                  if (!compassEntry && !compassEntryId) return null;
                  const linkId = compassEntry?.id || compassEntryId!;
                  return (
                    <button onClick={() => navigate(`/admin/compass?tab=buying&entry=${encodeURIComponent(linkId)}`)} className="w-full flex items-center justify-between gap-3 py-3 text-ui-13 text-admin-text-sec hover:text-admin-text transition-colors">
                      <span className="truncate">
                        Encounter <span className="text-admin-text-dim">·</span> {compassEntry?.vendorName || 'Entry'}
                        {compassEntry && <span className="text-admin-text-dim"> · {new Date(compassEntry.createdAt).toLocaleDateString()}</span>}
                      </span>
                      <ChevronRight size={12} className="text-admin-text-dim shrink-0" />
                    </button>
                  );
                })()}
                <button onClick={() => navigate(`/admin/activity?tab=orders&search=${encodeURIComponent(product.givenName || product.productName)}`)} className="w-full flex items-center justify-between gap-3 py-3 text-ui-13 text-admin-text-sec hover:text-admin-text transition-colors">
                  Order history<ChevronRight size={12} className="text-admin-text-dim" />
                </button>
                <button onClick={() => navigate(`/admin/products/${product.id}/story`)} className="w-full flex items-center justify-between gap-3 py-3 text-ui-13 text-admin-text-sec hover:text-admin-text transition-colors">
                  Full story page<ChevronRight size={12} className="text-admin-text-dim" />
                </button>
              </div>
            </CollapsibleSection>

            {(isOwnerTier || product.ownerUserId === activeUserId) && activeAccountId && (
              <CollapsibleSection title="Sales permissions" description="Who may sell this holding and on what terms." defaultOpen={false}>
                <SalesPermissionsPanel productId={product.id} accountId={activeAccountId} />
              </CollapsibleSection>
            )}

            <CollapsibleSection title="Events" description="Tasting aggregate, guest impressions, and the events this tea appeared at." defaultOpen={false}>
              {productEventsLoading ? (
                <div className="flex items-center gap-2 py-2 text-ui-12 text-admin-text-sec">
                  <Loader2 size={12} className="animate-spin" />
                  <span>Loading events…</span>
                </div>
              ) : productEvents.length === 0 ? (
                <p className="text-ui-12 text-admin-text-sec py-1">Not featured at any events yet.</p>
              ) : (
                <>
                  {productTastingAgg && productTastingAgg.impressions.length > 0 && (
                    <div className="mb-4 rounded-md bg-admin-input border border-admin-border overflow-hidden">
                      <div className="px-4 py-3 space-y-2.5">
                        <div className="text-ui-10 text-admin-text-dim uppercase tracking-[0.08em]">Guest impressions</div>
                        {productTastingAgg.impressions.map((imp, i) => (
                          <p key={i} className="text-ui-13 text-admin-text leading-[1.55]">"{imp}"</p>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="text-ui-10 text-admin-text-dim uppercase tracking-[0.08em] mb-2">Appeared at</div>
                  <div className="divide-y divide-admin-border border-y border-admin-border">
                    {productEvents.map((event: any) => (
                      <div key={event.id} className="flex items-center justify-between gap-3 py-2.5">
                        <span className="text-ui-13 text-admin-text truncate">{event.name || event.title || 'Event'}</span>
                        {(event.date || event.event_date) && (
                          <span className="font-mono text-ui-11 text-admin-text-dim shrink-0 tabular-nums">
                            {new Date(event.date || event.event_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CollapsibleSection>

            {/* The rest of what can be done to this one tea. Star and Collection
                are not repeated here: they are the switches and row above. */}
            <div role="group" aria-label="Do with this tea" className="tea-page-tools">
              <Button type="button" variant="quiet" size="sm" aria-label="Generate QR code" onClick={() => setQrProduct(product)}>QR</Button>
              {onTeaAction && ([['invoice', 'Invoice'], ['sample', 'Sample'], ['share', 'Share'], ['journal', 'Journal'], ['archive', 'Archive']] as const).map(([kind, label]) => (
                <Button key={kind} type="button" variant="quiet" size="sm" aria-label={`${label} this tea`} onClick={() => onTeaAction(kind, product)}>{label}</Button>
              ))}
            </div>
            {shelfTools && <div className="hidden px-4 pb-3 md:block">{shelfTools}</div>}
            <p className="tea-page-end pb-nav-gap">{nextProduct ? `End of ${product.productName || 'this tea'}. The arrow at the top opens the next tea${section ? ` at ${sectionLabel(section)}` : ''}.` : `End of ${product.productName || 'this tea'}.`}</p>
          </div>}
        </>)}
      </div>

      {/* Mobile backdrop. Same scrim the sibling admin modals use
          (SplitOrderModal, AddToCartModal, CsvImportModal): the page colour at
          70% rather than a fixed near-black, so it dims whichever theme is
          actually behind it. */}
      {product && <div className="fixed inset-0 z-20 md:hidden bg-tea-bg/70 backdrop-blur-[2px]" onClick={onClose} />}

      {/* Tasting editor modal */}
      {tastingEditorProduct && (
        <TastingEditorModal
          product={tastingEditorProduct}
          onClose={() => setTastingEditorProduct(null)}
          onSaved={(p, tastingData, derivedMood) => {
            // Persist the tasting + mood via our update handler
            handleUpdate(p.id, 'tasting' as any, tastingData);
            if (derivedMood) handleUpdate(p.id, 'mood', derivedMood);
          }}
        />
      )}

      {/* QR code modal */}
      <QrCodeModal isOpen={!!qrProduct} onClose={() => setQrProduct(null)} product={qrProduct} />
    </>
  );
};

export const ProductEditPanel = React.memo(ProductEditPanelImpl);
