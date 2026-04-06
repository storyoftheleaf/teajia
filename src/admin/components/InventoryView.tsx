import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Loader2, FileSpreadsheet, Plus, Search, QrCode, Download,
  Trash2, AlertTriangle, Archive, Pencil, AlertOctagon, ArrowUpDown, ArrowUp, ArrowDown, Copy, Layers, Settings, MoreHorizontal, Check, X as XIcon, Eye, EyeOff, Star, Sparkles, FlaskConical, RefreshCw, ChevronDown, ChevronRight, ChevronUp, ChevronLeft, MapPin, Save, Columns, PanelRightOpen, Square, CheckSquare, Leaf, Coffee, Image as ImageIcon, Globe, Tag, FileText, User, Receipt
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Papa from 'papaparse';
import Fuse from 'fuse.js';
import { api } from '../../lib/api';
import { calculatePricing } from '../utils';
import { Product } from '../types';
import { QrCodeModal } from './QrCodeModal';
import { useRates, useCustomers } from '../hooks/useAdminData';
import { useToast } from './Toast';
import { useAppStore } from '../store';
import { fmtNum } from '../../utils/formatNumber';
import { getThemeColor } from '../themeUtils';
import { TastingEditorModal } from './TastingEditorModal';
import { StockLedgerPanel } from './StockLedgerPanel';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import { TeaDetailsModal } from './TeaDetailsModal';
import {
  flattenTastingNotes,
  resolveTermLabel,
  resolveTermIcon,
  LIQUOR_COLORS,
  TERM_MAP,
  TASTING_CATEGORY_ORDER,
  SECTION_ICONS,
  type TastingCategoryId,
} from '../../data/tastingTaxonomy';

const MAINTENANCE_SQL = `-- Reset all data via API\n// Use the admin panel's reset function`;

const VIEW_ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  AlertTriangle,
  EyeOff,
  CheckSquare,
  FlaskConical,
  Archive,
  Coffee,
  FileText,
  Globe,
};

const VIEW_FILTER_LABELS: Record<string, string> = {
  All: 'All Inventory',
  ForSale: 'For Sale',
  Drafts: 'Drafts',
  Alerts: 'Needs Attention',
  Unpublished: 'Unpublished',
  Unverified: 'Stock Check',
  Samples: 'Samples',
  Personal: 'Personal Collection',
  Archived: 'Archived',
};

// --- COLUMN DEFINITIONS ---
type InventoryCategory = 'tea' | 'teaware';

const TEA_COLUMN_DEFS = [
  { key: 'productName', label: 'Product', defaultWidth: 'w-[28%]', alwaysVisible: true },
  { key: 'type', label: 'Type', defaultWidth: 'w-[10%]' },
  { key: 'year', label: 'Year', defaultWidth: 'w-[7%]' },
  { key: 'originRegion', label: 'Origin', defaultWidth: 'w-[15%]' },
  { key: 'stockGrams', label: 'Stock', defaultWidth: 'w-[8%]' },
  { key: 'verified', label: 'Verified', defaultWidth: 'w-[7%]' },
  { key: 'costAmount', label: 'Cost', defaultWidth: 'w-[9%]' },
  { key: 'costPerGramUSD', label: 'Cost/g', defaultWidth: 'w-[8%]' },
  { key: 'pricePerGramUSD', label: 'Retail/g', defaultWidth: 'w-[8%]' },
] as const;

const TEAWARE_COLUMN_DEFS = [
  { key: 'productName', label: 'Product', defaultWidth: 'w-[28%]', alwaysVisible: true },
  { key: 'teawareCategory', label: 'Category', defaultWidth: 'w-[12%]' },
  { key: 'material', label: 'Material', defaultWidth: 'w-[14%]' },
  { key: 'capacityMl', label: 'Capacity', defaultWidth: 'w-[10%]' },
  { key: 'quantityUnits', label: 'Units', defaultWidth: 'w-[8%]' },
  { key: 'verified', label: 'Verified', defaultWidth: 'w-[7%]' },
  { key: 'costAmount', label: 'Cost', defaultWidth: 'w-[10%]' },
  { key: 'pricePerGramUSD', label: 'Retail', defaultWidth: 'w-[8%]' },
] as const;


const GROUPBY_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'type', label: 'Type' },
  { value: 'vendor', label: 'Vendor' },
  { value: 'status', label: 'Status' },
  { value: 'originCountry', label: 'Origin Country' },
] as const;

const DEFAULT_TEA_VIEWS: Array<{ id: string; name: string; icon?: string | null; columns: string[]; sortConfig: { key: string; direction: 'asc' | 'desc' }[]; filterType: string; groupBy: string | null }> = [
  // Text label
  {
    id: 'default-all',
    name: 'All',
    icon: null,
    columns: ['productName', 'type', 'year', 'originRegion', 'stockGrams', 'costAmount', 'pricePerGramUSD'],
    sortConfig: [{ key: 'type', direction: 'asc' as const }],
    filterType: 'All',
    groupBy: null,
  },
  // Icons after
  {
    id: 'default-forsale',
    name: '',
    icon: 'Globe',
    columns: ['productName', 'type', 'year', 'originRegion', 'stockGrams', 'pricePerGramUSD'],
    sortConfig: [{ key: 'type', direction: 'asc' as const }],
    filterType: 'ForSale',
    groupBy: null,
  },
  {
    id: 'default-drafts',
    name: '',
    icon: 'FileText',
    columns: ['productName', 'type', 'year', 'originRegion', 'vendor', 'costAmount', 'stockGrams'],
    sortConfig: [{ key: 'type', direction: 'asc' as const }],
    filterType: 'Drafts',
    groupBy: null,
  },
  {
    id: 'default-low-stock',
    name: '',
    icon: 'AlertTriangle',
    columns: ['productName', 'type', 'year', 'originRegion', 'stockGrams', 'costAmount', 'pricePerGramUSD'],
    sortConfig: [{ key: 'stockGrams', direction: 'asc' as const }],
    filterType: 'Alerts',
    groupBy: null,
  },
  {
    id: 'default-unpublished',
    name: '',
    icon: 'EyeOff',
    columns: ['productName', 'type', 'stockGrams', 'pricePerGramUSD'],
    sortConfig: [{ key: 'type', direction: 'asc' as const }],
    filterType: 'Unpublished',
    groupBy: null,
  },
  {
    id: 'default-stock-check',
    name: '',
    icon: 'CheckSquare',
    columns: ['productName', 'type', 'stockGrams', 'verified'],
    sortConfig: [{ key: 'type', direction: 'asc' as const }],
    filterType: 'Unverified',
    groupBy: null,
  },
  {
    id: 'default-samples',
    name: '',
    icon: 'FlaskConical',
    columns: ['productName', 'type', 'year', 'originRegion', 'stockGrams', 'costAmount'],
    sortConfig: [{ key: 'type', direction: 'asc' as const }],
    filterType: 'Samples',
    groupBy: null,
  },
  {
    id: 'default-personal',
    name: '',
    icon: 'Coffee',
    columns: ['productName', 'type', 'year', 'originRegion', 'stockGrams', 'costAmount'],
    sortConfig: [{ key: 'type', direction: 'asc' as const }],
    filterType: 'Personal',
    groupBy: null,
  },
  {
    id: 'default-archived',
    name: '',
    icon: 'Archive',
    columns: ['productName', 'type', 'year', 'originRegion', 'stockGrams', 'costAmount'],
    sortConfig: [{ key: 'type', direction: 'asc' as const }],
    filterType: 'Archived',
    groupBy: null,
  },
];

const DEFAULT_TEAWARE_VIEWS: typeof DEFAULT_TEA_VIEWS = [
  {
    id: 'default-teaware-all',
    name: 'All',
    columns: ['productName', 'teawareCategory', 'material', 'capacityMl', 'quantityUnits', 'costAmount', 'pricePerGramUSD'],
    sortConfig: [{ key: 'teawareCategory', direction: 'asc' as const }],
    filterType: 'All',
    groupBy: null,
  },
  {
    id: 'default-teaware-unpublished',
    name: 'Hidden',
    columns: ['productName', 'teawareCategory', 'material', 'costAmount', 'pricePerGramUSD'],
    sortConfig: [{ key: 'teawareCategory', direction: 'asc' as const }],
    filterType: 'Unpublished',
    groupBy: null,
  },
  {
    id: 'default-teaware-archived',
    name: 'Archived',
    columns: ['productName', 'teawareCategory', 'material', 'costAmount', 'pricePerGramUSD'],
    sortConfig: [{ key: 'teawareCategory', direction: 'asc' as const }],
    filterType: 'Archived',
    groupBy: null,
  },
];


const BULK_EDIT_FIELDS: readonly { key: string; label: string; type: 'select' | 'boolean'; options?: readonly string[] }[] = [
  { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Archived', 'Sold Out', 'Draft'] },
  { key: 'isPublic', label: 'Public', type: 'boolean' },
  { key: 'isFeatured', label: 'Featured', type: 'boolean' },
  { key: 'isPersonal', label: 'Personal', type: 'boolean' },
  { key: 'canReorder', label: 'Can Reorder', type: 'boolean' },
];

interface InventoryViewProps {
  products: Product[];
  isLoading: boolean;
  isError?: boolean;
  error?: Error | null;
  onImportClick: () => void;
  onAddClick: () => void;
  onRefresh: () => void;
  /** Category controlled from parent top bar */
  externalCategory?: 'tea' | 'teaware';
  /** Search query controlled from parent top bar */
  externalSearchQuery?: string;
  /** Options menu controlled from parent top bar */
  externalShowOptions?: boolean;
  onOptionsToggle?: (open: boolean) => void;
}

// --- GHOST INPUT COMPONENT ---
// Invisible input that looks like text until focused
const GhostTextarea = ({
    value,
    onSave,
    className = '',
    placeholder = '',
    rows = 3,
}: {
    value: string,
    onSave: (val: string) => void,
    className?: string,
    placeholder?: string,
    rows?: number,
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
    // Auto-expand to fit content
    useEffect(() => {
        const el = textareaRef.current;
        if (el) {
            el.style.height = 'auto';
            el.style.height = el.scrollHeight + 'px';
        }
    }, [localValue]);
    return (
        <textarea
            ref={textareaRef}
            value={localValue || ''}
            onChange={(e) => setLocalValue(e.target.value)}
            onBlur={handleBlur}
            placeholder={placeholder}
            rows={rows}
            className={`w-full bg-transparent border border-transparent focus:border-tea-accent-sub focus:bg-tea-gold/[0.06] rounded-md py-1.5 px-2 outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg transition-all resize-none text-xs leading-relaxed whitespace-pre-line placeholder-tea-text-dim/70 min-h-[80px] overflow-hidden ${justSaved ? '!text-tea-gold' : ''} ${className}`}
        />
    );
};

const GhostInput = ({
    value,
    onSave,
    type = 'text',
    align = 'left',
    className = '',
    placeholder = '',
    inputMode,
    id
}: {
    value: string | number,
    onSave: (val: any) => void,
    type?: 'text' | 'number',
    align?: 'left' | 'right',
    className?: string,
    placeholder?: string,
    inputMode?: string,
    id?: string
}) => {
    const [localValue, setLocalValue] = useState(value);
    
    // Sync with prop updates (e.g. from refresh)
    useEffect(() => {
        setLocalValue(value);
    }, [value]);

    const [justSaved, setJustSaved] = useState(false);

    const handleBlur = () => {
        // Simple loose equality check to prevent unnecessary saves (e.g. "10" vs 10)
        if (localValue != value) {
            onSave(localValue);
            setJustSaved(true);
            setTimeout(() => setJustSaved(false), 600);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.currentTarget.blur();
        }
    };

    return (
        <input
            id={id}
            type={type}
            value={localValue || ''}
            onChange={(e) => setLocalValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            inputMode={inputMode || (type === 'number' ? 'decimal' : undefined) as any}
            className={`w-full bg-transparent border-b border-transparent [@media(hover:none)]:border-dotted [@media(hover:none)]:border-tea-accent-sub focus:border-tea-accent-sub focus:border-solid focus:bg-tea-gold/[0.06] rounded-none py-0 px-0 outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg transition-all text-${align} placeholder-tea-text-dim/70 leading-none ${justSaved ? '!text-tea-gold' : ''} ${className}`}
        />
    );
};

// --- GHOST SELECT ---
const GhostSelect = ({ value, onSave, options, className = '' }: {
    value: string, onSave: (val: string) => void, options: string[], className?: string
}) => (
    <div className="relative flex-1">
        <select
            value={value}
            onChange={(e) => onSave(e.target.value)}
            className={`w-full bg-transparent border-b border-transparent focus:border-tea-accent-sub focus:bg-tea-gold/[0.06] rounded-none py-0 px-0 pr-4 outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg transition-all text-right appearance-none cursor-pointer leading-none ${className}`}
        >
            {options.map(opt => (
                <option key={opt} value={opt} className="bg-tea-surface text-tea-text">{opt}</option>
            ))}
        </select>
        <ChevronRight size={10} className="absolute right-0 top-1/2 -translate-y-1/2 rotate-90 text-tea-text-sec pointer-events-none" />
    </div>
);

// --- VENDOR PICKER (inline, uses useCustomers) ---
const VendorPicker = ({ value, onChange, productId, className }: {
    value: string, onChange: (name: string) => void, productId?: string, className?: string
}) => {
    const { data: customers = [], refetch: refetchCustomers } = useCustomers();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState(value);
    const wrapperRef = useRef<HTMLDivElement>(null);

    const vendors = useMemo(() => {
        return customers
            .filter(c => c.tags?.includes('vendor'))
            .map(c => c.name)
            .sort((a, b) => a.localeCompare(b));
    }, [customers]);

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
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const isNew = query.trim() && !vendors.some(v => v.toLowerCase() === query.trim().toLowerCase());

    // Auto-create vendor customer and link the product
    const handleSelectVendor = async (name: string) => {
        onChange(name);
        setOpen(false);
        if (!name) return;

        // Find existing customer by name (with or without vendor tag)
        let vendorCustomer = customers.find(
            c => c.name.toLowerCase() === name.toLowerCase()
        );

        if (!vendorCustomer) {
            // Create new customer with vendor tag
            try {
                const created = await api.customers.create({
                    name,
                    tags: ['vendor'],
                });
                refetchCustomers();
                // Link the product to the new vendor
                if (productId && created?.id) {
                    await api.customers.linkProduct(created.id, productId);
                }
                return;
            } catch (err) {
                console.error('Failed to create vendor customer:', err);
                return;
            }
        }

        // Existing customer — ensure they have the vendor tag
        if (!vendorCustomer.tags?.includes('vendor')) {
            try {
                await api.customers.update(vendorCustomer.id, {
                    tags: [...(vendorCustomer.tags || []), 'vendor'],
                });
                refetchCustomers();
            } catch (err) {
                console.error('Failed to add vendor tag:', err);
            }
        }

        // Link the product to the vendor
        if (productId && vendorCustomer.id) {
            try {
                await api.customers.linkProduct(vendorCustomer.id, productId);
            } catch (err) {
                // Link may already exist — that's fine
            }
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
                className={className}
                placeholder="Type or pick a source..."
            />

            {open && (filtered.length > 0 || (query.trim() && isNew)) && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-tea-surface border border-tea-accent-sub rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {isNew && query.trim() && (
                        <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => handleSelectVendor(query.trim())}
                            className="w-full text-left px-3 py-2 text-xs text-tea-accent hover:bg-tea-bg transition-colors border-b border-tea-accent-sub">
                            + Add "{query.trim()}" as new source
                        </button>
                    )}
                    {filtered.map(v => (
                        <button key={v} type="button" onMouseDown={e => e.preventDefault()} onClick={() => { setQuery(v); handleSelectVendor(v); }}
                            className={`w-full text-left px-3 py-2 text-xs hover:bg-tea-bg transition-colors ${v === value ? 'text-tea-accent font-medium' : 'text-tea-text'}`}>
                            {v}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

// --- COLLAPSIBLE SECTION ---
const CollapsibleSection = ({ title, defaultOpen = true, mobileDefault, children }: {
    title: string, defaultOpen?: boolean, mobileDefault?: boolean, children: React.ReactNode
}) => {
    const [open, setOpen] = useState(() => {
        if (mobileDefault !== undefined && typeof window !== 'undefined' && !window.matchMedia('(min-width: 768px)').matches) {
            return mobileDefault;
        }
        return defaultOpen;
    });
    return (
        <div className="mx-3 mb-1.5 rounded-lg bg-tea-surface">
            <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-4 py-3.5 group">
                <span className="text-[11px] text-tea-text-sec uppercase tracking-[0.08em] font-semibold">{title}</span>
                <ChevronRight size={14} className={`text-tea-text-dim transition-transform duration-200 ${open ? 'rotate-90' : ''}`} />
            </button>
            <div
                className="grid transition-[grid-template-rows] duration-200 ease-out"
                style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
            >
                <div className="overflow-hidden">
                    <div className="px-4 pb-4">{children}</div>
                </div>
            </div>
        </div>
    );
};

// --- TAG INPUT COMPONENT ---
const TagInput = ({ suggestions, value, onSave, multiple = true, placeholder = '' }: {
    suggestions: string[], value: string[] | string, onSave: (val: any) => void,
    multiple?: boolean, placeholder?: string
}) => {
    const [input, setInput] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const tags = multiple ? (Array.isArray(value) ? value : []) : [];
    const singleValue = !multiple ? (typeof value === 'string' ? value : '') : '';
    const filtered = suggestions.filter(s =>
        s.toLowerCase().includes(input.toLowerCase()) &&
        (multiple ? !tags.includes(s) : true)
    ).slice(0, 8);

    const addTag = (tag: string) => {
        if (multiple) {
            const newTags = [...tags, tag];
            onSave(newTags);
        } else {
            onSave(tag);
        }
        setInput('');
        setShowDropdown(false);
    };

    const removeTag = (tag: string) => {
        if (multiple) {
            onSave(tags.filter(t => t !== tag));
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && input.trim()) {
            e.preventDefault();
            addTag(input.trim());
        }
    };

    return (
        <div className="relative">
            <input
                ref={inputRef}
                value={multiple ? input : (input || singleValue)}
                onChange={e => { setInput(e.target.value); setShowDropdown(true); if (!multiple) onSave(e.target.value); }}
                onFocus={() => setShowDropdown(true)}
                onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className="w-full bg-transparent border-b border-transparent focus:border-tea-accent-sub focus:bg-tea-gold/[0.06] rounded-none py-0 px-0 outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg transition-all text-xs text-tea-text placeholder-tea-text-dim/70 leading-none"
            />
            {showDropdown && input && filtered.length > 0 && (
                <div className="absolute z-10 left-0 right-0 mt-1 bg-tea-surface border border-tea-accent-sub rounded-md shadow-lg max-h-32 overflow-y-auto">
                    {filtered.map(s => (
                        <button key={s} onMouseDown={() => addTag(s)} className="w-full text-left px-3 py-1.5 text-xs text-tea-text-sec hover:bg-tea-elevated transition-colors">
                            {s}
                        </button>
                    ))}
                </div>
            )}
            {multiple && tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                    {tags.map(tag => (
                        <span key={tag} className="text-[10px] text-tea-text-sec bg-tea-surface/50 px-2 py-0.5 rounded-full flex items-center gap-1 group">
                            {tag}
                            <button onClick={() => removeTag(tag)} className="opacity-0 group-hover:opacity-100 transition-opacity"><XIcon size={8} /></button>
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
};

// --- IMAGE MANAGER ---
const ImageManager = ({ product, onUpdate }: {
    product: Product, onUpdate: (field: keyof Product, value: any) => void
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadingSlot, setUploadingSlot] = useState<number | null>(null);
    const { showToast } = useToast();

    const images = [
        product.imageUrl || '',
        ...(product.additionalImages || [])
    ].slice(0, 3);
    // Pad to 3 slots
    while (images.length < 3) images.push('');

    const handleUpload = async (file: File, slotIndex: number) => {
        setUploadingSlot(slotIndex);
        try {
            const url = await api.uploadImage(file);
            if (slotIndex === 0) {
                onUpdate('imageUrl', url);
            } else {
                const additional = [...(product.additionalImages || [])];
                additional[slotIndex - 1] = url;
                onUpdate('additionalImages' as keyof Product, additional);
            }
        } catch (err: any) {
            showToast(`Upload failed: ${err.message}`, 'error');
        } finally {
            setUploadingSlot(null);
        }
    };

    const handleRemove = (slotIndex: number) => {
        if (slotIndex === 0) {
            onUpdate('imageUrl', '');
        } else {
            const additional = [...(product.additionalImages || [])];
            additional.splice(slotIndex - 1, 1);
            onUpdate('additionalImages' as keyof Product, additional);
        }
    };

    return (
        <div className="flex gap-2">
            {images.map((img, i) => (
                <div key={i}>
                    {img ? (
                        <div className="w-16 h-16 rounded-md overflow-hidden relative group">
                            <img src={img} alt="" className="w-full h-full object-cover" />
                            <button
                                onClick={() => handleRemove(i)}
                                className="absolute inset-0 bg-tea-bg/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                            >
                                <XIcon size={14} className="text-tea-text-sec" />
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => {
                                const input = document.createElement('input');
                                input.type = 'file';
                                input.accept = 'image/*';
                                input.onchange = (e: any) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleUpload(file, i);
                                };
                                input.click();
                            }}
                            disabled={uploadingSlot !== null}
                            className="w-16 h-16 rounded-md border border-dashed border-tea-accent-sub hover:border-tea-gold/30 transition-colors flex items-center justify-center cursor-pointer"
                        >
                            {uploadingSlot === i ? (
                                <Loader2 size={14} className="text-tea-text-dim animate-spin" />
                            ) : (
                                <Plus size={14} className="text-tea-text-dim" />
                            )}
                        </button>
                    )}
                </div>
            ))}
        </div>
    );
};

export const InventoryView: React.FC<InventoryViewProps> = ({
  products, isLoading, isError, error, onImportClick, onAddClick, onRefresh,
  externalCategory = 'tea', externalSearchQuery = '',
  externalShowOptions, onOptionsToggle,
}) => {
  const { showToast } = useToast();

  // --- STORE ---
  const {
    inventoryColumns, toggleInventoryColumn, setInventoryColumns,
    savedViews, activeViewId, saveView, deleteView, setActiveView,
    inventoryGroupBy, setInventoryGroupBy,
    inventorySortConfig, setInventorySortConfig,
    aiPromptTemplate,
    currency,
    setCurrency,
    addToCart,
    setIsCartOpen,
  } = useAppStore();

  // --- STATE ---
  const [searchParams, setSearchParams] = useSearchParams();
  const vendorFilter = searchParams.get('vendor') || '';
  const panelParam = searchParams.get('panel') || '';
  const navigate = useNavigate();
  const compassEntries = useTeaCompassStore((s) => s.entries);
  const startNewCapture = useTeaCompassStore((s) => s.startNewCapture);
  const updateCompassEntry = useTeaCompassStore((s) => s.updateEntry);

  // Use external category/search from parent top bar
  const inventoryCategory: InventoryCategory = externalCategory;
  const searchQuery = externalSearchQuery;
  const [filterType, setFilterType] = useState<string>('All');
  const [showOptionsInternal, setShowOptionsInternal] = useState(false);
  const showOptions = externalShowOptions ?? showOptionsInternal;
  const setShowOptions = (v: boolean) => { setShowOptionsInternal(v); onOptionsToggle?.(v); };
  useEffect(() => { if (externalShowOptions !== undefined) setShowOptionsInternal(externalShowOptions); }, [externalShowOptions]);
  const [showMobileSort, setShowMobileSort] = useState(false);
  const [showMobileGroupBy, setShowMobileGroupBy] = useState(false);
  const [showGroupByDropdown, setShowGroupByDropdown] = useState(false);
  const [glossaryMode, setGlossaryMode] = useState(false);
  const [priceMode, setPriceMode] = useState<'retail' | 'cost'>('retail');
  const [viewTabsExpanded, setViewTabsExpanded] = useState(false);

  // Reset glossary mode when switching categories
  useEffect(() => { setGlossaryMode(false); }, [externalCategory]);

  // Escape key closes options dropdown
  useEffect(() => {
    if (!showOptions) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') { setShowOptions(false); e.preventDefault(); } };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showOptions]);

  // EDIT MODE STATE
  const [isEditMode, setIsEditMode] = useState(false);
  const [localProducts, setLocalProducts] = useState<Product[]>([]);

  // Initialize/Sync Local Products for Optimistic Updates
  // When a vendor filter is active, only show products from that vendor
  useEffect(() => {
    if (vendorFilter) {
      const vendorLower = vendorFilter.toLowerCase();
      setLocalProducts(products.filter(p => p.vendor && p.vendor.toLowerCase() === vendorLower));
    } else {
      setLocalProducts(products);
    }
  }, [products, vendorFilter]);

  // Feature 2: Column Show/Hide popover
  const [showColumnsPopover, setShowColumnsPopover] = useState(false);

  // Feature 3: Row Grouping collapsed state
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Feature 4: Saved Views — initialize defaults + sync names/icons from defaults
  useEffect(() => {
    if (savedViews.length === 0) {
      DEFAULT_TEA_VIEWS.forEach(v => saveView(v));
      DEFAULT_TEAWARE_VIEWS.forEach(v => saveView(v));
      setActiveView('default-all');
    } else {
      // Sync default view names + icons, and add any new defaults
      [...DEFAULT_TEA_VIEWS, ...DEFAULT_TEAWARE_VIEWS].forEach(def => {
        const existing = savedViews.find(v => v.id === def.id);
        if (!existing) {
          saveView(def);
        } else if (existing.name !== def.name || existing.icon !== def.icon) {
          saveView({ ...existing, name: def.name, icon: def.icon });
        }
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Switch columns when category changes (skip initial mount to avoid redundant store writes)
  const prevCategoryRef = useRef(inventoryCategory);
  useEffect(() => {
    if (prevCategoryRef.current === inventoryCategory) return;
    prevCategoryRef.current = inventoryCategory;
    const defaultView = inventoryCategory === 'teaware' ? DEFAULT_TEAWARE_VIEWS[0] : DEFAULT_TEA_VIEWS[0];
    setInventoryColumns(defaultView.columns);
    setInventorySortConfig(defaultView.sortConfig);
    setFilterType('All');
    setActiveView(defaultView.id);
  }, [inventoryCategory]); // eslint-disable-line react-hooks/exhaustive-deps

  // Feature 4: Save View prompt
  const [showSaveViewPrompt, setShowSaveViewPrompt] = useState(false);
  const [newViewName, setNewViewName] = useState('');

  // Feature 5: Record Panel
  const [panelProduct, setPanelProduct] = useState<Product | null>(null);
  const [panelDirty, setPanelDirty] = useState(false);
  const [rowDropdownId, setRowDropdownId] = useState<string | null>(null);
  const [panelBreakdownOpen, setPanelBreakdownOpen] = useState(false);
  const [panelHistoryOpen, setPanelHistoryOpen] = useState(false);
  useEffect(() => { setPanelDirty(false); }, [panelProduct?.id]);

  // Feature: Product Events & Tasting Aggregation
  const [productEvents, setProductEvents] = useState<any[]>([]);
  const [productEventsLoading, setProductEventsLoading] = useState(false);
  const [productTastingAgg, setProductTastingAgg] = useState<{
    avgRating: number;
    totalNotes: number;
    favoriteCount: number;
    impressions: string[];
  } | null>(null);

  const loadProductTastings = async (events: any[], productName: string) => {
    try {
      const allNotes: any[] = [];
      for (const event of events.slice(0, 5)) {
        try {
          const notes = await api.events.getTastingNotes(event.id);
          const eventNotes = Array.isArray(notes) ? notes : (notes as any).tasting_notes || [];
          const productNotes = eventNotes.filter((n: any) =>
            n.teaName && n.teaName.toLowerCase().includes(productName.toLowerCase())
          );
          allNotes.push(...productNotes);
        } catch { /* skip failed event */ }
      }
      if (allNotes.length > 0) {
        const ratings = allNotes.filter((n: any) => n.rating).map((n: any) => n.rating);
        setProductTastingAgg({
          avgRating: ratings.length > 0 ? ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length : 0,
          totalNotes: allNotes.length,
          favoriteCount: allNotes.filter((n: any) => n.isFavorite || n.is_favorite).length,
          impressions: allNotes
            .filter((n: any) => n.impression)
            .map((n: any) => n.impression)
            .slice(0, 5),
        });
      }
    } catch { /* silently fail */ }
  };

  useEffect(() => {
    if (!panelProduct) {
      setProductEvents([]);
      setProductTastingAgg(null);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setProductEventsLoading(true);
      setProductTastingAgg(null);
      try {
        const data = await api.products.getEvents(panelProduct.id);
        const events = Array.isArray(data) ? data : (data as any).events || [];
        if (!cancelled) {
          setProductEvents(events);
          if (events.length > 0) {
            loadProductTastings(events, panelProduct.givenName || panelProduct.name || '');
          }
        }
      } catch {
        if (!cancelled) setProductEvents([]);
      } finally {
        if (!cancelled) setProductEventsLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [panelProduct?.id]);

  // Close row dropdown on outside click
  useEffect(() => {
    if (!rowDropdownId) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-row-dropdown]')) setRowDropdownId(null);
    };
    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, [rowDropdownId]);

  // Auto-open panel from URL param (e.g. from Sources view)
  useEffect(() => {
    if (panelParam && products.length > 0) {
      const match = products.find(p => p.id === panelParam);
      if (match) {
        setPanelProduct(match);
        // Clear the param so it doesn't re-trigger
        setSearchParams(prev => { prev.delete('panel'); return prev; }, { replace: true });
      }
    }
  }, [panelParam, products]);

  // Tasting Editor Modal
  const [tastingEditorProduct, setTastingEditorProduct] = useState<Product | null>(null);

  // Feature 6: Keyboard Navigation
  const [focusedCell, setFocusedCell] = useState<{ row: number; col: number } | null>(null);

  // Feature 7: Bulk Edit
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkField, setBulkField] = useState<string>('status');
  const [bulkValue, setBulkValue] = useState<string>('');
  const [isBulkApplying, setIsBulkApplying] = useState(false);

  // Virtualization State
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(600);

  // Modals
  const [qrProduct, setQrProduct] = useState<Product | null>(null);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [detailsProduct, setDetailsProduct] = useState<Product | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetInput, setResetInput] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [stockHistoryProduct, setStockHistoryProduct] = useState<{ id: string; name: string } | null>(null);

  const { data: rates = [] } = useRates();

  // --- DATA PROCESSING ---
  const fuse = useMemo(() => new Fuse(localProducts, {
    keys: ['givenName', 'productName', 'chineseName', 'originRegion', 'vendor'],
    threshold: 0.3,
    ignoreLocation: true,
  }), [localProducts]);

  // Active column defs based on category
  const activeColumnDefs = inventoryCategory === 'teaware' ? TEAWARE_COLUMN_DEFS : TEA_COLUMN_DEFS;
  const activeDefaultViews = inventoryCategory === 'teaware' ? DEFAULT_TEAWARE_VIEWS : DEFAULT_TEA_VIEWS;

  const processedProducts = useMemo(() => {
    let result = localProducts;

    // 0. Category filter
    if (inventoryCategory === 'teaware') {
      result = result.filter(p => p.type === 'Teaware');
    } else {
      // 'tea' — all non-teaware
      result = result.filter(p => p.type !== 'Teaware');
    }

    // 0b. Hide archived products unless explicitly viewing the Archived filter
    if (filterType !== 'Archived') {
      result = result.filter(p => p.status !== 'Archived');
    }

    // 1. Search
    if (searchQuery) {
      result = fuse.search(searchQuery).map(r => r.item).filter(p =>
        inventoryCategory === 'teaware' ? p.type === 'Teaware' : p.type !== 'Teaware'
      );
    }

    // 2. Filter
    if (filterType === 'Alerts') {
      result = result.filter(p => p.status === 'Draft' || p.stockGrams <= p.lowStockThreshold || p.pricePerGramUSD === 0 || p.recheckStock);
    } else if (filterType === 'Drafts') {
      result = result.filter(p => p.status === 'Draft');
    } else if (filterType === 'Pending') {
      result = result.filter(p => p.lore && !p.showWisdom);
    } else if (filterType === 'Unverified') {
      result = result.filter(p => !p.stockVerifiedAt);
    } else if (filterType === 'Unpublished') {
      result = result.filter(p => !p.isPublic);
    } else if (filterType === 'Samples') {
      result = result.filter(p => p.isSample);
    } else if (filterType === 'Personal') {
      result = result.filter(p => p.isPersonal);
    } else if (filterType === 'ForSale') {
      result = result.filter(p => !p.isPersonal && !p.isSample);
    } else if (filterType === 'Archived') {
      result = result.filter(p => p.status === 'Archived');
    } else if (filterType !== 'All') {
      result = result.filter(p => p.type === filterType);
    }

    // 3. Multi-level Sort
    return [...result].sort((a, b) => {
      for (const sort of inventorySortConfig) {
        const key = sort.key as keyof Product;
        // Teaware always sorts last when sorting by type
        if (key === 'type') {
          if (a.type === 'Teaware' && b.type !== 'Teaware') return 1;
          if (a.type !== 'Teaware' && b.type === 'Teaware') return -1;
        }
        const aVal = a[key];
        const bVal = b[key];
        if (aVal === bVal) continue;
        if (aVal == null) return 1;
        if (bVal == null) return -1;
        const comparison = typeof aVal === 'number' && typeof bVal === 'number'
          ? aVal - bVal
          : String(aVal).localeCompare(String(bVal));
        const result = sort.direction === 'asc' ? comparison : -comparison;
        if (result !== 0) return result;
      }
      return 0;
    });
  }, [localProducts, searchQuery, filterType, inventorySortConfig, fuse]);

  // Visible columns (filtered by store, adapted to category)
  // Price columns are always controlled by priceMode toggle, not by view config
  const visibleCols = useMemo(() => activeColumnDefs.filter(col => {
    const isCostCol = col.key === 'costAmount' || col.key === 'costPerGramUSD';
    const isRetailCol = col.key === 'pricePerGramUSD';
    if (isCostCol) return priceMode === 'cost';
    if (isRetailCol) return priceMode === 'retail';
    if (!inventoryColumns.includes(col.key)) return false;
    return true;
  }), [inventoryColumns, activeColumnDefs, priceMode]);
  const colCount = visibleCols.length + 1; // +1 for actions column
  const colCountWithBulk = colCount + (isEditMode ? 1 : 0); // +1 for checkbox column in edit mode

  // Grouped data for Feature 3
  const groupedProducts = useMemo(() => {
    if (!inventoryGroupBy) return null;
    const groups: Record<string, Product[]> = {};
    for (const p of processedProducts) {
      const key = String((p as any)[inventoryGroupBy] || 'Unknown');
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    }
    return groups;
  }, [processedProducts, inventoryGroupBy]);

  const pendingCount = useMemo(() => localProducts.filter(p => p.lore && !p.showWisdom).length, [localProducts]);

  // Stock verification stats (scoped to current category — counts all non-archived)
  const verificationStats = useMemo(() => {
    const categoryProducts = inventoryCategory === 'teaware'
      ? localProducts.filter(p => p.type === 'Teaware')
      : localProducts.filter(p => p.type !== 'Teaware');
    const countable = categoryProducts.filter(p => p.status !== 'Archived');
    const verified = countable.filter(p => !!p.stockVerifiedAt).length;
    return { total: countable.length, verified, remaining: countable.length - verified };
  }, [localProducts, inventoryCategory]);

  // Initialize review drafts when switching to Pending filter or when pending products change
  useEffect(() => {
    if (filterType !== 'Pending') return;
    const pending = localProducts.filter(p => p.lore && !p.showWisdom);
    setReviewDrafts(prev => {
      const next = { ...prev };
      pending.forEach(p => {
        if (!next[p.id]) {
          next[p.id] = {
            lore: p.lore || '',
            terroir: p.terroir || '',
            processingNotes: p.processingNotes || '',
            mood: p.mood || '',
            experience: p.experience || '',
            tastingNotes: p.tastingNotes || [],
            chineseName: p.chineseName || '',
            originRegion: p.originRegion || '',
          };
        }
      });
      return next;
    });
  }, [filterType, localProducts]);

  // --- VIRTUALIZATION LOGIC (TABLE BASED) ---
  const ROW_HEIGHT = 36; 
  const BUFFER_ROWS = 5;

  useEffect(() => {
      const el = scrollContainerRef.current;
      if (!el) return;
      setContainerHeight(el.clientHeight);
      const ro = new ResizeObserver((entries) => {
          for (const entry of entries) {
              setContainerHeight(entry.contentRect.height);
          }
      });
      ro.observe(el);
      return () => ro.disconnect();
  }, []);

  const totalRows = processedProducts.length;
  const totalHeight = totalRows * ROW_HEIGHT;
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - BUFFER_ROWS);
  const endIndex = Math.min(totalRows, Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + BUFFER_ROWS);
  
  const visibleProducts = processedProducts.slice(startIndex, endIndex);

  // Spacer Heights
  const paddingTop = startIndex * ROW_HEIGHT;
  const paddingBottom = Math.max(0, totalHeight - paddingTop - (visibleProducts.length * ROW_HEIGHT));

  // --- HANDLERS ---
  const handleSort = (key: keyof Product) => {
      const existing = inventorySortConfig.find(s => s.key === key);
      if (existing) {
        if (existing.direction === 'asc') {
          // Flip to descending
          setInventorySortConfig(inventorySortConfig.map(s => s.key === key ? { ...s, direction: 'desc' as const } : s));
        } else {
          // Remove from sort
          setInventorySortConfig(inventorySortConfig.filter(s => s.key !== key));
        }
      } else {
        // Add as ascending
        setInventorySortConfig([...inventorySortConfig, { key, direction: 'asc' }]);
      }
  };

  // GENERIC UPDATE HANDLER (Optimistic + DB)
  // Restock: create a pre-filled Tea Compass entry from a product and navigate
  const handleRestock = useCallback((product: Product) => {
    const category = product.type === 'Teaware' ? 'teaware' : 'tea';
    const newId = startNewCapture(category);
    const updates: Record<string, any> = {
      name: product.givenName || product.productName,
      chineseName: product.chineseName || undefined,
      type: product.type,
      status: 'want',
      notes: `Restock from inventory — ${product.productName}`,
    };
    if (product.vendor) updates.vendorName = product.vendor;
    if (product.costCurrency) updates.priceCurrency = product.costCurrency;
    if (product.costPerGramUSD) updates.pricePerUnitGrams = product.costPerGramUSD;
    if (product.originRegion) updates.originRegion = product.originRegion;
    if (product.form) updates.form = product.form;
    if (product.year) updates.year = product.year;
    updateCompassEntry(newId, updates);
    setRowDropdownId(null);
    navigate(`/admin/compass?tab=capture`);
  }, [startNewCapture, updateCompassEntry, navigate]);

  const handleProductUpdate = async (id: string, field: keyof Product, value: any) => {
    // 1. Optimistic Update
    setLocalProducts(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
    setPanelDirty(true);

    // 2. Map to DB Column
    let dbPayload: any = {};
    if (field === 'stockGrams') dbPayload = { stock_grams: Number(value) };
    else if (field === 'costAmount') dbPayload = { cost_amount: Number(value) };
    else if (field === 'pricePerGramUSD') dbPayload = { fixed_retail_price_usd: Number(value) }; // Override retail
    else if (field === 'productName') dbPayload = { product_name: value };
    else if (field === 'originRegion') dbPayload = { origin_region: value };
    else if (field === 'year') dbPayload = { year: Number(value) };
    else if (field === 'isFeatured') dbPayload = { is_featured: value };
    else if (field === 'isPublic') dbPayload = { is_public: value };
    else if (field === 'showWisdom') dbPayload = { show_wisdom: value };
    else if (field === 'recheckStock') dbPayload = { recheck_stock: value ? 1 : 0 };
    else if (field === 'stockVerifiedAt') dbPayload = { stock_verified_at: value };
    else if (field === 'material') dbPayload = { material: value };
    else if (field === 'capacityMl') dbPayload = { capacity_ml: Number(value) };
    else if (field === 'teawareCategory') dbPayload = { teaware_category: value };
    else if (field === 'quantityUnits') dbPayload = { quantity_units: Number(value) };
    else if (field === 'experience') dbPayload = { experience: value };
    else if (field === 'description') dbPayload = { description: value };
    else if (field === 'mood') dbPayload = { mood: value };
    else if (field === 'tastingNotes') dbPayload = { tasting_notes: JSON.stringify(value) };
    else if (field === 'lore') dbPayload = { lore: value };
    else if (field === 'givenName') dbPayload = { given_name: value };
    else if (field === 'chineseName') dbPayload = { chinese_name: value };
    else if (field === 'form') dbPayload = { form: value };
    else if (field === 'originCountry') dbPayload = { origin_country: value };
    else if (field === 'vendor') dbPayload = { vendor: value };
    else if (field === 'type') dbPayload = { type: value };
    else if (field === 'status') dbPayload = { status: value };
    else if (field === 'imageUrl') dbPayload = { image_url: value };
    else if (field === 'processingNotes') dbPayload = { processing_notes: value };
    else if (field === 'terroir') dbPayload = { terroir: value };
    else if (field === 'isPersonal') dbPayload = { is_personal: value ? 1 : 0 };
    else if (field === 'canReorder') dbPayload = { can_reorder: value ? 1 : 0 };
    else if (field === 'isCurated') dbPayload = { is_curated: value ? 1 : 0 };
    else if (field === 'isSample') dbPayload = { is_sample: value ? 1 : 0 };
    else if (field === 'isCustomWisdom') dbPayload = { is_custom_wisdom: value ? 1 : 0 };
    else if (field === 'fixedRetailPriceUSD') dbPayload = { fixed_retail_price_usd: value ? Number(value) : null };
    else if (field === 'shippingRatePerKg') dbPayload = { shipping_rate_per_kg: Number(value) };
    else if (field === 'quantityPurchased') dbPayload = { quantity_purchased: Number(value) };
    else if (field === 'lowStockThreshold') dbPayload = { low_stock_threshold: Number(value) };
    else if (field === 'costCurrency') dbPayload = { cost_currency: value };
    else if (field === 'additionalImages') dbPayload = { additional_images: JSON.stringify(value || []) };
    else return; // Unsupported field for quick edit

    // 3. Recalculate retail display when cost-related fields change (optimistic UI update)
    const pricingFields: (keyof Product)[] = ['costAmount', 'quantityPurchased', 'shippingRatePerKg', 'costCurrency'];
    if (pricingFields.includes(field)) {
      const product = localProducts.find(p => p.id === id);
      if (product) {
        const updated = { ...product, [field]: value };
        const isTeaware = updated.type === 'Teaware';
        const calc = calculatePricing(
          updated.costAmount || 0,
          updated.shippingRatePerKg || 13,
          updated.quantityPurchased || 0,
          updated.costCurrency || 'USD',
          rates,
          isTeaware
        );
        if (calc.suggestedRetailUSD > 0) {
          const newRetail = parseFloat(calc.suggestedRetailUSD.toFixed(4));
          // Update the formula-based retail in local state (no fixed price change)
          setLocalProducts(prev => prev.map(p => p.id === id ? { ...p, pricePerGramUSD: newRetail } : p));
        }
      }
    }

    // 4. Fire & Forget (with Error Revert)
    try {
      await api.products.update(id, dbPayload);
    } catch (err: any) {
      showToast(`Update failed: ${err.message}`, 'error');
      onRefresh();
    }
  };

  const handleExport = () => {
    const csv = Papa.unparse(processedProducts.map(p => ({
        Type: p.type,
        'Given Name': p.givenName,
        'Product Name': p.productName,
        Stock: p.stockGrams,
        Cost: p.costAmount,
        Retail: p.pricePerGramUSD,
        Origin: p.originRegion
    })));
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'inventory_export.csv');
    link.click();
    showToast("Export generated", 'success');
  };

  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichProgress, setEnrichProgress] = useState<{ current: number; total: number; currentName: string } | null>(null);

  // REVIEW FEED STATE
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, any>>({});
  const [approvingIds, setApprovingIds] = useState<Set<string>>(new Set());
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);

  const handleBulkEnrich = async () => {
    const teasToEnrich = localProducts.filter(p => !p.lore && p.type !== 'Teaware' && p.type !== 'Misc');
    
    if (teasToEnrich.length === 0) {
        showToast("All teas already have wisdom!", "success");
        return;
    }

    if (!confirm(`Are you sure you want to generate wisdom for ${teasToEnrich.length} teas? This may take a few minutes.`)) {
        return;
    }

    setIsEnriching(true);
    setEnrichProgress({ current: 0, total: teasToEnrich.length, currentName: '' });
    let successCount = 0;
    let failCount = 0;

    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    try {
        for (let i = 0; i < teasToEnrich.length; i++) {
            const tea = teasToEnrich[i];
            setEnrichProgress({ current: i + 1, total: teasToEnrich.length, currentName: tea.productName });
            try {
                const prompt = aiPromptTemplate
                    .replace('{{productName}}', tea.productName)
                    .replace('{{type}}', tea.type);

                const data = await api.generateWisdom(prompt);

                await api.products.update(tea.id, {
                    lore: data.lore,
                    tasting_notes: data.tastingNotes,
                    chinese_name: tea.chineseName || data.chineseName || '',
                    origin_region: tea.originRegion || data.originRegion || '',
                    processing_notes: data.processingNotes || '',
                    terroir: data.terroir || '',
                    mood: data.mood || '',
                    experience: data.experience || '',
                    is_custom_wisdom: false,
                    show_wisdom: false,
                });

                successCount++;
                await delay(500);
            } catch (err) {
                console.error(`Failed to enrich ${tea.productName}:`, err);
                failCount++;
            }
        }
    } catch (error: any) {
        console.error("Bulk enrich error:", error);
        showToast("Bulk enrichment failed.", "error");
    } finally {
        setIsEnriching(false);
        setEnrichProgress(null);
        onRefresh();
        showToast(`Enrichment complete. ${successCount} succeeded, ${failCount} failed.`, successCount > 0 ? 'success' : 'error');
    }
  };

  const handleResetDatabase = async () => {
    if (resetInput !== 'delete') return;
    setIsResetting(true);
    try {
        await api.rpc.truncateAll();
        showToast("Database wiped.", 'success');
        setShowResetConfirm(false);
        onRefresh();
    } catch (error: any) {
        setShowResetConfirm(false);
        setShowMaintenanceModal(true);
        showToast("Wipe failed. Permissions error.", 'error');
    } finally {
        setIsResetting(false);
    }
  };

  // --- REVIEW FEED HANDLERS ---

  const handleApproveOne = async (product: Product) => {
    setApprovingIds(prev => new Set([...prev, product.id]));
    const draft = reviewDrafts[product.id] || {};
    const wasEdited = (
      (draft.lore || '') !== (product.lore || '') ||
      (draft.terroir || '') !== (product.terroir || '') ||
      (draft.processingNotes || '') !== (product.processingNotes || '') ||
      (draft.mood || '') !== (product.mood || '') ||
      (draft.experience || '') !== (product.experience || '')
    );
    try {
      await api.products.update(product.id, {
        lore: draft.lore || product.lore,
        terroir: draft.terroir || '',
        processing_notes: draft.processingNotes || '',
        mood: draft.mood || '',
        experience: draft.experience || '',
        tasting_notes: Array.isArray(draft.tastingNotes) ? draft.tastingNotes : product.tastingNotes,
        show_wisdom: true,
        is_custom_wisdom: wasEdited,
      });
      setLocalProducts(prev => prev.map(p => p.id === product.id ? { ...p, showWisdom: true, isCustomWisdom: wasEdited } : p));
      setReviewDrafts(prev => { const n = { ...prev }; delete n[product.id]; return n; });
    } catch (err: any) {
      showToast(`Approve failed: ${err.message}`, 'error');
    } finally {
      setApprovingIds(prev => { const n = new Set(prev); n.delete(product.id); return n; });
    }
  };

  const handleApproveAll = async () => {
    const pending = processedProducts;
    try {
      await Promise.all(pending.map(p => {
        const draft = reviewDrafts[p.id] || {};
        const wasEdited = (
          (draft.lore || '') !== (p.lore || '') ||
          (draft.terroir || '') !== (p.terroir || '') ||
          (draft.processingNotes || '') !== (p.processingNotes || '') ||
          (draft.mood || '') !== (p.mood || '') ||
          (draft.experience || '') !== (p.experience || '')
        );
        return api.products.update(p.id, {
          lore: draft.lore || p.lore,
          terroir: draft.terroir || '',
          processing_notes: draft.processingNotes || '',
          mood: draft.mood || '',
          experience: draft.experience || '',
          tasting_notes: Array.isArray(draft.tastingNotes) ? draft.tastingNotes : p.tastingNotes,
          show_wisdom: true,
          is_custom_wisdom: wasEdited,
        });
      }));
      showToast(`${pending.length} teas approved`, 'success');
      onRefresh();
    } catch (err: any) {
      showToast(`Approve all failed: ${err.message}`, 'error');
      onRefresh();
    }
  };

  const handleDiscardOne = async (productId: string) => {
    try {
      await api.products.update(productId, { lore: '', show_wisdom: false });
      setLocalProducts(prev => prev.map(p => p.id === productId ? { ...p, lore: '', showWisdom: false } : p));
      setReviewDrafts(prev => { const n = { ...prev }; delete n[productId]; return n; });
    } catch (err: any) {
      showToast(`Discard failed: ${err.message}`, 'error');
    }
  };

  const handleDiscardAll = async () => {
    const pending = processedProducts;
    try {
      await Promise.all(pending.map(p => api.products.update(p.id, { lore: '', show_wisdom: false })));
      showToast(`${pending.length} teas discarded`, 'info');
      onRefresh();
    } catch (err: any) {
      showToast(`Discard all failed: ${err.message}`, 'error');
      onRefresh();
    }
  };

  const handleRegenerateOne = async (product: Product) => {
    setRegeneratingId(product.id);
    try {
      const prompt = aiPromptTemplate
        .replace('{{productName}}', product.productName)
        .replace('{{type}}', product.type);
      const data = await api.generateWisdom(prompt);
      setReviewDrafts(prev => ({
        ...prev,
        [product.id]: {
          lore: data.lore || '',
          terroir: data.terroir || '',
          processingNotes: data.processingNotes || '',
          mood: data.mood || '',
          experience: data.experience || '',
          tastingNotes: data.tastingNotes || [],
          chineseName: data.chineseName || product.chineseName || '',
          originRegion: data.originRegion || product.originRegion || '',
        }
      }));
      showToast("Regenerated — review the new content", 'success');
    } catch (err: any) {
      showToast(`Regeneration failed: ${err.message}`, 'error');
    } finally {
      setRegeneratingId(null);
    }
  };

  // --- COMPONENTS ---
  const SortHeader = ({ colKey, label, align = 'left' }: { colKey: keyof Product, label: string, align?: 'left' | 'right' | 'center' }) => {
      const sortIndex = inventorySortConfig.findIndex(s => s.key === colKey);
      const sortEntry = sortIndex >= 0 ? inventorySortConfig[sortIndex] : null;
      const showBadge = inventorySortConfig.length > 1 && sortEntry;
      return (
        <th
          className={`px-4 py-2 cursor-pointer hover:text-tea-text transition-colors select-none border-b border-tea-border group text-[10px] uppercase tracking-wider font-serif text-tea-text-sec text-${align} truncate`}
          onClick={() => handleSort(colKey)}
        >
          <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : ''}`}>
             {label}
             <div className="flex-shrink-0 relative z-0 flex items-center">
              {sortEntry ? (
                <span className="flex items-center">
                  {sortEntry.direction === 'asc' ? <ArrowUp size={10} className="ml-1 text-tea-text-sec" /> : <ArrowDown size={10} className="ml-1 text-tea-text-sec" />}
                  {showBadge && <span className="ml-0.5 text-[8px] text-tea-accent font-bold">{sortIndex + 1}</span>}
                </span>
              ) : <ArrowUpDown size={10} className="opacity-0 group-hover:opacity-100 text-tea-text-sec/50 ml-1 transition-opacity" />}
             </div>
          </div>
        </th>
      );
  };

  // --- FEATURE 5: Panel keyboard shortcuts ---
  useEffect(() => {
    if (!panelProduct) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setPanelProduct(null); e.preventDefault(); }
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        const idx = processedProducts.findIndex(p => p.id === panelProduct.id);
        if (idx > 0) setPanelProduct(processedProducts[idx - 1]);
        e.preventDefault();
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        const idx = processedProducts.findIndex(p => p.id === panelProduct.id);
        if (idx < processedProducts.length - 1) setPanelProduct(processedProducts[idx + 1]);
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [panelProduct, processedProducts]);

  // --- FEATURE 6: KEYBOARD NAVIGATION ---
  useEffect(() => {
    if (!isEditMode || panelProduct) { setFocusedCell(null); return; }
    const handler = (e: KeyboardEvent) => {
      if (!focusedCell) {
        if (e.key === 'ArrowDown') { setFocusedCell({ row: 0, col: 0 }); e.preventDefault(); }
        return;
      }
      const maxRow = processedProducts.length - 1;
      const maxCol = visibleCols.length - 1;
      if (e.key === 'ArrowDown') { setFocusedCell(prev => prev ? { ...prev, row: Math.min(prev.row + 1, maxRow) } : null); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { setFocusedCell(prev => prev ? { ...prev, row: Math.max(prev.row - 1, 0) } : null); e.preventDefault(); }
      else if (e.key === 'ArrowRight' || e.key === 'Tab') { setFocusedCell(prev => prev ? { ...prev, col: Math.min(prev.col + 1, maxCol) } : null); if (e.key === 'Tab') e.preventDefault(); }
      else if (e.key === 'ArrowLeft') { setFocusedCell(prev => prev ? { ...prev, col: Math.max(prev.col - 1, 0) } : null); e.preventDefault(); }
      else if (e.key === 'Enter' && focusedCell) {
        const cellId = `ghost-${focusedCell.row}-${focusedCell.col}`;
        const el = document.getElementById(cellId);
        if (el) (el as HTMLInputElement).focus();
        e.preventDefault();
      }
      else if (e.key === 'Escape') { setFocusedCell(null); e.preventDefault(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isEditMode, focusedCell, processedProducts.length, visibleCols.length]);

  // Auto-scroll focused cell into view
  useEffect(() => {
    if (focusedCell) {
      const cellId = `cell-${focusedCell.row}-${focusedCell.col}`;
      document.getElementById(cellId)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }, [focusedCell]);

  // --- FEATURE 7: BULK EDIT HANDLERS ---
  const toggleSelectId = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === processedProducts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(processedProducts.map(p => p.id)));
    }
  };

  const handleBulkApply = async () => {
    if (selectedIds.size === 0 || !bulkField) return;
    setIsBulkApplying(true);
    const fieldDef = BULK_EDIT_FIELDS.find(f => f.key === bulkField);
    const parsedValue = fieldDef?.type === 'boolean' ? bulkValue === 'true' : bulkValue;
    let done = 0;
    try {
      for (const id of selectedIds) {
        await handleProductUpdate(id, bulkField as keyof Product, parsedValue);
        done++;
      }
      showToast(`Updated ${done} items`, 'success');
      setSelectedIds(new Set());
    } catch (err: any) {
      showToast(`Bulk update failed after ${done} items: ${err.message}`, 'error');
    } finally {
      setIsBulkApplying(false);
    }
  };

  // Helper to render a cell for a given column key
  const renderCell = (product: Product, colKey: string, rowIndex: number, colIndex: number) => {
    const isFocused = focusedCell?.row === rowIndex && focusedCell?.col === colIndex;
    const focusRing = isFocused ? 'ring-1 ring-tea-accent/50 rounded' : '';
    const ghostId = `ghost-${rowIndex}-${colIndex}`;

    switch (colKey) {
      case 'productName':
        return (
          <td id={`cell-${rowIndex}-${colIndex}`} className={`px-4 align-middle overflow-hidden ${focusRing}`}>
            <div className="flex flex-col justify-center h-full">
              {isEditMode ? (
                <GhostInput
                  value={product.productName}
                  onSave={(val) => handleProductUpdate(product.id, 'productName', val)}
                  className="font-serif text-sm text-tea-text tracking-wide truncate"
                />
              ) : (
                <>
                  <span className="text-sm font-serif text-tea-text tracking-wide group-hover:text-tea-accent transition-colors truncate">
                    {product.productName}
                  </span>
                  {product.givenName && (
                    <span className="text-[10px] text-tea-text-sec font-sans mt-0.5 truncate block">
                      {product.givenName}
                      {product.form && <span className="ml-1 opacity-50">· {product.form}</span>}
                    </span>
                  )}
                  {!product.givenName && product.form && (
                    <span className="text-[10px] text-tea-text-sec/50 font-sans mt-0.5 truncate block">{product.form}</span>
                  )}
                </>
              )}
            </div>
          </td>
        );
      case 'type': {
        const dotColor = getThemeColor(product.type);
        return (
          <td id={`cell-${rowIndex}-${colIndex}`} className={`px-4 align-middle overflow-hidden ${focusRing}`}>
            <span className="flex items-center gap-2 text-xs font-medium tracking-wide text-tea-text-sec truncate">
              <span style={{ color: dotColor, fontSize: '10px' }}>&#9679;</span> {product.type}
            </span>
          </td>
        );
      }
      case 'year':
        return (
          <td id={`cell-${rowIndex}-${colIndex}`} className={`px-4 align-middle overflow-hidden ${focusRing}`}>
            {isEditMode ? (
              <GhostInput id={ghostId} value={product.year || ''} onSave={(val) => handleProductUpdate(product.id, 'year', val)} type="number" placeholder="YYYY" className="font-sans text-xs text-tea-text-sec tabular-nums" />
            ) : <span className="text-xs text-tea-text-sec font-sans tabular-nums">{product.year || '-'}</span>}
          </td>
        );
      case 'originRegion':
        return (
          <td id={`cell-${rowIndex}-${colIndex}`} className={`px-4 align-middle overflow-hidden ${focusRing}`}>
            {isEditMode ? (
              <GhostInput id={ghostId} value={product.originRegion} onSave={(val) => handleProductUpdate(product.id, 'originRegion', val)} className="font-sans text-xs text-tea-text-sec truncate" />
            ) : <span className="text-xs text-tea-text-sec font-sans truncate block">{product.originRegion}</span>}
          </td>
        );
      case 'stockGrams': {
        const isLow = product.stockGrams <= product.lowStockThreshold;
        return (
          <td id={`cell-${rowIndex}-${colIndex}`} className={`px-4 align-middle overflow-hidden ${focusRing}`}>
            {isEditMode ? (
              <div className="flex items-center gap-1">
                <GhostInput id={ghostId} value={product.stockGrams} onSave={(val) => handleProductUpdate(product.id, 'stockGrams', val)} type="number" className="num text-xs" />
                <button title={product.recheckStock ? "Clear recheck flag" : "Flag for stock recheck"} onClick={(e) => { e.stopPropagation(); handleProductUpdate(product.id, 'recheckStock', !product.recheckStock); }} className={`text-[10px] transition-colors ${product.recheckStock ? 'text-amber-400 hover:text-tea-text-sec' : 'text-tea-border hover:text-amber-400'}`}>&#9888;</button>
              </div>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); setStockHistoryProduct({ id: product.id, name: product.givenName || product.productName }); }}
                className={`num text-xs flex items-center gap-1 hover:text-tea-accent transition-colors ${isLow ? 'text-tea-accent font-bold' : 'text-tea-text-sec'}`}
                title="View stock history"
              >
                {product.recheckStock && <span title="Stock needs rechecking" className="text-amber-400 text-[10px]">&#9888;</span>}
                {Math.round(product.stockGrams)}g
              </button>
            )}
          </td>
        );
      }
      case 'costAmount':
        return (
          <td id={`cell-${rowIndex}-${colIndex}`} className={`px-4 align-middle overflow-hidden ${focusRing}`}>
            {isEditMode ? (
              <GhostInput id={ghostId} value={product.costAmount} onSave={(val) => handleProductUpdate(product.id, 'costAmount', val)} type="number" className="num text-xs" />
            ) : <span className="num text-xs text-tea-text-sec">{product.costAmount > 0 ? product.costAmount.toLocaleString() : '-'}</span>}
          </td>
        );
      case 'costPerGramUSD':
        return (
          <td id={`cell-${rowIndex}-${colIndex}`} className={`px-4 align-middle overflow-hidden ${focusRing}`}>
            <span className="num text-xs text-tea-text-sec">{product.costPerGramUSD > 0 ? fmtNum(product.costPerGramUSD) : '-'}</span>
          </td>
        );
      case 'pricePerGramUSD': {
        const sellingPrice = product.fixedRetailPriceUSD ?? product.pricePerGramUSD;
        return (
          <td id={`cell-${rowIndex}-${colIndex}`} className={`px-4 align-middle overflow-hidden ${focusRing}`}>
            {isEditMode ? (
              <GhostInput id={ghostId} value={sellingPrice?.toFixed(2)} onSave={(val) => handleProductUpdate(product.id, 'fixedRetailPriceUSD', val ? Number(val) : null)} type="number" className="num text-xs" />
            ) : <span className={`num text-xs ${product.fixedRetailPriceUSD != null ? 'text-tea-gold' : 'text-tea-text'}`}>{sellingPrice != null ? fmtNum(sellingPrice) : '-'}</span>}
          </td>
        );
      }
      case 'material':
        return (
          <td id={`cell-${rowIndex}-${colIndex}`} className={`px-4 align-middle overflow-hidden ${focusRing}`}>
            {isEditMode ? (
              <GhostInput id={ghostId} value={product.material || ''} onSave={(val) => handleProductUpdate(product.id, 'material', val)} className="font-sans text-xs text-tea-text-sec truncate" />
            ) : <span className="text-xs text-tea-text-sec font-sans truncate block">{product.material || '-'}</span>}
          </td>
        );
      case 'teawareCategory':
        return (
          <td id={`cell-${rowIndex}-${colIndex}`} className={`px-4 align-middle overflow-hidden ${focusRing}`}>
            {isEditMode ? (
              <GhostInput id={ghostId} value={product.teawareCategory || ''} onSave={(val) => handleProductUpdate(product.id, 'teawareCategory', val)} className="font-sans text-xs text-tea-text-sec truncate" />
            ) : <span className="text-xs text-tea-text-sec font-sans capitalize truncate block">{product.teawareCategory || '-'}</span>}
          </td>
        );
      case 'capacityMl':
        return (
          <td id={`cell-${rowIndex}-${colIndex}`} className={`px-4 align-middle overflow-hidden ${focusRing}`}>
            {isEditMode ? (
              <GhostInput id={ghostId} value={product.capacityMl || ''} onSave={(val) => handleProductUpdate(product.id, 'capacityMl', val)} type="number" className="num text-xs" />
            ) : <span className="num text-xs text-tea-text-sec">{product.capacityMl ? `${product.capacityMl}ml` : '-'}</span>}
          </td>
        );
      case 'quantityUnits':
        return (
          <td id={`cell-${rowIndex}-${colIndex}`} className={`px-4 align-middle overflow-hidden ${focusRing}`}>
            {isEditMode ? (
              <GhostInput id={ghostId} value={product.quantityUnits || ''} onSave={(val) => handleProductUpdate(product.id, 'quantityUnits', val)} type="number" className="num text-xs" />
            ) : <span className="num text-xs text-tea-text-sec">{product.quantityUnits ?? '-'}</span>}
          </td>
        );
      case 'verified': {
        const isVerified = !!product.stockVerifiedAt;
        return (
          <td id={`cell-${rowIndex}-${colIndex}`} className={`px-4 align-middle text-center ${focusRing}`}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                const name = product.givenName || product.productName;
                if (!isVerified) {
                  handleProductUpdate(product.id, 'stockVerifiedAt', new Date().toISOString());
                  showToast(`${name} verified`, 'success', {
                    duration: 5000,
                    action: {
                      label: 'Undo',
                      onClick: () => handleProductUpdate(product.id, 'stockVerifiedAt', null),
                    },
                  });
                } else {
                  handleProductUpdate(product.id, 'stockVerifiedAt', null);
                }
              }}
              title={isVerified ? `Verified ${new Date(product.stockVerifiedAt!).toLocaleDateString()}` : 'Mark as verified'}
              className={`inline-flex items-center justify-center w-5 h-5 rounded transition-colors ${isVerified ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300' : 'bg-tea-surface text-tea-border hover:text-tea-text-sec hover:bg-tea-bg'}`}
            >
              {isVerified ? <Check size={12} strokeWidth={3} /> : <span className="w-3 h-3 rounded-sm border border-current" />}
            </button>
          </td>
        );
      }
      case 'vendor':
        return (
          <td className="px-4 align-middle overflow-hidden">
            {product.vendor ? (
              <button
                onClick={(e) => { e.stopPropagation(); navigate(`/admin/people?tab=sources&search=${encodeURIComponent(product.vendor!)}`); }}
                className="text-xs text-tea-text-sec hover:text-tea-accent transition-colors truncate block text-left"
              >
                {product.vendor}
              </button>
            ) : <span className="text-xs text-tea-text-dim">—</span>}
          </td>
        );
      default:
        return <td className="px-4 align-middle text-xs text-tea-text-sec">-</td>;
    }
  };

  const getRowBorderClass = (product: Product) => {
    if (product.status === 'Draft') return 'border-l-2 border-l-amber-500/50';
    if (product.recheckStock) return 'border-l-2 border-l-orange-400/60';
    if (product.stockGrams <= product.lowStockThreshold && product.stockGrams > 0) return 'border-l-2 border-l-red-500/50';
    if (product.isFeatured) return 'border-l-2 border-l-tea-accent/40';
    return '';
  };

  if (isLoading) {
    return <div className="p-12 text-center text-tea-text-sec font-serif italic"><Loader2 className="animate-spin inline mr-2" /> Loading inventory...</div>;
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-center">
        <div className="p-4 bg-red-500/10 rounded-full border border-red-500/20 mb-6">
          <AlertTriangle className="text-red-400" size={32} />
        </div>
        <h2 className="text-lg font-serif text-tea-text mb-2">Failed to load inventory</h2>
        <p className="text-tea-text-sec text-sm mb-6 max-w-md">
          {error?.message || 'Could not connect to the server. Please check your connection and try again.'}
        </p>
        <button
          onClick={onRefresh}
          className="bg-tea-accent text-tea-bg px-6 py-3 rounded-xl text-sm font-medium hover:bg-tea-accent/90 transition-colors flex items-center gap-2"
        >
          <RefreshCw size={16} />
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className={`h-full flex flex-col overflow-hidden bg-tea-bg ${panelProduct ? 'md:mr-[420px]' : ''} transition-all duration-300`}>

      {/* --- VENDOR FILTER BANNER --- */}
      {vendorFilter && (
        <div className="flex items-center gap-3 px-4 md:px-6 py-2 bg-tea-surface/60 border-b border-tea-accent-sub">
          <button
            onClick={() => navigate('/admin/people')}
            className="flex items-center gap-1.5 text-xs text-tea-text-sec hover:text-tea-text transition-colors"
          >
            <ChevronLeft size={14} />
            <span className="uppercase tracking-[0.15em] text-[10px] font-bold">Sources</span>
          </button>
          <div className="w-px h-4 bg-tea-border/30" />
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <User size={14} className="text-tea-gold flex-shrink-0" />
            <span className="text-sm font-serif text-tea-text truncate">{vendorFilter}</span>
            <span className="text-[10px] text-tea-text-sec uppercase tracking-[0.15em]">
              — {processedProducts.length} tea{processedProducts.length !== 1 ? 's' : ''} supplied
            </span>
          </div>
          <button
            onClick={() => { setSearchParams({}); }}
            className="flex items-center gap-1 text-[10px] text-tea-text-sec hover:text-tea-text uppercase tracking-[0.15em] transition-colors px-2 py-1 hover:bg-tea-bg rounded-md"
          >
            <XIcon size={12} /> Clear Filter
          </button>
        </div>
      )}

      {/* --- MERGED VIEWS + CONTROLS BAR (mobile) --- */}
      <div className={`md:hidden sticky top-0 z-30 bg-tea-bg/95 backdrop-blur-md transition-colors ${isEditMode ? 'bg-tea-surface/95' : ''}`}>
        <div className={`flex items-center px-2 py-1.5 gap-0.5 ${viewTabsExpanded ? 'flex-wrap' : ''}`}>
          {/* View tabs — top 3 visible, expand to show all */}
          {(() => {
            const defaultOrder = activeDefaultViews.map(v => v.id);
            const unsorted = savedViews.length > 0 ? savedViews.filter(v => inventoryCategory === 'teaware' ? v.id.includes('teaware') : !v.id.includes('teaware')) : activeDefaultViews;
            const views = [...unsorted].sort((a, b) => {
              const ai = defaultOrder.indexOf(a.id);
              const bi = defaultOrder.indexOf(b.id);
              return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
            });
            const VISIBLE_COUNT = 3;
            const visibleViews = viewTabsExpanded ? views : views.slice(0, VISIBLE_COUNT);
            const hasMore = views.length > VISIBLE_COUNT;
            // Check if active view is in the hidden set
            const activeInHidden = !viewTabsExpanded && views.findIndex(v => v.id === activeViewId) >= VISIBLE_COUNT;
            return (
              <>
                {visibleViews.map(view => {
                  const isIconOnly = view.icon && !view.name;
                  const filterLabel = VIEW_FILTER_LABELS[view.filterType] || view.filterType;
                  return (
                    <button
                      key={view.id}
                      onClick={() => {
                        setGlossaryMode(false);
                        setActiveView(view.id);
                        setInventoryColumns(view.columns);
                        setInventorySortConfig(view.sortConfig);
                        setFilterType(view.filterType);
                        setInventoryGroupBy(view.groupBy);
                      }}
                      className={`flex items-center gap-1 shrink-0 ${isIconOnly && !viewTabsExpanded ? 'w-9 h-9 justify-center' : 'px-2 h-9 text-[11px] uppercase tracking-[0.08em]'} rounded-md transition-colors ${
                        activeViewId === view.id
                          ? 'bg-tea-accent/15 text-tea-accent'
                          : 'text-tea-text-dim hover:text-tea-text-sec'
                      }`}
                      title={filterLabel}
                    >
                      {view.icon && VIEW_ICON_MAP[view.icon] && React.createElement(VIEW_ICON_MAP[view.icon], { size: 15 })}
                      {viewTabsExpanded && isIconOnly ? <span className="text-[11px] uppercase tracking-[0.08em]">{filterLabel}</span> : (view.name || null)}
                      {!view.id.startsWith('default-') && (
                        <span
                          onClick={(e) => { e.stopPropagation(); deleteView(view.id); }}
                          className="ml-1 text-tea-text-sec/40 hover:text-tea-accent transition-colors"
                        >
                          <XIcon size={9} />
                        </span>
                      )}
                    </button>
                  );
                })}
                {hasMore && (
                  <button
                    onClick={() => setViewTabsExpanded(!viewTabsExpanded)}
                    className={`w-7 h-7 flex items-center justify-center shrink-0 rounded-md transition-colors ${activeInHidden ? 'text-tea-accent bg-tea-accent/10' : 'text-tea-text-dim hover:text-tea-text-sec'}`}
                    title={viewTabsExpanded ? 'Show fewer views' : 'Show all views'}
                  >
                    {viewTabsExpanded ? <XIcon size={13} /> : <Plus size={13} />}
                  </button>
                )}
              </>
            );
          })()}

          {/* Right controls — price toggle + group + sort */}
          <div className="flex items-center gap-0 ml-auto shrink-0 relative">
            <button
              onClick={() => setPriceMode(priceMode === 'retail' ? 'cost' : 'retail')}
              className={`w-9 h-9 flex items-center justify-center rounded-md transition-colors ${priceMode === 'cost' ? 'text-tea-accent bg-tea-accent/10' : 'text-tea-text-dim hover:text-tea-text-sec'}`}
              title={`Showing ${priceMode} prices — tap to switch`}
            >
              {priceMode === 'retail' ? <Tag size={15} /> : <Receipt size={15} />}
            </button>
            <div className="relative">
              <button
                onClick={() => { setShowMobileGroupBy(!showMobileGroupBy); setShowMobileSort(false); setShowOptions(false); }}
                className={`w-9 h-9 flex items-center justify-center transition-colors rounded-md ${showMobileGroupBy || inventoryGroupBy ? 'text-tea-accent' : 'text-tea-text-dim hover:text-tea-text-sec'}`}
              >
                <Layers size={15} />
              </button>
              {/* Group-by dropdown rendered outside backdrop-blur container below */}
            </div>
            <div className="relative">
              <button
                onClick={() => { setShowMobileSort(!showMobileSort); setShowMobileGroupBy(false); setShowOptions(false); }}
                className={`w-9 h-9 flex items-center justify-center transition-colors rounded-md ${showMobileSort ? 'text-tea-accent' : 'text-tea-text-dim hover:text-tea-text-sec'}`}
              >
                <ArrowUpDown size={15} />
              </button>
              {/* Sort dropdown rendered outside backdrop-blur container below */}
            </div>
          </div>
        </div>
      </div>

      {/* --- MOBILE GROUP-BY DROPDOWN (outside backdrop-blur container) --- */}
      <div className="md:hidden">
            {showMobileGroupBy && (
              <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMobileGroupBy(false)} />
              <div className="fixed right-12 top-[40px] w-40 bg-tea-surface border border-tea-border shadow-2xl rounded-xl z-50 py-1" role="menu">
                {GROUPBY_OPTIONS.map(opt => {
                  const isActive = (inventoryGroupBy || '') === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => {
                        setInventoryGroupBy(opt.value || null);
                        setShowMobileGroupBy(false);
                      }}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-[13px] transition-colors ${isActive ? 'text-tea-accent font-medium' : 'text-tea-text-sec active:bg-tea-bg'}`}
                    >
                      <span>{opt.label}</span>
                      {isActive && <Check size={14} />}
                    </button>
                  );
                })}
              </div>
              </>
            )}
      </div>

      {/* --- MOBILE SORT DROPDOWN (outside backdrop-blur container) --- */}
      <div className="md:hidden">
            {showMobileSort && (
              <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMobileSort(false)} />
              <div className="fixed right-2 top-[40px] w-[calc(100vw-16px)] max-w-[280px] bg-tea-surface border border-tea-border shadow-2xl rounded-xl z-50 py-2 px-1" role="menu">
                <div className="grid grid-cols-2 gap-0.5">
                {[
                  { key: 'type', label: 'Type' },
                  { key: 'productName', label: 'Name' },
                  { key: 'stockGrams', label: 'Stock' },
                  { key: 'pricePerGramUSD', label: 'Price/g' },
                  { key: 'costAmount', label: 'Cost' },
                  { key: 'costPerGramUSD', label: 'Cost/g' },
                  { key: 'year', label: 'Year' },
                  { key: 'originRegion', label: 'Origin' },
                  { key: 'vendor', label: 'Source' },
                ].map(opt => {
                  const current = inventorySortConfig[0];
                  const isActive = current?.key === opt.key;
                  return (
                    <button
                      key={opt.key}
                      onClick={() => {
                        if (isActive) {
                          setInventorySortConfig([{ key: opt.key, direction: current.direction === 'asc' ? 'desc' : 'asc' }]);
                        } else {
                          setInventorySortConfig([{ key: opt.key, direction: 'asc' }]);
                        }
                        setShowMobileSort(false);
                      }}
                      className={`flex items-center justify-between gap-1 px-2.5 py-2 rounded-lg text-[12px] transition-colors ${isActive ? 'bg-tea-accent/15 text-tea-accent font-medium' : 'text-tea-text-sec active:bg-tea-bg'}`}
                    >
                      <span>{opt.label}</span>
                      {isActive && (
                        <span className="flex items-center">
                          {current.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                        </span>
                      )}
                    </button>
                  );
                })}
                </div>
              </div>
              </>
            )}
      </div>

      {/* --- MOBILE OPTIONS SHEET (outside backdrop-blur container) --- */}
      <div className="md:hidden">
            {showOptions && (
              <>
              <div className="fixed inset-0 z-40" onClick={() => setShowOptions(false)} onKeyDown={(e) => { if (e.key === 'Escape') setShowOptions(false); }} />
              <div
                className="fixed right-2 top-[40px] w-48 bg-tea-surface border border-tea-border shadow-2xl rounded-xl z-50 py-1 flex flex-col max-h-[calc(100dvh-100px)] overflow-y-auto"
                role="menu"
                onKeyDown={(e) => { if (e.key === 'Escape') setShowOptions(false); }}
                tabIndex={-1}
                ref={(el) => el?.focus()}
              >
                  <button
                      onClick={() => { setFilterType(filterType === 'Pending' ? 'All' : 'Pending'); setShowOptions(false); }}
                      className={`px-3 py-2 text-left text-[11px] flex items-center gap-2 hover:bg-tea-bg transition-colors ${filterType === 'Pending' ? 'text-tea-accent' : 'text-tea-text-sec'}`}
                  >
                      <Sparkles size={13} />
                      Pending AI
                      {pendingCount > 0 && (
                          <span className="ml-auto bg-tea-accent/20 text-tea-accent text-[9px] font-bold px-1.5 py-0.5 rounded-full">{pendingCount}</span>
                      )}
                  </button>
                  <div className="h-px bg-tea-border"></div>
                  <button onClick={() => { onImportClick(); setShowOptions(false); }} className="px-3 py-2 text-left text-[11px] text-tea-text-sec hover:text-tea-text hover:bg-tea-bg flex items-center gap-2 transition-colors">
                      <FileSpreadsheet size={13} /> Import CSV
                  </button>
                  <button onClick={() => { handleExport(); setShowOptions(false); }} className="px-3 py-2 text-left text-[11px] text-tea-text-sec hover:text-tea-text hover:bg-tea-bg flex items-center gap-2 transition-colors">
                      <Download size={13} /> Export CSV
                  </button>
                  <button
                      onClick={() => { handleBulkEnrich(); setShowOptions(false); }}
                      disabled={isEnriching}
                      className="px-3 py-2 text-left text-[11px] text-tea-text-sec hover:text-tea-text hover:bg-tea-bg flex items-center gap-2 transition-colors disabled:opacity-50"
                  >
                      {isEnriching ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                      Enrich Wisdom
                  </button>
                  <div className="h-px bg-tea-border"></div>
                  <button onClick={() => { setShowResetConfirm(true); setShowOptions(false); }} className="px-3 py-2 text-left text-[11px] text-tea-accent hover:bg-tea-accent/10 flex items-center gap-2 transition-colors">
                      <Trash2 size={13} /> Wipe Database
                  </button>
              </div>
              </>
            )}
      </div>

      {/* --- SAVED VIEWS TAB BAR (desktop only) --- */}
      <div className="hidden md:flex items-center gap-1 px-6 py-1.5 border-b border-tea-border bg-tea-bg overflow-x-auto custom-scrollbar hide-scrollbar">
        {(() => {
          const views = savedViews.length > 0 ? savedViews.filter(v => inventoryCategory === 'teaware' ? v.id.includes('teaware') : !v.id.includes('teaware')) : activeDefaultViews;
          let didSeparate = false;
          return views.map(view => {
            const isIconOnly = view.icon && !view.name;
            const needsSep = isIconOnly && !didSeparate;
            if (needsSep) didSeparate = true;
            return (
              <React.Fragment key={view.id}>
                {needsSep && <div className="w-px h-4 bg-tea-border/30 mx-0.5 shrink-0" />}
                <button
                  onClick={() => {
                    setGlossaryMode(false);
                    setActiveView(view.id);
                    setInventoryColumns(view.columns);
                    setInventorySortConfig(view.sortConfig);
                    setFilterType(view.filterType);
                    setInventoryGroupBy(view.groupBy);
                  }}
                  className={`flex items-center gap-1.5 ${isIconOnly ? 'px-2' : 'px-3'} py-1.5 text-[11px] uppercase tracking-[0.12em] rounded-md whitespace-nowrap transition-colors ${
                    activeViewId === view.id
                      ? 'bg-tea-accent/15 text-tea-accent'
                      : 'text-tea-text-dim hover:text-tea-text-sec hover:bg-tea-surface'
                  }`}
                >
                  {view.icon && VIEW_ICON_MAP[view.icon] && React.createElement(VIEW_ICON_MAP[view.icon], { size: 13 })}
                  {view.name}
                  {!view.id.startsWith('default-') && (
                    <span
                      onClick={(e) => { e.stopPropagation(); deleteView(view.id); }}
                      className="ml-1 text-tea-text-sec/40 hover:text-tea-accent transition-colors"
                    >
                      <XIcon size={10} />
                    </span>
                  )}
                </button>
              </React.Fragment>
            );
          });
        })()}
        <div className="flex items-center gap-1 ml-auto shrink-0">
          {showSaveViewPrompt ? (
            <div className="flex items-center gap-1">
              <input
                autoFocus
                value={newViewName}
                onChange={(e) => setNewViewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newViewName.trim()) {
                    const id = `custom-${Date.now()}`;
                    saveView({ id, name: newViewName.trim(), columns: inventoryColumns, sortConfig: inventorySortConfig, filterType, groupBy: inventoryGroupBy });
                    setActiveView(id);
                    setNewViewName('');
                    setShowSaveViewPrompt(false);
                  } else if (e.key === 'Escape') {
                    setShowSaveViewPrompt(false);
                    setNewViewName('');
                  }
                }}
                placeholder="View name..."
                className="bg-transparent border-b border-tea-border text-[10px] text-tea-text outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg w-24 py-0.5 px-1"
              />
              <button onClick={() => { setShowSaveViewPrompt(false); setNewViewName(''); }} className="text-tea-text-sec/40 hover:text-tea-text-sec"><XIcon size={10} /></button>
            </div>
          ) : (
            <button
              onClick={() => setShowSaveViewPrompt(true)}
              className="flex items-center justify-center w-8 h-8 rounded-md text-tea-text-sec/40 hover:text-tea-text-sec hover:bg-tea-surface transition-colors shrink-0"
              aria-label="Save current view"
            >
              <Save size={15} />
            </button>
          )}
          {inventoryCategory === 'tea' && (
            <>
              <div className="w-px h-4 bg-tea-border/30 shrink-0" />
              <button
                onClick={() => setGlossaryMode(prev => !prev)}
                className={`flex items-center justify-center w-8 h-8 rounded-md transition-colors shrink-0 ${
                  glossaryMode
                    ? 'bg-tea-accent/15 text-tea-accent'
                    : 'text-tea-text-sec hover:text-tea-text hover:bg-tea-surface'
                }`}
                aria-label="Glossary view"
              >
                <ImageIcon size={15} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* --- HEADER CONTROLS --- */}
      <div className={`sticky top-0 z-30 border-b border-tea-border py-2 transition-colors hidden md:block ${isEditMode ? 'bg-tea-surface/95 border-b-tea-accent/20' : 'bg-tea-bg/90 backdrop-blur-md'}`}>

        {/* Desktop header — unchanged */}
        <div className="flex px-6 max-w-7xl mx-auto items-center gap-4">
            <div className="flex items-center gap-2 shrink-0">
                <Settings size={16} className={isEditMode ? "text-tea-text-sec" : "text-tea-accent"} />
                <h2 className="text-sm font-serif text-tea-text uppercase tracking-[0.15em]">
                    {isEditMode ? 'Editing' : 'Inventory'}
                </h2>
                <span className="text-tea-text-sec text-xs tracking-wide">
                    {isEditMode ? '— click cells to edit' : `— ${processedProducts.length} items`}
                </span>
            </div>

            <div className="flex items-center gap-4 ml-auto">
                {/* Actions Group */}
                <div className="flex items-center gap-2 relative">

                    {/* Toggle Edit Mode */}
                    <button
                        onClick={() => setIsEditMode(!isEditMode)}
                        className={`flex items-center gap-2 text-xs uppercase tracking-[0.2em] font-bold transition-all px-3 py-1.5 border rounded-lg ${
                            isEditMode
                            ? 'bg-tea-accent text-tea-bg border-tea-accent hover:bg-tea-accent/90'
                            : 'text-tea-text-sec border-transparent hover:border-tea-border hover:text-tea-text'
                        }`}
                    >
                        {isEditMode ? <Check size={14} /> : <Pencil size={14} />}
                        {isEditMode ? 'Done' : 'Edit'}
                    </button>

                    <div className="w-px h-4 bg-tea-border mx-1"></div>

                    <button onClick={onAddClick} className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] font-bold text-tea-text-sec hover:text-tea-text transition-colors px-3 py-1.5 border border-transparent hover:border-tea-border rounded-lg">
                        <Plus size={14} /> New
                    </button>

                    {/* Price Mode Toggle */}
                    <div className="flex items-center rounded-lg overflow-hidden">
                      <button
                        onClick={() => setPriceMode('retail')}
                        className={priceMode === 'retail' ? 'pill-active' : 'pill'}
                        style={{ borderRadius: '8px 0 0 8px', padding: '5px 10px' }}
                        title="Show retail prices"
                      >
                        <Tag size={14} />
                      </button>
                      <button
                        onClick={() => setPriceMode('cost')}
                        className={priceMode === 'cost' ? 'pill-active' : 'pill'}
                        style={{ borderRadius: '0 8px 8px 0', padding: '5px 10px' }}
                        title="Show cost prices"
                      >
                        <Receipt size={14} />
                      </button>
                    </div>

                    {/* Columns Toggle */}
                    <div className="relative">
                      <button
                        onClick={() => setShowColumnsPopover(!showColumnsPopover)}
                        className={`p-1.5 rounded-lg transition-colors ${showColumnsPopover ? 'text-tea-accent bg-tea-surface' : 'text-tea-text-sec hover:text-tea-text hover:bg-tea-surface'}`}
                        title="Show/Hide Columns"
                      >
                        <Columns size={15} />
                      </button>
                      {showColumnsPopover && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setShowColumnsPopover(false)} />
                          <div className="absolute right-0 top-full mt-2 w-44 bg-tea-surface border border-tea-border shadow-xl rounded-xl z-50 py-2">
                            <div className="px-3 pb-1.5 text-[9px] text-tea-text-sec/60 uppercase tracking-[0.2em]">Visible Columns</div>
                            {activeColumnDefs.map(col => (
                              <label key={col.key} className={`flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-tea-bg transition-colors cursor-pointer ${'alwaysVisible' in col && col.alwaysVisible ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                <input
                                  type="checkbox"
                                  checked={inventoryColumns.includes(col.key)}
                                  onChange={() => !('alwaysVisible' in col && col.alwaysVisible) && toggleInventoryColumn(col.key)}
                                  disabled={'alwaysVisible' in col && col.alwaysVisible}
                                  className="accent-tea-accent"
                                />
                                <span className="text-tea-text">{col.label}</span>
                              </label>
                            ))}
                          </div>
                        </>
                      )}
                    </div>

                    {/* Group By Dropdown */}
                    <div className="relative">
                      <button
                        onClick={() => setShowGroupByDropdown(!showGroupByDropdown)}
                        className={`flex items-center gap-1 p-1.5 rounded-lg text-xs transition-colors ${inventoryGroupBy ? 'text-tea-accent bg-tea-surface' : 'text-tea-text-sec hover:text-tea-text hover:bg-tea-surface'}`}
                        title="Group By"
                      >
                        <Layers size={15} />
                      </button>
                      {showGroupByDropdown && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setShowGroupByDropdown(false)} />
                          <div className="absolute right-0 top-full mt-2 w-40 bg-tea-surface border border-tea-border shadow-xl rounded-xl z-50 py-1">
                            {GROUPBY_OPTIONS.map(opt => (
                              <button
                                key={opt.value}
                                onClick={() => {
                                  setInventoryGroupBy(opt.value || null);
                                  setShowGroupByDropdown(false);
                                }}
                                className={`w-full px-3 py-1.5 text-left text-xs hover:bg-tea-bg transition-colors ${(inventoryGroupBy || '') === opt.value ? 'text-tea-accent' : 'text-tea-text-sec'}`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>

                    <button
                        onClick={() => setShowOptions(!showOptions)}
                        className="p-1.5 text-tea-text-sec hover:text-tea-text transition-colors rounded-lg hover:bg-tea-surface"
                    >
                        <MoreHorizontal size={16} />
                    </button>

                    {/* Options Dropdown */}
                    {showOptions && (
                        <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowOptions(false)}></div>
                        <div className="absolute right-0 top-full mt-2 w-48 bg-tea-surface border border-tea-border shadow-xl rounded-xl z-50 py-1 flex flex-col">
                            <button 
                                onClick={() => { setFilterType(filterType === 'Alerts' ? 'All' : 'Alerts'); setShowOptions(false); }}
                                className={`px-4 py-2 text-left text-xs flex items-center gap-2 hover:bg-tea-bg transition-colors ${filterType === 'Alerts' ? 'text-tea-accent' : 'text-tea-text-sec'}`}
                            >
                                <AlertTriangle size={14} /> Low Stock Alerts
                            </button>
                            <button
                                onClick={() => { setFilterType(filterType === 'Unverified' ? 'All' : 'Unverified'); setShowOptions(false); }}
                                className={`px-4 py-2 text-left text-xs flex items-center gap-2 hover:bg-tea-bg transition-colors ${filterType === 'Unverified' ? 'text-tea-accent' : 'text-tea-text-sec'}`}
                            >
                                <CheckSquare size={14} /> Stock Verification
                            </button>
                            <button
                                onClick={() => { setFilterType(filterType === 'Pending' ? 'All' : 'Pending'); setShowOptions(false); }}
                                className={`px-4 py-2 text-left text-xs flex items-center gap-2 hover:bg-tea-bg transition-colors ${filterType === 'Pending' ? 'text-tea-accent' : 'text-tea-text-sec'}`}
                            >
                                <Sparkles size={14} />
                                Pending AI Approval
                                {pendingCount > 0 && (
                                    <span className="ml-auto bg-tea-accent/20 text-tea-accent text-[10px] font-bold px-1.5 py-0.5 rounded-full">{pendingCount}</span>
                                )}
                            </button>
                            <button onClick={() => { onImportClick(); setShowOptions(false); }} className="px-4 py-2 text-left text-xs text-tea-text-sec hover:text-tea-text hover:bg-tea-bg flex items-center gap-2 transition-colors">
                                <FileSpreadsheet size={14} /> Import CSV
                            </button>
                            <button onClick={() => { handleExport(); setShowOptions(false); }} className="px-4 py-2 text-left text-xs text-tea-text-sec hover:text-tea-text hover:bg-tea-bg flex items-center gap-2 transition-colors">
                                <Download size={14} /> Export CSV
                            </button>
                            <button 
                                onClick={() => { handleBulkEnrich(); setShowOptions(false); }} 
                                disabled={isEnriching}
                                className="px-4 py-2 text-left text-xs text-tea-text-sec hover:text-tea-text hover:bg-tea-bg flex items-center gap-2 transition-colors disabled:opacity-50"
                            >
                                {isEnriching ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                                Enrich Missing Wisdom
                            </button>
                            <div className="h-px bg-tea-border my-1"></div>
                            <button onClick={() => { setShowResetConfirm(true); setShowOptions(false); }} className="px-4 py-2 text-left text-xs text-tea-accent hover:bg-tea-accent/10 flex items-center gap-2 transition-colors">
                                <Trash2 size={14} /> Wipe Database
                            </button>
                        </div>
                        </>
                    )}
                </div>
            </div>
        </div>
      </div>

      {/* ENRICHMENT PROGRESS BANNER */}
      {enrichProgress && (
        <div className="px-6 py-2 bg-tea-surface/80 border-b border-tea-border flex items-center gap-4">
          <Loader2 size={13} className="animate-spin text-tea-accent flex-shrink-0" />
          <div className="flex-1">
            <div className="text-[10px] text-tea-text-sec uppercase tracking-[0.2em] mb-1.5">
              Generating &lsquo;{enrichProgress.currentName}&rsquo; — {enrichProgress.current} of {enrichProgress.total}
            </div>
            <div className="h-0.5 bg-tea-border rounded-full overflow-hidden">
              <div
                className="h-full bg-tea-accent transition-all duration-500"
                style={{ width: `${(enrichProgress.current / enrichProgress.total) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* --- SCROLL CONTAINER --- */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-auto custom-scrollbar bg-tea-bg md:px-6"
        onScroll={(e) => filterType !== 'Pending' && setScrollTop(e.currentTarget.scrollTop)}
      >

        {/* ACTIVE FILTER LABEL — shows for icon-only views */}
        {VIEW_FILTER_LABELS[filterType] && (
          <div className="px-4 md:px-0 pt-4 pb-2 max-w-7xl mx-auto">
            <div className="flex items-center gap-2.5">
              {(() => {
                const activeView = [...(savedViews.length > 0 ? savedViews : (inventoryCategory === 'teaware' ? DEFAULT_TEAWARE_VIEWS : DEFAULT_TEA_VIEWS))].find(v => v.id === activeViewId);
                const IconComp = activeView?.icon ? VIEW_ICON_MAP[activeView.icon] : null;
                return IconComp ? <IconComp size={14} className="text-tea-text-sec" /> : null;
              })()}
              <span className="text-xs uppercase tracking-[0.15em] text-tea-text">{VIEW_FILTER_LABELS[filterType]}</span>
              <span className="ml-auto text-[10px] text-tea-text-dim uppercase tracking-[0.15em]">{processedProducts.length} item{processedProducts.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
        )}

        {/* STOCK VERIFICATION BANNER */}
        {filterType === 'Unverified' && (
          <div className="max-w-7xl mx-auto px-4 md:px-0 pt-4 pb-2">
            <div className="bg-tea-surface rounded-xl px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-tea-text-sec uppercase tracking-[0.15em]">
                  Confirm each tea's stock matches your shelf
                </span>
                <div className="flex items-center gap-3">
                  {verificationStats.remaining === 0 && verificationStats.total > 0 ? (
                    <span className="text-[10px] text-emerald-400 font-medium uppercase tracking-[0.15em]">All verified</span>
                  ) : (
                    <span className="text-[10px] text-tea-text-dim tabular-nums">
                      {verificationStats.verified} of {verificationStats.total}
                    </span>
                  )}
                  {verificationStats.verified > 0 && (
                    <button
                      onClick={async () => {
                        if (!window.confirm(`Reset all ${verificationStats.verified} verification checkmarks? This lets you start a fresh inventory check.`)) return;
                        try {
                          await api.rpc.resetStockVerification();
                          setLocalProducts(prev => prev.map(p => ({ ...p, stockVerifiedAt: null })));
                          onRefresh();
                          showToast('Verification reset — ready for a new stock check', 'success');
                        } catch (err: any) {
                          showToast(`Reset failed: ${err.message}`, 'error');
                        }
                      }}
                      className="text-[10px] text-tea-text-dim hover:text-amber-400 transition-colors uppercase tracking-[0.12em]"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>
              <div className="w-full bg-tea-bg rounded-full h-1 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out bg-emerald-500/70"
                  style={{ width: `${verificationStats.total > 0 ? (verificationStats.verified / verificationStats.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* REVIEW FEED (Pending AI Approval mode) */}
        {filterType === 'Pending' && (
          <div className="max-w-3xl mx-auto py-6 px-4 space-y-4">
            {/* Feed header */}
            <div className="sticky top-0 z-10 bg-tea-bg/95 backdrop-blur py-3 flex items-center justify-between border-b border-tea-border pb-4">
              <span className="text-tea-text-sec text-[10px] uppercase tracking-[0.2em]">
                {processedProducts.length} pending review
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleApproveAll}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-tea-accent text-tea-bg text-[10px] font-bold uppercase tracking-[0.2em] rounded-lg hover:bg-tea-accent/90 transition-colors"
                >
                  <Check size={11} /> Approve All
                </button>
                <button
                  onClick={handleDiscardAll}
                  className="text-[10px] text-tea-text-sec/60 hover:text-tea-accent uppercase tracking-[0.2em] transition-colors px-2 py-1.5"
                >
                  Discard All
                </button>
              </div>
            </div>

            {/* Review cards */}
            {processedProducts.map(product => {
              const draft = reviewDrafts[product.id] || {};
              const isApproving = approvingIds.has(product.id);
              const isRegenerating = regeneratingId === product.id;
              const loreExtras = [draft.terroir, draft.processingNotes].filter(Boolean).join(' ');
              const storyPreview = (draft.lore || '') + (loreExtras ? ' ' + loreExtras : '');
              const fieldClass = "w-full bg-transparent border-b border-tea-border text-xs text-tea-text outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg focus:border-tea-accent transition-colors py-1";

              return (
                <div key={product.id} className="bg-tea-surface border border-tea-border rounded-xl overflow-hidden">
                  {/* Identity */}
                  <div className="px-5 py-3 bg-tea-bg/50 border-b border-tea-border flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-serif text-tea-text text-sm truncate">{product.productName}</span>
                      {product.chineseName && <span className="text-tea-text-sec text-xs font-serif flex-shrink-0">{product.chineseName}</span>}
                    </div>
                    <span className="text-[10px] text-tea-text-sec uppercase tracking-[0.2em] flex-shrink-0">
                      {product.type}{product.originRegion ? ` · ${product.originRegion}` : ''}{product.year ? ` · ${product.year}` : ''}
                    </span>
                  </div>

                  <div className="p-5 space-y-4">
                    {/* Story preview */}
                    {storyPreview && (
                      <div className="bg-tea-bg/60 border border-tea-border rounded-lg p-4">
                        <div className="text-[10px] text-tea-text-sec/60 uppercase tracking-[0.2em] mb-2">Story Preview</div>
                        <p className="text-tea-text/70 text-xs font-serif italic leading-relaxed">{storyPreview}</p>
                      </div>
                    )}

                    {/* Lore */}
                    <div>
                      <label className="text-[10px] text-tea-text-sec uppercase tracking-[0.2em] block mb-1">Lore</label>
                      <textarea
                        value={draft.lore || ''}
                        onChange={e => setReviewDrafts(prev => ({ ...prev, [product.id]: { ...prev[product.id], lore: e.target.value } }))}
                        rows={3}
                        className="w-full bg-transparent border-b border-tea-border text-sm text-tea-text font-serif outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg focus:border-tea-accent transition-colors resize-none leading-relaxed py-1"
                      />
                    </div>

                    {/* Grid fields */}
                    <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                      <div>
                        <label className="text-[10px] text-tea-text-sec uppercase tracking-[0.2em] block mb-1">Terroir</label>
                        <input value={draft.terroir || ''} onChange={e => setReviewDrafts(prev => ({ ...prev, [product.id]: { ...prev[product.id], terroir: e.target.value } }))} className={fieldClass} />
                      </div>
                      <div>
                        <label className="text-[10px] text-tea-text-sec uppercase tracking-[0.2em] block mb-1">Processing</label>
                        <input value={draft.processingNotes || ''} onChange={e => setReviewDrafts(prev => ({ ...prev, [product.id]: { ...prev[product.id], processingNotes: e.target.value } }))} className={fieldClass} />
                      </div>
                      <div>
                        <label className="text-[10px] text-tea-text-sec uppercase tracking-[0.2em] block mb-1">Mood</label>
                        <input value={draft.mood || ''} onChange={e => setReviewDrafts(prev => ({ ...prev, [product.id]: { ...prev[product.id], mood: e.target.value } }))} className={fieldClass} />
                      </div>
                      <div>
                        <label className="text-[10px] text-tea-text-sec uppercase tracking-[0.2em] block mb-1">Tasting Notes</label>
                        <input
                          value={Array.isArray(draft.tastingNotes) ? draft.tastingNotes.join(', ') : (draft.tastingNotes || '')}
                          onChange={e => setReviewDrafts(prev => ({ ...prev, [product.id]: { ...prev[product.id], tastingNotes: e.target.value.split(',').map((n: string) => n.trim()).filter(Boolean) } }))}
                          className={fieldClass}
                          placeholder="Honey, Camphor, Wet Stone"
                        />
                      </div>
                    </div>

                    {/* Experience */}
                    <div>
                      <label className="text-[10px] text-tea-text-sec uppercase tracking-[0.2em] block mb-1">Experience</label>
                      <textarea
                        value={draft.experience || ''}
                        onChange={e => setReviewDrafts(prev => ({ ...prev, [product.id]: { ...prev[product.id], experience: e.target.value } }))}
                        rows={2}
                        className="w-full bg-transparent border-b border-tea-border text-xs text-tea-text outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg focus:border-tea-accent transition-colors resize-none leading-relaxed py-1"
                      />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="px-5 py-3 border-t border-tea-border flex justify-between items-center bg-tea-bg/30">
                    <button
                      onClick={() => handleRegenerateOne(product)}
                      disabled={!!regeneratingId}
                      className="flex items-center gap-1.5 text-[10px] text-tea-text-sec hover:text-tea-text uppercase tracking-[0.2em] transition-colors disabled:opacity-40"
                    >
                      {isRegenerating ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                      Regenerate
                    </button>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleDiscardOne(product.id)}
                        className="text-[10px] text-tea-text-sec/50 hover:text-tea-accent uppercase tracking-[0.2em] transition-colors"
                      >
                        Discard
                      </button>
                      <button
                        onClick={() => handleApproveOne(product)}
                        disabled={isApproving}
                        className="flex items-center gap-1.5 px-3 py-1 bg-tea-accent/10 border border-tea-accent-sub text-tea-accent text-[10px] uppercase tracking-[0.2em] rounded-lg hover:bg-tea-accent/20 transition-colors disabled:opacity-40"
                      >
                        {isApproving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                        Approve
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {processedProducts.length === 0 && (
              <div className="text-center py-16 text-tea-text-sec font-serif italic">
                All caught up — no pending wisdom to review.
              </div>
            )}
          </div>
        )}

        {/* GLOSSARY MODE — card grid for browsing */}
        {glossaryMode && filterType !== 'Pending' && (
          <div className="pb-24 px-3 md:px-6 pt-3">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {processedProducts.map(product => {
                const dotColor = getThemeColor(product.type);
                return (
                  <button
                    key={product.id}
                    onClick={() => setDetailsProduct(product)}
                    className="group text-left bg-tea-surface/50 hover:bg-tea-surface rounded-xl overflow-hidden transition-all duration-200 hover:shadow-lg"
                  >
                    {product.imageUrl ? (
                      <div className="aspect-square overflow-hidden">
                        <img src={product.imageUrl} alt={product.productName} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      </div>
                    ) : (
                      <div className="aspect-square flex items-center justify-center" style={{ backgroundColor: `${dotColor}15` }}>
                        <Leaf size={32} style={{ color: dotColor }} className="opacity-30" />
                      </div>
                    )}
                    <div className="p-3">
                      <div className="text-sm font-medium text-tea-text truncate">{product.productName}</div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: dotColor }} />
                        <span className="text-[11px] text-tea-text-sec">{product.type}</span>
                        {product.year && <span className="text-[11px] text-tea-text-dim">· {product.year}</span>}
                      </div>
                      {product.tastingNotes && product.tastingNotes.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {product.tastingNotes.slice(0, 3).map(note => (
                            <span key={note} className="tag text-[9px]">{note}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
            {processedProducts.length === 0 && (
              <div className="text-center py-16 text-tea-text-sec font-serif italic">No items found.</div>
            )}
          </div>
        )}

        {/* MOBILE CARDS — compact rows with inline action icons */}
        <div className={`md:hidden pb-24 ${filterType === 'Pending' || glossaryMode ? 'hidden' : ''}`}>
            {(() => {
              let lastGroup: string | null = null;
              const sortKey = inventorySortConfig[0]?.key;
              const groupByVendor = sortKey === 'vendor';
              return processedProducts.map((product, idx) => {
                const dotColor = getThemeColor(product.type);
                const isExpanded = expandedCardId === product.id;
                const isOutOfStock = product.stockGrams === 0;
                const isLowStock = product.stockGrams > 0 && product.stockGrams <= (product.lowStockThreshold || 10);
                const groupValue = groupByVendor ? (product.vendor || 'Unknown') : product.type;
                const showGroupHeader = groupValue !== lastGroup;
                lastGroup = groupValue;
                return (
                <React.Fragment key={product.id}>
                    {/* Group header — by type or vendor */}
                    {showGroupHeader && (
                      <div className="flex items-center gap-2.5 px-4 py-3 bg-tea-surface/30">
                        {!groupByVendor && <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: dotColor }} />}
                        {groupByVendor && <MapPin size={12} className="text-tea-text-dim flex-shrink-0" />}
                        <span className="text-[12px] uppercase tracking-[0.12em] font-semibold text-tea-text">{groupValue}</span>
                        <div className="flex-1 h-px bg-tea-border/40" />
                      </div>
                    )}

                    <div className={`${!product.isPublic ? 'opacity-50' : ''} ${idx % 2 === 0 ? 'bg-tea-bg' : 'bg-tea-surface/15'}`}>
                        {/* Main row — tap to expand, with inline action icons */}
                        <div
                            className="inv-row-accent w-full flex items-center transition-colors active:bg-tea-surface/60"
                            style={{ '--row-type-color': dotColor } as React.CSSProperties}
                        >
                            {/* Tappable name area — expands card */}
                            <button
                                className="flex-1 min-w-0 text-left px-4 py-2 flex items-center gap-2"
                                onClick={() => setExpandedCardId(isExpanded ? null : product.id)}
                            >
                                {/* Name + metadata */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-tea-text text-[15px] font-sans font-medium truncate leading-tight">{product.productName}</span>
                                        {product.isFeatured && <Star size={11} className="flex-shrink-0 text-tea-gold fill-tea-gold" />}
                                        {!product.isPublic && <EyeOff size={10} className="flex-shrink-0 text-tea-text-dim" />}
                                    </div>
                                    <div className="flex items-center gap-1.5 mt-0.5 text-[12px]">
                                        <span className="font-medium text-tea-text-sec">{product.type}</span>
                                        {product.originRegion && (
                                            <>
                                                <span className="text-tea-text-dim">·</span>
                                                <span className="truncate text-tea-text-dim">{product.originRegion}</span>
                                            </>
                                        )}
                                        {product.year && (
                                            <>
                                                <span className="text-tea-text-dim">·</span>
                                                <span className="text-tea-text-dim">{product.year}</span>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Stock + Price */}
                                <div className="flex-shrink-0 text-right min-w-[64px]">
                                    {inventoryCategory === 'teaware' ? (
                                      <>
                                        <div className="text-[13px] text-tea-text font-sans font-medium tabular-nums">
                                          {product.quantityUnits ?? '-'} <span className="text-tea-text-dim text-[11px]">units</span>
                                        </div>
                                        <div className="text-[12px] text-tea-text-sec tabular-nums">
                                          {product.material || product.teawareCategory || '-'}
                                        </div>
                                      </>
                                    ) : (
                                      <>
                                        {isOutOfStock ? (
                                          <div className="text-[11px] font-medium text-tea-text-dim tabular-nums">0g</div>
                                        ) : isLowStock ? (
                                          <div className="text-[13px] font-sans font-medium tabular-nums text-amber-500">
                                              {Math.round(product.stockGrams)}g
                                          </div>
                                        ) : (
                                          <div className="text-[13px] font-sans font-medium tabular-nums text-tea-text">
                                              {Math.round(product.stockGrams)}g
                                          </div>
                                        )}
                                        <div className="text-[12px] text-tea-text-dim tabular-nums">
                                            {priceMode === 'cost'
                                              ? `${product.costPerGramUSD > 0 ? fmtNum(product.costPerGramUSD) : '0.00'}/g`
                                              : `${fmtNum(product.fixedRetailPriceUSD ?? product.pricePerGramUSD)}/g`
                                            }
                                        </div>
                                      </>
                                    )}
                                </div>
                            </button>

                            {/* Inline action icons — Edit + Details */}
                            <div className="flex items-center gap-0 pr-2 flex-shrink-0">
                                <button
                                    onClick={() => setDetailsProduct(product)}
                                    className="w-10 h-10 flex items-center justify-center text-tea-text-dim hover:text-tea-text-sec transition-colors rounded-lg"
                                    aria-label="View details"
                                >
                                    <FileText size={16} />
                                </button>
                                <button
                                    onClick={() => setPanelProduct(product)}
                                    className="w-10 h-10 flex items-center justify-center text-tea-text-dim hover:text-tea-text transition-colors rounded-lg"
                                    aria-label="Edit product"
                                >
                                    <Pencil size={16} />
                                </button>
                            </div>

                            {/* Verification checkmark (mobile) */}
                            {filterType === 'Unverified' && (
                              <button
                                onClick={() => {
                                  const isVerified = !!product.stockVerifiedAt;
                                  const name = product.givenName || product.productName;
                                  if (!isVerified) {
                                    handleProductUpdate(product.id, 'stockVerifiedAt', new Date().toISOString());
                                    showToast(`${name} verified`, 'success', {
                                      duration: 5000,
                                      action: {
                                        label: 'Undo',
                                        onClick: () => handleProductUpdate(product.id, 'stockVerifiedAt', null),
                                      },
                                    });
                                  } else {
                                    handleProductUpdate(product.id, 'stockVerifiedAt', null);
                                  }
                                }}
                                className={`flex-shrink-0 w-10 h-10 mr-2 rounded-lg flex items-center justify-center transition-colors ${product.stockVerifiedAt ? 'bg-emerald-500/20 text-emerald-400' : 'bg-tea-surface text-tea-text-dim'}`}
                              >
                                {product.stockVerifiedAt ? <Check size={18} strokeWidth={3} /> : <Square size={18} />}
                              </button>
                            )}
                        </div>

                        {/* Expanded detail panel — shows extra info + rare actions */}
                        <AnimatePresence>
                        {isExpanded && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                                className="overflow-hidden"
                            >
                              <div className="inv-detail-panel px-4 pb-3 pt-2">
                                {/* Context line — given name + vendor */}
                                <div className="flex items-baseline justify-between gap-3 pb-2 mb-2" style={{ boxShadow: '0 1px 0 rgba(184,146,78,0.08)' }}>
                                  <span className="text-[13px] text-tea-text font-serif italic truncate">
                                    {product.givenName || product.chineseName || '—'}
                                  </span>
                                  {product.vendor && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); navigate(`/admin/people?tab=sources&search=${encodeURIComponent(product.vendor!)}`); }}
                                      className="text-[11px] text-tea-text-dim hover:text-tea-accent truncate shrink-0 flex items-center gap-1 transition-colors"
                                    >
                                      <MapPin size={9} className="opacity-50" />
                                      {product.vendor}
                                    </button>
                                  )}
                                </div>

                                {/* Quick edits — numbers grid */}
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 py-1">
                                  {inventoryCategory === 'teaware' ? (
                                    <>
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="text-[11px] text-tea-text-sec uppercase tracking-[0.06em] shrink-0">Units</span>
                                        <GhostInput
                                          value={product.quantityUnits ?? ''}
                                          onSave={(val) => handleProductUpdate(product.id, 'quantityUnits', val)}
                                          type="number"
                                          align="right"
                                          className="num text-[13px] text-tea-text font-medium"
                                        />
                                      </div>
                                      {priceMode === 'retail' ? (
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="text-[11px] text-tea-text-sec uppercase tracking-[0.06em] shrink-0">Retail</span>
                                        <GhostInput
                                          value={(product.fixedRetailPriceUSD ?? product.pricePerGramUSD)?.toFixed(2) || ''}
                                          onSave={(val) => handleProductUpdate(product.id, 'fixedRetailPriceUSD', val ? Number(val) : null)}
                                          type="number"
                                          align="right"
                                          className="num text-[13px] text-tea-text font-medium"
                                        />
                                      </div>
                                      ) : (
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="text-[11px] text-tea-text-sec uppercase tracking-[0.06em] shrink-0">Cost</span>
                                        <div className="flex items-center gap-1">
                                          <GhostInput
                                            value={product.costAmount || ''}
                                            onSave={(val) => handleProductUpdate(product.id, 'costAmount', val)}
                                            type="number"
                                            align="right"
                                            className="num text-[13px] text-tea-text-sec"
                                          />
                                          <span className="text-[10px] text-tea-text-dim">{product.costCurrency || 'USD'}</span>
                                        </div>
                                      </div>
                                      )}
                                    </>
                                  ) : (
                                    <>
                                      {priceMode === 'cost' ? (
                                      <>
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="text-[11px] text-tea-text-sec uppercase tracking-[0.06em] shrink-0">Batch</span>
                                        <div className="flex items-center gap-1">
                                          <GhostInput
                                            value={product.costAmount || ''}
                                            onSave={(val) => handleProductUpdate(product.id, 'costAmount', val)}
                                            type="number"
                                            align="right"
                                            className="num text-[13px] text-tea-text-sec"
                                          />
                                          <span className="text-[10px] text-tea-text-dim">{product.costCurrency || 'USD'}</span>
                                        </div>
                                      </div>
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="text-[11px] text-tea-text-sec uppercase tracking-[0.06em] shrink-0">Bought</span>
                                        <div className="flex items-center gap-1">
                                          <GhostInput
                                            value={product.quantityPurchased || ''}
                                            onSave={(val) => handleProductUpdate(product.id, 'quantityPurchased', val)}
                                            type="number"
                                            align="right"
                                            className="num text-[13px] text-tea-text-sec"
                                          />
                                          <span className="text-[10px] text-tea-text-dim">g</span>
                                        </div>
                                      </div>
                                      </>
                                      ) : null}
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="text-[11px] text-tea-text-sec uppercase tracking-[0.06em] shrink-0">Stock</span>
                                        <div className="flex items-center gap-1">
                                          <GhostInput
                                            value={product.stockGrams}
                                            onSave={(val) => handleProductUpdate(product.id, 'stockGrams', val)}
                                            type="number"
                                            align="right"
                                            className={`num text-[13px] font-medium ${isLowStock ? 'text-amber-500' : 'text-tea-text'}`}
                                          />
                                          <span className="text-[10px] text-tea-text-dim">g</span>
                                        </div>
                                      </div>
                                      {priceMode === 'retail' ? (
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="text-[11px] text-tea-text-sec uppercase tracking-[0.06em] shrink-0">Retail/g</span>
                                        <GhostInput
                                          value={(product.fixedRetailPriceUSD ?? product.pricePerGramUSD)?.toFixed(2) || ''}
                                          onSave={(val) => handleProductUpdate(product.id, 'fixedRetailPriceUSD', val ? Number(val) : null)}
                                          type="number"
                                          align="right"
                                          className={`num text-[13px] font-medium ${product.fixedRetailPriceUSD != null ? 'text-tea-gold' : 'text-tea-text'}`}
                                        />
                                      </div>
                                      ) : null}
                                    </>
                                  )}
                                  {/* Recheck stock flag + Taste button */}
                                  <div className="col-span-2 flex items-center justify-between gap-2 pt-0.5">
                                    <div className="flex items-center gap-3">
                                      <button
                                        onClick={() => handleProductUpdate(product.id, 'recheckStock', !product.recheckStock)}
                                        className={`flex items-center gap-1.5 text-[11px] transition-colors ${product.recheckStock ? 'text-amber-400' : 'text-tea-text-dim hover:text-tea-text-sec'}`}
                                      >
                                        <span className="text-[12px]">{product.recheckStock ? '⚠' : '☐'}</span>
                                        <span className="uppercase tracking-[0.06em]">{product.recheckStock ? 'Needs recount' : 'Mark for recount'}</span>
                                      </button>
                                      <span className="w-px h-3 bg-tea-border/40" />
                                      <button
                                        onClick={() => setTastingEditorProduct(product)}
                                        className="flex items-center gap-1.5 text-[11px] text-tea-text-dim hover:text-tea-gold transition-colors"
                                      >
                                        <Sparkles size={12} />
                                        <span className="uppercase tracking-[0.06em]">Taste</span>
                                      </button>
                                    </div>
                                    {product.stockVerifiedAt && (
                                      <span className="text-[10px] text-tea-text-dim">
                                        Verified {new Date(product.stockVerifiedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Tasting — button + notes */}
                                <div className="mt-2 pt-2" style={{ boxShadow: '0 -1px 0 rgba(184,146,78,0.08)' }}>
                                  {product.tastingNotes && product.tastingNotes.length > 0 ? (
                                    <button
                                      onClick={() => setTastingEditorProduct(product)}
                                      className="w-full text-left group/tasting"
                                    >
                                      <div className="flex flex-wrap gap-1.5">
                                        {product.tastingNotes.map(note => (
                                          <span key={note} className="tag text-[11px]">{note}</span>
                                        ))}
                                      </div>
                                      {product.mood && (
                                        <div className="text-[12px] text-tea-text-dim italic mt-1.5">{product.mood}</div>
                                      )}
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => setTastingEditorProduct(product)}
                                      className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-xs text-tea-text-dim hover:text-tea-gold hover:bg-tea-gold/5 transition-colors active:scale-[0.98]"
                                    >
                                      <Sparkles size={14} />
                                      <span>Add tasting notes</span>
                                    </button>
                                  )}
                                </div>

                                {/* Toggle actions — star, public, archive */}
                                <div className="flex items-center gap-1 mt-2 pt-2" style={{ boxShadow: '0 -1px 0 rgba(184,146,78,0.08)' }}>
                                    <button
                                        onClick={() => handleProductUpdate(product.id, 'isFeatured', !product.isFeatured)}
                                        className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${product.isFeatured ? 'text-tea-gold bg-tea-gold/10' : 'text-tea-text-dim hover:text-tea-text-sec hover:bg-tea-surface/50'}`}
                                        aria-label={product.isFeatured ? 'Unfeature' : 'Feature'}
                                    >
                                        <Star size={16} className={product.isFeatured ? "fill-tea-gold" : ""} />
                                    </button>
                                    <button
                                        onClick={() => handleProductUpdate(product.id, 'isPublic', !product.isPublic)}
                                        className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${product.isPublic ? 'text-tea-text-sec bg-tea-surface/30' : 'text-tea-text-dim hover:text-tea-text-sec hover:bg-tea-surface/50'}`}
                                        aria-label={product.isPublic ? 'Make private' : 'Make public'}
                                    >
                                        {product.isPublic ? <Eye size={16} /> : <EyeOff size={16} />}
                                    </button>
                                    <button
                                        onClick={() => {
                                          const newStatus = product.status === 'Archived' ? 'Active' : 'Archived';
                                          handleProductUpdate(product.id, 'status', newStatus);
                                        }}
                                        className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${product.status === 'Archived' ? 'text-amber-400 bg-amber-500/10' : 'text-tea-text-dim hover:text-tea-text-sec hover:bg-tea-surface/50'}`}
                                        aria-label={product.status === 'Archived' ? 'Unarchive' : 'Archive'}
                                    >
                                        <Archive size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleRestock(product)}
                                        className="w-10 h-10 flex items-center justify-center rounded-lg transition-colors text-tea-text-dim hover:text-tea-accent hover:bg-tea-accent/10"
                                        aria-label="Restock via Compass"
                                    >
                                        <Globe size={16} />
                                    </button>
                                </div>
                              </div>
                            </motion.div>
                        )}
                        </AnimatePresence>
                    </div>
                </React.Fragment>
              );
            });
            })()}

            {processedProducts.length === 0 && (
              <div className="text-center py-16 text-tea-text-sec font-serif italic">
                No items found.
              </div>
            )}
        </div>

        {/* DESKTOP TABLE */}
        <div className={`w-full max-w-7xl mx-auto bg-tea-surface min-h-full ${filterType === 'Pending' || glossaryMode ? 'hidden' : 'hidden md:block'}`}>

          {/* --- GROUPED VIEW --- */}
          {groupedProducts ? (
            <div>
              {/* Table header (sticky) */}
              <table className="w-full table-fixed border-collapse">
                <colgroup>
                  {isEditMode && <col className="w-[32px]" />}
                  {visibleCols.map(col => <col key={col.key} className={col.defaultWidth} />)}
                  <col className="w-[10%]" />
                </colgroup>
                <thead className="sticky top-0 z-20 bg-tea-bg shadow-sm">
                  <tr>
                    {isEditMode && (
                      <th className="px-2 py-2 border-b border-tea-border">
                        <button onClick={toggleSelectAll} className="text-tea-text-sec hover:text-tea-text">
                          {selectedIds.size === processedProducts.length ? <CheckSquare size={14} /> : <Square size={14} />}
                        </button>
                      </th>
                    )}
                    {visibleCols.map(col => (
                      <SortHeader key={col.key} colKey={col.key as keyof Product} label={col.label} align="left" />
                    ))}
                    <th className="px-2 py-2 border-b border-tea-border"></th>
                  </tr>
                </thead>
              </table>

              {/* Grouped sections */}
              {Object.entries(groupedProducts).map(([groupKey, items]) => {
                const isCollapsed = collapsedGroups.has(groupKey);
                const totalStock = Math.round(items.reduce((sum, p) => sum + (Number(p.stockGrams) || 0), 0));
                const totalRetail = items.reduce((sum, p) => sum + (Number(p.fixedRetailPriceUSD ?? p.pricePerGramUSD) || 0) * (Number(p.stockGrams) || 0), 0);
                return (
                  <div key={groupKey}>
                    <button
                      onClick={() => setCollapsedGroups(prev => {
                        const next = new Set(prev);
                        if (next.has(groupKey)) next.delete(groupKey); else next.add(groupKey);
                        return next;
                      })}
                      className="w-full flex items-center gap-3 px-5 py-2 bg-tea-bg/70 border-b border-tea-border hover:bg-tea-bg transition-colors text-left"
                    >
                      {isCollapsed ? <ChevronRight size={14} className="text-tea-text-sec" /> : <ChevronDown size={14} className="text-tea-text-sec" />}
                      <span className="text-sm font-serif text-tea-text">{groupKey}</span>
                      <span className="text-[10px] text-tea-text-sec uppercase tracking-[0.15em]">{items.length} items</span>
                      <span className="text-[10px] text-tea-text-sec tabular-nums ml-auto">{totalStock}g total</span>
                      <span className="text-[10px] text-tea-text-sec tabular-nums">${fmtNum(totalRetail)} value</span>
                    </button>
                    {!isCollapsed && (
                      <table className="w-full table-fixed border-collapse">
                        <colgroup>
                          {isEditMode && <col className="w-[32px]" />}
                          {visibleCols.map(col => <col key={col.key} className={col.defaultWidth} />)}
                          <col className="w-[10%]" />
                        </colgroup>
                        <tbody>
                          {items.map((product, rowIdx) => {
                            const globalIdx = processedProducts.indexOf(product);
                            return (
                              <tr
                                key={product.id}
                                className={`transition-colors border-b border-tea-border group ${isEditMode ? '' : 'hover:bg-tea-bg/50 cursor-pointer'} ${getRowBorderClass(product)} ${!product.isPublic ? 'opacity-70' : ''} ${product.isPersonal ? 'bg-amber-950/20' : ''}`}
                                style={{ height: ROW_HEIGHT }}
                                onClick={() => !isEditMode && setPanelProduct(product)}
                              >
                                {isEditMode && (
                                  <td className="px-2 align-middle" onClick={(e) => e.stopPropagation()}>
                                    <button onClick={() => toggleSelectId(product.id)} className="text-tea-text-sec hover:text-tea-text">
                                      {selectedIds.has(product.id) ? <CheckSquare size={14} className="text-tea-accent" /> : <Square size={14} />}
                                    </button>
                                  </td>
                                )}
                                {visibleCols.map((col, colIdx) => renderCell(product, col.key, globalIdx, colIdx))}
                                <td className="px-2 align-middle text-right">
                                  <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                                    {!isEditMode && (
                                      <>
                                        <button onClick={() => handleProductUpdate(product.id, 'isFeatured', !product.isFeatured)} className={`${product.isFeatured ? 'text-tea-accent' : 'text-tea-text-sec hover:text-tea-text'} p-1 transition-colors`}><Star size={13} className={product.isFeatured ? "fill-tea-accent" : ""} /></button>
                                        <button onClick={() => handleProductUpdate(product.id, 'isPublic', !product.isPublic)} className="text-tea-text-sec hover:text-tea-text p-1 transition-colors">{product.isPublic ? <Eye size={13}/> : <EyeOff size={13}/>}</button>
                                        <button onClick={() => setPanelProduct(product)} className="text-tea-text-sec hover:text-tea-text p-1 transition-colors"><Pencil size={13}/></button>
                                        <div className="relative" data-row-dropdown>
                                          <button onClick={() => setRowDropdownId(rowDropdownId === product.id ? null : product.id)} className="text-tea-text-sec hover:text-tea-text p-1 transition-colors" title="More actions"><MoreHorizontal size={13}/></button>
                                          {rowDropdownId === product.id && (
                                            <div className="absolute right-0 top-full mt-1 z-50 bg-tea-surface rounded-lg shadow-lg py-1 min-w-[140px]" style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
                                              <button
                                                onClick={() => handleRestock(product)}
                                                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-tea-text hover:bg-tea-bg/60 transition-colors text-left"
                                              >
                                                <Globe size={12} /> Restock via Compass
                                              </button>
                                              <button
                                                onClick={() => { handleProductUpdate(product.id, 'status', product.status === 'Archived' ? 'Active' : 'Archived'); setRowDropdownId(null); }}
                                                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-tea-text hover:bg-tea-bg/60 transition-colors text-left"
                                              >
                                                <Archive size={12} /> {product.status === 'Archived' ? 'Unarchive' : 'Archive'}
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* --- FLAT TABLE (with virtualization) --- */
            <table className="w-full table-fixed border-collapse">
                <colgroup>
                    {isEditMode && <col className="w-[32px]" />}
                    {visibleCols.map(col => <col key={col.key} className={col.defaultWidth} />)}
                    <col className="w-[10%]" />
                </colgroup>

                <thead className="sticky top-0 z-20 bg-tea-bg shadow-sm">
                    <tr>
                        {isEditMode && (
                          <th className="px-2 py-2 border-b border-tea-border">
                            <button onClick={toggleSelectAll} className="text-tea-text-sec hover:text-tea-text">
                              {selectedIds.size === processedProducts.length ? <CheckSquare size={14} /> : <Square size={14} />}
                            </button>
                          </th>
                        )}
                        {visibleCols.map(col => (
                          <SortHeader key={col.key} colKey={col.key as keyof Product} label={col.label} align="left" />
                        ))}
                        <th className="px-2 py-2 border-b border-tea-border"></th>
                    </tr>
                </thead>

                <tbody>
                    {paddingTop > 0 && <tr style={{ height: paddingTop }}><td colSpan={colCountWithBulk}></td></tr>}

                    {visibleProducts.map((product, idx) => {
                        const globalIdx = startIndex + idx;
                        return (
                            <tr
                                key={product.id}
                                className={`transition-colors border-b border-tea-border group ${isEditMode ? '' : 'hover:bg-tea-bg/50 cursor-pointer'} ${getRowBorderClass(product)} ${!product.isPublic ? 'opacity-70' : ''} ${panelProduct?.id === product.id ? 'bg-tea-accent/5' : product.isPersonal ? 'bg-amber-950/20' : ''}`}
                                style={{ height: ROW_HEIGHT }}
                                onClick={() => !isEditMode && setPanelProduct(product)}
                            >
                                {isEditMode && (
                                  <td className="px-2 align-middle" onClick={(e) => e.stopPropagation()}>
                                    <button onClick={() => toggleSelectId(product.id)} className="text-tea-text-sec hover:text-tea-text">
                                      {selectedIds.has(product.id) ? <CheckSquare size={14} className="text-tea-accent" /> : <Square size={14} />}
                                    </button>
                                  </td>
                                )}

                                {visibleCols.map((col, colIdx) => renderCell(product, col.key, globalIdx, colIdx))}

                                {/* Actions */}
                                <td className="px-2 align-middle text-right">
                                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                                        {!isEditMode && (
                                            <>
                                                <button onClick={() => handleProductUpdate(product.id, 'isFeatured', !product.isFeatured)} className={`${product.isFeatured ? 'text-tea-accent hover:text-tea-accent/80' : 'text-tea-text-sec hover:text-tea-text'} p-1 transition-colors`} title={product.isFeatured ? "Remove star" : "Star this tea"}><Star size={13} className={product.isFeatured ? "fill-tea-accent" : ""} /></button>
                                                <button onClick={() => handleProductUpdate(product.id, 'isPublic', !product.isPublic)} className={`${product.isPublic ? 'text-tea-text-sec hover:text-tea-text' : 'text-tea-text-sec/50 hover:text-tea-text-sec'} p-1 transition-colors`} title={product.isPublic ? "Remove from shop" : "Add to shop"}>{product.isPublic ? <Eye size={13}/> : <EyeOff size={13}/>}</button>
                                                <button onClick={() => setPanelProduct(product)} className="text-tea-text-sec hover:text-tea-text p-1 transition-colors" title="Edit"><Pencil size={13}/></button>
                                                <div className="relative" data-row-dropdown>
                                                  <button onClick={() => setRowDropdownId(rowDropdownId === product.id ? null : product.id)} className="text-tea-text-sec hover:text-tea-text p-1 transition-colors" title="More actions"><MoreHorizontal size={13}/></button>
                                                  {rowDropdownId === product.id && (
                                                    <div className="absolute right-0 top-full mt-1 z-50 bg-tea-surface rounded-lg shadow-lg py-1 min-w-[140px]" style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
                                                      <button
                                                        onClick={() => handleRestock(product)}
                                                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-tea-text hover:bg-tea-bg/60 transition-colors text-left"
                                                      >
                                                        <Globe size={12} /> Restock via Compass
                                                      </button>
                                                      <button
                                                        onClick={() => { handleProductUpdate(product.id, 'status', product.status === 'Archived' ? 'Active' : 'Archived'); setRowDropdownId(null); }}
                                                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-tea-text hover:bg-tea-bg/60 transition-colors text-left"
                                                      >
                                                        <Archive size={12} /> {product.status === 'Archived' ? 'Unarchive' : 'Archive'}
                                                      </button>
                                                    </div>
                                                  )}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        );
                    })}

                    {paddingBottom > 0 && <tr style={{ height: paddingBottom }}><td colSpan={colCountWithBulk}></td></tr>}
                </tbody>
            </table>
          )}
        </div>
      </div>

      {/* --- MODALS --- */}
      <QrCodeModal isOpen={!!qrProduct} onClose={() => setQrProduct(null)} product={qrProduct} />

      {/* Tea Details Modal (AlcoveCard) */}
      <TeaDetailsModal
        product={detailsProduct}
        isOpen={!!detailsProduct}
        onClose={() => setDetailsProduct(null)}
        onAdd={(product, quantity) => {
          addToCart(product, quantity);
          setIsCartOpen(true);
          showToast('Added to registry', 'success');
        }}
        currency={currency}
        rates={rates}
        isAdmin={true}
        onEdit={(product) => {
          setDetailsProduct(null);
          setPanelProduct(product);
        }}
        onNext={detailsProduct ? (() => {
          const idx = processedProducts.findIndex(p => p.id === detailsProduct.id);
          if (idx < processedProducts.length - 1) setDetailsProduct(processedProducts[idx + 1]);
        }) : undefined}
        onPrev={detailsProduct ? (() => {
          const idx = processedProducts.findIndex(p => p.id === detailsProduct.id);
          if (idx > 0) setDetailsProduct(processedProducts[idx - 1]);
        }) : undefined}
      />
      
      {/* RESET CONFIRMATION */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-modal flex items-center justify-center bg-tea-text/95 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-tea-bg border border-tea-accent-sub rounded-xl max-w-sm w-full p-8 relative shadow-2xl">
                <div className="flex flex-col items-center text-center space-y-4">
                    <div className="p-4 rounded-full border border-tea-accent-sub text-tea-accent bg-tea-accent/10">
                        {isResetting ? <Loader2 className="animate-spin" size={32} /> : <AlertOctagon size={32} />}
                    </div>
                    <h3 className="text-xl font-serif text-tea-text">Danger Zone</h3>
                    <p className="text-tea-text-sec text-sm">
                        Confirm full database wipe? This is irreversible.
                    </p>
                    <div className="w-full pt-4">
                        <input 
                            type="text" 
                            className="w-full input-warm rounded-lg p-3 text-center text-tea-accent num text-xs outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg focus:border-tea-accent transition-colors"
                            value={resetInput}
                            onChange={(e) => setResetInput(e.target.value)}
                            placeholder='Type "delete" to confirm'
                            disabled={isResetting}
                        />
                    </div>
                    <div className="flex gap-3 w-full pt-4">
                        <button onClick={() => setShowResetConfirm(false)} className="flex-1 py-3 text-tea-text-sec hover:text-tea-text transition-colors text-xs uppercase tracking-[0.2em]" disabled={isResetting}>Cancel</button>
                        <button 
                            onClick={handleResetDatabase} 
                            disabled={resetInput !== 'delete' || isResetting}
                            className="flex-1 py-3 bg-tea-accent/20 border border-tea-accent-sub text-tea-accent text-xs font-bold uppercase tracking-[0.2em] rounded-lg hover:bg-tea-accent/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        >
                            {isResetting ? 'Deleting...' : 'Confirm Wipe'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* MAINTENANCE MODAL */}
      {showMaintenanceModal && (
        <div className="fixed inset-0 z-toast flex items-center justify-center bg-tea-text/95 backdrop-blur-md p-4 animate-in fade-in duration-300">
            <div className="bg-tea-bg border border-tea-border w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-tea-border flex justify-between items-center bg-tea-surface">
                    <div className="flex items-center gap-3">
                         <div className="p-2 border border-tea-accent-sub text-tea-accent rounded-lg bg-tea-accent/10">
                            <AlertTriangle size={16} />
                         </div>
                         <h3 className="text-lg font-serif text-tea-text">Permission Error</h3>
                    </div>
                    <button onClick={() => setShowMaintenanceModal(false)} className="text-tea-text-sec hover:text-tea-text transition-colors">
                        <XIcon size={20} />
                    </button>
                </div>
                <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                    <p className="text-tea-text-sec mb-4 text-sm font-serif italic">
                        The archives are locked. Supabase requires administrative SQL execution to bypass integrity checks.
                    </p>
                    <div className="relative group mt-6">
                        <pre className="bg-tea-surface border border-tea-border p-4 rounded-xl text-[10px] font-mono text-tea-text-sec overflow-x-auto whitespace-pre-wrap">
                            {MAINTENANCE_SQL}
                        </pre>
                        <button 
                            onClick={() => {
                                navigator.clipboard.writeText(MAINTENANCE_SQL);
                                showToast("SQL copied to clipboard", 'info');
                            }}
                            className="absolute top-2 right-2 border border-tea-border bg-tea-surface text-tea-text-sec p-2 rounded-lg hover:text-tea-text hover:border-tea-text-sec flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] transition-colors"
                        >
                            <Copy size={12} /> Copy
                        </button>
                    </div>
                </div>
                <div className="p-4 border-t border-tea-border flex justify-end bg-tea-surface">
                    <button 
                        onClick={() => setShowMaintenanceModal(false)}
                        className="px-6 py-2 bg-tea-accent text-tea-bg text-xs font-bold uppercase tracking-[0.2em] rounded-lg hover:bg-tea-accent/90 transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* --- FEATURE 5: RECORD PANEL (Side Panel) --- */}
      <AnimatePresence>
        {panelProduct && (() => {
          const statusColors: Record<string, string> = { Active: 'var(--tea-gold)', Draft: 'var(--tea-text-dim)', Archived: 'var(--tea-text-sec)', 'Sold Out': '#a65d4e' };
          const statusColor = statusColors[panelProduct.status] || 'var(--tea-text-sec)';
          const allTastingNotes = [...new Set(products.flatMap(p => p.tastingNotes || []))].sort();
          const allMoods = [...new Set(products.map(p => p.mood).filter(Boolean) as string[])].sort();
          return (
          <>
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed inset-0 bottom-[calc(44px+env(safe-area-inset-bottom))] md:inset-auto md:right-0 md:top-0 md:bottom-0 md:w-[420px] z-30 bg-tea-bg flex flex-col panel-sidebar"
            >
              {/* Panel Header — Row 1: Nav */}
              <div className="flex items-center justify-between px-4 pt-3 pb-1 bg-tea-surface/30">
                <button onClick={() => setPanelProduct(null)} className="p-2.5 -ml-1 text-tea-text-sec hover:text-tea-text transition-colors rounded-lg active:bg-tea-surface">
                  <XIcon size={18} />
                </button>
                <span className="text-[11px] text-tea-text-dim tabular-nums">
                  {processedProducts.findIndex(p => p.id === panelProduct.id) + 1} of {processedProducts.length}
                </span>
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => {
                      const idx = processedProducts.findIndex(p => p.id === panelProduct.id);
                      if (idx > 0) setPanelProduct(processedProducts[idx - 1]);
                    }}
                    className="p-2.5 text-tea-text-sec hover:text-tea-text transition-colors rounded-lg active:bg-tea-surface"
                    title="Previous"
                  ><ChevronLeft size={18} /></button>
                  <button
                    onClick={() => {
                      const idx = processedProducts.findIndex(p => p.id === panelProduct.id);
                      if (idx < processedProducts.length - 1) setPanelProduct(processedProducts[idx + 1]);
                    }}
                    className="p-2.5 text-tea-text-sec hover:text-tea-text transition-colors rounded-lg active:bg-tea-surface"
                    title="Next"
                  ><ChevronRight size={18} /></button>
                </div>
              </div>

              {/* Panel Header — Row 2: Identity */}
              <div className="flex items-start justify-between gap-3 px-5 pb-3 border-b border-tea-accent-sub bg-tea-surface/30">
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: getThemeColor(panelProduct.type) }} />
                  <div className="min-w-0">
                    <h3 className="text-base font-serif text-tea-text truncate leading-tight">{panelProduct.productName}</h3>
                    <span className="text-[11px] text-tea-text-dim">{panelProduct.type} {panelProduct.year ? `· ${panelProduct.year}` : ''}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 pt-0.5">
                  <select
                    value={panelProduct.status}
                    onChange={e => {
                      handleProductUpdate(panelProduct.id, 'status', e.target.value);
                      setPanelProduct(prev => prev ? { ...prev, status: e.target.value as any } : null);
                    }}
                    className="text-[11px] uppercase tracking-[0.08em] px-2.5 py-1.5 rounded-md bg-tea-surface text-tea-text-sec appearance-none cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg"
                    style={{ borderColor: statusColor, color: statusColor, border: '1px solid' }}
                  >
                    {['Active', 'Draft', 'Archived', 'Sold Out'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button onClick={() => setQrProduct(panelProduct)} className="p-1.5 text-tea-text-dim hover:text-tea-text-sec transition-colors rounded" title="QR Code">
                    <QrCode size={14} />
                  </button>
                </div>
              </div>

              {/* Panel Content — scrollable */}
              <div className="flex-1 overflow-y-auto custom-scrollbar pt-3">

                {/* ── 1. Identity & Origin ── */}
                <CollapsibleSection title="Identity & Origin" defaultOpen={true}>
                  <div className="space-y-0">
                    {([
                      { label: 'Name', field: 'productName' as const, value: panelProduct.productName },
                      { label: 'Given Name', field: 'givenName' as const, value: panelProduct.givenName || '' },
                      { label: 'Chinese', field: 'chineseName' as const, value: panelProduct.chineseName || '' },
                    ]).map(item => (
                      <div key={item.field} className="flex items-center justify-between gap-3 py-2.5 min-h-[44px]">
                        <span className="text-[11px] text-tea-text-sec uppercase tracking-[0.06em] shrink-0 w-20 md:w-24">{item.label}</span>
                        <GhostInput
                          value={item.value}
                          onSave={(val) => {
                            handleProductUpdate(panelProduct.id, item.field, val);
                            setPanelProduct(prev => prev ? { ...prev, [item.field]: val } : null);
                          }}
                          align="right"
                          className="text-xs text-tea-text flex-1"
                        />
                      </div>
                    ))}
                    {inventoryCategory === 'teaware' ? (
                      <>
                        <div className="flex items-center justify-between gap-3 py-2.5 min-h-[44px]">
                          <span className="text-[11px] text-tea-text-sec uppercase tracking-[0.06em] shrink-0 w-20 md:w-24">Category</span>
                          <GhostInput
                            value={panelProduct.teawareCategory || ''}
                            onSave={(val) => {
                              handleProductUpdate(panelProduct.id, 'teawareCategory', val);
                              setPanelProduct(prev => prev ? { ...prev, teawareCategory: val as any } : null);
                            }}
                            align="right"
                            className="text-xs text-tea-text flex-1"
                          />
                        </div>
                        <div className="flex items-center justify-between gap-3 py-2.5 min-h-[44px]">
                          <span className="text-[11px] text-tea-text-sec uppercase tracking-[0.06em] shrink-0 w-20 md:w-24">Material</span>
                          <GhostInput
                            value={panelProduct.material || ''}
                            onSave={(val) => {
                              handleProductUpdate(panelProduct.id, 'material', val);
                              setPanelProduct(prev => prev ? { ...prev, material: String(val) } : null);
                            }}
                            align="right"
                            className="text-xs text-tea-text flex-1"
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center justify-between gap-3 py-2.5 min-h-[44px]">
                          <span className="text-[11px] text-tea-text-sec uppercase tracking-[0.06em] shrink-0 w-20 md:w-24">Type</span>
                          <GhostSelect
                            value={panelProduct.type}
                            onSave={(val) => {
                              handleProductUpdate(panelProduct.id, 'type', val);
                              setPanelProduct(prev => prev ? { ...prev, type: val as any } : null);
                            }}
                            options={['Green', 'Yellow', 'White', 'Oolong', 'Red', 'Dark', 'Sheng', 'Shou', 'Herbal', 'Misc']}
                            className="text-xs text-tea-text"
                          />
                        </div>
                        <div className="flex items-center justify-between gap-3 py-2.5 min-h-[44px]">
                          <span className="text-[11px] text-tea-text-sec uppercase tracking-[0.06em] shrink-0 w-20 md:w-24">Form</span>
                          <GhostSelect
                            value={panelProduct.form || ''}
                            onSave={(val) => {
                              handleProductUpdate(panelProduct.id, 'form', val);
                              setPanelProduct(prev => prev ? { ...prev, form: val as any } : null);
                            }}
                            options={['Loose Leaf', 'Cake', 'Tuo', 'Brick', 'Rolled', 'Ball', 'Powder', 'Bag', 'Other']}
                            className="text-xs text-tea-text"
                          />
                        </div>
                      </>
                    )}
                    <div className="flex items-center justify-between gap-3 py-2.5 min-h-[44px]">
                      <span className="text-[11px] text-tea-text-sec uppercase tracking-[0.06em] shrink-0 w-20 md:w-24">Year</span>
                      <GhostInput
                        value={panelProduct.year || ''}
                        onSave={(val) => {
                          handleProductUpdate(panelProduct.id, 'year', val);
                          setPanelProduct(prev => prev ? { ...prev, year: Number(val) } : null);
                        }}
                        type="number"
                        align="right"
                        className="text-xs text-tea-text flex-1"
                      />
                    </div>

                    {/* Origin fields */}
                    <div className="mt-1 pt-1">
                      {[
                        { label: 'Country', field: 'originCountry' as const, value: panelProduct.originCountry || '' },
                        { label: 'Region', field: 'originRegion' as const, value: panelProduct.originRegion || '' },
                      ].map(item => (
                        <div key={item.field} className="flex items-center justify-between gap-3 py-2.5 min-h-[44px]">
                          <span className="text-[11px] text-tea-text-sec uppercase tracking-[0.06em] shrink-0 w-20 md:w-24">{item.label}</span>
                          <GhostInput
                            value={item.value}
                            onSave={(val) => {
                              handleProductUpdate(panelProduct.id, item.field, val);
                              setPanelProduct(prev => prev ? { ...prev, [item.field]: String(val) } : null);
                            }}
                            align="right"
                            className="text-xs text-tea-text flex-1"
                          />
                        </div>
                      ))}
                      <div className="flex items-center justify-between gap-3 py-2.5 min-h-[44px]">
                        <span className="text-[11px] text-tea-text-sec uppercase tracking-[0.06em] shrink-0 w-20 md:w-24 flex items-center gap-1">
                          Vendor
                          {panelProduct.vendor && (
                            <button
                              onClick={() => navigate(`/admin/people?tab=sources&search=${encodeURIComponent(panelProduct.vendor || '')}`)}
                              className="ml-1 text-tea-gold hover:text-tea-gold-lt transition-colors"
                              title="View vendor"
                            >
                              <svg className="w-3 h-3 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                              </svg>
                            </button>
                          )}
                        </span>
                        <VendorPicker
                          value={panelProduct.vendor || ''}
                          productId={panelProduct.id}
                          onChange={(val) => {
                            handleProductUpdate(panelProduct.id, 'vendor', val);
                            setPanelProduct(prev => prev ? { ...prev, vendor: val } : null);
                          }}
                          className="w-full bg-transparent border-b border-transparent focus:border-tea-accent-sub focus:bg-tea-gold/[0.06] rounded-none py-0 px-0 outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg transition-all text-right text-xs text-tea-text placeholder-tea-text-dim/70 leading-none"
                        />
                      </div>

                      {/* Compass Origin — if this product came from a Tea Compass entry */}
                      {(() => {
                        // Prefer persistent DB link, fall back to client-side compass store
                        const compassEntryId = panelProduct.sourceCompassEntryId;
                        const compassEntry = compassEntryId
                          ? compassEntries.find(e => e.id === compassEntryId)
                          : compassEntries.find(e => e.draftProductId === panelProduct.id);
                        // Show link if we have either a local compass entry or a persistent ID
                        if (!compassEntry && !compassEntryId) return null;
                        const linkId = compassEntry?.id || compassEntryId!;
                        return (
                          <div className="flex items-center justify-between gap-3 py-2.5 min-h-[44px]">
                            <span className="text-[11px] text-tea-text-sec uppercase tracking-[0.06em] shrink-0 w-20 md:w-24">Field Note</span>
                            <button
                              onClick={() => navigate(`/admin/compass?tab=ledger&entry=${encodeURIComponent(linkId)}`)}
                              className="text-xs text-tea-accent hover:text-tea-text transition-colors text-right flex items-center gap-1.5"
                            >
                              <Globe size={10} />
                              {compassEntry?.vendorName || 'Compass Entry'}
                              {compassEntry && (
                                <span className="text-tea-text-dim">· {new Date(compassEntry.createdAt).toLocaleDateString()}</span>
                              )}
                            </button>
                          </div>
                        );
                      })()}

                      {/* Order History — link to Activity view filtered by this product */}
                      <div className="flex items-center justify-between gap-3 py-2.5 min-h-[44px]">
                        <span className="text-[11px] text-tea-text-sec uppercase tracking-[0.06em] shrink-0 w-20 md:w-24">Orders</span>
                        <button
                          onClick={() => navigate(`/admin/activity?search=${encodeURIComponent(panelProduct.givenName || panelProduct.productName)}`)}
                          className="text-xs text-tea-accent hover:text-tea-text transition-colors text-right flex items-center gap-1.5"
                        >
                          <Receipt size={10} />
                          View order history
                        </button>
                      </div>
                    </div>

                    {/* All toggles: visibility + source + ownership */}
                    <div className="flex items-center gap-2 flex-wrap pt-2.5 mt-1.5 border-t border-tea-accent-sub">
                      {([
                        { field: 'isPublic' as const, label: 'In Shop', icon: panelProduct.isPublic ? <Eye size={10} /> : <EyeOff size={10} />, active: panelProduct.isPublic },
                        { field: 'isFeatured' as const, label: 'Starred', icon: <Star size={10} className={panelProduct.isFeatured ? "fill-tea-accent" : ""} />, active: panelProduct.isFeatured },
                        { field: 'isCurated' as const, label: 'Top Pick', icon: <Sparkles size={10} />, active: panelProduct.isCurated },
                        { field: 'isSample' as const, label: 'Sample', icon: <FlaskConical size={10} />, active: panelProduct.isSample },
                        { field: 'canReorder' as const, label: 'Restockable', icon: <RefreshCw size={10} />, active: panelProduct.canReorder },
                        { field: 'isPersonal' as const, label: 'Mine', icon: <User size={10} />, active: panelProduct.isPersonal },
                      ] as const).map(toggle => (
                        <button
                          key={toggle.field}
                          onClick={() => {
                            const newVal = !toggle.active;
                            handleProductUpdate(panelProduct.id, toggle.field, newVal);
                            setPanelProduct(prev => prev ? { ...prev, [toggle.field]: newVal } : null);
                          }}
                          className={`pill ${toggle.active ? 'pill-active' : ''}`}
                        >
                          {toggle.icon} {toggle.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </CollapsibleSection>

                {/* ── 2. Images ── */}
                <CollapsibleSection title="Images" defaultOpen={true}>
                  <ImageManager
                    product={panelProduct}
                    onUpdate={(field, value) => {
                      handleProductUpdate(panelProduct.id, field, value);
                      setPanelProduct(prev => prev ? { ...prev, [field]: value } : null);
                    }}
                  />
                </CollapsibleSection>

                {/* ── 3. Tasting Profile ── */}
                <CollapsibleSection title="Tasting Profile" defaultOpen={true}>
                  {(() => {
                    const tasting = panelProduct.tasting;
                    const hasTasting = tasting && flattenTastingNotes(tasting).length > 0;
                    const categoryLabels: Record<string, string> = {
                      'brewing': 'Brewing',
                      'liquor-color': 'Color',
                      'flavor': 'Flavor',
                      'body': 'Body',
                      'finish': 'Finish',
                      'feeling': 'Feeling',
                    };

                    if (!hasTasting) {
                      return (
                        <button
                          onClick={() => setTastingEditorProduct(panelProduct)}
                          className="w-full flex items-center justify-center gap-2 py-4 rounded-lg text-xs text-tea-text-dim hover:text-tea-gold hover:bg-tea-gold/5 transition-colors active:scale-[0.98]"
                        >
                          <Sparkles size={14} />
                          <span>Add tasting profile</span>
                        </button>
                      );
                    }

                    const moodText = panelProduct.mood;

                    return (
                      <div className="space-y-0">
                        {moodText && (
                          <div className="pb-2.5 mb-1">
                            <span className="text-[13px] text-tea-gold italic font-serif">{moodText}</span>
                          </div>
                        )}
                        {TASTING_CATEGORY_ORDER.map(catId => {
                          const raw = tasting?.[catId];
                          const terms: string[] = Array.isArray(raw) ? raw as string[] : [];
                          const SectionIcon = SECTION_ICONS[catId];
                          const label = categoryLabels[catId] || catId;
                          const isColor = catId === 'liquor-color';

                          return (
                            <button
                              key={catId}
                              onClick={() => setTastingEditorProduct(panelProduct)}
                              className={`w-full flex items-center gap-2.5 py-2.5 transition-colors hover:bg-tea-gold/5 active:bg-tea-gold/10 rounded ${
                                terms.length === 0 ? 'opacity-30' : ''
                              }`}
                            >
                              {SectionIcon && <SectionIcon size={13} className="text-tea-text-dim shrink-0" />}
                              <span className="text-[10px] text-tea-text-sec uppercase tracking-[0.06em] w-12 shrink-0 text-left">{label}</span>
                              <div className="flex-1 flex items-center gap-1 overflow-hidden min-w-0">
                                {terms.length === 0 ? (
                                  <span className="text-[10px] text-tea-text-dim">—</span>
                                ) : isColor ? (
                                  <div className="flex items-center gap-1.5">
                                    {terms.map(termId => {
                                      const hex = LIQUOR_COLORS[termId];
                                      return (
                                        <span key={termId} className="flex items-center gap-1">
                                          {hex && <span className="w-3 h-3 rounded-full shrink-0" style={{ background: hex }} />}
                                          <span className="text-[10px] text-tea-text-sec">{resolveTermLabel(termId)}</span>
                                        </span>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <span className="text-[11px] text-tea-text truncate">
                                    {terms.map(id => resolveTermLabel(id)).join(', ')}
                                  </span>
                                )}
                              </div>
                              {terms.length > 0 && (
                                <span className="text-[9px] text-tea-text-dim tabular-nums shrink-0">{terms.length}</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })()}
                </CollapsibleSection>

                {/* ── 4. Pricing ── */}
                <CollapsibleSection title="Pricing" defaultOpen={true}>
                  {inventoryCategory === 'teaware' ? (
                    <div className="space-y-0">
                      {[
                        { label: 'Cost', field: 'costAmount' as const, value: panelProduct.costAmount, type: 'number' as const },
                        { label: 'Retail ($)', field: 'pricePerGramUSD' as const, value: panelProduct.pricePerGramUSD, type: 'number' as const },
                      ].map(item => (
                        <div key={item.field} className="flex items-center justify-between gap-3 py-2.5 min-h-[44px]">
                          <span className="text-[11px] text-tea-text-sec uppercase tracking-[0.06em] shrink-0 w-20 md:w-24">{item.label}</span>
                          <GhostInput
                            value={item.value}
                            onSave={(val) => {
                              handleProductUpdate(panelProduct.id, item.field, val);
                              setPanelProduct(prev => prev ? { ...prev, [item.field]: Number(val) } : null);
                            }}
                            type={item.type}
                            align="right"
                            className="text-xs text-tea-text tabular-nums flex-1"
                          />
                        </div>
                      ))}
                    </div>
                  ) : (() => {
                    const calc = calculatePricing(
                      panelProduct.costAmount || 0,
                      panelProduct.shippingRatePerKg || 13,
                      panelProduct.quantityPurchased || 0,
                      panelProduct.costCurrency || 'USD',
                      rates,
                      false
                    );
                    return (
                      <div className="space-y-0">
                        {/* Editable fields — always visible */}
                        <div className="flex items-center justify-between gap-3 py-2.5 min-h-[44px]">
                          <span className="text-[11px] text-tea-text-sec uppercase tracking-[0.06em] shrink-0 w-20 md:w-24">Batch Cost</span>
                          <div className="flex items-center gap-1.5 flex-1 justify-end">
                            <select
                              value={panelProduct.costCurrency || 'USD'}
                              onChange={(e) => {
                                const newCurrency = e.target.value;
                                handleProductUpdate(panelProduct.id, 'costCurrency', newCurrency);
                                setPanelProduct(prev => prev ? { ...prev, costCurrency: newCurrency as any } : null);
                              }}
                              className="bg-transparent text-[10px] text-tea-text-sec font-medium uppercase outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg cursor-pointer appearance-none border-none"
                            >
                              <option value="USD" className="bg-tea-surface text-tea-text">USD</option>
                              <option value="NT" className="bg-tea-surface text-tea-text">NT</option>
                              <option value="Yuan" className="bg-tea-surface text-tea-text">CNY</option>
                              <option value="IDR" className="bg-tea-surface text-tea-text">IDR</option>
                              <option value="JPY" className="bg-tea-surface text-tea-text">JPY</option>
                              <option value="MYR" className="bg-tea-surface text-tea-text">MYR</option>
                              <option value="HKD" className="bg-tea-surface text-tea-text">HKD</option>
                            </select>
                            <GhostInput
                              value={panelProduct.costAmount}
                              onSave={(val) => {
                                handleProductUpdate(panelProduct.id, 'costAmount', val);
                                setPanelProduct(prev => prev ? { ...prev, costAmount: Number(val) } : null);
                              }}
                              type="number"
                              align="right"
                              className="text-xs text-tea-text tabular-nums flex-1"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-3 py-2.5 min-h-[44px]">
                          <span className="text-[11px] text-tea-text-sec uppercase tracking-[0.06em] shrink-0 w-20 md:w-24">Batch Wt (g)</span>
                          <GhostInput
                            value={panelProduct.quantityPurchased || 0}
                            onSave={(val) => {
                              handleProductUpdate(panelProduct.id, 'quantityPurchased', val);
                              setPanelProduct(prev => prev ? { ...prev, quantityPurchased: Number(val) } : null);
                            }}
                            type="number"
                            align="right"
                            className="text-xs text-tea-text tabular-nums flex-1"
                          />
                        </div>

                        <div className="flex items-center justify-between gap-3 py-2.5 min-h-[44px]">
                          <span className="text-[11px] text-tea-text-sec uppercase tracking-[0.06em] shrink-0 w-20 md:w-24">Ship (USD/kg)</span>
                          <GhostInput
                            value={panelProduct.shippingRatePerKg || 13}
                            onSave={(val) => {
                              handleProductUpdate(panelProduct.id, 'shippingRatePerKg', val);
                              setPanelProduct(prev => prev ? { ...prev, shippingRatePerKg: Number(val) } : null);
                            }}
                            type="number"
                            align="right"
                            className="text-xs text-tea-text tabular-nums flex-1"
                          />
                        </div>

                        <div className="flex items-center justify-between gap-3 py-2.5 min-h-[44px]">
                          <span className="text-[11px] text-tea-text-sec uppercase tracking-[0.06em] shrink-0 w-20 md:w-24">Retail USD/g</span>
                          <span className="text-xs text-tea-text tabular-nums flex-1 text-right font-medium">${calc.suggestedRetailUSD.toFixed(2)}</span>
                        </div>

                        <div className="flex items-center justify-between gap-3 py-2.5 min-h-[44px]">
                          <span className="text-[11px] text-tea-text-sec uppercase tracking-[0.06em] shrink-0 w-20 md:w-24">Fixed USD</span>
                          <GhostInput
                            value={panelProduct.fixedRetailPriceUSD ?? ''}
                            placeholder={calc.suggestedRetailUSD > 0 ? calc.suggestedRetailUSD.toFixed(2) : '—'}
                            onSave={(val) => {
                              const numVal = val === '' || val === null ? null : Number(val);
                              handleProductUpdate(panelProduct.id, 'fixedRetailPriceUSD', numVal);
                              setPanelProduct(prev => prev ? { ...prev, fixedRetailPriceUSD: numVal } : null);
                            }}
                            type="number"
                            align="right"
                            className={`text-xs tabular-nums flex-1 ${
                              panelProduct.fixedRetailPriceUSD && panelProduct.fixedRetailPriceUSD < calc.trueCostUSD
                                ? 'text-red-400 font-bold' : 'text-tea-text'
                            }`}
                          />
                        </div>

                        {/* Cost Breakdown — nested expandable */}
                        <div className="mt-2">
                          <button
                            onClick={() => setPanelBreakdownOpen(!panelBreakdownOpen)}
                            className="flex items-center gap-1.5 text-[10px] text-tea-text-dim uppercase tracking-[0.06em] hover:text-tea-text-sec transition-colors py-1"
                          >
                            <ChevronRight size={10} className={`transition-transform duration-150 ${panelBreakdownOpen ? 'rotate-90' : ''}`} />
                            Cost Breakdown
                          </button>
                          <div
                            className="grid transition-[grid-template-rows] duration-200 ease-out"
                            style={{ gridTemplateRows: panelBreakdownOpen ? '1fr' : '0fr' }}
                          >
                            <div className="overflow-hidden">
                              <div className="bg-tea-surface/30 rounded-md px-3 py-2 mt-1 space-y-1.5">
                                <div className="flex justify-between text-[11px]">
                                  <span className="text-tea-text-dim">Source Cost/g</span>
                                  <span className="text-tea-text-sec tabular-nums">{calc.costPerGramSource.toFixed(3)} {panelProduct.costCurrency || 'USD'}</span>
                                </div>
                                <div className="flex justify-between text-[11px]">
                                  <span className="text-tea-text-dim">Exchange Rate</span>
                                  <span className="text-tea-text-sec tabular-nums">{calc.rateUsed}</span>
                                </div>
                                <div className="flex justify-between text-[11px]">
                                  <span className="text-tea-text-dim">True Cost (USD)</span>
                                  <span className="text-tea-text tabular-nums font-medium">${calc.trueCostUSD.toFixed(3)}/g</span>
                                </div>
                                <div className="flex justify-between text-[11px]">
                                  <span className="text-tea-text-dim">3x Markup</span>
                                  <span className="text-tea-text-sec tabular-nums">${calc.suggestedRetailUSD.toFixed(2)}/g</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </CollapsibleSection>

                {/* ── 5. Stock ── */}
                <CollapsibleSection title="Stock" defaultOpen={true}>
                  <div className="space-y-0">
                    {inventoryCategory === 'teaware' ? (
                      <>
                        <div className="flex items-center justify-between gap-3 py-2.5 min-h-[44px]">
                          <span className="text-[11px] text-tea-text-sec uppercase tracking-[0.06em] shrink-0 w-20 md:w-24">Units</span>
                          <GhostInput
                            value={panelProduct.quantityUnits || ''}
                            onSave={(val) => {
                              handleProductUpdate(panelProduct.id, 'quantityUnits', val);
                              setPanelProduct(prev => prev ? { ...prev, quantityUnits: Number(val) } : null);
                            }}
                            type="number"
                            align="right"
                            className="text-xs text-tea-text tabular-nums flex-1"
                          />
                        </div>
                        <div className="flex items-center justify-between gap-3 py-2.5 min-h-[44px]">
                          <span className="text-[11px] text-tea-text-sec uppercase tracking-[0.06em] shrink-0 w-20 md:w-24">Capacity (ml)</span>
                          <GhostInput
                            value={panelProduct.capacityMl || ''}
                            onSave={(val) => {
                              handleProductUpdate(panelProduct.id, 'capacityMl', val);
                              setPanelProduct(prev => prev ? { ...prev, capacityMl: Number(val) } : null);
                            }}
                            type="number"
                            align="right"
                            className="text-xs text-tea-text tabular-nums flex-1"
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center justify-between gap-3 py-2.5 min-h-[44px]">
                          <span className="text-[11px] text-tea-text-sec uppercase tracking-[0.06em] shrink-0 w-20 md:w-24">Current (g)</span>
                          <GhostInput
                            value={panelProduct.stockGrams}
                            onSave={(val) => {
                              handleProductUpdate(panelProduct.id, 'stockGrams', val);
                              setPanelProduct(prev => prev ? { ...prev, stockGrams: Number(val) } : null);
                            }}
                            type="number"
                            align="right"
                            className="text-xs text-tea-text tabular-nums flex-1"
                          />
                        </div>
                        <div className="flex items-center justify-between gap-3 py-2.5 min-h-[44px]">
                          <span className="text-[11px] text-tea-text-sec uppercase tracking-[0.06em] shrink-0 w-20 md:w-24">Low Alert</span>
                          <GhostInput
                            value={panelProduct.lowStockThreshold || 0}
                            onSave={(val) => {
                              handleProductUpdate(panelProduct.id, 'lowStockThreshold', val);
                              setPanelProduct(prev => prev ? { ...prev, lowStockThreshold: Number(val) } : null);
                            }}
                            type="number"
                            align="right"
                            className="text-xs text-tea-text tabular-nums flex-1"
                          />
                        </div>
                      </>
                    )}
                    {/* Recount toggle */}
                    <div className="flex items-center gap-2 flex-wrap pt-2.5 mt-1.5 border-t border-tea-accent-sub">
                      <button
                        onClick={() => {
                          const newVal = !panelProduct.recheckStock;
                          handleProductUpdate(panelProduct.id, 'recheckStock', newVal);
                          setPanelProduct(prev => prev ? { ...prev, recheckStock: newVal } : null);
                        }}
                        className={`pill ${panelProduct.recheckStock ? 'pill-active-amber' : ''}`}
                      >
                        <RefreshCw size={10} /> Recount
                      </button>
                    </div>

                    {/* Stock History — nested expandable */}
                    <div className="mt-2">
                      <button
                        onClick={() => setPanelHistoryOpen(!panelHistoryOpen)}
                        className="flex items-center gap-1.5 text-[10px] text-tea-text-dim uppercase tracking-[0.06em] hover:text-tea-text-sec transition-colors py-1"
                      >
                        <ChevronRight size={10} className={`transition-transform duration-150 ${panelHistoryOpen ? 'rotate-90' : ''}`} />
                        Stock History
                      </button>
                      <div
                        className="grid transition-[grid-template-rows] duration-200 ease-out"
                        style={{ gridTemplateRows: panelHistoryOpen ? '1fr' : '0fr' }}
                      >
                        <div className="overflow-hidden">
                          <div className="mt-1">
                            <StockLedgerPanel
                              productId={panelProduct.id}
                              productName={panelProduct.givenName || panelProduct.productName}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CollapsibleSection>

                {/* ── 6. Experience ── */}
                <CollapsibleSection title="Experience" defaultOpen={true}>
                  <GhostTextarea
                    value={panelProduct.experience || ''}
                    placeholder="The experience of this tea..."
                    rows={4}
                    onSave={(val) => {
                      handleProductUpdate(panelProduct.id, 'experience', val);
                      setPanelProduct(prev => prev ? { ...prev, experience: val } : null);
                    }}
                    className="text-tea-text font-serif"
                  />
                </CollapsibleSection>

                {/* ── 7. Story & Background ── */}
                <CollapsibleSection title="Story & Background" defaultOpen={false}>
                  <div className="space-y-4">
                    <div>
                      <div className="text-[11px] text-tea-text-sec uppercase tracking-[0.06em] mb-1.5">Introduction</div>
                      <GhostTextarea
                        value={panelProduct.description || ''}
                        placeholder="Your personal introduction to this tea..."
                        rows={4}
                        onSave={(val) => {
                          handleProductUpdate(panelProduct.id, 'description', val);
                          setPanelProduct(prev => prev ? { ...prev, description: val } : null);
                        }}
                        className="text-tea-text font-serif"
                      />
                    </div>
                    <div>
                      <div className="text-[11px] text-tea-text-sec uppercase tracking-[0.06em] mb-1.5">Terroir</div>
                      <GhostTextarea
                        value={panelProduct.terroir || ''}
                        placeholder="Soil, altitude, climate..."
                        rows={3}
                        onSave={(val) => {
                          handleProductUpdate(panelProduct.id, 'terroir', val);
                          setPanelProduct(prev => prev ? { ...prev, terroir: val } : null);
                        }}
                        className="text-tea-text font-serif"
                      />
                    </div>
                    <div>
                      <div className="text-[11px] text-tea-text-sec uppercase tracking-[0.06em] mb-1.5">Processing</div>
                      <GhostTextarea
                        value={panelProduct.processingNotes || ''}
                        placeholder="Craft, processing method..."
                        rows={3}
                        onSave={(val) => {
                          handleProductUpdate(panelProduct.id, 'processingNotes', val);
                          setPanelProduct(prev => prev ? { ...prev, processingNotes: val } : null);
                        }}
                        className="text-tea-text font-serif"
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="text-[11px] text-tea-text-sec uppercase tracking-[0.06em]">Lore & History</div>
                        {panelProduct.isCustomWisdom && (
                          <span className="flex items-center gap-0.5 text-[9px] text-tea-text-dim italic">
                            <Pencil size={8} /> edited
                          </span>
                        )}
                      </div>
                      <GhostTextarea
                        value={panelProduct.lore || ''}
                        placeholder="History, story, or lore..."
                        rows={3}
                        onSave={(val) => {
                          handleProductUpdate(panelProduct.id, 'lore', val);
                          if (!panelProduct.isCustomWisdom) {
                            handleProductUpdate(panelProduct.id, 'isCustomWisdom', true);
                          }
                          setPanelProduct(prev => prev ? { ...prev, lore: val, isCustomWisdom: true } : null);
                        }}
                        className="text-tea-text font-serif"
                      />
                    </div>
                  </div>
                </CollapsibleSection>

                {/* ── 8. Events ── */}
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
                        <div className="mb-3 p-2.5 rounded bg-tea-accent-sub/30">
                          <div className="flex items-center gap-3 text-xs font-sans">
                            <span className="text-tea-gold font-medium">
                              {productTastingAgg.avgRating.toFixed(1)}/5
                            </span>
                            <span className="text-tea-text-dim">
                              from {productTastingAgg.totalNotes} tasting {productTastingAgg.totalNotes === 1 ? 'note' : 'notes'}
                            </span>
                            {productTastingAgg.favoriteCount > 0 && (
                              <span className="text-tea-text-dim">
                                · {productTastingAgg.favoriteCount} {productTastingAgg.favoriteCount === 1 ? 'favorite' : 'favorites'}
                              </span>
                            )}
                          </div>
                          {productTastingAgg.impressions.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {productTastingAgg.impressions.map((imp, i) => (
                                <p key={i} className="text-xs font-serif italic text-tea-text-sec leading-relaxed">
                                  "{imp}"
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      <div className="space-y-1.5">
                        {productEvents.map((event: any) => (
                          <div key={event.id} className="flex items-center justify-between text-xs">
                            <span className="text-tea-text">{event.name || event.title || 'Event'}</span>
                            {(event.date || event.event_date) && (
                              <span className="text-tea-text-dim">
                                {new Date(event.date || event.event_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </CollapsibleSection>

                {/* Bottom breathing room */}
                <div className="pb-6" />
              </div>
            </motion.div>
            {/* Mobile backdrop — stop above bottom nav */}
            <div className="fixed inset-0 bottom-[calc(44px+env(safe-area-inset-bottom))] z-20 bg-tea-text/50 md:hidden" onClick={() => setPanelProduct(null)} />
          </>
          );
        })()}
      </AnimatePresence>

      {/* --- FEATURE 7: BULK EDIT FLOATING TOOLBAR --- */}
      <AnimatePresence>
        {isEditMode && selectedIds.size > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-tea-surface border border-tea-border shadow-2xl rounded-xl px-5 py-3 flex items-center gap-4"
          >
            <span className="text-xs text-tea-text font-bold">{selectedIds.size} selected</span>
            <div className="w-px h-5 bg-tea-border" />
            <select
              value={bulkField}
              onChange={(e) => { setBulkField(e.target.value); setBulkValue(''); }}
              className="bg-tea-bg border border-tea-border rounded-md text-xs text-tea-text px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg"
            >
              {BULK_EDIT_FIELDS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
            {(() => {
              const fieldDef = BULK_EDIT_FIELDS.find(f => f.key === bulkField);
              if (fieldDef?.type === 'select') {
                return (
                  <select value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} className="bg-tea-bg border border-tea-border rounded-md text-xs text-tea-text px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg">
                    <option value="">Select...</option>
                    {fieldDef.options.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                );
              } else if (fieldDef?.type === 'boolean') {
                return (
                  <select value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} className="bg-tea-bg border border-tea-border rounded-md text-xs text-tea-text px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg">
                    <option value="">Select...</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                );
              }
              return null;
            })()}
            <button
              onClick={handleBulkApply}
              disabled={!bulkValue || isBulkApplying}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-tea-accent text-tea-bg text-[10px] font-bold uppercase tracking-[0.2em] rounded-lg hover:bg-tea-accent/90 transition-colors disabled:opacity-40"
            >
              {isBulkApplying ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Apply
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-[10px] text-tea-text-sec hover:text-tea-text uppercase tracking-[0.15em] transition-colors"
            >Cancel</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tasting Editor Modal */}
      {tastingEditorProduct && (
        <TastingEditorModal
          product={tastingEditorProduct}
          onClose={() => setTastingEditorProduct(null)}
          onSaved={(product, tastingData, derivedMood) => {
            // Update the panel product if it's the same one
            setPanelProduct(prev => {
              if (!prev || prev.id !== product.id) return prev;
              return {
                ...prev,
                tasting: tastingData,
                mood: derivedMood || prev.mood,
                tastingNotes: tastingData.flavor?.map(id => resolveTermLabel(id)) || prev.tastingNotes,
              };
            });
            // Update local products for optimistic UI
            setLocalProducts(prev =>
              prev.map(p =>
                p.id === product.id
                  ? { ...p, tasting: tastingData, mood: derivedMood || p.mood }
                  : p
              )
            );
          }}
        />
      )}

      {/* Floating Stock History Panel (from table click) */}
      {stockHistoryProduct && !panelProduct && (
        <div className="fixed bottom-4 right-4 z-40 w-96 max-h-[50vh] overflow-y-auto custom-scrollbar shadow-2xl rounded-xl">
          <StockLedgerPanel
            productId={stockHistoryProduct.id}
            productName={stockHistoryProduct.name}
            onClose={() => setStockHistoryProduct(null)}
          />
        </div>
      )}

    </div>
  );
};