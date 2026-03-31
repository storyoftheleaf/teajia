import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Plus, Trash2, Edit3, Loader2, ChevronDown, ChevronUp,
  ChevronRight, Leaf, MapPin, ArrowUpDown, ArrowUp, ArrowDown,
  ExternalLink, X as XIcon, Pencil, Check, Columns, Layers,
  MoreHorizontal, Save, Download, Square, CheckSquare, Users
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

  const inputStyle = "w-full bg-transparent border-b border-tea-border px-0 py-2 text-sm text-tea-text outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg focus:border-tea-accent transition-colors placeholder-tea-text-sec/50";

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-tea-text/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <form onSubmit={handleSubmit} className="bg-tea-bg border border-tea-border rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex justify-between items-center p-6 border-b border-tea-border">
          <h3 className="text-lg font-serif text-tea-text">{isEditing ? 'Edit Source' : 'New Source'}</h3>
          <button type="button" onClick={onClose} className="text-tea-text-sec hover:text-tea-text"><XIcon size={20} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-tea-gold/70 font-bold mb-1">Name *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputStyle} placeholder="Vendor name" autoFocus />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-tea-gold/70 font-bold mb-1">Company</label>
            <input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} className={inputStyle} placeholder="Company or shop name" />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-tea-gold/70 font-bold mb-1">Country</label>
            <input value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} className={inputStyle} placeholder="Country of origin" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-tea-gold/70 font-bold mb-1">Phone</label>
              <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className={inputStyle} placeholder="Phone" />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-tea-gold/70 font-bold mb-1">WhatsApp</label>
              <input value={form.whatsapp} onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))} className={inputStyle} placeholder="WhatsApp" />
            </div>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-tea-gold/70 font-bold mb-1">Email</label>
            <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={inputStyle} placeholder="Email" />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-tea-gold/70 font-bold mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className={`${inputStyle} min-h-[60px] resize-none`} placeholder="Notes about this source..." />
          </div>
        </div>
        <div className="flex justify-end gap-3 p-6 border-t border-tea-border">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-tea-text-sec hover:text-tea-text transition-colors">Cancel</button>
          <button type="submit" disabled={saving || !form.name.trim()} className="px-5 py-2 bg-tea-gold text-tea-bg text-sm font-medium rounded-lg hover:bg-tea-gold/90 transition-colors disabled:opacity-50">
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
      className={`w-full bg-transparent border-b border-transparent [@media(hover:none)]:border-dotted [@media(hover:none)]:border-tea-accent-sub focus:border-tea-accent-sub focus:border-solid focus:bg-tea-gold/[0.06] rounded-none py-0 px-0 outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg transition-all text-${align} placeholder-tea-text-dim/70 leading-none ${className}`}
    />
  );
};

// --- COLLAPSIBLE SECTION ---
const CollapsibleSection = ({ title, defaultOpen = true, children }: {
  title: string, defaultOpen?: boolean, children: React.ReactNode
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mx-3 mb-2 rounded-lg bg-tea-surface">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-4 py-3 group">
        <span className="text-[12px] text-tea-gold uppercase tracking-[0.15em] font-bold">{title}</span>
        <ChevronRight size={14} className={`text-tea-text-dim transition-transform duration-200 ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
};

// --- SOURCE WITH TEA COUNT ---
interface SourceRow extends Customer {
  teaCount: number;
}

export const SourcesView = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { data: customers = [], isLoading, refetch } = useCustomers();
  const { data: allProducts = [] } = useProducts();
  const { data: rates = [] } = useRates();
  const { currency } = useAppStore();

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
      showToast('Error: ' + err.message, 'error');
    }
  };

  const handleDelete = async (source: Customer) => {
    if (!confirm(`Delete source "${source.name}"?\n\nProducts will keep the vendor name but the link will be removed.`)) return;
    try {
      await api.customers.delete(source.id);
      showToast('Source deleted', 'success');
      setPanelSource(null);
      refetch();
    } catch (err: any) {
      showToast('Error: ' + err.message, 'error');
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
      showToast(`Update failed: ${err.message}`, 'error');
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

  // --- RENDER CELL ---
  const renderCell = (source: SourceRow, colKey: string) => {
    switch (colKey) {
      case 'name':
        return (
          <td className="px-4 align-middle overflow-hidden">
            <div className="flex flex-col justify-center h-full">
              {isEditMode ? (
                <GhostInput
                  value={source.name}
                  onSave={(val) => handleSourceUpdate(source.id, 'name', val)}
                  className="font-serif text-sm text-tea-text tracking-wide truncate"
                />
              ) : (
                <span className="text-sm font-serif text-tea-text tracking-wide group-hover:text-tea-accent transition-colors truncate">
                  {source.name}
                </span>
              )}
            </div>
          </td>
        );
      case 'company':
        return (
          <td className="px-4 align-middle overflow-hidden">
            {isEditMode ? (
              <GhostInput value={source.company || ''} onSave={(val) => handleSourceUpdate(source.id, 'company', val)} className="font-sans text-xs text-tea-text-sec truncate" placeholder="Company" />
            ) : <span className="text-xs text-tea-text-sec font-sans truncate block">{source.company || '—'}</span>}
          </td>
        );
      case 'country':
        return (
          <td className="px-4 align-middle overflow-hidden">
            {isEditMode ? (
              <GhostInput value={source.country || ''} onSave={(val) => handleSourceUpdate(source.id, 'country', val)} className="font-sans text-xs text-tea-text-sec truncate" placeholder="Country" />
            ) : (
              source.country ? (
                <span className="text-xs text-tea-text-sec flex items-center gap-1 truncate"><MapPin size={10} className="flex-shrink-0" /> {source.country}</span>
              ) : (
                <span className="text-xs text-tea-text-dim">—</span>
              )
            )}
          </td>
        );
      case 'contact':
        return (
          <td className="px-4 align-middle overflow-hidden">
            <div className="flex items-center gap-2 text-xs text-tea-text-sec truncate">
              {source.email && <span className="truncate">{source.email}</span>}
              {!source.email && source.phone && <span>{source.phone}</span>}
              {!source.email && !source.phone && source.whatsapp && <span>WA: {source.whatsapp}</span>}
              {!source.email && !source.phone && !source.whatsapp && <span className="text-tea-text-dim">—</span>}
            </div>
          </td>
        );
      case 'teaCount':
        return (
          <td className="px-4 align-middle overflow-hidden text-center">
            <span className={`inline-flex items-center gap-1 text-xs font-medium ${source.teaCount > 0 ? 'text-tea-gold' : 'text-tea-text-dim'}`}>
              <Leaf size={11} /> {source.teaCount}
            </span>
          </td>
        );
      case 'created':
        return (
          <td className="px-4 align-middle overflow-hidden">
            <span className="text-xs text-tea-text-sec font-sans tabular-nums">
              {source.createdAt ? new Date(source.createdAt).toLocaleDateString() : '—'}
            </span>
          </td>
        );
      default:
        return <td className="px-4 align-middle text-xs text-tea-text-sec">—</td>;
    }
  };

  // --- ROW COMPONENT ---
  const renderRow = (source: SourceRow) => {
    const isExpanded = expandedSourceId === source.id;
    return (
    <React.Fragment key={source.id}>
    <tr
      className={`transition-colors border-b border-tea-border group ${isEditMode ? '' : 'hover:bg-tea-bg/50 cursor-pointer'} ${isExpanded ? 'bg-tea-accent/5' : ''} ${panelSource?.id === source.id ? 'bg-tea-accent/5' : ''}`}
      style={{ height: ROW_HEIGHT }}
      onClick={() => !isEditMode && setExpandedSourceId(isExpanded ? null : source.id)}
    >
      {visibleCols.map(col => renderCell(source, col.key))}
      <td className="px-2 align-middle text-right">
        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
          {!isEditMode && (
            <>
              <button
                onClick={() => { setEditingSource(source); setIsModalOpen(true); }}
                className="text-tea-text-sec hover:text-tea-text p-1 transition-colors"
                title="Edit"
              ><Pencil size={13} /></button>
              <button
                onClick={() => handleDelete(source)}
                className="text-tea-text-sec hover:text-red-400 p-1 transition-colors"
                title="Delete"
              ><Trash2 size={13} /></button>
            </>
          )}
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
                  <Leaf size={16} className="text-tea-accent" />
                  <h2 className="text-sm font-serif text-tea-text uppercase tracking-[0.15em]">
                    {source.name}
                  </h2>
                  <span className="text-tea-text-sec text-xs tracking-wide">
                    — {getSourceProducts(source.name).length} teas supplied
                  </span>
                </div>
              }
              onEdit={(product) => {
                navigate(`/admin/inventory?panel=${encodeURIComponent(product.id)}`);
              }}
            />
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

      {/* --- SAVED VIEWS TAB BAR (desktop only — mobile uses options menu) --- */}
      <div className="hidden md:flex items-center gap-1 px-6 py-1.5 border-b border-tea-border bg-tea-bg overflow-x-auto hide-scrollbar flex-shrink-0">
        {savedViews.map(view => (
          <button
            key={view.id}
            onClick={() => {
              setActiveViewId(view.id);
              setVisibleColumns(view.columns);
              setSortConfig(view.sortConfig);
              setGroupBy(view.groupBy);
            }}
            className={`flex items-center gap-1.5 px-3 py-1 text-[10px] uppercase tracking-[0.15em] rounded-md whitespace-nowrap transition-colors ${
              activeViewId === view.id
                ? 'bg-tea-accent/15 text-tea-accent border border-tea-accent-sub'
                : 'text-tea-text-sec hover:text-tea-text hover:bg-tea-surface border border-transparent'
            }`}
          >
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
        ))}
        <div className="w-px h-4 bg-tea-border/30 mx-1" />
        {showSaveViewPrompt ? (
          <div className="flex items-center gap-1">
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
              className="bg-transparent border-b border-tea-border text-[10px] text-tea-text outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg w-24 py-0.5 px-1"
            />
            <button onClick={() => { setShowSaveViewPrompt(false); setNewViewName(''); }} className="text-tea-text-sec/40 hover:text-tea-text-sec"><XIcon size={10} /></button>
          </div>
        ) : (
          <button
            onClick={() => setShowSaveViewPrompt(true)}
            className="flex items-center gap-1 px-2 py-1 text-[10px] text-tea-text-sec/50 hover:text-tea-text-sec uppercase tracking-[0.15em] transition-colors"
          >
            <Save size={10} /> Save View
          </button>
        )}
      </div>

      {/* --- MOBILE CONTROL BAR --- */}
      <div className={`md:hidden sticky top-0 z-30 transition-colors flex-shrink-0 ${isEditMode ? 'bg-tea-surface/95' : 'bg-tea-bg/95 backdrop-blur-md'}`}>
        <div className="flex items-center px-2 py-1.5 gap-1">
          <Users size={14} className="text-tea-accent shrink-0 ml-1" />
          <span className="text-[11px] text-tea-text-sec uppercase tracking-[0.08em] shrink-0">
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
              className="w-full bg-transparent border-b border-tea-border rounded-none pl-8 pr-3 py-1.5 text-xs text-tea-text outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg focus:border-tea-text-sec font-serif placeholder-tea-text-sec/50 transition-colors"
            />
          </div>

          {/* Sort */}
          <div className="relative">
            <button
              onClick={() => { setShowMobileSort(!showMobileSort); setShowOptions(false); }}
              className={`w-9 h-9 flex items-center justify-center transition-colors rounded-md ${showMobileSort ? 'text-tea-accent' : 'text-tea-text-dim hover:text-tea-text-sec'}`}
            >
              <ArrowUpDown size={15} />
            </button>
            {showMobileSort && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMobileSort(false)} />
                <div className="absolute right-0 top-9 w-40 bg-tea-surface border border-tea-border shadow-2xl rounded-xl z-50 py-1" role="menu">
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
                        className={`w-full px-3 py-2 text-left text-[11px] flex items-center gap-2 hover:bg-tea-bg transition-colors ${isActive ? 'text-tea-accent' : 'text-tea-text-sec'}`}
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
              className={`w-9 h-9 flex items-center justify-center transition-colors rounded-md ${showOptions ? 'text-tea-accent' : 'text-tea-text-dim hover:text-tea-text-sec'}`}
            >
              <MoreHorizontal size={15} />
            </button>
            {showOptions && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowOptions(false)} />
                <div className="absolute right-0 top-9 w-48 bg-tea-surface border border-tea-border shadow-2xl rounded-xl z-50 py-1 max-h-[calc(100dvh-100px)] overflow-y-auto">
                  {/* Saved views */}
                  <div className="px-3 py-1.5 text-[9px] text-tea-text-sec/60 uppercase tracking-[0.2em]">Views</div>
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
                      className={`w-full px-3 py-2 text-left text-[11px] flex items-center gap-2 hover:bg-tea-bg transition-colors ${activeViewId === view.id ? 'text-tea-accent' : 'text-tea-text-sec'}`}
                    >
                      {view.name}
                      {activeViewId === view.id && <Check size={11} className="ml-auto" />}
                    </button>
                  ))}
                  <div className="h-px bg-tea-border/30 my-1" />
                  <button onClick={() => { setEditingSource(null); setIsModalOpen(true); setShowOptions(false); }} className="w-full px-3 py-2 text-left text-[11px] flex items-center gap-2 hover:bg-tea-bg text-tea-text-sec transition-colors">
                    <Plus size={13} /> New Source
                  </button>
                  <button onClick={() => { setIsEditMode(!isEditMode); setShowOptions(false); }} className="w-full px-3 py-2 text-left text-[11px] flex items-center gap-2 hover:bg-tea-bg text-tea-text-sec transition-colors">
                    {isEditMode ? <Check size={13} /> : <Pencil size={13} />}
                    {isEditMode ? 'Done Editing' : 'Edit Mode'}
                  </button>
                  <button onClick={() => { handleExport(); setShowOptions(false); }} className="w-full px-3 py-2 text-left text-[11px] flex items-center gap-2 hover:bg-tea-bg text-tea-text-sec transition-colors">
                    <Download size={13} /> Export CSV
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* --- DESKTOP HEADER CONTROLS --- */}
      <div className={`hidden md:block sticky top-0 z-30 border-b border-tea-border py-2.5 transition-colors flex-shrink-0 ${isEditMode ? 'bg-tea-surface/95 border-b-tea-accent/20' : 'bg-tea-bg/90 backdrop-blur-md'}`}>
        <div className="px-6 max-w-7xl mx-auto flex items-center gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <Users size={16} className={isEditMode ? "text-tea-text-sec" : "text-tea-accent"} />
            <h2 className="text-sm font-serif text-tea-text uppercase tracking-[0.15em]">
              {isEditMode ? 'Editing' : 'Sources'}
            </h2>
            <span className="text-tea-text-sec text-xs tracking-wide">
              {isEditMode ? '— click cells to edit' : `— ${processedSources.length} vendor${processedSources.length !== 1 ? 's' : ''}`}
            </span>
          </div>

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

              <button
                onClick={() => { setEditingSource(null); setIsModalOpen(true); }}
                className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] font-bold text-tea-text-sec hover:text-tea-text transition-colors px-3 py-1.5 border border-transparent hover:border-tea-border rounded-lg"
              >
                <Plus size={14} /> New
              </button>

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
                      {SOURCE_COLUMN_DEFS.map(col => (
                        <label key={col.key} className={`flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-tea-bg transition-colors cursor-pointer ${'alwaysVisible' in col && col.alwaysVisible ? 'opacity-50 cursor-not-allowed' : ''}`}>
                          <input
                            type="checkbox"
                            checked={visibleColumns.includes(col.key)}
                            onChange={() => !('alwaysVisible' in col && col.alwaysVisible) && toggleColumn(col.key)}
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
                  onClick={() => {
                    const el = document.getElementById('sources-groupby-dropdown');
                    if (el) el.classList.toggle('hidden');
                  }}
                  className={`flex items-center gap-1 p-1.5 rounded-lg text-xs transition-colors ${groupBy ? 'text-tea-accent bg-tea-surface' : 'text-tea-text-sec hover:text-tea-text hover:bg-tea-surface'}`}
                  title="Group By"
                >
                  <Layers size={15} />
                </button>
                <div id="sources-groupby-dropdown" className="hidden absolute right-0 top-full mt-2 w-40 bg-tea-surface border border-tea-border shadow-xl rounded-xl z-50 py-1">
                  {GROUPBY_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        setGroupBy(opt.value || null);
                        document.getElementById('sources-groupby-dropdown')?.classList.add('hidden');
                      }}
                      className={`w-full px-3 py-1.5 text-left text-xs hover:bg-tea-bg transition-colors ${(groupBy || '') === opt.value ? 'text-tea-accent' : 'text-tea-text-sec'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
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

        {/* MOBILE CARDS */}
        <div className="md:hidden pb-24">
          {processedSources.map((source, idx) => {
            const isExpanded = expandedCardId === source.id;
            return (
              <div key={source.id}>
                <button
                  className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors active:bg-tea-surface/80 ${isExpanded ? 'bg-tea-surface/60' : idx % 2 === 0 ? 'bg-transparent' : 'bg-tea-surface/20'}`}
                  onClick={() => setExpandedCardId(isExpanded ? null : source.id)}
                >
                  {/* Name + company */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-tea-text text-sm font-serif truncate">{source.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-tea-text-sec/70 mt-0.5">
                      {source.company && <span className="truncate">{source.company}</span>}
                      {source.company && source.country && <span className="opacity-40">·</span>}
                      {source.country && (
                        <span className="flex items-center gap-0.5"><MapPin size={8} /> {source.country}</span>
                      )}
                    </div>
                  </div>

                  {/* Tea count */}
                  <div className="flex-shrink-0 text-right">
                    <div className={`text-xs tabular-nums flex items-center gap-1 ${source.teaCount > 0 ? 'text-tea-gold' : 'text-tea-text-dim'}`}>
                      <Leaf size={10} /> {source.teaCount}
                    </div>
                  </div>

                  <ChevronDown size={14} className={`flex-shrink-0 text-tea-text-sec/30 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                </button>

                {/* Expanded detail panel */}
                {isExpanded && (
                  <div className="bg-tea-surface/40 px-4 pb-3 pt-1 border-b border-tea-border">
                    <div className="grid grid-cols-3 gap-x-4 gap-y-2 py-2">
                      {source.company && (
                        <div>
                          <div className="text-[9px] text-tea-text-sec/50 uppercase tracking-wider">Company</div>
                          <div className="text-sm text-tea-text">{source.company}</div>
                        </div>
                      )}
                      {source.country && (
                        <div>
                          <div className="text-[9px] text-tea-text-sec/50 uppercase tracking-wider">Country</div>
                          <div className="text-sm text-tea-text">{source.country}</div>
                        </div>
                      )}
                      <div>
                        <div className="text-[9px] text-tea-text-sec/50 uppercase tracking-wider">Teas</div>
                        <div className="text-sm text-tea-text tabular-nums">{source.teaCount}</div>
                      </div>
                      {source.email && (
                        <div className="col-span-2">
                          <div className="text-[9px] text-tea-text-sec/50 uppercase tracking-wider">Email</div>
                          <div className="text-sm text-tea-text truncate">{source.email}</div>
                        </div>
                      )}
                      {source.phone && (
                        <div>
                          <div className="text-[9px] text-tea-text-sec/50 uppercase tracking-wider">Phone</div>
                          <div className="text-sm text-tea-text">{source.phone}</div>
                        </div>
                      )}
                    </div>

                    {source.notes && (
                      <p className="text-xs text-tea-text-sec/70 font-serif italic leading-relaxed mt-1 mb-2">{source.notes}</p>
                    )}

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-tea-border">
                      <div className="ml-auto flex items-center gap-2">
                        <button
                          onClick={() => { setEditingSource(source); setIsModalOpen(true); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] uppercase tracking-[0.15em] text-tea-text-sec hover:text-tea-text bg-tea-bg/60 hover:bg-tea-bg rounded-md transition-colors"
                        >
                          <Pencil size={12} /> Edit
                        </button>
                        <button
                          onClick={() => handleDelete(source)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] uppercase tracking-[0.15em] text-tea-text-sec hover:text-red-400 bg-tea-bg/60 hover:bg-tea-bg rounded-md transition-colors"
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
                            navigate(`/admin/inventory?panel=${encodeURIComponent(product.id)}`);
                          }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {processedSources.length === 0 && (
            <div className="text-center py-16 text-tea-text-sec font-serif italic">
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
                  <col className="w-[10%]" />
                </colgroup>
                <thead className="sticky top-0 z-20 bg-tea-bg shadow-sm">
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
                      <span className="text-[10px] text-tea-text-sec uppercase tracking-[0.15em]">{items.length} source{items.length !== 1 ? 's' : ''}</span>
                      <span className="text-[10px] text-tea-text-sec tabular-nums ml-auto">{totalTeas} tea{totalTeas !== 1 ? 's' : ''} total</span>
                    </button>
                    {!isCollapsed && (
                      <table className="w-full table-fixed border-collapse">
                        <colgroup>
                          {visibleCols.map(col => <col key={col.key} className={col.defaultWidth} />)}
                          <col className="w-[10%]" />
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
                <col className="w-[10%]" />
              </colgroup>

              <thead className="sticky top-0 z-20 bg-tea-bg shadow-sm">
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

      {/* --- SIDE PANEL --- */}
      <AnimatePresence>
        {panelSource && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed inset-0 md:inset-auto md:right-0 md:top-0 md:bottom-0 md:w-[420px] z-50 bg-tea-bg flex flex-col"
            style={{ boxShadow: '-12px 0 40px -8px rgba(0,0,0,0.35), inset 1px 0 0 var(--tea-accent-sub)' }}
          >
            {/* Panel Header */}
            <div className="flex items-center gap-3 px-5 py-3 border-b border-tea-accent-sub bg-tea-surface/30">
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-serif text-tea-text truncate">{panelSource.name}</h3>
                <span className="text-[10px] text-tea-text-dim">
                  {panelSource.company || 'Vendor'}{panelSource.country ? ` · ${panelSource.country}` : ''}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    const idx = processedSources.findIndex(s => s.id === panelSource.id);
                    if (idx > 0) setPanelSource(processedSources[idx - 1]);
                  }}
                  className="p-1 text-tea-text-sec hover:text-tea-text transition-colors"
                  title="Previous"
                ><ChevronUp size={16} /></button>
                <button
                  onClick={() => {
                    const idx = processedSources.findIndex(s => s.id === panelSource.id);
                    if (idx < processedSources.length - 1) setPanelSource(processedSources[idx + 1]);
                  }}
                  className="p-1 text-tea-text-sec hover:text-tea-text transition-colors"
                  title="Next"
                ><ChevronDown size={16} /></button>
                <button onClick={() => setPanelSource(null)} className="p-1 text-tea-text-sec hover:text-tea-text transition-colors ml-1"><XIcon size={16} /></button>
              </div>
            </div>

            {/* Panel Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar py-3 space-y-1">

              {/* Details Section */}
              <CollapsibleSection title="Details">
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] text-tea-text-sec uppercase tracking-[0.15em] block mb-1">Name</label>
                    <GhostInput
                      value={panelSource.name}
                      onSave={(val) => handleSourceUpdate(panelSource.id, 'name', val)}
                      className="text-sm text-tea-text font-serif"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-tea-text-sec uppercase tracking-[0.15em] block mb-1">Company</label>
                    <GhostInput
                      value={panelSource.company || ''}
                      onSave={(val) => handleSourceUpdate(panelSource.id, 'company', val)}
                      className="text-xs text-tea-text"
                      placeholder="Company or shop name"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-tea-text-sec uppercase tracking-[0.15em] block mb-1">Country</label>
                    <GhostInput
                      value={panelSource.country || ''}
                      onSave={(val) => handleSourceUpdate(panelSource.id, 'country', val)}
                      className="text-xs text-tea-text"
                      placeholder="Country"
                    />
                  </div>
                  {panelSource.notes && (
                    <div>
                      <label className="text-[10px] text-tea-text-sec uppercase tracking-[0.15em] block mb-1">Notes</label>
                      <p className="text-xs text-tea-text-sec/70 font-serif italic leading-relaxed whitespace-pre-line">{panelSource.notes}</p>
                    </div>
                  )}
                </div>
              </CollapsibleSection>

              {/* Contact Section */}
              <CollapsibleSection title="Contact">
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] text-tea-text-sec uppercase tracking-[0.15em] block mb-1">Email</label>
                    <GhostInput
                      value={panelSource.email || ''}
                      onSave={(val) => handleSourceUpdate(panelSource.id, 'email', val)}
                      className="text-xs text-tea-text"
                      placeholder="email@example.com"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] text-tea-text-sec uppercase tracking-[0.15em] block mb-1">Phone</label>
                      <GhostInput
                        value={panelSource.phone || ''}
                        onSave={(val) => handleSourceUpdate(panelSource.id, 'phone', val)}
                        className="text-xs text-tea-text"
                        placeholder="Phone"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-tea-text-sec uppercase tracking-[0.15em] block mb-1">WhatsApp</label>
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
                      <div className="bg-tea-bg rounded-lg border border-tea-border overflow-hidden mb-3">
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
                                    onClick={() => navigate(`/admin/inventory?panel=${encodeURIComponent(p.id)}`)}
                                    className="text-tea-text hover:text-tea-accent transition-colors flex items-center gap-1.5"
                                  >
                                    {p.image_url && <img src={p.image_url} alt="" className="w-5 h-5 rounded object-cover flex-shrink-0" />}
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
                                    className="text-tea-text-sec hover:text-red-400 transition-colors"
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
                          className="flex items-center gap-1.5 text-xs text-tea-text-sec hover:text-tea-accent transition-colors"
                        >
                          <Plus size={12} /> Link a tea
                        </button>
                      ) : (
                        <div className="bg-tea-bg border border-tea-border rounded-lg shadow-lg overflow-hidden max-w-sm">
                          <div className="p-2 border-b border-tea-border flex items-center gap-2">
                            <Search size={12} className="text-tea-text-sec" />
                            <input
                              type="text"
                              placeholder="Search teas..."
                              value={linkSearch}
                              onChange={e => setLinkSearch(e.target.value)}
                              className="flex-1 bg-transparent text-xs text-tea-text outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg"
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
                                  <span className="text-[9px] text-tea-text-sec uppercase">{p.type}</span>
                                </button>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </CollapsibleSection>
            </div>

            {/* Panel Footer */}
            <div className="px-5 py-3 border-t border-tea-accent-sub bg-tea-surface/30 flex items-center justify-between">
              <button
                onClick={() => { setEditingSource(panelSource); setIsModalOpen(true); }}
                className="flex items-center gap-1.5 text-[10px] text-tea-text-sec hover:text-tea-text uppercase tracking-[0.2em] transition-colors"
              >
                <Edit3 size={11} /> Full Edit
              </button>
              <button
                onClick={() => handleDelete(panelSource)}
                className="flex items-center gap-1.5 text-[10px] text-tea-text-sec hover:text-red-400 uppercase tracking-[0.2em] transition-colors"
              >
                <Trash2 size={11} /> Delete
              </button>
            </div>
          </motion.div>
        )}
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
    </div>
  );
};
