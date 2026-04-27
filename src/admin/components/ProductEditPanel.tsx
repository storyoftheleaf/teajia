import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X as XIcon, ChevronLeft, ChevronRight, ChevronDown, QrCode, Eye, EyeOff, Star, Sparkles,
  FlaskConical, RefreshCw, User, Pencil, Plus, Loader2, Check, Globe, Receipt, BookOpen,
} from 'lucide-react';
import { api } from '../../lib/api';
import type { Product, ExchangeRate, Currency } from '../types';
import { calculatePricing } from '../utils';
import { useCustomers } from '../hooks/useAdminData';
import { useToast } from './Toast';
import { TastingEditorModal } from './TastingEditorModal';
import { QrCodeModal } from './QrCodeModal';
import { ProductCollectionsSection } from './collections/ProductCollectionsSection';
import { TaxonomyChipPicker } from './tasting/TaxonomyChipPicker';
import { StockLedgerPanel } from './StockLedgerPanel';
import { AutocompleteInput } from '../../components/TeaCompass/AutocompleteInput';
import { buildVarietyDataMap, getTeaVarietySuggestions } from '../../data/teaVarieties';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import { getThemeColor } from '../themeUtils';
import {
  flattenTastingNotes,
  resolveTermLabel,
  LIQUOR_COLORS,
  TASTING_CATEGORY_ORDER,
  SECTION_ICONS,
} from '../../data/tastingTaxonomy';

/* ------------------------------------------------------------------ */
/* Shared inline-edit sub-components                                   */
/* ------------------------------------------------------------------ */

export const GhostTextarea = ({
  value, onSave, className = '', placeholder = '', rows = 3, ariaLabel,
}: {
  value: string;
  onSave: (val: string) => void;
  className?: string;
  placeholder?: string;
  rows?: number;
  ariaLabel?: string;
}) => {
  const [localValue, setLocalValue] = useState(value);
  const [justSaved, setJustSaved] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { setLocalValue(value); }, [value]);
  const handleBlur = () => {
    if (localValue !== value) {
      onSave(localValue);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 600);
    }
  };
  useEffect(() => {
    const el = textareaRef.current;
    if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }
  }, [localValue]);
  return (
    <textarea
      ref={textareaRef}
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
      className={`w-full bg-transparent border border-dashed border-tea-accent-sub focus:border-solid focus:border-tea-accent-sub focus:bg-tea-gold/[0.06] rounded-md py-1.5 px-2 outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg transition-all resize-none text-xs leading-relaxed whitespace-pre-line placeholder-tea-text-dim min-h-[80px] overflow-hidden ${justSaved ? '!text-tea-gold' : ''} ${className}`}
    />
  );
};

export const GhostInput = ({
  value, onSave, type = 'text', align = 'left', className = '', placeholder = '', inputMode, id, ariaLabel,
}: {
  value: string | number;
  onSave: (val: any) => void;
  type?: 'text' | 'number';
  align?: 'left' | 'right';
  className?: string;
  placeholder?: string;
  inputMode?: string;
  id?: string;
  ariaLabel?: string;
}) => {
  const [localValue, setLocalValue] = useState(value);
  useEffect(() => { setLocalValue(value); }, [value]);
  const [justSaved, setJustSaved] = useState(false);
  const handleBlur = () => {
    if (localValue != value) {
      onSave(localValue);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 600);
    }
  };
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') e.currentTarget.blur();
  };
  return (
    <input
      id={id}
      aria-label={ariaLabel}
      type={type}
      value={localValue || ''}
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
      className={`w-full bg-transparent border-b border-dashed border-tea-accent-sub focus:border-solid focus:border-tea-accent-sub focus:bg-tea-gold/[0.06] rounded-none py-0 px-0 outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg transition-all text-${align} placeholder-tea-text-dim leading-none ${justSaved ? '!text-tea-gold' : ''} ${className}`}
    />
  );
};

export const GhostAutocompleteInput = ({
  value, onSave, suggestions, itemData, onAutoFill, className = '', placeholder = '',
}: {
  value: string;
  onSave: (val: string) => void;
  suggestions: string[];
  itemData?: Record<string, any>;
  onAutoFill?: (data: any) => void;
  className?: string;
  placeholder?: string;
}) => {
  const [localValue, setLocalValue] = useState(value);
  const localValueRef = useRef(value);
  const [justSaved, setJustSaved] = useState(false);
  useEffect(() => {
    setLocalValue(value);
    localValueRef.current = value;
  }, [value]);
  const save = useCallback((val: string) => {
    if (val !== value) {
      onSave(val);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 600);
    }
  }, [value, onSave]);
  const handleChange = (val: string) => { localValueRef.current = val; setLocalValue(val); };
  const handleSelect = (data: any) => { save(localValueRef.current); onAutoFill?.(data); };
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
        className={`w-full bg-transparent border-b border-dashed border-tea-accent-sub focus:border-solid focus:border-tea-accent-sub focus:bg-tea-gold/[0.06] rounded-none py-0 px-0 outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg transition-all text-right placeholder-tea-text-dim leading-none ${justSaved ? '!text-tea-gold' : ''} ${className}`}
      />
    </div>
  );
};

export const GhostSelect = ({ value, onSave, options, className = '', ariaLabel }: {
  value: string; onSave: (val: string) => void; options: string[]; className?: string; ariaLabel?: string;
}) => (
  <div className="relative flex-1">
    <select
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onSave(e.target.value)}
      className={`w-full bg-transparent border-b border-dashed border-tea-accent-sub focus:border-solid focus:border-tea-accent-sub focus:bg-tea-gold/[0.06] rounded-none py-0 px-0 pr-4 outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg transition-all text-right appearance-none cursor-pointer leading-none ${className}`}
    >
      {options.map(opt => (
        <option key={opt} value={opt} className="bg-tea-surface text-tea-text">{opt}</option>
      ))}
    </select>
    <ChevronRight size={10} aria-hidden="true" className="absolute right-0 top-1/2 -translate-y-1/2 rotate-90 text-tea-text-sec pointer-events-none" />
  </div>
);

export const VendorPicker = ({ value, onChange, productId, className }: {
  value: string; onChange: (name: string) => void; productId?: string; className?: string;
}) => {
  const { data: customers = [], refetch: refetchCustomers } = useCustomers();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const wrapperRef = useRef<HTMLDivElement>(null);

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
      <input
        type="text"
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => { setTimeout(() => handleSelectVendor(query.trim()), 150); }}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSelectVendor(query.trim()); } }}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        data-1p-ignore
        data-lpignore="true"
        className={className}
        placeholder="Type or pick a source..."
      />
      {open && (filtered.length > 0 || (query.trim() && isNew)) && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-tea-surface border border-tea-accent-sub rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {isNew && query.trim() && (
            <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => handleSelectVendor(query.trim())}
              className="w-full text-left px-3 py-2 text-xs text-tea-gold hover:bg-tea-bg transition-colors border-b border-tea-accent-sub">
              + Add "{query.trim()}" as new source
            </button>
          )}
          {filtered.map(v => (
            <button key={v} type="button" onMouseDown={e => e.preventDefault()} onClick={() => { setQuery(v); handleSelectVendor(v); }}
              className={`w-full text-left px-3 py-2 text-xs hover:bg-tea-bg transition-colors ${v === value ? 'text-tea-gold font-medium' : 'text-tea-text'}`}>
              {v}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export const CollapsibleSection = ({ title, defaultOpen = true, mobileDefault, children }: {
  title: string; defaultOpen?: boolean; mobileDefault?: boolean; children: React.ReactNode;
}) => {
  const [open, setOpen] = useState(() => {
    if (mobileDefault !== undefined && typeof window !== 'undefined' && !window.matchMedia('(min-width: 768px)').matches) {
      return mobileDefault;
    }
    return defaultOpen;
  });
  return (
    <div className="mx-3 mb-3 rounded-lg bg-tea-surface">
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="w-full flex items-center justify-between px-4 py-3 group">
        <span className="text-xs font-serif italic text-tea-text-sec group-hover:text-tea-text transition-colors">{title}</span>
        <ChevronRight size={13} aria-hidden="true" className={`text-tea-text-dim transition-transform duration-200 group-hover:text-tea-text-sec ${open ? 'rotate-90' : ''}`} />
      </button>
      <div className="grid transition-[grid-template-rows] duration-200 ease-out" style={{ gridTemplateRows: open ? '1fr' : '0fr' }}>
        <div className="overflow-hidden">
          <div className="px-4 pb-4">{children}</div>
        </div>
      </div>
    </div>
  );
};

export const ImageManager = ({ product, onUpdate }: {
  product: Product; onUpdate: (field: keyof Product, value: any) => void;
}) => {
  const [uploadingSlot, setUploadingSlot] = useState<number | null>(null);
  const [justUploadedSlot, setJustUploadedSlot] = useState<number | null>(null);
  const { showToast } = useToast();

  const images = [product.imageUrl || '', ...(product.additionalImages || [])].slice(0, 3);
  while (images.length < 3) images.push('');

  const handleUpload = async (file: File, slotIndex: number) => {
    setUploadingSlot(slotIndex);
    try {
      const url = await api.uploadImage(file);
      if (slotIndex === 0) onUpdate('imageUrl', url);
      else {
        const additional = [...(product.additionalImages || [])];
        additional[slotIndex - 1] = url;
        onUpdate('additionalImages' as keyof Product, additional);
      }
      setJustUploadedSlot(slotIndex);
      setTimeout(() => setJustUploadedSlot(null), 1200);
    } catch (err: any) {
      showToast(`Upload failed: ${err.message}`, 'error');
    } finally {
      setUploadingSlot(null);
    }
  };

  const handleRemove = (slotIndex: number) => {
    if (slotIndex === 0) onUpdate('imageUrl', '');
    else {
      const additional = [...(product.additionalImages || [])];
      additional.splice(slotIndex - 1, 1);
      onUpdate('additionalImages' as keyof Product, additional);
    }
  };

  const slotLabels = ['Primary', 'Second', 'Third'];
  return (
    <div className="flex gap-2">
      {images.map((img, i) => (
        <div key={i} className="flex-1 aspect-square relative group">
          {img ? (
            <>
              <img src={img} alt={slotLabels[i]} className="w-full h-full object-cover rounded-md" loading="lazy" />
              <span aria-hidden="true" className="absolute top-1 left-1 w-4 h-4 rounded-full bg-tea-bg/80 text-tea-text-dim text-ui-10 font-serif tabular-nums flex items-center justify-center">{i + 1}</span>
              {justUploadedSlot === i ? (
                <div className="absolute inset-0 rounded-md bg-tea-bg/70 flex items-center justify-center pointer-events-none">
                  <Check size={20} className="text-tea-gold" aria-hidden="true" />
                </div>
              ) : (
                <button
                  onClick={() => handleRemove(i)}
                  aria-label={`Remove ${slotLabels[i].toLowerCase()} image`}
                  className="absolute inset-0 rounded-md bg-tea-bg/70 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity flex items-center justify-center"
                >
                  <XIcon size={16} className="text-tea-text" aria-hidden="true" />
                </button>
              )}
            </>
          ) : (
            <button
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file'; input.accept = 'image/*';
                input.onchange = (e: any) => { const file = e.target.files?.[0]; if (file) handleUpload(file, i); };
                document.body.appendChild(input); input.click(); input.remove();
              }}
              disabled={uploadingSlot !== null}
              aria-label={`Add ${slotLabels[i].toLowerCase()} image`}
              className="w-full h-full rounded-md bg-tea-surface/50 hover:bg-tea-surface border border-dashed border-tea-accent-sub hover:border-tea-gold/30 transition-colors flex items-center justify-center cursor-pointer relative"
            >
              <span aria-hidden="true" className="absolute top-1 left-1 text-ui-10 font-serif tabular-nums text-tea-text-dim">{i + 1}</span>
              {uploadingSlot === i ? <Loader2 size={16} className="text-tea-text-dim animate-spin" aria-hidden="true" /> : <Plus size={16} className="text-tea-text-dim" aria-hidden="true" />}
            </button>
          )}
        </div>
      ))}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Field → DB column mapping (shared between panel and inventory)      */
/* ------------------------------------------------------------------ */

export function buildProductUpdatePayload(field: keyof Product, value: any): Record<string, any> | null {
  switch (field) {
    case 'stockGrams': return { stock_grams: Number(value) };
    case 'costAmount': return { cost_amount: Number(value) };
    case 'pricePerGramUSD': return { fixed_retail_price_usd: Number(value) };
    case 'productName': return { product_name: value };
    case 'originRegion': return { origin_region: value };
    case 'year': return { year: Number(value) };
    case 'isFeatured': return { is_featured: value };
    case 'isPublic': return { is_public: value };
    case 'showWisdom': return { show_wisdom: value };
    case 'recheckStock': return { recheck_stock: value ? 1 : 0 };
    case 'stockVerifiedAt': return { stock_verified_at: value };
    case 'material': return { material: value };
    case 'capacityMl': return { capacity_ml: Number(value) };
    case 'teawareCategory': return { teaware_category: value };
    case 'quantityUnits': return { quantity_units: Number(value) };
    case 'experience': return { experience: value };
    case 'description': return { description: value };
    case 'mood': return { mood: value };
    case 'moodTags': return { mood_tags: JSON.stringify(value || []) };
    case 'flavorTags': return { flavor_tags: JSON.stringify(value || []) };
    case 'tastingNotes': return { tasting_notes: JSON.stringify(value) };
    case 'lore': return { lore: value };
    case 'givenName': return { given_name: value };
    case 'chineseName': return { chinese_name: value };
    case 'form': return { form: value };
    case 'originCountry': return { origin_country: value };
    case 'vendor': return { vendor: value };
    case 'type': return { type: value };
    case 'status': return { status: value };
    case 'imageUrl': return { image_url: value };
    case 'processingNotes': return { processing_notes: value };
    case 'terroir': return { terroir: value };
    case 'isPersonal': return { is_personal: value ? 1 : 0 };
    case 'canReorder': return { can_reorder: value ? 1 : 0 };
    case 'isCurated': return { is_curated: value ? 1 : 0 };
    case 'isSample': return { is_sample: value ? 1 : 0 };
    case 'isCustomWisdom': return { is_custom_wisdom: value ? 1 : 0 };
    case 'fixedRetailPriceUSD': return { fixed_retail_price_usd: value ? Number(value) : null };
    case 'shippingRatePerKg': return { shipping_rate_per_kg: Number(value) };
    case 'quantityPurchased': return { quantity_purchased: Number(value) };
    case 'lowStockThreshold': return { low_stock_threshold: Number(value) };
    case 'costCurrency': return { cost_currency: value };
    case 'additionalImages': return { additional_images: JSON.stringify(value || []) };
    default: return null;
  }
}

/* ------------------------------------------------------------------ */
/* ProductEditPanel — the inventory sidebar, now reusable              */
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
   * If unset, the panel will call api.products.update directly.
   */
  onUpdate?: (id: string, field: keyof Product, value: any) => void | Promise<void>;
  /**
   * Optional list of other products — used for:
   *   - prev/next navigation (pass products in desired order)
   *   - name-autocomplete suggestions
   */
  products?: Product[];
  /** When navigating via prev/next, called with the new product. */
  onNavigate?: (product: Product) => void;
  /** Label for filter context shown in header (e.g. "Needs Attention"). */
  filterLabel?: string;
}

const STATUS_COLORS: Record<string, string> = {
  Active: 'var(--tea-gold)',
  Draft: 'var(--tea-text-dim)',
  Archived: 'var(--tea-text-sec)',
  'Sold Out': 'var(--tea-error)',
};

const ProductEditPanelImpl: React.FC<ProductEditPanelProps> = ({
  product,
  rates,
  onClose,
  onUpdate,
  products = [],
  onNavigate,
  filterLabel,
}) => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const compassEntries = useTeaCompassStore((s) => s.entries);

  // Local state for modals mounted inside the panel
  const [tastingEditorProduct, setTastingEditorProduct] = useState<Product | null>(null);
  const [qrProduct, setQrProduct] = useState<Product | null>(null);
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Events & tasting aggregate
  const [productEvents, setProductEvents] = useState<any[]>([]);
  const [productEventsLoading, setProductEventsLoading] = useState(false);
  const [productTastingAgg, setProductTastingAgg] = useState<{
    avgRating: number; totalNotes: number; favoriteCount: number; impressions: string[];
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

  // Default onUpdate if parent didn't supply one — persist directly
  const handleUpdate = useCallback(async (id: string, field: keyof Product, value: any) => {
    if (onUpdate) { await onUpdate(id, field, value); return; }
    const payload = buildProductUpdatePayload(field, value);
    if (!payload) return;
    try { await api.products.update(id, payload); }
    catch (err: any) { showToast(`Update failed: ${err.message}`, 'error'); }
  }, [onUpdate, showToast]);

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
          const ratings = allNotes.filter(n => n.rating).map(n => n.rating as number);
          setProductTastingAgg({
            avgRating: ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0,
            totalNotes: allNotes.length,
            favoriteCount: allNotes.filter(n => n.isFavorite || n.is_favorite).length,
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

  // Memoize pricing calc — only recompute when relevant fields change
  const pricingCalc = useMemo(() => {
    if (!product) return null;
    return calculatePricing(
      product.costAmount || 0,
      product.shippingRatePerKg || 13,
      product.quantityPurchased || 0,
      (product.costCurrency || 'USD') as Currency,
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
  ]);

  // Memoize tasting flatten — only recompute when product.tasting changes
  const flattenedTastingCount = useMemo(() => {
    const tasting = (product as any)?.tasting;
    return tasting ? flattenTastingNotes(tasting).length : 0;
  }, [(product as any)?.tasting]);

  const statusColor = product ? (STATUS_COLORS[product.status] || 'var(--tea-text-sec)') : 'var(--tea-text-sec)';
  const inventoryCategory: 'tea' | 'teaware' = product?.type === 'Teaware' ? 'teaware' : 'tea';

  return (
    <>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-hidden={!product}
        style={{ willChange: 'transform' }}
        className={`fixed inset-0 bottom-[calc(44px+env(safe-area-inset-bottom))] md:inset-auto md:right-0 md:top-0 md:bottom-0 md:w-[360px] lg:w-[420px] xl:w-[440px] z-30 bg-tea-bg flex flex-col panel-sidebar transition-transform duration-300 ease-out ${product ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {product && (<>
          {/* Header — Row 1: Nav */}
          <div className="flex items-center justify-between px-3 pt-2.5 pb-1 bg-tea-surface/30">
            <button
              ref={closeButtonRef}
              onClick={onClose}
              aria-label="Close product panel"
              title="Close (Esc)"
              className="p-2 -ml-0.5 text-tea-text-sec hover:text-tea-text transition-colors rounded-lg active:bg-tea-surface"
            >
              <XIcon size={17} aria-hidden="true" />
            </button>
            <div className="flex flex-col items-center gap-0">
              <span className="text-ui-10 text-tea-text-dim tabular-nums leading-none">
                {productIndex >= 0 ? `${productIndex + 1} / ${totalCount}` : ''}
              </span>
              {filterLabel && (
                <span className="text-ui-9 text-tea-text-dim uppercase tracking-[0.1em] leading-none mt-0.5">
                  {filterLabel}
                </span>
              )}
            </div>
            <div className="flex items-center gap-0">
              <button
                onClick={() => prevProduct && onNavigate?.(prevProduct)}
                aria-label="Previous product"
                title="Previous (←)"
                className="p-2 text-tea-text-sec hover:text-tea-text transition-colors rounded-lg active:bg-tea-surface disabled:opacity-30"
                disabled={!prevProduct || !onNavigate}
              ><ChevronLeft size={17} aria-hidden="true" /></button>
              <button
                onClick={() => nextProduct && onNavigate?.(nextProduct)}
                aria-label="Next product"
                title="Next (→)"
                className="p-2 text-tea-text-sec hover:text-tea-text transition-colors rounded-lg active:bg-tea-surface disabled:opacity-30"
                disabled={!nextProduct || !onNavigate}
              ><ChevronRight size={17} aria-hidden="true" /></button>
            </div>
          </div>

          {/* Keyboard hint bar */}
          {onNavigate && (
            <div className="hidden md:flex items-center justify-center gap-3 px-4 pb-1 bg-tea-surface/30">
              <span className="text-ui-9 text-tea-text-dim uppercase tracking-[0.15em]">Esc close</span>
              <span className="text-ui-9 text-tea-text-dim">·</span>
              <span className="text-ui-9 text-tea-text-dim uppercase tracking-[0.15em]">← → navigate</span>
            </div>
          )}

          {/* Header — Row 2: Identity */}
          <div className="flex items-start justify-between gap-3 px-4 pb-3 border-b border-tea-accent-sub bg-tea-surface/30">
            <div className="flex items-start gap-2.5 min-w-0 flex-1">
              <span aria-hidden="true" className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: getThemeColor(product.type) }} />
              <div className="min-w-0">
                <h3 id={titleId} className="text-lg font-serif text-tea-text leading-snug" title={product.productName}>{product.productName}</h3>
                {product.givenName && <div className="text-xs text-tea-text-sec font-serif italic leading-tight">{product.givenName}</div>}
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-xs text-tea-text-sec">{product.type}</span>
                  {product.year && <span className="text-xs text-tea-text-dim">· {product.year}</span>}
                  {product.originRegion && <span className="text-xs text-tea-text-dim">· {product.originRegion}</span>}
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0 pt-0.5">
              <div className="relative">
                <label className="sr-only" htmlFor={`panel-status-${product.id}`}>Product status</label>
                <select
                  id={`panel-status-${product.id}`}
                  value={product.status}
                  onChange={e => handleUpdate(product.id, 'status', e.target.value)}
                  className="text-ui-11 uppercase tracking-[0.08em] pl-2.5 pr-6 py-1.5 rounded-md bg-tea-surface cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg appearance-none"
                  style={{ borderColor: statusColor, color: statusColor, border: '1px solid' }}
                >
                  {['Active', 'Draft', 'Archived', 'Sold Out'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: statusColor }} aria-hidden="true" />
              </div>
              <button onClick={() => setQrProduct(product)} aria-label="Generate QR code" title="Generate QR Code" className="flex items-center gap-1 text-ui-10 text-tea-text-dim hover:text-tea-text-sec transition-colors rounded px-1 py-0.5">
                <QrCode size={12} aria-hidden="true" /> QR
              </button>
            </div>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto custom-scrollbar pt-3 pb-nav-gap">
            {/* 1. Identity & Origin */}
            <CollapsibleSection title="Identity & Origin" defaultOpen={true}>
              <div className="space-y-0">
                <div className="flex items-center justify-between gap-3 py-2.5 min-h-[44px]">
                  <span className="text-ui-11 text-tea-text-sec uppercase tracking-[0.06em] shrink-0 w-20 md:w-24">Name</span>
                  <GhostAutocompleteInput
                    value={product.productName}
                    onSave={(val) => handleUpdate(product.id, 'productName', val)}
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
                    className="text-xs text-tea-text"
                  />
                </div>
                {([
                  { label: 'Given Name', field: 'givenName' as const, value: product.givenName || '' },
                  { label: 'Chinese', field: 'chineseName' as const, value: product.chineseName || '' },
                ]).map(item => (
                  <div key={item.field} className="flex items-center justify-between gap-3 py-2.5 min-h-[44px]">
                    <span className="text-ui-11 text-tea-text-sec uppercase tracking-[0.06em] shrink-0 w-20 md:w-24">{item.label}</span>
                    <GhostInput value={item.value} onSave={(val) => handleUpdate(product.id, item.field, val)} align="right" className="text-xs text-tea-text flex-1" />
                  </div>
                ))}
                {inventoryCategory === 'teaware' ? (
                  <>
                    <div className="flex items-center justify-between gap-3 py-2.5 min-h-[44px]">
                      <span className="text-ui-11 text-tea-text-sec uppercase tracking-[0.06em] shrink-0 w-20 md:w-24">Category</span>
                      <GhostInput value={product.teawareCategory || ''} onSave={(val) => handleUpdate(product.id, 'teawareCategory', val)} align="right" className="text-xs text-tea-text flex-1" />
                    </div>
                    <div className="flex items-center justify-between gap-3 py-2.5 min-h-[44px]">
                      <span className="text-ui-11 text-tea-text-sec uppercase tracking-[0.06em] shrink-0 w-20 md:w-24">Material</span>
                      <GhostInput value={product.material || ''} onSave={(val) => handleUpdate(product.id, 'material', val)} align="right" className="text-xs text-tea-text flex-1" />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-3 py-2.5 min-h-[44px]">
                      <span className="text-ui-11 text-tea-text-sec uppercase tracking-[0.06em] shrink-0 w-20 md:w-24">Type</span>
                      <GhostSelect ariaLabel="Type" value={product.type} onSave={(val) => handleUpdate(product.id, 'type', val)} options={['Green', 'Yellow', 'White', 'Oolong', 'Red', 'Dark', 'Sheng', 'Shou', 'Herbal', 'Misc']} className="text-xs text-tea-text" />
                    </div>
                    <div className="flex items-center justify-between gap-3 py-2.5 min-h-[44px]">
                      <span className="text-ui-11 text-tea-text-sec uppercase tracking-[0.06em] shrink-0 w-20 md:w-24">Form</span>
                      <GhostSelect ariaLabel="Form" value={product.form || ''} onSave={(val) => handleUpdate(product.id, 'form', val)} options={['Loose Leaf', 'Cake', 'Tuo', 'Brick', 'Rolled', 'Ball', 'Powder', 'Bag', 'Other']} className="text-xs text-tea-text" />
                    </div>
                  </>
                )}
                <div className="flex items-center justify-between gap-3 py-2.5 min-h-[44px]">
                  <span className="text-ui-11 text-tea-text-sec uppercase tracking-[0.06em] shrink-0 w-20 md:w-24">Year</span>
                  <GhostInput value={product.year || ''} onSave={(val) => handleUpdate(product.id, 'year', val)} type="number" align="right" className="text-xs text-tea-text flex-1" />
                </div>

                {/* Origin */}
                <div className="mt-3 pt-3 border-t border-tea-accent-sub">
                  <div className="text-ui-9 text-tea-text-dim uppercase tracking-[0.18em] mb-2">Origin</div>
                  {[
                    { label: 'Country', field: 'originCountry' as const, value: product.originCountry || '' },
                    { label: 'Region', field: 'originRegion' as const, value: product.originRegion || '' },
                  ].map(item => (
                    <div key={item.field} className="flex items-center justify-between gap-3 py-2.5 min-h-[44px]">
                      <span className="text-ui-11 text-tea-text-sec uppercase tracking-[0.06em] shrink-0 w-20 md:w-24">{item.label}</span>
                      <GhostInput value={item.value} onSave={(val) => handleUpdate(product.id, item.field, val)} align="right" className="text-xs text-tea-text flex-1" />
                    </div>
                  ))}
                  <div className="flex items-center justify-between gap-3 py-2.5 min-h-[44px]">
                    <div className="flex items-center gap-1.5 shrink-0 w-20 md:w-24">
                      <span className="text-ui-11 text-tea-text-sec uppercase tracking-[0.06em]">Vendor</span>
                      {product.vendor && (
                        <button onClick={() => navigate(`/admin/people?tab=sources&search=${encodeURIComponent(product.vendor || '')}`)} className="text-tea-gold hover:text-tea-gold-lt transition-colors" title="View vendor profile">
                          <ChevronRight size={12} />
                        </button>
                      )}
                    </div>
                    <VendorPicker
                      value={product.vendor || ''}
                      productId={product.id}
                      onChange={(val) => handleUpdate(product.id, 'vendor', val)}
                      className="w-full bg-transparent border-b border-dashed border-tea-accent-sub focus:border-solid focus:border-tea-accent-sub focus:bg-tea-gold/[0.06] rounded-none py-0 px-0 outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg transition-all text-right text-xs text-tea-text placeholder-tea-text-dim leading-none"
                    />
                  </div>

                  {/* Links */}
                  <div className="mt-3 pt-3 border-t border-tea-accent-sub">
                    <div className="text-ui-9 text-tea-text-dim uppercase tracking-[0.18em] mb-1">Links</div>
                  </div>
                  {(() => {
                    const compassEntryId = product.sourceCompassEntryId;
                    const compassEntry = compassEntryId
                      ? compassEntries.find(e => e.id === compassEntryId)
                      : compassEntries.find(e => e.draftProductId === product.id);
                    if (!compassEntry && !compassEntryId) return null;
                    const linkId = compassEntry?.id || compassEntryId!;
                    return (
                      <div className="flex items-center justify-between gap-3 py-2.5 min-h-[44px]">
                        <span className="text-ui-11 text-tea-text-sec uppercase tracking-[0.06em] shrink-0 w-20 md:w-24">Encounter</span>
                        <button onClick={() => navigate(`/admin/compass?tab=buying&entry=${encodeURIComponent(linkId)}`)} className="text-xs text-tea-gold hover:text-tea-text transition-colors text-right flex items-center gap-1.5">
                          <Globe size={10} />
                          {compassEntry?.vendorName || 'Encounters Entry'}
                          {compassEntry && <span className="text-tea-text-dim">· {new Date(compassEntry.createdAt).toLocaleDateString()}</span>}
                          <ChevronRight size={11} className="text-tea-text-dim shrink-0" />
                        </button>
                      </div>
                    );
                  })()}
                  <div className="flex items-center justify-between gap-3 py-2.5 min-h-[44px]">
                    <span className="text-ui-11 text-tea-text-sec uppercase tracking-[0.06em] shrink-0 w-20 md:w-24">Orders</span>
                    <button onClick={() => navigate(`/admin/activity?tab=orders&search=${encodeURIComponent(product.givenName || product.productName)}`)} className="text-xs text-tea-gold hover:text-tea-text transition-colors text-right flex items-center gap-1.5">
                      <Receipt size={10} />
                      View order history
                      <ChevronRight size={11} className="text-tea-text-dim shrink-0" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-3 py-2.5 min-h-[44px]">
                    <span className="text-ui-11 text-tea-text-sec uppercase tracking-[0.06em] shrink-0 w-20 md:w-24">Story</span>
                    <button onClick={() => navigate(`/admin/products/${product.id}/story`)} className="text-xs text-tea-gold hover:text-tea-text transition-colors text-right flex items-center gap-1.5">
                      <BookOpen size={10} />
                      View full story
                      <ChevronRight size={11} className="text-tea-text-dim shrink-0" />
                    </button>
                  </div>
                </div>

                {/* Toggles */}
                <div className="mt-3 pt-3 border-t border-tea-accent-sub space-y-2.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-ui-9 text-tea-text-dim uppercase tracking-[0.15em] w-14 shrink-0">Visibility</span>
                    {([
                      { field: 'isPublic' as const, label: 'In Shop', icon: product.isPublic ? <Eye size={10} /> : <EyeOff size={10} />, active: product.isPublic },
                    ] as const).map(toggle => (
                      <button key={toggle.field} onClick={() => handleUpdate(product.id, toggle.field, !toggle.active)} className={`pill ${toggle.active ? 'pill-active' : ''}`}>
                        {toggle.icon} {toggle.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-ui-9 text-tea-text-dim uppercase tracking-[0.15em] w-14 shrink-0">Promote</span>
                    {([
                      { field: 'isFeatured' as const, label: 'Starred', icon: <Star size={10} className={product.isFeatured ? 'fill-tea-gold' : ''} />, active: product.isFeatured },
                      { field: 'isCurated' as const, label: 'Top Pick', icon: <Sparkles size={10} />, active: product.isCurated },
                    ] as const).map(toggle => (
                      <button key={toggle.field} onClick={() => handleUpdate(product.id, toggle.field, !toggle.active)} className={`pill ${toggle.active ? 'pill-active' : ''}`}>
                        {toggle.icon} {toggle.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-ui-9 text-tea-text-dim uppercase tracking-[0.15em] w-14 shrink-0">Classify</span>
                    {([
                      { field: 'isSample' as const, label: 'Sample', icon: <FlaskConical size={10} />, active: product.isSample },
                      { field: 'canReorder' as const, label: 'Restockable', icon: <RefreshCw size={10} />, active: product.canReorder },
                      { field: 'isPersonal' as const, label: 'Mine', icon: <User size={10} />, active: product.isPersonal },
                    ] as const).map(toggle => (
                      <button key={toggle.field} onClick={() => handleUpdate(product.id, toggle.field, !toggle.active)} className={`pill ${toggle.active ? 'pill-active' : ''}`}>
                        {toggle.icon} {toggle.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </CollapsibleSection>

            {/* 2. Images — flat, no section header */}
            <div className="px-3 mb-3">
              <ImageManager product={product} onUpdate={(field, value) => handleUpdate(product.id, field, value)} />
            </div>

            {/* 3. Tasting Profile — tap-to-open */}
            <button
              onClick={() => setTastingEditorProduct(product)}
              aria-label={flattenedTastingCount > 0 ? `Edit tasting profile (${flattenedTastingCount} notes)` : 'Add tasting profile'}
              className="w-full mx-3 mb-3 rounded-lg bg-tea-surface px-4 py-3 flex items-center justify-between gap-3 hover:bg-tea-gold/5 active:bg-tea-gold/10 transition-colors group"
              style={{ width: 'calc(100% - 1.5rem)' }}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Sparkles size={14} className="text-tea-text-dim group-hover:text-tea-gold transition-colors shrink-0" aria-hidden="true" />
                <span className="text-xs font-serif italic text-tea-text-sec group-hover:text-tea-text transition-colors">Tasting Profile</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {flattenedTastingCount > 0 ? (
                  <>
                    {product.mood && <span className="text-ui-11 text-tea-gold italic font-serif truncate max-w-[140px]">{product.mood}</span>}
                    <span className="text-ui-10 text-tea-text-dim tabular-nums">{flattenedTastingCount}</span>
                  </>
                ) : (
                  <span className="text-ui-10 text-tea-text-dim italic">add</span>
                )}
                <ChevronRight size={13} aria-hidden="true" className="text-tea-text-dim group-hover:text-tea-text-sec transition-colors" />
              </div>
            </button>

            {/* 4. Pricing */}
            <CollapsibleSection title="Pricing" defaultOpen={false}>
              {inventoryCategory === 'teaware' ? (
                <div className="space-y-0">
                  {[
                    { label: 'Cost', field: 'costAmount' as const, value: product.costAmount },
                    { label: 'Retail ($)', field: 'pricePerGramUSD' as const, value: product.pricePerGramUSD },
                  ].map(item => (
                    <div key={item.field} className="flex items-center justify-between gap-3 py-2.5 min-h-[44px]">
                      <span className="text-ui-11 text-tea-text-sec uppercase tracking-[0.06em] shrink-0 w-20 md:w-24">{item.label}</span>
                      <GhostInput value={item.value} onSave={(val) => handleUpdate(product.id, item.field, val)} type="number" align="right" className="text-xs text-tea-text tabular-nums flex-1" />
                    </div>
                  ))}
                </div>
              ) : (() => {
                const calc = pricingCalc!;
                return (
                  <div className="space-y-0">
                    <div className="flex items-center justify-between gap-3 py-2.5 min-h-[44px]">
                      <span className="text-ui-11 text-tea-text-sec uppercase tracking-[0.06em] shrink-0 w-20 md:w-24">Batch Cost</span>
                      <div className="flex items-center gap-1.5 flex-1 justify-end">
                        <div className="relative flex items-center">
                          <select
                            value={product.costCurrency || 'USD'}
                            onChange={(e) => handleUpdate(product.id, 'costCurrency', e.target.value)}
                            className="bg-transparent text-ui-10 text-tea-text-sec font-medium uppercase outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg cursor-pointer appearance-none border-none pr-3"
                          >
                            {['USD', 'NT', 'Yuan', 'IDR', 'JPY', 'MYR', 'HKD'].map(c => (
                              <option key={c} value={c} className="bg-tea-surface text-tea-text">{c === 'Yuan' ? 'CNY' : c}</option>
                            ))}
                          </select>
                          <ChevronDown size={9} className="absolute right-0 top-1/2 -translate-y-1/2 text-tea-text-dim pointer-events-none" />
                        </div>
                        <GhostInput value={product.costAmount} onSave={(val) => handleUpdate(product.id, 'costAmount', val)} type="number" align="right" className="text-xs text-tea-text tabular-nums flex-1" />
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3 py-2.5 min-h-[44px]">
                      <span className="text-ui-11 text-tea-text-sec uppercase tracking-[0.06em] shrink-0 w-20 md:w-24">Batch Weight</span>
                      <GhostInput value={product.quantityPurchased || 0} onSave={(val) => handleUpdate(product.id, 'quantityPurchased', val)} type="number" align="right" className="text-xs text-tea-text tabular-nums flex-1" />
                    </div>
                    <div className="flex items-center justify-between gap-3 py-2.5 min-h-[44px]">
                      <span className="text-ui-11 text-tea-text-sec uppercase tracking-[0.06em] shrink-0 w-20 md:w-24">Shipping/kg</span>
                      <GhostInput value={product.shippingRatePerKg || 13} onSave={(val) => handleUpdate(product.id, 'shippingRatePerKg', val)} type="number" align="right" className="text-xs text-tea-text tabular-nums flex-1" />
                    </div>
                    <div className="flex items-center justify-between gap-3 py-2 mt-2 rounded-md bg-tea-bg px-2 -mx-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-ui-10 text-tea-text-dim uppercase tracking-[0.06em] shrink-0">Calculated Retail</span>
                        <span className="text-ui-9 text-tea-text-dim uppercase tracking-[0.08em]">(3× markup)</span>
                      </div>
                      <span className="text-xs text-tea-text-sec tabular-nums font-medium">${calc.suggestedRetailUSD.toFixed(2)}/g</span>
                    </div>
                    <div className="flex items-center justify-between gap-3 py-2.5 min-h-[44px]">
                      <div className="flex items-center gap-1.5 shrink-0 w-20 md:w-24">
                        <span className="text-ui-11 text-tea-text-sec uppercase tracking-[0.06em]">Override</span>
                        {product.fixedRetailPriceUSD && product.fixedRetailPriceUSD < calc.trueCostUSD && (
                          <span className="text-ui-10 text-tea-error italic" title="Below true cost">Below cost</span>
                        )}
                      </div>
                      <GhostInput
                        value={product.fixedRetailPriceUSD ?? ''}
                        placeholder={calc.suggestedRetailUSD > 0 ? calc.suggestedRetailUSD.toFixed(2) : '—'}
                        onSave={(val) => handleUpdate(product.id, 'fixedRetailPriceUSD', val === '' || val === null ? null : Number(val))}
                        type="number"
                        align="right"
                        className={`text-xs tabular-nums flex-1 ${product.fixedRetailPriceUSD != null ? 'text-tea-gold font-medium' : 'text-tea-text'}`}
                      />
                    </div>
                    <div className="mt-2">
                      <button onClick={() => setBreakdownOpen(!breakdownOpen)} className="flex items-center gap-1.5 text-xs text-tea-text-dim hover:text-tea-text-sec transition-colors py-2 w-full">
                        <ChevronRight size={11} className={`transition-transform duration-150 ${breakdownOpen ? 'rotate-90' : ''}`} />
                        Cost Breakdown
                      </button>
                      <div className="grid transition-[grid-template-rows] duration-200 ease-out" style={{ gridTemplateRows: breakdownOpen ? '1fr' : '0fr' }}>
                        <div className="overflow-hidden">
                          <div className="bg-tea-bg rounded-md px-3 py-2.5 mt-1 space-y-2">
                            <div className="flex justify-between text-xs"><span className="text-tea-text-sec">Source Cost/g</span><span className="text-tea-text tabular-nums">{calc.costPerGramSource.toFixed(3)} {product.costCurrency || 'USD'}</span></div>
                            <div className="flex justify-between text-xs"><span className="text-tea-text-sec">Exchange Rate</span><span className="text-tea-text tabular-nums">{calc.rateUsed}</span></div>
                            <div className="flex justify-between text-xs"><span className="text-tea-text-sec">True Cost (USD)</span><span className="text-tea-text tabular-nums font-semibold">${calc.trueCostUSD.toFixed(3)}/g</span></div>
                            <div className="flex justify-between text-xs border-t border-tea-accent-sub pt-2"><span className="text-tea-text-sec">3× Markup</span><span className="text-tea-gold tabular-nums font-medium">${calc.suggestedRetailUSD.toFixed(2)}/g</span></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </CollapsibleSection>

            {/* 5. Stock */}
            <CollapsibleSection title="Stock" defaultOpen={true}>
              <div className="space-y-0">
                {inventoryCategory === 'teaware' ? (
                  <>
                    <div className="flex items-center justify-between gap-3 py-2.5 min-h-[44px]">
                      <span className="text-ui-11 text-tea-text-sec uppercase tracking-[0.06em] shrink-0 w-20 md:w-24">Units</span>
                      <GhostInput value={product.quantityUnits || ''} onSave={(val) => handleUpdate(product.id, 'quantityUnits', val)} type="number" align="right" className="text-xs text-tea-text tabular-nums flex-1" />
                    </div>
                    <div className="flex items-center justify-between gap-3 py-2.5 min-h-[44px]">
                      <span className="text-ui-11 text-tea-text-sec uppercase tracking-[0.06em] shrink-0 w-20 md:w-24">Capacity (ml)</span>
                      <GhostInput value={product.capacityMl || ''} onSave={(val) => handleUpdate(product.id, 'capacityMl', val)} type="number" align="right" className="text-xs text-tea-text tabular-nums flex-1" />
                    </div>
                  </>
                ) : (() => {
                  const stock = product.stockGrams;
                  const threshold = product.lowStockThreshold || 0;
                  const isLow = threshold > 0 && stock <= threshold;
                  const isOut = stock === 0;
                  const pct = threshold > 0 ? Math.min(1, stock / (threshold * 4)) : null;
                  const barColor = isOut ? 'bg-tea-error/60' : isLow ? 'bg-tea-gold/60' : 'bg-tea-gold/40';
                  return (
                    <>
                      <div className="flex items-center justify-between gap-3 py-2.5 min-h-[44px]">
                        <div className="flex items-center gap-1.5 shrink-0 w-20 md:w-24">
                          <span className="text-ui-11 text-tea-text-sec uppercase tracking-[0.06em]">Current</span>
                          <span className="text-ui-9 text-tea-text-dim uppercase tracking-[0.08em]">(g)</span>
                        </div>
                        <div className="flex items-center gap-2 flex-1 justify-end">
                          {isLow && !isOut && <span className="text-ui-10 text-tea-gold/80 italic">Low</span>}
                          {isOut && <span className="text-ui-10 text-tea-error italic">Empty</span>}
                          <GhostInput value={stock} onSave={(val) => handleUpdate(product.id, 'stockGrams', val)} type="number" align="right" className={`text-xs tabular-nums w-20 ${isOut ? 'text-tea-error font-medium' : isLow ? 'text-tea-gold font-medium' : 'text-tea-text'}`} />
                        </div>
                      </div>
                      {pct !== null && (
                        <div className="flex items-center gap-2 pb-1">
                          <div className="flex-1 h-1 bg-tea-bg rounded-full overflow-hidden">
                            <div className={`h-full rounded-full origin-left transition-transform duration-500 ${barColor}`} style={{ transform: `scaleX(${pct})` }} />
                          </div>
                          <span className="text-ui-9 text-tea-text-dim tabular-nums w-10 text-right">
                            {threshold > 0 ? `${Math.round((stock / threshold) * 10) / 10}× min` : ''}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-3 py-2.5 min-h-[44px]">
                        <span className="text-ui-11 text-tea-text-sec uppercase tracking-[0.06em] shrink-0 w-20 md:w-24">Low Alert</span>
                        <GhostInput value={threshold} onSave={(val) => handleUpdate(product.id, 'lowStockThreshold', val)} type="number" align="right" className="text-xs text-tea-text tabular-nums flex-1" />
                      </div>
                    </>
                  );
                })()}

                <div className="flex items-center gap-2 pt-2.5 mt-1.5 border-t border-tea-accent-sub">
                  <button onClick={() => handleUpdate(product.id, 'recheckStock', !product.recheckStock)} className={`pill ${product.recheckStock ? 'pill-active-amber' : ''}`}>
                    <RefreshCw size={10} /> Flag for Recount
                  </button>
                  {product.stockVerifiedAt && (
                    <span className="text-ui-10 text-tea-text-dim ml-auto">
                      Verified {new Date(product.stockVerifiedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </div>

                <div className="mt-2">
                  <button onClick={() => setHistoryOpen(!historyOpen)} className="flex items-center gap-1.5 text-xs text-tea-text-dim hover:text-tea-text-sec transition-colors py-2 w-full">
                    <ChevronRight size={11} className={`transition-transform duration-150 ${historyOpen ? 'rotate-90' : ''}`} />
                    Stock History
                  </button>
                  <div className="grid transition-[grid-template-rows] duration-200 ease-out" style={{ gridTemplateRows: historyOpen ? '1fr' : '0fr' }}>
                    <div className="overflow-hidden">
                      <div className="mt-1">
                        <StockLedgerPanel productId={product.id} productName={product.givenName || product.productName} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CollapsibleSection>

            {/* 6. Experience */}
            <CollapsibleSection title="Experience" defaultOpen={false}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-ui-10 text-tea-text-dim italic">How it drinks — body, session, lingering impression</span>
              </div>
              <GhostTextarea ariaLabel="Experience" value={product.experience || ''} placeholder="How this tea feels in the body. The session it creates. What stays with you after the last cup." rows={4} onSave={(val) => handleUpdate(product.id, 'experience', val)} className="text-tea-text font-serif" />

              <div className="mt-5 pt-4 border-t border-tea-accent-sub space-y-5">
                <TaxonomyChipPicker
                  category="mood"
                  label="State"
                  value={product.moodTags ?? []}
                  onChange={(next) => handleUpdate(product.id, 'moodTags', next)}
                />
                <div className="pt-3 border-t border-tea-accent-sub">
                  <TaxonomyChipPicker
                    category="flavor"
                    label="Flavor"
                    value={product.flavorTags ?? []}
                    onChange={(next) => handleUpdate(product.id, 'flavorTags', next)}
                  />
                </div>
              </div>
            </CollapsibleSection>

            {/* 7. Story & Background */}
            <CollapsibleSection title="Story & Background" defaultOpen={false}>
              <div className="space-y-5">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-tea-text-sec">Introduction</span>
                    <span className="text-ui-10 text-tea-text-dim italic">Personal voice</span>
                  </div>
                  <GhostTextarea ariaLabel="Introduction" value={product.description || ''} placeholder="Your personal introduction to this tea..." rows={4} onSave={(val) => handleUpdate(product.id, 'description', val)} className="text-tea-text font-serif" />
                </div>
                <div className="pt-1 border-t border-tea-accent-sub">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-tea-text-sec">Terroir</span>
                    <span className="text-ui-10 text-tea-text-dim italic">Soil, altitude, climate</span>
                  </div>
                  <GhostTextarea ariaLabel="Terroir" value={product.terroir || ''} placeholder="Where this tea grew and why it matters..." rows={3} onSave={(val) => handleUpdate(product.id, 'terroir', val)} className="text-tea-text font-serif" />
                </div>
                <div className="pt-1 border-t border-tea-accent-sub">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-tea-text-sec">Processing</span>
                    <span className="text-ui-10 text-tea-text-dim italic">Craft & method</span>
                  </div>
                  <GhostTextarea ariaLabel="Processing notes" value={product.processingNotes || ''} placeholder="How this tea was made..." rows={3} onSave={(val) => handleUpdate(product.id, 'processingNotes', val)} className="text-tea-text font-serif" />
                </div>
                <div className="pt-1 border-t border-tea-accent-sub">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-tea-text-sec">Lore & History</span>
                    {product.isCustomWisdom
                      ? <span className="flex items-center gap-1 text-ui-10 text-tea-gold/70 italic"><Pencil size={10} /> hand-edited</span>
                      : <span className="text-ui-10 text-tea-text-dim italic">AI generated</span>}
                  </div>
                  <GhostTextarea
                    ariaLabel="Lore and history"
                    value={product.lore || ''}
                    placeholder="History, story, or lore..."
                    rows={3}
                    onSave={(val) => {
                      handleUpdate(product.id, 'lore', val);
                      if (!product.isCustomWisdom) handleUpdate(product.id, 'isCustomWisdom', true);
                    }}
                    className="text-tea-text font-serif"
                  />
                </div>
              </div>
            </CollapsibleSection>

            {/* 8. Events */}
            <CollapsibleSection title="Events" defaultOpen={false}>
              {productEventsLoading ? (
                <div className="flex items-center gap-2 py-2 text-xs text-tea-text-dim">
                  <Loader2 size={12} className="animate-spin" />
                  <span>Loading events…</span>
                </div>
              ) : productEvents.length === 0 ? (
                <p className="text-xs text-tea-text-dim italic py-1">Not featured at any events yet.</p>
              ) : (
                <>
                  {productTastingAgg && productTastingAgg.totalNotes > 0 && (
                    <div className="mb-4 rounded-lg bg-tea-surface border border-tea-accent-sub overflow-hidden">
                      <div className="flex items-center gap-4 px-4 py-3 border-b border-tea-accent-sub">
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-serif text-tea-gold leading-none">{productTastingAgg.avgRating.toFixed(1)}</span>
                          <span className="text-ui-10 text-tea-text-dim">/5</span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs text-tea-text-sec">
                            {productTastingAgg.totalNotes} tasting {productTastingAgg.totalNotes === 1 ? 'note' : 'notes'}
                          </span>
                          {productTastingAgg.favoriteCount > 0 && (
                            <span className="text-xs text-tea-text-dim">
                              {productTastingAgg.favoriteCount} {productTastingAgg.favoriteCount === 1 ? 'guest favorited' : 'guests favorited'}
                            </span>
                          )}
                        </div>
                      </div>
                      {productTastingAgg.impressions.length > 0 && (
                        <div className="px-4 py-3 space-y-2.5">
                          <div className="text-ui-9 text-tea-text-dim uppercase tracking-[0.15em]">Guest Impressions</div>
                          {productTastingAgg.impressions.map((imp, i) => (
                            <p key={i} className="text-xs font-serif italic text-tea-text leading-relaxed">"{imp}"</p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="text-ui-9 text-tea-text-dim uppercase tracking-[0.15em] mb-2">Appeared at</div>
                  <div className="space-y-2">
                    {productEvents.map((event: any) => (
                      <div key={event.id} className="flex items-center justify-between gap-3 py-1">
                        <span className="text-xs text-tea-text font-medium truncate">{event.name || event.title || 'Event'}</span>
                        {(event.date || event.event_date) && (
                          <span className="text-ui-11 text-tea-text-dim shrink-0">
                            {new Date(event.date || event.event_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CollapsibleSection>

            <CollapsibleSection title="Collections" defaultOpen={false}>
              {product?.id && <ProductCollectionsSection productId={product.id} />}
            </CollapsibleSection>

            <div className="pb-16" />
          </div>
        </>)}
      </div>

      {/* Mobile backdrop */}
      {product && <div className="fixed inset-0 bottom-[calc(44px+env(safe-area-inset-bottom))] z-20 bg-black/50 md:hidden" onClick={onClose} />}

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
