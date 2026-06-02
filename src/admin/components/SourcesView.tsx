import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Plus, Trash2, Edit3, Loader2, ChevronDown, ChevronUp,
  ChevronRight, Leaf, MapPin, ArrowUpDown, ArrowUp, ArrowDown,
  ExternalLink, X as XIcon, Pencil, Check, Columns, Layers,
  MoreHorizontal, Save, Download, Users,
  Eye, Palette, Star
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Fuse from 'fuse.js';
import Papa from 'papaparse';
import { useCustomers, useProducts, useRates } from '../hooks/useAdminData';
import { useToast } from './Toast';
import { api } from '../../lib/api';
import { Customer, CustomerTag, Product } from '../types';
import { useAppStore } from '../store';
import { TeaTable } from './TeaTable';
import { ConfirmModal } from './ConfirmModal';
import { resolveTermLabel, flattenTastingNotes, LIQUOR_COLORS } from '../../data/tastingTaxonomy';
import { useLedgerStore, type LedgerTransaction, type LedgerLineItem } from '../../lib/ledgerStore';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import { useSampleStore } from '../../samples/sampleStore';
import { STATUS_PILL_BASE, STATUS_PILL_VARIANTS, type StatusPillVariant } from '../constants';
import type { Currency } from '../types';

/** Canonical status pill — see DesignSystemShowcase §8 */
const StatusPill: React.FC<{ variant?: StatusPillVariant; className?: string; children: React.ReactNode }> = ({
  variant = 'draft',
  className = '',
  children,
}) => (
  <span className={`${STATUS_PILL_BASE} ${STATUS_PILL_VARIANTS[variant]} ${className}`}>{children}</span>
);

/** Two-letter initials for the identity-card avatar (matches §19) */
function vendorInitials(name: string | undefined): string {
  if (!name) return '·';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '·';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Gradient avatar swatch — canonical from §19 showcase */
const VendorAvatar: React.FC<{ name: string; size?: number; className?: string }> = ({
  name,
  size = 40,
  className = '',
}) => (
  <div
    className={`relative rounded-full overflow-hidden border border-tea-border flex-shrink-0 ${className}`}
    style={{ width: size, height: size }}
  >
    <div
      className="absolute inset-0"
      style={{ background: 'radial-gradient(circle at 30% 30%, #c6a473, #8e6d2e 55%, #3a3126)' }}
      aria-hidden="true"
    />
    <div
      className="absolute inset-0 flex items-center justify-center font-display text-tea-bg/90"
      style={{ fontSize: Math.max(10, Math.round(size * 0.32)), letterSpacing: '0.04em' }}
    >
      {vendorInitials(name)}
    </div>
  </div>
);

// ── Add/Edit Source Modal ──
const SourceModal = ({
  isOpen, onClose, onSave, initialData, isEditing,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { name: string; company: string; country: string; notes: string; phone: string; whatsapp: string; email: string }) => Promise<void>;
  initialData?: { name: string; company: string; country: string; notes: string; phone: string; whatsapp: string; email: string };
  isEditing: boolean;
}) => {
  const [form, setForm] = useState(initialData || { name: '', company: '', country: '', notes: '', phone: '', whatsapp: '', email: '' });
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    setForm(initialData || { name: '', company: '', country: '', notes: '', phone: '', whatsapp: '', email: '' });
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try { await onSave(form); } finally { setSaving(false); }
  };

  const inputStyle = "w-full bg-transparent border-b border-tea-border px-0 py-2 text-base md:text-sm text-tea-text outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg focus:border-tea-gold transition-colors placeholder-tea-text-sec/50";

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <form onSubmit={handleSubmit} className="bg-tea-bg border border-tea-border rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex justify-between items-center p-6 border-b border-tea-border">
          <h3 className="text-lg font-serif text-tea-text">{isEditing ? 'Edit Source' : 'New Source'}</h3>
          <button type="button" onClick={onClose} className="text-tea-text-sec hover:text-tea-text"><XIcon size={20} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-ui-10 uppercase tracking-wider text-tea-gold/70 font-bold mb-1">Name *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputStyle} placeholder="Vendor name" autoFocus />
          </div>
          <div>
            <label className="block text-ui-10 uppercase tracking-wider text-tea-gold/70 font-bold mb-1">Company</label>
            <input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} className={inputStyle} placeholder="Company or shop name" />
          </div>
          <div>
            <label className="block text-ui-10 uppercase tracking-wider text-tea-gold/70 font-bold mb-1">Country</label>
            <input value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} className={inputStyle} placeholder="Country of origin" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-ui-10 uppercase tracking-wider text-tea-gold/70 font-bold mb-1">Phone</label>
              <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className={inputStyle} placeholder="Phone" />
            </div>
            <div>
              <label className="block text-ui-10 uppercase tracking-wider text-tea-gold/70 font-bold mb-1">WhatsApp</label>
              <input value={form.whatsapp} onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))} className={inputStyle} placeholder="WhatsApp" />
            </div>
          </div>
          <div>
            <label className="block text-ui-10 uppercase tracking-wider text-tea-gold/70 font-bold mb-1">Email</label>
            <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={inputStyle} placeholder="Email" />
          </div>
          <div>
            <label className="block text-ui-10 uppercase tracking-wider text-tea-gold/70 font-bold mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className={`${inputStyle} min-h-[60px] resize-none`} placeholder="Notes about this source..." />
          </div>
        </div>
        <div className="flex justify-between gap-3 p-6 border-t border-tea-border">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-tea-text-sec hover:text-tea-text transition-colors">Cancel</button>
          <button type="submit" disabled={saving || !form.name.trim()} className="px-5 py-2 bg-tea-gold text-tea-bg text-sm font-medium rounded-xl hover:bg-tea-gold/90 transition-colors disabled:opacity-50">
            {saving ? 'Saving...' : isEditing ? 'Update' : 'Add Source'}
          </button>
        </div>
      </form>
    </div>
  );
};

// --- COLUMN DEFINITIONS ---
const SOURCE_COLUMN_DEFS = [
  { key: 'name', label: 'Source', defaultWidth: 'w-[25%]', alwaysVisible: true },
  { key: 'company', label: 'Company', defaultWidth: 'w-[15%]' },
  { key: 'country', label: 'Country', defaultWidth: 'w-[15%]' },
  { key: 'contact', label: 'Contact', defaultWidth: 'w-[18%]' },
  { key: 'teaCount', label: 'Teas', defaultWidth: 'w-[10%]' },
  { key: 'created', label: 'Added', defaultWidth: 'w-[12%]' },
] as const;

type SourceSortKey = 'name' | 'company' | 'country' | 'contact' | 'teaCount' | 'created';

interface SourceSortEntry {
  key: SourceSortKey;
  direction: 'asc' | 'desc';
}

interface SavedSourceView {
  id: string;
  name: string;
  columns: string[];
  sortConfig: SourceSortEntry[];
  groupBy: string | null;
}

const DEFAULT_SOURCE_VIEWS: SavedSourceView[] = [
  {
    id: 'default-all',
    name: 'All Sources',
    columns: ['name', 'company', 'country', 'contact', 'teaCount', 'created'],
    sortConfig: [{ key: 'name', direction: 'asc' }],
    groupBy: null,
  },
  {
    id: 'default-most-teas',
    name: 'Most Teas',
    columns: ['name', 'company', 'country', 'teaCount'],
    sortConfig: [{ key: 'teaCount', direction: 'desc' }],
    groupBy: null,
  },
  {
    id: 'default-by-country',
    name: 'By Country',
    columns: ['name', 'company', 'country', 'contact', 'teaCount'],
    sortConfig: [{ key: 'name', direction: 'asc' }],
    groupBy: 'country',
  },
];

const GROUPBY_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'country', label: 'Country' },
  { value: 'teaCountRange', label: 'Tea Count Range' },
] as const;

const ROW_HEIGHT = 36;

// --- GHOST INPUT COMPONENT ---
const GhostInput = ({
  value,
  onSave,
  type = 'text',
  align = 'left',
  className = '',
  placeholder = '',
  id
}: {
  value: string | number,
  onSave: (val: any) => void,
  type?: 'text' | 'number',
  align?: 'left' | 'right',
  className?: string,
  placeholder?: string,
  id?: string
}) => {
  const [localValue, setLocalValue] = useState(value);
  useEffect(() => { setLocalValue(value); }, [value]);
  const handleBlur = () => { if (localValue != value) onSave(localValue); };
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') e.currentTarget.blur();
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
      className={`w-full bg-transparent border-b border-transparent [@media(hover:none)]:border-dotted [@media(hover:none)]:border-tea-accent-sub focus:border-tea-accent-sub focus:border-solid focus:bg-tea-gold/[0.06] rounded-none py-0 px-0 outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg transition-all text-${align} placeholder-tea-text-dim/70 leading-none text-base md:text-[length:inherit] ${className}`}
    />
  );
};

// --- COLLAPSIBLE SECTION (canonical card §§19 — bg-tea-bg border rounded-xl) ---
const CollapsibleSection = ({ title, defaultOpen = true, children }: {
  title: string, defaultOpen?: boolean, children: React.ReactNode
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mx-4 mb-3 rounded-xl bg-tea-bg border border-tea-border overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-4 py-3 group hover:bg-tea-accent-sub transition-colors">
        <span className="text-ui-12 text-tea-text-sec uppercase tracking-caps font-sans">{title}</span>
        <ChevronRight size={14} className={`text-tea-text-dim transition-transform duration-200 ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && <div className="px-4 pb-4 pt-1">{children}</div>}
    </div>
  );
};

// --- SOURCE WITH TEA COUNT ---
interface SourceRow extends Customer {
  teaCount: number;
}

/** Map source state (tea count + tags) to a canonical StatusPill variant */
function sourceStatus(source: SourceRow): { variant: StatusPillVariant; label: string } {
  if (source.tags?.includes('inactive')) return { variant: 'archived', label: 'Inactive' };
  if (source.teaCount > 0) return { variant: 'success', label: 'Verified' };
  return { variant: 'draft', label: 'Source' };
}

// ── Currency formatting ──
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', NT: 'NT$', Yuan: '¥', IDR: 'Rp', JPY: '¥', MYR: 'RM', HKD: 'HK$', UNK: '',
};

function fmtPrice(amount: number, cur: string): string {
  const sym = CURRENCY_SYMBOLS[cur] || '';
  const decimals = ['NT', 'IDR', 'JPY'].includes(cur) ? 0 : 2;
  return `${sym}${amount.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

function lineTotal(item: LedgerLineItem): number {
  return item.priceIsPerGram
    ? item.pricePerUnit * (item.quantityGrams ?? 0)
    : item.pricePerUnit * (item.quantityUnits ?? 1);
}

export const SourcesView = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { data: customers = [], isLoading, refetch } = useCustomers();
  const { data: allProducts = [] } = useProducts();
  const { data: rates = [] } = useRates();
  const { currency } = useAppStore();

  // Ledger & Compass stores
  const ledgerTransactions = useLedgerStore((s) => s.transactions);
  const compassEntries = useTeaCompassStore((s) => s.entries);

  // Sample store
  const sampleSets = useSampleStore((s) => s.sampleSets);
  const getSamplesForSet = useSampleStore((s) => s.getSamplesForSet);

  // Expanded source — shows inline inventory table
  const [expandedSourceId, setExpandedSourceId] = useState<string | null>(null);

  // --- LOCAL VIEW STATE ---
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<SourceSortEntry[]>([{ key: 'name', direction: 'asc' }]);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(['name', 'company', 'country', 'contact', 'teaCount', 'created']);
  const [groupBy, setGroupBy] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Saved views (local state only)
  const [savedViews, setSavedViews] = useState<SavedSourceView[]>(DEFAULT_SOURCE_VIEWS);
  const [activeViewId, setActiveViewId] = useState('default-all');
  const [showSaveViewPrompt, setShowSaveViewPrompt] = useState(false);
  const [newViewName, setNewViewName] = useState('');

  // UI State
  const [isEditMode, setIsEditMode] = useState(false);
  const [showColumnsPopover, setShowColumnsPopover] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [showMobileSort, setShowMobileSort] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<Customer | null>(null);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

  const [pendingDeleteSource, setPendingDeleteSource] = useState<Customer | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Side Panel
  const [panelSource, setPanelSource] = useState<SourceRow | null>(null);
  const [panelDirty, setPanelDirty] = useState(false);
  useEffect(() => { setPanelDirty(false); }, [panelSource?.id]);

  // Panel supplied teas state
  const [panelSupplied, setPanelSupplied] = useState<any[]>([]);
  const [panelSuppliedLoading, setPanelSuppliedLoading] = useState(false);
  const [showLinkSearch, setShowLinkSearch] = useState(false);
  const [linkSearch, setLinkSearch] = useState('');

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // --- COMPUTE SOURCES ---
  const teaCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    const vendorList = customers.filter(c => c.tags?.includes('vendor'));
    for (const p of allProducts) {
      if (p.vendor) {
        const key = p.vendor.toLowerCase();
        for (const c of vendorList) {
          if (c.name.toLowerCase() === key) {
            map[c.id] = (map[c.id] || 0) + 1;
          }
        }
      }
    }
    return map;
  }, [customers, allProducts]);

  const allSources: SourceRow[] = useMemo(() => {
    return customers
      .filter(c => c.tags?.includes('vendor'))
      .map(c => ({ ...c, teaCount: teaCountMap[c.id] || 0 }));
  }, [customers, teaCountMap]);

  // Get products for a specific source by vendor name
  const getSourceProducts = useCallback((sourceName: string) => {
    const nameLower = sourceName.toLowerCase();
    return allProducts.filter(p => p.vendor && p.vendor.toLowerCase() === nameLower);
  }, [allProducts]);

  // Fuse search
  const fuse = useMemo(() => new Fuse(allSources, {
    keys: ['name', 'company', 'country', 'email'],
    threshold: 0.3,
    ignoreLocation: true,
  }), [allSources]);

  // Processed (searched, sorted) sources
  const processedSources = useMemo(() => {
    let result = allSources;

    // Search
    if (searchQuery) {
      result = fuse.search(searchQuery).map(r => r.item);
    }

    // Multi-level Sort
    return [...result].sort((a, b) => {
      for (const sort of sortConfig) {
        let cmp = 0;
        switch (sort.key) {
          case 'name': cmp = a.name.localeCompare(b.name); break;
          case 'company': cmp = (a.company || '').localeCompare(b.company || ''); break;
          case 'country': cmp = (a.country || '').localeCompare(b.country || ''); break;
          case 'contact': {
            const aContact = a.email || a.phone || a.whatsapp || '';
            const bContact = b.email || b.phone || b.whatsapp || '';
            cmp = aContact.localeCompare(bContact);
            break;
          }
          case 'teaCount': cmp = a.teaCount - b.teaCount; break;
          case 'created': cmp = (a.createdAt || '').localeCompare(b.createdAt || ''); break;
        }
        const result = sort.direction === 'asc' ? cmp : -cmp;
        if (result !== 0) return result;
      }
      return 0;
    });
  }, [allSources, searchQuery, sortConfig, fuse]);

  // Grouped data
  const groupedSources = useMemo(() => {
    if (!groupBy) return null;
    const groups: Record<string, SourceRow[]> = {};
    for (const s of processedSources) {
      let key: string;
      if (groupBy === 'country') {
        key = s.country || 'Unknown';
      } else if (groupBy === 'teaCountRange') {
        if (s.teaCount === 0) key = '0 teas';
        else if (s.teaCount <= 5) key = '1–5 teas';
        else key = '5+ teas';
      } else {
        key = 'All';
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    }
    return groups;
  }, [processedSources, groupBy]);

  // Visible column defs
  const visibleCols = useMemo(() => SOURCE_COLUMN_DEFS.filter(col => visibleColumns.includes(col.key)), [visibleColumns]);

  // --- HANDLERS ---
  const handleSort = (key: SourceSortKey) => {
    const existing = sortConfig.find(s => s.key === key);
    if (existing) {
      if (existing.direction === 'asc') {
        setSortConfig(sortConfig.map(s => s.key === key ? { ...s, direction: 'desc' as const } : s));
      } else {
        setSortConfig(sortConfig.filter(s => s.key !== key));
      }
    } else {
      setSortConfig([...sortConfig, { key, direction: 'asc' }]);
    }
  };

  const toggleColumn = (key: string) => {
    setVisibleColumns(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const handleSave = async (data: { name: string; company: string; country: string; notes: string; phone: string; whatsapp: string; email: string }) => {
    try {
      const payload = { ...data, tags: ['vendor'] as CustomerTag[] };
      if (editingSource) {
        await api.customers.update(editingSource.id, payload);
        showToast('Source updated', 'success');
      } else {
        await api.customers.create(payload);
        showToast('Source added', 'success');
      }
      setIsModalOpen(false);
      setEditingSource(null);
      refetch();
    } catch (err: any) {
      showToast('Could not save source: ' + err.message, 'error');
    }
  };

  const handleDelete = (source: Customer) => {
    setPendingDeleteSource(source);
  };

  const handleConfirmDelete = async () => {
    if (!pendingDeleteSource) return;
    setDeleteLoading(true);
    try {
      await api.customers.delete(pendingDeleteSource.id);
      showToast('Source deleted', 'success');
      setPanelSource(null);
      setPendingDeleteSource(null);
      refetch();
    } catch (err: any) {
      showToast('Could not delete source: ' + err.message, 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleSourceUpdate = async (id: string, field: keyof Customer, value: any) => {
    // Optimistic local panel update
    if (panelSource && panelSource.id === id) {
      setPanelSource(prev => prev ? { ...prev, [field]: value } : null);
      setPanelDirty(true);
    }

    // Map to API payload
    const payload: any = { [field]: value };

    try {
      await api.customers.update(id, payload);
    } catch (err: any) {
      showToast(`Could not update source field: ${err.message}`, 'error');
      refetch();
    }
  };

  const handleExport = () => {
    const csv = Papa.unparse(processedSources.map(s => ({
      Name: s.name,
      Company: s.company || '',
      Country: s.country || '',
      Phone: s.phone || '',
      WhatsApp: s.whatsapp || '',
      Email: s.email || '',
      Teas: s.teaCount,
      Added: s.createdAt ? new Date(s.createdAt).toLocaleDateString() : '',
      Notes: s.notes || '',
    })));
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'sources_export.csv');
    link.click();
    showToast('Export generated', 'success');
  };

  const saveView = (view: SavedSourceView) => {
    setSavedViews(prev => {
      const idx = prev.findIndex(v => v.id === view.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = view;
        return next;
      }
      return [...prev, view];
    });
  };

  const deleteView = (id: string) => {
    setSavedViews(prev => prev.filter(v => v.id !== id));
    if (activeViewId === id) setActiveViewId('default-all');
  };

  // --- PANEL: LOAD SUPPLIED TEAS ---
  const refreshSupplied = useCallback(() => {
    if (!panelSource) return;
    setPanelSuppliedLoading(true);
    api.customers.getSuppliedProducts(panelSource.id)
      .then(setPanelSupplied)
      .catch(() => setPanelSupplied([]))
      .finally(() => setPanelSuppliedLoading(false));
  }, [panelSource?.id]);

  useEffect(() => {
    if (panelSource) {
      refreshSupplied();
      setShowLinkSearch(false);
      setLinkSearch('');
    }
  }, [panelSource?.id]);

  // --- PANEL KEYBOARD SHORTCUTS ---
  useEffect(() => {
    if (!panelSource) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setPanelSource(null); e.preventDefault(); }
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        const idx = processedSources.findIndex(s => s.id === panelSource.id);
        if (idx > 0) setPanelSource(processedSources[idx - 1]);
        e.preventDefault();
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        const idx = processedSources.findIndex(s => s.id === panelSource.id);
        if (idx < processedSources.length - 1) setPanelSource(processedSources[idx + 1]);
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [panelSource, processedSources]);

  // --- SORT HEADER COMPONENT ---
  const SortHeader = ({ colKey, label, align = 'left' }: { colKey: SourceSortKey, label: string, align?: 'left' | 'right' | 'center' }) => {
    const sortIndex = sortConfig.findIndex(s => s.key === colKey);
    const sortEntry = sortIndex >= 0 ? sortConfig[sortIndex] : null;
    const showBadge = sortConfig.length > 1 && sortEntry;
    return (
      <th
        className={`px-4 py-2 cursor-pointer hover:text-tea-text transition-colors select-none border-b border-tea-border group font-serif text-ui-11 uppercase tracking-display text-tea-text-sec font-normal text-${align} truncate`}
        onClick={() => handleSort(colKey)}
      >
        <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : ''}`}>
          {label}
          <div className="flex-shrink-0 relative z-0 flex items-center">
            {sortEntry ? (
              <span className="flex items-center">
                {sortEntry.direction === 'asc' ? <ArrowUp size={10} className="ml-1 text-tea-text-sec" /> : <ArrowDown size={10} className="ml-1 text-tea-text-sec" />}
                {showBadge && <span className="ml-0.5 text-ui-8 text-tea-gold font-bold">{sortIndex + 1}</span>}
              </span>
            ) : <ArrowUpDown size={10} className="opacity-0 group-hover:opacity-100 text-tea-text-sec/50 ml-1 transition-opacity" />}
          </div>
        </div>
      </th>
    );
  };

  // --- RENDER CELL ---
  const renderCell = (source: SourceRow, colKey: string) => {
    switch (colKey) {
      case 'name':
        return (
          <td className="px-4 py-2 align-middle overflow-hidden">
            <div className="flex flex-col justify-center h-full">
              {isEditMode ? (
                <GhostInput
                  value={source.name}
                  onSave={(val) => handleSourceUpdate(source.id, 'name', val)}
                  className="font-serif text-sm text-tea-text tracking-wide truncate"
                />
              ) : (
                <span className="text-sm font-serif text-tea-text tracking-wide group-hover:text-tea-gold transition-colors truncate">
                  {source.name}
                </span>
              )}
            </div>
          </td>
        );
      case 'company':
        return (
          <td className="px-4 py-2 align-middle overflow-hidden">
            {isEditMode ? (
              <GhostInput value={source.company || ''} onSave={(val) => handleSourceUpdate(source.id, 'company', val)} className="text-ui-12 text-tea-text-sec truncate" placeholder="Company" />
            ) : <span className="text-ui-12 text-tea-text-sec truncate block">{source.company || '—'}</span>}
          </td>
        );
      case 'country':
        return (
          <td className="px-4 py-2 align-middle overflow-hidden">
            {isEditMode ? (
              <GhostInput value={source.country || ''} onSave={(val) => handleSourceUpdate(source.id, 'country', val)} className="text-ui-12 text-tea-text-sec truncate" placeholder="Country" />
            ) : (
              source.country ? (
                <span className="text-ui-12 text-tea-text-sec flex items-center gap-1 truncate"><MapPin size={10} className="flex-shrink-0 text-tea-text-dim" /> {source.country}</span>
              ) : (
                <span className="text-ui-12 text-tea-text-dim">—</span>
              )
            )}
          </td>
        );
      case 'contact':
        return (
          <td className="px-4 py-2 align-middle overflow-hidden">
            <div className="flex items-center gap-2 text-ui-12 text-tea-text-sec truncate">
              {source.email && <span className="truncate">{source.email}</span>}
              {!source.email && source.phone && <span>{source.phone}</span>}
              {!source.email && !source.phone && source.whatsapp && <span>WA: {source.whatsapp}</span>}
              {!source.email && !source.phone && !source.whatsapp && <span className="text-tea-text-dim">—</span>}
            </div>
          </td>
        );
      case 'teaCount':
        return (
          <td className="px-4 py-2 align-middle overflow-hidden text-center">
            <span className={`inline-flex items-center gap-1 text-ui-12 tabular-nums ${source.teaCount > 0 ? 'text-tea-gold' : 'text-tea-text-dim'}`}>
              <Leaf size={11} /> {source.teaCount}
            </span>
          </td>
        );
      case 'created':
        return (
          <td className="px-4 py-2 align-middle overflow-hidden">
            <span className="text-ui-12 text-tea-text-sec tabular-nums">
              {source.createdAt ? new Date(source.createdAt).toLocaleDateString() : '—'}
            </span>
          </td>
        );
      default:
        return <td className="px-4 py-2 align-middle text-ui-12 text-tea-text-sec">—</td>;
    }
  };

  // --- ROW COMPONENT ---
  const renderRow = (source: SourceRow) => {
    const isExpanded = expandedSourceId === source.id;
    const status = sourceStatus(source);
    return (
    <React.Fragment key={source.id}>
    <tr
      className={`transition-colors border-b border-tea-border group ${isEditMode ? '' : 'hover:bg-tea-accent-sub cursor-pointer'} ${isExpanded ? 'bg-tea-gold/5' : ''} ${panelSource?.id === source.id ? 'bg-tea-gold/5' : ''}`}
      style={{ height: ROW_HEIGHT + 8 }}
      onClick={() => !isEditMode && setExpandedSourceId(isExpanded ? null : source.id)}
    >
      {visibleCols.map(col => renderCell(source, col.key))}
      <td className="px-3 py-2 align-middle">
        <div className="flex items-center justify-end gap-2">
          <StatusPill variant={status.variant} className="opacity-90">{status.label}</StatusPill>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
            {!isEditMode && (
              <>
                {source.id && (
                  <button
                    onClick={() => navigate(`/admin/vendors/${source.id}`)}
                    className="tap-target text-tea-text-sec hover:text-tea-gold p-1 transition-colors"
                    title="View vendor profile"
                  ><ExternalLink size={13} /></button>
                )}
                <button
                  onClick={() => { setEditingSource(source); setIsModalOpen(true); }}
                  className="tap-target text-tea-text-sec hover:text-tea-text p-1 transition-colors"
                  title="Edit"
                ><Pencil size={13} /></button>
                <button
                  onClick={() => handleDelete(source)}
                  className="tap-target text-tea-text-sec hover:text-tea-error p-1 transition-colors"
                  title="Delete"
                ><Trash2 size={13} /></button>
              </>
            )}
          </div>
          <ChevronRight size={13} className={`text-tea-text-dim flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
        </div>
      </td>
    </tr>
    {isExpanded && (
      <tr>
        <td colSpan={visibleCols.length + 1} className="p-0">
          <div className="border-b-2 border-tea-accent-sub bg-tea-bg pb-6">
            <TeaTable
              products={getSourceProducts(source.name)}
              currency={currency}
              rates={rates}
              onAdd={() => {}}
              isAdmin={true}
              isLoading={false}
              showAll={true}
              inline={true}
              headerSlot={
                <div className="flex items-center gap-2 shrink-0">
                  <Leaf size={16} className="text-tea-gold" />
                  <h2 className="h3">
                    {source.name}
                  </h2>
                  <span className="text-tea-text-sec text-xs tracking-wide">
                    — {getSourceProducts(source.name).length} teas supplied
                  </span>
                </div>
              }
              onEdit={(product) => {
                navigate(`/admin/stock?panel=${encodeURIComponent(product.id)}`);
              }}
            />
            {(() => {
              const vendorBatches = sampleSets.filter(
                ss => ss.sourceId === source.id ||
                      (ss.sourceName && ss.sourceName.toLowerCase() === source.name.toLowerCase())
              );
              if (vendorBatches.length === 0) return null;
              return (
                <div className="mt-4 pt-3 mx-4" style={{ borderTop: '1px solid var(--tea-accent-sub)' }}>
                  <p className="text-ui-10 uppercase tracking-wider text-tea-text-dim mb-2 font-medium">
                    Sample Batches · {vendorBatches.length}
                  </p>
                  <div className="space-y-1">
                    {vendorBatches.map((batch) => {
                      const batchSamples = getSamplesForSet(batch.id);
                      const tasted = batchSamples.filter(s => s.status !== 'untasted').length;
                      const graduated = batchSamples.filter(s => s.productId).length;
                      return (
                        <div
                          key={batch.id}
                          className="flex items-center gap-3 px-3 py-2 rounded bg-tea-surface text-sm"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="text-tea-text truncate">{batch.name || 'Untitled Batch'}</div>
                            <div className="text-ui-10 text-tea-text-dim">
                              {batchSamples.length} sample{batchSamples.length !== 1 ? 's' : ''} ·{' '}
                              {tasted}/{batchSamples.length} tasted
                              {graduated > 0 && ` · ${graduated} in inventory`}
                            </div>
                          </div>
                          <span className="text-ui-10 text-tea-text-dim shrink-0">
                            {new Date(batch.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        </td>
      </tr>
    )}
    </React.Fragment>
    );
  };

  if (isLoading) {
    return <div className="p-12 text-center text-tea-text-sec font-serif italic"><Loader2 className="animate-spin inline mr-2" /> Loading sources...</div>;
  }

  return (
    <div className={`h-full flex flex-col overflow-hidden bg-tea-bg ${panelSource ? 'md:mr-[420px]' : ''} transition-all duration-300`}>

      {/* --- SAVED VIEWS TAB BAR (desktop only — underline tabs, §6 canonical) --- */}
      <div className="hidden md:block px-4 md:px-8 border-b border-tea-border bg-tea-bg flex-shrink-0">
        <div className="flex items-center gap-5 overflow-x-auto hide-scrollbar flex-wrap">
          {savedViews.map(view => {
            const isActive = activeViewId === view.id;
            return (
              <button
                key={view.id}
                onClick={() => {
                  setActiveViewId(view.id);
                  setVisibleColumns(view.columns);
                  setSortConfig(view.sortConfig);
                  setGroupBy(view.groupBy);
                }}
                className={`whitespace-nowrap py-2.5 text-ui-12 uppercase tracking-caps font-sans border-b transition-colors flex items-center gap-1.5 ${
                  isActive
                    ? 'text-tea-text border-tea-gold'
                    : 'text-tea-text-sec hover:text-tea-text border-transparent'
                }`}
              >
                {view.name}
                {!view.id.startsWith('default-') && (
                  <span
                    onClick={(e) => { e.stopPropagation(); deleteView(view.id); }}
                    className="text-tea-text-sec hover:text-tea-text transition-colors"
                  >
                    <XIcon size={10} />
                  </span>
                )}
              </button>
            );
          })}
          {showSaveViewPrompt ? (
            <div className="flex items-center gap-1 py-2.5">
              <input
                autoFocus
                value={newViewName}
                onChange={(e) => setNewViewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newViewName.trim()) {
                    const id = `custom-${Date.now()}`;
                    saveView({ id, name: newViewName.trim(), columns: visibleColumns, sortConfig, groupBy });
                    setActiveViewId(id);
                    setNewViewName('');
                    setShowSaveViewPrompt(false);
                  } else if (e.key === 'Escape') {
                    setShowSaveViewPrompt(false);
                    setNewViewName('');
                  }
                }}
                placeholder="View name..."
                className="bg-transparent border-b border-tea-border text-ui-12 text-tea-text outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg w-28 py-0.5 px-1"
              />
              <button onClick={() => { setShowSaveViewPrompt(false); setNewViewName(''); }} className="text-tea-text-sec hover:text-tea-text"><XIcon size={10} /></button>
            </div>
          ) : (
            <button
              onClick={() => setShowSaveViewPrompt(true)}
              className="flex items-center gap-1 py-2.5 text-ui-12 text-tea-text-sec hover:text-tea-text uppercase tracking-caps transition-colors"
            >
              <Save size={10} /> Save View
            </button>
          )}
        </div>
      </div>

      {/* --- MOBILE CONTROL BAR --- */}
      <div className={`md:hidden sticky top-0 z-sticky transition-colors flex-shrink-0 ${isEditMode ? 'bg-tea-surface/95' : 'bg-tea-bg/95 backdrop-blur-md'}`}>
        <div className="flex items-center px-2 py-1.5 gap-1">
          <Users size={14} className="text-tea-gold shrink-0 ml-1" />
          <span className="text-ui-11 text-tea-text-sec uppercase tracking-[0.08em] shrink-0">
            {processedSources.length}
          </span>

          <div className="flex-1" />

          {/* Search */}
          <div className="relative w-28">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-tea-text-sec" size={14} />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent border-b border-tea-border rounded-none pl-8 pr-3 py-1.5 text-base md:text-xs text-tea-text outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg focus:border-tea-text-sec font-serif placeholder-tea-text-sec/50 transition-colors"
            />
          </div>

          {/* Sort */}
          <div className="relative">
            <button
              onClick={() => { setShowMobileSort(!showMobileSort); setShowOptions(false); }}
              className={`w-9 h-9 flex items-center justify-center transition-colors rounded-md ${showMobileSort ? 'text-tea-gold' : 'text-tea-text-dim hover:text-tea-text-sec'}`}
            >
              <ArrowUpDown size={15} />
            </button>
            {showMobileSort && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMobileSort(false)} />
                <div className="absolute right-0 top-9 w-40 bg-tea-surface border border-tea-border shadow-2xl rounded-xl z-popover py-1" role="menu">
                  {([
                    { key: 'name' as SourceSortKey, label: 'Name' },
                    { key: 'company' as SourceSortKey, label: 'Company' },
                    { key: 'country' as SourceSortKey, label: 'Country' },
                    { key: 'teaCount' as SourceSortKey, label: 'Tea Count' },
                    { key: 'created' as SourceSortKey, label: 'Added' },
                  ]).map(opt => {
                    const current = sortConfig[0];
                    const isActive = current?.key === opt.key;
                    return (
                      <button
                        key={opt.key}
                        onClick={() => {
                          if (isActive) {
                            setSortConfig([{ key: opt.key, direction: current.direction === 'asc' ? 'desc' : 'asc' }]);
                          } else {
                            setSortConfig([{ key: opt.key, direction: 'asc' }]);
                          }
                          setShowMobileSort(false);
                        }}
                        className={`w-full px-3 py-2 text-left text-ui-11 flex items-center gap-2 hover:bg-tea-bg transition-colors ${isActive ? 'text-tea-gold' : 'text-tea-text-sec'}`}
                      >
                        {opt.label}
                        {isActive && (
                          <span className="ml-auto">
                            {current.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Options (New, Export, Edit) */}
          <div className="relative">
            <button
              onClick={() => { setShowOptions(!showOptions); setShowMobileSort(false); }}
              className={`w-9 h-9 flex items-center justify-center transition-colors rounded-md ${showOptions ? 'text-tea-gold' : 'text-tea-text-dim hover:text-tea-text-sec'}`}
            >
              <MoreHorizontal size={15} />
            </button>
            {showOptions && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowOptions(false)} />
                <div className="absolute right-0 top-9 w-48 bg-tea-surface border border-tea-border shadow-2xl rounded-xl z-popover py-1 max-h-[calc(100dvh-100px)] overflow-y-auto">
                  {/* Saved views */}
                  <div className="px-3 py-1.5 text-ui-9 text-tea-text-sec/60 uppercase tracking-[0.2em]">Views</div>
                  {savedViews.map(view => (
                    <button
                      key={view.id}
                      onClick={() => {
                        setActiveViewId(view.id);
                        setVisibleColumns(view.columns);
                        setSortConfig(view.sortConfig);
                        setGroupBy(view.groupBy);
                        setShowOptions(false);
                      }}
                      className={`w-full px-3 py-2 text-left text-ui-11 flex items-center gap-2 hover:bg-tea-bg transition-colors ${activeViewId === view.id ? 'text-tea-gold' : 'text-tea-text-sec'}`}
                    >
                      {view.name}
                      {activeViewId === view.id && <Check size={11} className="ml-auto" />}
                    </button>
                  ))}
                  <div className="h-px bg-tea-border/30 my-1" />
                  <button onClick={() => { setEditingSource(null); setIsModalOpen(true); setShowOptions(false); }} className="w-full px-3 py-2 text-left text-ui-11 flex items-center gap-2 hover:bg-tea-bg text-tea-text-sec transition-colors">
                    <Plus size={13} /> New Source
                  </button>
                  <button onClick={() => { setIsEditMode(!isEditMode); setShowOptions(false); }} className="w-full px-3 py-2 text-left text-ui-11 flex items-center gap-2 hover:bg-tea-bg text-tea-text-sec transition-colors">
                    {isEditMode ? <Check size={13} /> : <Pencil size={13} />}
                    {isEditMode ? 'Done Editing' : 'Edit Mode'}
                  </button>
                  <button onClick={() => { handleExport(); setShowOptions(false); }} className="w-full px-3 py-2 text-left text-ui-11 flex items-center gap-2 hover:bg-tea-bg text-tea-text-sec transition-colors">
                    <Download size={13} /> Export CSV
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* --- DESKTOP HEADER CONTROLS (filter + actions only; parent PeopleView owns the page title) --- */}
      <div className={`hidden md:block sticky top-0 z-sticky border-b border-tea-border transition-colors flex-shrink-0 ${isEditMode ? 'bg-tea-surface/95 border-b-tea-gold/20' : 'bg-tea-bg/90 backdrop-blur-md'}`}>
        <div className="px-4 md:px-8 py-3 flex items-center gap-4 flex-wrap">
          <span className="label-caps text-tea-text-dim shrink-0">
            {isEditMode ? 'CLICK CELLS TO EDIT' : `${processedSources.length} VENDORS`}
          </span>

          <div className="flex items-center gap-4 ml-auto">
            {/* Search */}
            <div className="relative w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-tea-text-sec" size={14} />
              <input
                type="text"
                placeholder="Search sources..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent border-b border-tea-border rounded-none pl-9 pr-3 py-1.5 text-xs text-tea-text outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg focus:border-tea-text-sec font-serif placeholder-tea-text-sec/50 transition-colors"
              />
            </div>

            {/* Actions Group */}
            <div className="flex items-center gap-2 relative">
              {/* Toggle Edit Mode */}
              <button
                onClick={() => setIsEditMode(!isEditMode)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-colors ${
                  isEditMode
                    ? 'bg-tea-gold text-tea-bg font-semibold hover:bg-tea-gold/90 active:bg-tea-gold/80'
                    : 'border border-tea-border text-tea-text-sec hover:text-tea-text hover:bg-tea-accent-sub'
                }`}
              >
                {isEditMode ? <Check size={13} /> : <Pencil size={13} />}
                <span>{isEditMode ? 'Done' : 'Edit'}</span>
              </button>

              <div className="w-px h-4 bg-tea-border mx-1"></div>

              <button
                onClick={() => { setEditingSource(null); setIsModalOpen(true); }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 active:bg-tea-gold/80 transition-colors"
              >
                <Plus size={13} />
                <span>New</span>
              </button>

              <div className="w-px h-4 bg-tea-border mx-1"></div>

              {/* Columns Toggle */}
              <div className="relative">
                <button
                  onClick={() => setShowColumnsPopover(!showColumnsPopover)}
                  className={`tap-target flex items-center gap-1 px-2 py-1.5 rounded-md text-xs transition-colors ${showColumnsPopover ? 'text-tea-gold bg-tea-surface' : 'text-tea-text-sec hover:text-tea-text hover:bg-tea-surface'}`}
                  title="Show/Hide Columns"
                >
                  <Columns size={14} />
                  <span className="hidden xl:inline tracking-wide">Cols</span>
                </button>
                {showColumnsPopover && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowColumnsPopover(false)} />
                    <div className="absolute right-0 top-full mt-2 w-44 bg-tea-surface border border-tea-border shadow-2xl rounded-xl z-popover py-2">
                      <div className="px-3 pb-1.5 text-ui-9 text-tea-text-sec/60 uppercase tracking-[0.2em]">Visible Columns</div>
                      {SOURCE_COLUMN_DEFS.map(col => (
                        <label key={col.key} className={`flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-tea-bg transition-colors cursor-pointer ${'alwaysVisible' in col && col.alwaysVisible ? 'opacity-50 cursor-not-allowed' : ''}`}>
                          <input
                            type="checkbox"
                            checked={visibleColumns.includes(col.key)}
                            onChange={() => !('alwaysVisible' in col && col.alwaysVisible) && toggleColumn(col.key)}
                            disabled={'alwaysVisible' in col && col.alwaysVisible}
                            className="accent-tea-gold"
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
                  onClick={() => {
                    const el = document.getElementById('sources-groupby-dropdown');
                    if (el) el.classList.toggle('hidden');
                  }}
                  className={`tap-target flex items-center gap-1 px-2 py-1.5 rounded-md text-xs transition-colors ${groupBy ? 'text-tea-gold bg-tea-surface' : 'text-tea-text-sec hover:text-tea-text hover:bg-tea-surface'}`}
                  title="Group By"
                >
                  <Layers size={14} />
                  <span className="hidden xl:inline tracking-wide">Group</span>
                </button>
                <div id="sources-groupby-dropdown" className="hidden absolute right-0 top-full mt-2 w-40 bg-tea-surface border border-tea-border shadow-2xl rounded-xl z-popover py-1">
                  {GROUPBY_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        setGroupBy(opt.value || null);
                        document.getElementById('sources-groupby-dropdown')?.classList.add('hidden');
                      }}
                      className={`w-full px-3 py-1.5 text-left text-xs hover:bg-tea-bg transition-colors ${(groupBy || '') === opt.value ? 'text-tea-gold' : 'text-tea-text-sec'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => setShowOptions(!showOptions)}
                className="tap-target p-1.5 text-tea-text-sec hover:text-tea-text transition-colors rounded-md hover:bg-tea-surface"
              >
                <MoreHorizontal size={16} />
              </button>

              {/* Options Dropdown */}
              {showOptions && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowOptions(false)}></div>
                  <div className="absolute right-0 top-full mt-2 w-48 bg-tea-surface border border-tea-border shadow-2xl rounded-xl z-popover py-1 flex flex-col">
                    <button onClick={() => { handleExport(); setShowOptions(false); }} className="px-4 py-2 text-left text-xs text-tea-text-sec hover:text-tea-text hover:bg-tea-bg flex items-center gap-2 transition-colors">
                      <Download size={14} /> Export CSV
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* --- SCROLL CONTAINER --- */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-auto custom-scrollbar bg-tea-bg md:px-6"
      >

        {/* MOBILE CARDS — canonical list rows §8 + identity-card-in-miniature §19 */}
        <div className="md:hidden pb-nav-gap">
          <ul className="divide-y divide-tea-border bg-tea-surface border border-tea-border rounded-xl overflow-hidden mx-3 mt-3">
            {processedSources.map((source) => {
              const isExpanded = expandedCardId === source.id;
              const status = sourceStatus(source);
              return (
                <li key={source.id}>
                  <button
                    className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors active:bg-tea-accent-sub ${isExpanded ? 'bg-tea-accent-sub' : ''}`}
                    onClick={() => setExpandedCardId(isExpanded ? null : source.id)}
                  >
                    <VendorAvatar name={source.name} size={36} />
                    <div className="flex-1 min-w-0">
                      <div className="font-display text-ui-15 text-tea-text truncate">{source.name}</div>
                      <div className="flex items-center gap-1.5 text-ui-12 text-tea-text-dim mt-0.5">
                        {source.company && <span className="truncate">{source.company}</span>}
                        {source.company && source.country && <span className="opacity-40">·</span>}
                        {source.country && (
                          <span className="flex items-center gap-0.5 truncate"><MapPin size={9} className="flex-shrink-0" /> {source.country}</span>
                        )}
                        {!source.company && !source.country && (
                          <span className="text-tea-text-dim">Vendor</span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <StatusPill variant={status.variant}>{status.label}</StatusPill>
                      <div className={`text-ui-11 tabular-nums flex items-center gap-1 ${source.teaCount > 0 ? 'text-tea-gold' : 'text-tea-text-dim'}`}>
                        <Leaf size={10} /> {source.teaCount}
                      </div>
                    </div>

                    <ChevronRight size={14} className={`flex-shrink-0 text-tea-text-dim transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                  </button>

                  {/* Expanded detail panel */}
                  {isExpanded && (
                    <div className="bg-tea-bg/60 px-4 pb-3 pt-2 border-t border-tea-border">
                      <div className="grid grid-cols-3 gap-x-4 gap-y-3 py-2">
                        {source.company && (
                          <div>
                            <div className="text-ui-10 text-tea-text-dim uppercase tracking-caps">Company</div>
                            <div className="text-ui-13 text-tea-text mt-0.5 truncate">{source.company}</div>
                          </div>
                        )}
                        {source.country && (
                          <div>
                            <div className="text-ui-10 text-tea-text-dim uppercase tracking-caps">Country</div>
                            <div className="text-ui-13 text-tea-text mt-0.5 truncate">{source.country}</div>
                          </div>
                        )}
                        <div>
                          <div className="text-ui-10 text-tea-text-dim uppercase tracking-caps">Teas</div>
                          <div className="text-ui-13 text-tea-text tabular-nums mt-0.5">{source.teaCount}</div>
                        </div>
                        {source.email && (
                          <div className="col-span-2">
                            <div className="text-ui-10 text-tea-text-dim uppercase tracking-caps">Email</div>
                            <div className="text-ui-13 text-tea-text truncate mt-0.5">{source.email}</div>
                          </div>
                        )}
                        {source.phone && (
                          <div>
                            <div className="text-ui-10 text-tea-text-dim uppercase tracking-caps">Phone</div>
                            <div className="text-ui-13 text-tea-text mt-0.5">{source.phone}</div>
                          </div>
                        )}
                      </div>

                      {source.notes && (
                        <p className="text-ui-12 text-tea-text-sec font-serif italic leading-relaxed mt-1 mb-2">{source.notes}</p>
                      )}

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 mt-2 pt-3 border-t border-tea-border">
                        <button
                          onClick={() => navigate(`/admin/vendors/${source.id}`)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs text-tea-text-sec hover:text-tea-text hover:bg-tea-surface transition-colors"
                        >
                          <ExternalLink size={12} /> Profile
                        </button>
                        <div className="ml-auto flex items-center gap-2">
                          <button
                            onClick={() => { setEditingSource(source); setIsModalOpen(true); }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-tea-border text-xs text-tea-text-sec hover:text-tea-text hover:bg-tea-surface transition-colors"
                          >
                            <Pencil size={12} /> Edit
                          </button>
                          <button
                            onClick={() => handleDelete(source)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-tea-border text-xs text-tea-text-sec hover:text-tea-error transition-colors"
                          >
                            <Trash2 size={12} /> Delete
                          </button>
                        </div>
                      </div>

                      {/* Inline tea inventory */}
                      {source.teaCount > 0 && (
                        <div className="mt-3 -mx-4 border-t border-tea-accent-sub">
                          <TeaTable
                            products={getSourceProducts(source.name)}
                            currency={currency}
                            rates={rates}
                            onAdd={() => {}}
                            isAdmin={true}
                            isLoading={false}
                            showAll={true}
                            inline={true}
                            title={`${source.name}'s Teas`}
                            onEdit={(product) => {
                              navigate(`/admin/stock?panel=${encodeURIComponent(product.id)}`);
                            }}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          {processedSources.length === 0 && (
            <div className="bg-tea-surface border border-tea-border rounded-xl mx-3 mt-3 text-center py-16 text-ui-13 text-tea-text-sec font-serif italic">
              {searchQuery ? 'No sources match your search.' : 'No sources yet. Add your first vendor.'}
            </div>
          )}
        </div>

        {/* DESKTOP TABLE */}
        <div className="w-full max-w-7xl mx-auto bg-tea-surface min-h-full hidden md:block">

          {/* --- GROUPED VIEW --- */}
          {groupedSources ? (
            <div>
              {/* Table header (sticky) */}
              <table className="w-full table-fixed border-collapse">
                <colgroup>
                  {visibleCols.map(col => <col key={col.key} className={col.defaultWidth} />)}
                  <col className="w-[18%]" />
                </colgroup>
                <thead className="sticky top-0 z-sticky bg-tea-bg">
                  <tr>
                    {visibleCols.map(col => (
                      <SortHeader key={col.key} colKey={col.key as SourceSortKey} label={col.label} align={col.key === 'teaCount' ? 'center' : 'left'} />
                    ))}
                    <th className="px-2 py-2 border-b border-tea-border"></th>
                  </tr>
                </thead>
              </table>

              {/* Grouped sections */}
              {Object.entries(groupedSources).map(([groupKey, items]) => {
                const isCollapsed = collapsedGroups.has(groupKey);
                const totalTeas = items.reduce((sum, s) => sum + s.teaCount, 0);
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
                      <span className="text-ui-10 text-tea-text-sec uppercase tracking-[0.15em]">{items.length} source{items.length !== 1 ? 's' : ''}</span>
                      <span className="text-ui-10 text-tea-text-sec tabular-nums ml-auto">{totalTeas} tea{totalTeas !== 1 ? 's' : ''} total</span>
                    </button>
                    {!isCollapsed && (
                      <table className="w-full table-fixed border-collapse">
                        <colgroup>
                          {visibleCols.map(col => <col key={col.key} className={col.defaultWidth} />)}
                          <col className="w-[18%]" />
                        </colgroup>
                        <tbody>
                          {items.map(source => renderRow(source))}
                        </tbody>
                      </table>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* --- FLAT TABLE --- */
            <table className="w-full table-fixed border-collapse">
              <colgroup>
                {visibleCols.map(col => <col key={col.key} className={col.defaultWidth} />)}
                <col className="w-[18%]" />
              </colgroup>

              <thead className="sticky top-0 z-sticky bg-tea-bg">
                <tr>
                  {visibleCols.map(col => (
                    <SortHeader key={col.key} colKey={col.key as SourceSortKey} label={col.label} align={col.key === 'teaCount' ? 'center' : 'left'} />
                  ))}
                  <th className="px-2 py-2 border-b border-tea-border"></th>
                </tr>
              </thead>

              <tbody>
                {processedSources.map(source => renderRow(source))}
              </tbody>
            </table>
          )}

          {processedSources.length === 0 && (
            <div className="text-center py-16 text-tea-text-sec font-serif italic">
              {searchQuery ? 'No sources match your search.' : 'No sources yet. Add your first vendor.'}
            </div>
          )}
        </div>
      </div>

      {/* --- SIDE PANEL — canonical drawer §15 (close X top-LEFT, w-full max-w-md, bg-tea-surface) --- */}
      <AnimatePresence>
        {panelSource && (() => {
          const panelStatus = sourceStatus(panelSource);
          return (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed inset-y-0 right-0 z-drawer w-full md:max-w-md bg-tea-surface border-l border-tea-border flex flex-col"
            style={{ boxShadow: '-12px 0 40px -8px rgba(24,19,14,0.35)' }}
          >
            {/* Panel Header — close X top-LEFT, nav toolbar right (panel-with-toolbar exception) */}
            <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-tea-border bg-tea-surface flex-shrink-0">
              <button
                onClick={() => setPanelSource(null)}
                className="tap-target p-1 text-tea-text-sec hover:text-tea-text transition-colors"
                title="Close"
              ><XIcon size={18} /></button>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    const idx = processedSources.findIndex(s => s.id === panelSource.id);
                    if (idx > 0) setPanelSource(processedSources[idx - 1]);
                  }}
                  className="tap-target p-1 text-tea-text-sec hover:text-tea-text transition-colors"
                  title="Previous"
                ><ChevronUp size={16} /></button>
                <button
                  onClick={() => {
                    const idx = processedSources.findIndex(s => s.id === panelSource.id);
                    if (idx < processedSources.length - 1) setPanelSource(processedSources[idx + 1]);
                  }}
                  className="tap-target p-1 text-tea-text-sec hover:text-tea-text transition-colors"
                  title="Next"
                ><ChevronDown size={16} /></button>
              </div>
            </div>

            {/* Identity card — canonical from §19 */}
            <div className="px-5 py-5 border-b border-tea-border flex items-start gap-4 flex-shrink-0">
              <VendorAvatar name={panelSource.name} size={48} />
              <div className="flex-1 min-w-0">
                <h3 className="h3 truncate">{panelSource.name}</h3>
                {panelSource.email && (
                  <p className="text-ui-13 text-tea-text-sec mt-0.5 truncate">{panelSource.email}</p>
                )}
                <p className="text-ui-12 text-tea-text-dim mt-0.5 truncate">
                  {panelSource.company || 'Vendor'}{panelSource.country ? ` · ${panelSource.country}` : ''}
                  {panelSource.teaCount > 0 && ` · ${panelSource.teaCount} tea${panelSource.teaCount !== 1 ? 's' : ''}`}
                </p>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  <StatusPill variant={panelStatus.variant}>{panelStatus.label}</StatusPill>
                  {panelSource.tags?.filter(t => t !== 'vendor').map(t => (
                    <StatusPill key={t} variant="draft">{t}</StatusPill>
                  ))}
                </div>
              </div>
            </div>

            {/* Panel Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar py-3 space-y-1">

              {/* Details Section */}
              <CollapsibleSection title="Details">
                <div className="space-y-3">
                  <div>
                    <label className="text-ui-10 text-tea-text-sec uppercase tracking-[0.15em] block mb-1">Name</label>
                    <GhostInput
                      value={panelSource.name}
                      onSave={(val) => handleSourceUpdate(panelSource.id, 'name', val)}
                      className="text-sm text-tea-text font-serif"
                    />
                  </div>
                  <div>
                    <label className="text-ui-10 text-tea-text-sec uppercase tracking-[0.15em] block mb-1">Company</label>
                    <GhostInput
                      value={panelSource.company || ''}
                      onSave={(val) => handleSourceUpdate(panelSource.id, 'company', val)}
                      className="text-xs text-tea-text"
                      placeholder="Company or shop name"
                    />
                  </div>
                  <div>
                    <label className="text-ui-10 text-tea-text-sec uppercase tracking-[0.15em] block mb-1">Country</label>
                    <GhostInput
                      value={panelSource.country || ''}
                      onSave={(val) => handleSourceUpdate(panelSource.id, 'country', val)}
                      className="text-xs text-tea-text"
                      placeholder="Country"
                    />
                  </div>
                  {panelSource.notes && (
                    <div>
                      <label className="text-ui-10 text-tea-text-sec uppercase tracking-[0.15em] block mb-1">Notes</label>
                      <p className="text-xs text-tea-text-sec/70 font-serif italic leading-relaxed whitespace-pre-line">{panelSource.notes}</p>
                    </div>
                  )}
                </div>
              </CollapsibleSection>

              {/* Contact Section */}
              <CollapsibleSection title="Contact">
                <div className="space-y-3">
                  <div>
                    <label className="text-ui-10 text-tea-text-sec uppercase tracking-[0.15em] block mb-1">Email</label>
                    <GhostInput
                      value={panelSource.email || ''}
                      onSave={(val) => handleSourceUpdate(panelSource.id, 'email', val)}
                      className="text-xs text-tea-text"
                      placeholder="email@example.com"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-ui-10 text-tea-text-sec uppercase tracking-[0.15em] block mb-1">Phone</label>
                      <GhostInput
                        value={panelSource.phone || ''}
                        onSave={(val) => handleSourceUpdate(panelSource.id, 'phone', val)}
                        className="text-xs text-tea-text"
                        placeholder="Phone"
                      />
                    </div>
                    <div>
                      <label className="text-ui-10 text-tea-text-sec uppercase tracking-[0.15em] block mb-1">WhatsApp</label>
                      <GhostInput
                        value={panelSource.whatsapp || ''}
                        onSave={(val) => handleSourceUpdate(panelSource.id, 'whatsapp', val)}
                        className="text-xs text-tea-text"
                        placeholder="WhatsApp"
                      />
                    </div>
                  </div>
                </div>
              </CollapsibleSection>

              {/* Supplied Teas Section */}
              <CollapsibleSection title={`Supplied Teas (${panelSuppliedLoading ? '...' : panelSupplied.length})`}>
                {panelSuppliedLoading ? (
                  <div className="flex justify-center py-4"><Loader2 className="animate-spin text-tea-text-sec" size={16} /></div>
                ) : (
                  <>
                    {panelSupplied.length > 0 && (
                      <div className="bg-tea-bg rounded-xl border border-tea-border overflow-hidden mb-3">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-tea-border text-tea-text-sec">
                              <th className="text-left px-3 py-2 font-medium">Tea</th>
                              <th className="text-left px-3 py-2 font-medium">Type</th>
                              <th className="text-left px-3 py-2 font-medium">Region</th>
                              <th className="text-right px-3 py-2 font-medium">Stock</th>
                              <th className="text-right px-3 py-2 font-medium">Cost</th>
                              <th className="text-center px-3 py-2 font-medium w-8"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {panelSupplied.map((p: any) => (
                              <tr key={p.id} className="border-b border-tea-border last:border-0 hover:bg-tea-surface/50 transition-colors">
                                <td className="px-3 py-2">
                                  <button
                                    onClick={() => navigate(`/admin/stock?panel=${encodeURIComponent(p.id)}`)}
                                    className="text-tea-text hover:text-tea-gold transition-colors flex items-center gap-1.5"
                                  >
                                    {p.image_url && <img src={p.image_url} alt="" className="w-5 h-5 rounded object-cover flex-shrink-0" loading="lazy" />}
                                    <span className="truncate">{p.given_name || p.product_name}</span>
                                    <ExternalLink size={9} className="text-tea-text-sec flex-shrink-0" />
                                  </button>
                                </td>
                                <td className="px-3 py-2 text-tea-text-sec uppercase">{p.type}</td>
                                <td className="px-3 py-2 text-tea-text-sec">{p.origin_region || '—'}</td>
                                <td className="px-3 py-2 text-right text-tea-text">{p.stock_grams != null ? `${p.stock_grams}g` : '—'}</td>
                                <td className="px-3 py-2 text-right text-tea-text">
                                  {p.cost_amount ? `${p.cost_amount} ${p.cost_currency || ''}` : '—'}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <button
                                    onClick={async () => {
                                      await api.customers.unlinkProduct(panelSource.id, p.id);
                                      refreshSupplied();
                                      showToast('Unlinked', 'info');
                                    }}
                                    className="text-tea-text-sec hover:text-tea-error transition-colors"
                                    title="Unlink"
                                  >
                                    <XIcon size={12} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Link a tea */}
                    <div className="relative">
                      {!showLinkSearch ? (
                        <button
                          onClick={() => setShowLinkSearch(true)}
                          className="flex items-center gap-1.5 text-xs text-tea-text-sec hover:text-tea-gold transition-colors"
                        >
                          <Plus size={12} /> Link a tea
                        </button>
                      ) : (
                        <div className="bg-tea-bg border border-tea-border rounded-xl shadow-lg overflow-hidden max-w-sm">
                          <div className="p-2 border-b border-tea-border flex items-center gap-2">
                            <Search size={12} className="text-tea-text-sec" />
                            <input
                              type="text"
                              placeholder="Search teas..."
                              value={linkSearch}
                              onChange={e => setLinkSearch(e.target.value)}
                              className="flex-1 bg-transparent text-base md:text-xs text-tea-text outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg"
                              autoFocus
                            />
                            <button onClick={() => { setShowLinkSearch(false); setLinkSearch(''); }} className="text-tea-text-sec hover:text-tea-text"><XIcon size={12} /></button>
                          </div>
                          <div className="max-h-40 overflow-y-auto">
                            {allProducts
                              .filter(p => {
                                const q = linkSearch.toLowerCase();
                                const alreadyLinked = panelSupplied.some((sp: any) => sp.id === p.id);
                                if (alreadyLinked) return false;
                                if (!q) return true;
                                return (p.givenName || '').toLowerCase().includes(q)
                                  || (p.productName || '').toLowerCase().includes(q)
                                  || (p.type || '').toLowerCase().includes(q);
                              })
                              .slice(0, 15)
                              .map(p => (
                                <button
                                  key={p.id}
                                  onClick={async () => {
                                    await api.customers.linkProduct(panelSource.id, p.id);
                                    refreshSupplied();
                                    setShowLinkSearch(false);
                                    setLinkSearch('');
                                    showToast(`Linked "${p.givenName || p.productName}"`, 'success');
                                  }}
                                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-tea-surface transition-colors flex items-center gap-2"
                                >
                                  <span className="text-tea-text">{p.givenName || p.productName}</span>
                                  <span className="text-ui-9 text-tea-text-sec uppercase">{p.type}</span>
                                </button>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </CollapsibleSection>

              {/* Ledger Transactions Section */}
              {(() => {
                const vendorTxs = ledgerTransactions.filter(
                  (tx) =>
                    tx.counterpartyId === panelSource.id ||
                    tx.counterpartyName.toLowerCase() === panelSource.name.toLowerCase()
                );
                const totalsByDir = vendorTxs.reduce(
                  (acc, tx) => {
                    const total = tx.items.reduce((s, i) => s + lineTotal(i), 0);
                    if (tx.direction === 'purchase') acc.purchases += total;
                    else acc.sales += total;
                    return acc;
                  },
                  { purchases: 0, sales: 0 }
                );
                return (
                  <CollapsibleSection title={`Ledger (${vendorTxs.length})`}>
                    {vendorTxs.length === 0 ? (
                      <p className="text-xs text-tea-text-dim font-serif italic">No transactions recorded yet.</p>
                    ) : (
                      <>
                        {/* Summary */}
                        <div className="flex items-center gap-4 mb-3 text-xs text-tea-text-sec">
                          {totalsByDir.purchases > 0 && (
                            <span className="flex items-center gap-1">
                              <ArrowDown size={10} className="text-tea-text-sec" />
                              {vendorTxs.filter(t => t.direction === 'purchase').length} purchase{vendorTxs.filter(t => t.direction === 'purchase').length !== 1 ? 's' : ''}
                            </span>
                          )}
                          {totalsByDir.sales > 0 && (
                            <span className="flex items-center gap-1">
                              <ArrowUp size={10} className="text-tea-text-sec" />
                              {vendorTxs.filter(t => t.direction === 'sale').length} sale{vendorTxs.filter(t => t.direction === 'sale').length !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>

                        {/* Transaction list */}
                        <div className="space-y-2">
                          {vendorTxs.slice(0, 10).map((tx) => {
                            const txTotal = tx.items.reduce((s, i) => s + lineTotal(i), 0);
                            return (
                              <div key={tx.id} className="bg-tea-bg rounded-xl border border-tea-border p-3">
                                <div className="flex items-center justify-between mb-1.5">
                                  <div className="flex items-center gap-2">
                                    {tx.direction === 'purchase' ? (
                                      <ArrowDown size={12} className="text-tea-text-sec" />
                                    ) : (
                                      <ArrowUp size={12} className="text-tea-text-sec" />
                                    )}
                                    <span className="text-ui-10 text-tea-text-sec uppercase tracking-wider">
                                      {tx.direction} · {tx.items.length} item{tx.items.length !== 1 ? 's' : ''}
                                    </span>
                                    <StatusPill variant={tx.status === 'confirmed' ? 'success' : 'active'}>
                                      {tx.status}
                                    </StatusPill>
                                  </div>
                                  <span className="text-xs text-tea-text tabular-nums font-medium">
                                    {fmtPrice(txTotal, tx.currency)}
                                  </span>
                                </div>

                                {/* Items preview */}
                                <div className="space-y-0.5">
                                  {tx.items.slice(0, 3).map((item) => (
                                    <div key={item.id} className="flex items-center justify-between text-ui-11">
                                      <span className="text-tea-text-sec truncate flex-1 mr-2">
                                        {item.chineseName || item.name}
                                        {item.type && <span className="text-tea-text-dim ml-1 uppercase text-ui-9">{item.type}</span>}
                                      </span>
                                      <span className="text-tea-text-sec tabular-nums flex-shrink-0">
                                        {item.priceIsPerGram ? `${item.quantityGrams}g` : `×${item.quantityUnits ?? 1}`}
                                      </span>
                                    </div>
                                  ))}
                                  {tx.items.length > 3 && (
                                    <div className="text-ui-10 text-tea-text-dim">+{tx.items.length - 3} more</div>
                                  )}
                                </div>

                                {/* Photos */}
                                {tx.photos && tx.photos.length > 0 && (
                                  <div className="flex gap-1.5 mt-2">
                                    {tx.photos.slice(0, 4).map((url, i) => (
                                      <img key={i} src={url} alt="" className="w-10 h-10 rounded object-cover border border-tea-border" loading="lazy" />
                                    ))}
                                    {tx.photos.length > 4 && (
                                      <div className="w-10 h-10 rounded bg-tea-surface flex items-center justify-center text-ui-10 text-tea-text-dim border border-tea-border">
                                        +{tx.photos.length - 4}
                                      </div>
                                    )}
                                  </div>
                                )}

                                <div className="text-ui-10 text-tea-text-dim mt-1.5">
                                  {new Date(tx.createdAt).toLocaleDateString()}
                                </div>
                              </div>
                            );
                          })}
                          {vendorTxs.length > 10 && (
                            <p className="text-ui-10 text-tea-text-dim text-center">+{vendorTxs.length - 10} more transactions</p>
                          )}
                        </div>
                      </>
                    )}
                  </CollapsibleSection>
                );
              })()}

              {/* Store / Tea Compass Section */}
              {(() => {
                const vendorEntries = compassEntries.filter(
                  (e) =>
                    e.vendorId === panelSource.id ||
                    (e.vendorName && e.vendorName.toLowerCase() === panelSource.name.toLowerCase())
                );
                // Get vendor details from the first entry that has them
                const vendorDetails = vendorEntries.find((e) => e.vendorDetails)?.vendorDetails;
                const totalEntries = vendorEntries.length;

                if (totalEntries === 0 && !vendorDetails) return null;

                return (
                  <CollapsibleSection title={`Store${totalEntries > 0 ? ` (${totalEntries} entries)` : ''}`}>
                    {/* Vendor details (storefront, business card, location) */}
                    {vendorDetails && (
                      <div className="space-y-3 mb-3">
                        {/* Photos row */}
                        {(vendorDetails.storefrontUrl || vendorDetails.businessCardUrl) && (
                          <div className="flex gap-2">
                            {vendorDetails.storefrontUrl && (
                              <div className="flex-1">
                                <div className="text-ui-9 text-tea-text-sec/50 uppercase tracking-wider mb-1">Storefront</div>
                                <img src={vendorDetails.storefrontUrl} alt="Storefront" className="w-full h-24 rounded-xl object-cover border border-tea-border" loading="lazy" />
                              </div>
                            )}
                            {vendorDetails.businessCardUrl && (
                              <div className="flex-1">
                                <div className="text-ui-9 text-tea-text-sec/50 uppercase tracking-wider mb-1">Business Card</div>
                                <img src={vendorDetails.businessCardUrl} alt="Business card" className="w-full h-24 rounded-xl object-cover border border-tea-border" loading="lazy" />
                              </div>
                            )}
                          </div>
                        )}

                        {/* Contact details from vendor */}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {vendorDetails.wechat && (
                            <div>
                              <div className="text-ui-9 text-tea-text-sec/50 uppercase tracking-wider">WeChat</div>
                              <div className="text-tea-text">{vendorDetails.wechat}</div>
                            </div>
                          )}
                          {vendorDetails.line && (
                            <div>
                              <div className="text-ui-9 text-tea-text-sec/50 uppercase tracking-wider">LINE</div>
                              <div className="text-tea-text">{vendorDetails.line}</div>
                            </div>
                          )}
                        </div>

                        {/* Location */}
                        {vendorDetails.lat != null && vendorDetails.lng != null && (
                          <div>
                            <div className="text-ui-9 text-tea-text-sec/50 uppercase tracking-wider mb-1">Location</div>
                            <a
                              href={`https://maps.google.com/?q=${vendorDetails.lat},${vendorDetails.lng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 text-xs text-tea-gold hover:text-tea-text transition-colors"
                            >
                              <MapPin size={12} />
                              <span className="tabular-nums">{vendorDetails.lat.toFixed(4)}, {vendorDetails.lng.toFixed(4)}</span>
                              <ExternalLink size={9} className="ml-1" />
                            </a>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Recent compass entries from this vendor */}
                    {vendorEntries.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="text-ui-9 text-tea-text-sec/50 uppercase tracking-wider">Field Notes</div>
                        {vendorEntries.slice(0, 8).map((entry) => (
                          <button
                            key={entry.id}
                            type="button"
                            onClick={() => navigate(`/admin/compass?tab=sourcing&entry=${encodeURIComponent(entry.id)}`)}
                            className="w-full flex items-center gap-2 py-1.5 text-xs rounded-md hover:bg-tea-surface/50 transition-colors text-left -mx-1 px-1"
                          >
                            {entry.photos?.[0] && (
                              <img src={entry.photos[0]} alt="" className="w-6 h-6 rounded object-cover flex-shrink-0 border border-tea-border" loading="lazy" />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="text-tea-text truncate font-serif">
                                {entry.chineseName || entry.name || 'Unnamed'}
                              </div>
                              <div className="text-ui-10 text-tea-text-dim flex items-center gap-1">
                                {entry.type && <span className="uppercase">{entry.type}</span>}
                                {entry.status === 'in_stock' && <span className="text-tea-green">in stock</span>}
                                {entry.status === 'want' && <span className="text-tea-readgold">want</span>}
                              </div>
                            </div>
                            {entry.priceAmount != null && entry.priceAmount > 0 && (
                              <span className="text-ui-10 text-tea-text-sec tabular-nums flex-shrink-0">
                                {fmtPrice(entry.priceAmount, entry.priceCurrency)}
                              </span>
                            )}
                          </button>
                        ))}
                        {vendorEntries.length > 8 && (
                          <p className="text-ui-10 text-tea-text-dim">+{vendorEntries.length - 8} more entries</p>
                        )}
                      </div>
                    )}
                  </CollapsibleSection>
                );
              })()}

              {/* ── Flavor Profile ── */}
              {(() => {
                const sourceProducts = allProducts.filter(
                  (p) => p.vendorId === panelSource.id || (p.vendor && p.vendor.toLowerCase() === panelSource.name.toLowerCase())
                );
                // Aggregate tasting terms across all products from this vendor
                const termCounts: Record<string, number> = {};
                let tastingsCount = 0;
                const moods: string[] = [];
                const liquorColors: string[] = [];

                for (const p of sourceProducts) {
                  if (p.tasting) {
                    tastingsCount++;
                    const terms = flattenTastingNotes(p.tasting);
                    for (const t of terms) {
                      termCounts[t] = (termCounts[t] || 0) + 1;
                    }
                    if (p.tasting['liquor-color']?.length) {
                      liquorColors.push(...p.tasting['liquor-color']);
                    }
                  }
                  if (p.mood) moods.push(p.mood);
                  // Also count plain tastingNotes (string array)
                  if (p.tastingNotes?.length && !p.tasting) {
                    tastingsCount++;
                    for (const n of p.tastingNotes) {
                      termCounts[n] = (termCounts[n] || 0) + 1;
                    }
                  }
                }

                // Also aggregate compass entry tastings
                const vendorCompassEntries = compassEntries.filter(
                  (e) => e.vendorId === panelSource.id || (e.vendorName && e.vendorName.toLowerCase() === panelSource.name.toLowerCase())
                );
                for (const e of vendorCompassEntries) {
                  if (e.tasting) {
                    tastingsCount++;
                    const terms = flattenTastingNotes(e.tasting);
                    for (const t of terms) {
                      termCounts[t] = (termCounts[t] || 0) + 1;
                    }
                    if (e.tasting['liquor-color']?.length) {
                      liquorColors.push(...e.tasting['liquor-color']);
                    }
                  }
                }

                const topTerms = Object.entries(termCounts)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 12);

                // Unique liquor colors
                const uniqueColors = [...new Set(liquorColors)].slice(0, 6);
                // Unique moods
                const uniqueMoods = [...new Set(moods)].slice(0, 4);

                if (tastingsCount === 0) return null;

                return (
                  <CollapsibleSection title={`Flavor Profile (${tastingsCount})`}>
                    {/* Liquor color swatches */}
                    {uniqueColors.length > 0 && (
                      <div className="flex items-center gap-2 mb-3">
                        <Palette size={11} className="text-tea-text-dim" />
                        <div className="flex gap-1">
                          {uniqueColors.map((c) => (
                            <div
                              key={c}
                              className="w-5 h-5 rounded-full border border-tea-border"
                              style={{ backgroundColor: LIQUOR_COLORS[c] || '#888' }}
                              title={resolveTermLabel(c)}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Top flavor terms */}
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {topTerms.map(([term, count]) => (
                        <span
                          key={term}
                          className="inline-flex items-center gap-1 px-2 py-0.5 text-ui-10 bg-tea-surface rounded-full text-tea-text-sec"
                          title={`Appears in ${count} tasting${count > 1 ? 's' : ''}`}
                        >
                          {resolveTermLabel(term)}
                          {count > 1 && <span className="text-tea-gold tabular-nums">{count}</span>}
                        </span>
                      ))}
                    </div>

                    {/* Moods */}
                    {uniqueMoods.length > 0 && (
                      <div className="text-ui-10 text-tea-text-dim">
                        <span className="uppercase tracking-wider text-tea-text-sec/50 mr-1.5">Moods:</span>
                        {uniqueMoods.join(' · ')}
                      </div>
                    )}
                  </CollapsibleSection>
                );
              })()}

              {/* ── Cost Intelligence ── */}
              {(() => {
                const sourceProducts = allProducts.filter(
                  (p) => p.vendorId === panelSource.id || (p.vendor && p.vendor.toLowerCase() === panelSource.name.toLowerCase())
                );
                if (sourceProducts.length === 0) return null;

                const withCost = sourceProducts.filter((p) => p.costAmount > 0);
                const totalSpend = withCost.reduce((s, p) => s + p.costAmount, 0);
                const totalGrams = withCost.reduce((s, p) => s + (p.quantityPurchased || p.stockGrams || 0), 0);
                const avgCostPerGram = totalGrams > 0 ? totalSpend / totalGrams : 0;
                // Primary cost currency (most common)
                const currCounts: Record<string, number> = {};
                for (const p of withCost) {
                  currCounts[p.costCurrency] = (currCounts[p.costCurrency] || 0) + 1;
                }
                const primaryCurrency = Object.entries(currCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'USD';

                // Value ranking (cheapest cost/gram products)
                const valueRanked = [...withCost]
                  .filter((p) => p.costPerGramUSD > 0)
                  .sort((a, b) => a.costPerGramUSD - b.costPerGramUSD);

                // Type breakdown
                const typeBreakdown: Record<string, { count: number; totalCost: number }> = {};
                for (const p of sourceProducts) {
                  if (!typeBreakdown[p.type]) typeBreakdown[p.type] = { count: 0, totalCost: 0 };
                  typeBreakdown[p.type].count++;
                  typeBreakdown[p.type].totalCost += p.costAmount || 0;
                }

                return (
                  <CollapsibleSection title="Cost Intelligence">
                    {/* Summary stats */}
                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <div>
                        <div className="text-ui-9 text-tea-text-sec/50 uppercase tracking-wider">Total Spend</div>
                        <div className="text-sm text-tea-text tabular-nums font-medium">
                          {fmtPrice(totalSpend, primaryCurrency)}
                        </div>
                      </div>
                      <div>
                        <div className="text-ui-9 text-tea-text-sec/50 uppercase tracking-wider">Avg / Gram</div>
                        <div className="text-sm text-tea-text tabular-nums font-medium">
                          {avgCostPerGram > 0 ? fmtPrice(avgCostPerGram, primaryCurrency) : '—'}
                        </div>
                      </div>
                      <div>
                        <div className="text-ui-9 text-tea-text-sec/50 uppercase tracking-wider">Total Stock</div>
                        <div className="text-sm text-tea-text tabular-nums font-medium">
                          {totalGrams > 0 ? `${totalGrams.toLocaleString()}g` : '—'}
                        </div>
                      </div>
                    </div>

                    {/* Type breakdown */}
                    <div className="space-y-1 mb-3">
                      {Object.entries(typeBreakdown)
                        .sort((a, b) => b[1].count - a[1].count)
                        .map(([type, data]) => (
                          <div key={type} className="flex items-center justify-between text-ui-11">
                            <span className="text-tea-text-sec uppercase tracking-wider">{type}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-tea-text tabular-nums">{data.count}</span>
                              {data.totalCost > 0 && (
                                <span className="text-tea-text-dim tabular-nums">{fmtPrice(data.totalCost, primaryCurrency)}</span>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>

                    {/* Best value */}
                    {valueRanked.length > 0 && (
                      <div>
                        <div className="text-ui-9 text-tea-text-sec/50 uppercase tracking-wider mb-1.5">Best Value</div>
                        {valueRanked.slice(0, 3).map((p) => (
                          <div key={p.id} className="flex items-center justify-between text-ui-11 py-0.5">
                            <button
                              onClick={() => navigate(`/admin/stock?panel=${encodeURIComponent(p.id)}`)}
                              className="text-tea-text hover:text-tea-gold transition-colors truncate flex-1 mr-2 text-left"
                            >
                              {p.givenName || p.productName}
                            </button>
                            <span className="text-tea-gold tabular-nums flex-shrink-0">
                              ${p.costPerGramUSD.toFixed(2)}/g
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CollapsibleSection>
                );
              })()}

              {/* ── Not Yet Acquired ── */}
              {(() => {
                const pipeline = compassEntries.filter(
                  (e) =>
                    (e.vendorId === panelSource.id || (e.vendorName && e.vendorName.toLowerCase() === panelSource.name.toLowerCase())) &&
                    (e.status === 'noted' || e.status === 'want')
                );
                if (pipeline.length === 0) return null;

                const wants = pipeline.filter((e) => e.status === 'want');
                const logged = pipeline.filter((e) => e.status === 'noted');

                return (
                  <CollapsibleSection title={`Pipeline (${pipeline.length})`}>
                    {wants.length > 0 && (
                      <div className="mb-2">
                        <div className="text-ui-9 text-tea-readgold/70 uppercase tracking-wider mb-1 flex items-center gap-1">
                          <Star size={9} /> Want List
                        </div>
                        {wants.map((e) => (
                          <div key={e.id} className="flex items-center gap-2 py-1 text-xs">
                            {e.photos?.[0] && (
                              <img src={e.photos[0]} alt="" className="w-5 h-5 rounded object-cover flex-shrink-0 border border-tea-border" loading="lazy" />
                            )}
                            <div className="flex-1 min-w-0">
                              <span className="text-tea-text font-serif truncate block">{e.chineseName || e.name || 'Unnamed'}</span>
                            </div>
                            {e.priceAmount != null && e.priceAmount > 0 && (
                              <span className="text-ui-10 text-tea-text-sec tabular-nums">{fmtPrice(e.priceAmount, e.priceCurrency)}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {logged.length > 0 && (
                      <div>
                        <div className="text-ui-9 text-tea-text-sec/50 uppercase tracking-wider mb-1 flex items-center gap-1">
                          <Eye size={9} /> Sampled / Noted
                        </div>
                        {logged.map((e) => (
                          <div key={e.id} className="flex items-center gap-2 py-1 text-xs">
                            {e.photos?.[0] && (
                              <img src={e.photos[0]} alt="" className="w-5 h-5 rounded object-cover flex-shrink-0 border border-tea-border" loading="lazy" />
                            )}
                            <div className="flex-1 min-w-0">
                              <span className="text-tea-text font-serif truncate block">{e.chineseName || e.name || 'Unnamed'}</span>
                            </div>
                            {e.type && <span className="text-ui-9 text-tea-text-dim uppercase">{e.type}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </CollapsibleSection>
                );
              })()}

              {/* ── Relationship Timeline ── */}
              {(() => {
                const events: { date: string; type: 'compass' | 'ledger' | 'product' | 'sale'; label: string; detail?: string; id?: string }[] = [];

                // Compass entries
                const vendorCompass = compassEntries.filter(
                  (e) => e.vendorId === panelSource.id || (e.vendorName && e.vendorName.toLowerCase() === panelSource.name.toLowerCase())
                );
                for (const e of vendorCompass) {
                  const statusLabel = e.status === 'in_stock' ? 'Purchased' : e.status === 'want' ? 'Wishlisted' : 'Noted';
                  events.push({
                    date: e.createdAt,
                    type: 'compass',
                    label: `${statusLabel}: ${e.chineseName || e.name || 'tea'}`,
                    detail: e.type ? `${e.type}${e.originRegion ? ` · ${e.originRegion}` : ''}` : undefined,
                  });
                }

                // Ledger transactions
                const vendorTxs = ledgerTransactions.filter(
                  (tx) => tx.counterpartyId === panelSource.id || tx.counterpartyName.toLowerCase() === panelSource.name.toLowerCase()
                );
                for (const tx of vendorTxs) {
                  const itemCount = tx.items.length;
                  events.push({
                    date: tx.createdAt,
                    type: 'ledger',
                    label: `${tx.direction === 'purchase' ? 'Bought' : 'Sold'} ${itemCount} item${itemCount !== 1 ? 's' : ''}`,
                    detail: tx.status === 'draft' ? 'Draft' : undefined,
                  });
                }

                // Products added from this vendor
                const sourceProducts = allProducts.filter(
                  (p) => p.vendorId === panelSource.id || (p.vendor && p.vendor.toLowerCase() === panelSource.name.toLowerCase())
                );
                // We don't have createdAt on products client-side, so use a fallback
                for (const p of sourceProducts) {
                  events.push({
                    date: '', // no date available — will sort to end
                    type: 'product',
                    label: `Added to inventory: ${p.givenName || p.productName}`,
                    detail: `${p.type} · ${p.status}`,
                    id: p.id,
                  });
                }

                // Sort by date descending, undated items last
                events.sort((a, b) => {
                  if (!a.date && !b.date) return 0;
                  if (!a.date) return 1;
                  if (!b.date) return -1;
                  return new Date(b.date).getTime() - new Date(a.date).getTime();
                });

                if (events.length === 0) return null;

                const typeColors: Record<string, string> = {
                  compass: 'bg-tea-text-sec',
                  ledger: 'bg-tea-readgold',
                  product: 'bg-tea-green',
                  sale: 'bg-tea-gold',
                };

                return (
                  <CollapsibleSection title={`Timeline (${events.length})`}>
                    <div className="relative pl-4">
                      {/* Vertical line */}
                      <div className="absolute left-[5px] top-1 bottom-1 w-px bg-tea-border" />

                      <div className="space-y-2.5">
                        {events.slice(0, 15).map((evt, i) => (
                          <div key={i} className="relative flex items-start gap-2.5">
                            {/* Dot */}
                            <div className={`absolute -left-4 top-1 w-[10px] h-[10px] rounded-full border-2 border-tea-bg ${typeColors[evt.type]}`} />
                            <div className="flex-1 min-w-0">
                              <div className="text-ui-11 text-tea-text leading-tight">
                                {evt.id ? (
                                  <button
                                    onClick={() => navigate(`/admin/stock?panel=${encodeURIComponent(evt.id!)}`)}
                                    className="hover:text-tea-gold transition-colors text-left"
                                  >
                                    {evt.label}
                                  </button>
                                ) : evt.label}
                              </div>
                              <div className="flex items-center gap-2 text-ui-9 text-tea-text-dim mt-0.5">
                                {evt.date && <span>{new Date(evt.date).toLocaleDateString()}</span>}
                                {evt.detail && <span>{evt.detail}</span>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {events.length > 15 && (
                        <p className="text-ui-10 text-tea-text-dim mt-2 pl-1">+{events.length - 15} more events</p>
                      )}
                    </div>
                  </CollapsibleSection>
                );
              })()}
            </div>

            {/* Panel Footer — destructive secondary left, primary right (§ button rules) */}
            <div className="px-5 py-3 border-t border-tea-border bg-tea-surface flex items-center justify-between flex-shrink-0">
              <button
                onClick={() => handleDelete(panelSource)}
                className="inline-flex items-center gap-1.5 px-2 py-1 text-xs text-tea-text-sec hover:text-tea-error transition-colors"
              >
                <Trash2 size={13} /> <span>Delete</span>
              </button>
              <button
                onClick={() => { setEditingSource(panelSource); setIsModalOpen(true); }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 transition-colors"
              >
                <Edit3 size={13} /> <span>Full Edit</span>
              </button>
            </div>
          </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* Modal */}
      <SourceModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingSource(null); }}
        onSave={handleSave}
        initialData={editingSource ? {
          name: editingSource.name,
          company: editingSource.company || '',
          country: editingSource.country || '',
          notes: editingSource.notes || '',
          phone: editingSource.phone || '',
          whatsapp: editingSource.whatsapp || '',
          email: editingSource.email || '',
        } : undefined}
        isEditing={!!editingSource}
      />

      <ConfirmModal
        isOpen={!!pendingDeleteSource}
        onClose={() => setPendingDeleteSource(null)}
        onConfirm={handleConfirmDelete}
        title="Delete source?"
        description={`"${pendingDeleteSource?.name}" will be removed. Products will keep the vendor name but the link will be removed.`}
        confirmLabel="Delete"
        variant="destructive"
        isLoading={deleteLoading}
      />
    </div>
  );
};
