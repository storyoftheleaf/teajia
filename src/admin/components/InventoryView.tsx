import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  Loader2, FileSpreadsheet, Plus, Search, QrCode, Download,
  Trash2, AlertTriangle, Archive, Pencil, AlertOctagon, ArrowUpDown, ArrowUp, ArrowDown, Copy, Layers, Settings, MoreHorizontal, Check, X as XIcon, Eye, EyeOff, Star, Sparkles, RefreshCw, ChevronDown, ChevronRight, ChevronUp, MapPin, Save, Columns, PanelRightOpen, Square, CheckSquare, Leaf, Coffee
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Papa from 'papaparse';
import Fuse from 'fuse.js';
import { api } from '../../lib/api';
import { Product } from '../types';
import { QrCodeModal } from './QrCodeModal';
import { AddProductModal } from './AddProductModal';
import { useRates } from '../hooks/useAdminData';
import { useToast } from './Toast';
import { useAppStore } from '../store';
import { fmtNum } from '../../utils/formatNumber';
import { getThemeColor } from '../themeUtils';

const MAINTENANCE_SQL = `-- Reset all data via API\n// Use the admin panel's reset function`;

// --- COLUMN DEFINITIONS ---
type InventoryCategory = 'tea' | 'teaware';

const TEA_COLUMN_DEFS = [
  { key: 'productName', label: 'Product', defaultWidth: 'w-[30%]', alwaysVisible: true },
  { key: 'type', label: 'Type', defaultWidth: 'w-[10%]' },
  { key: 'year', label: 'Year', defaultWidth: 'w-[8%]' },
  { key: 'originRegion', label: 'Origin', defaultWidth: 'w-[15%]' },
  { key: 'stockGrams', label: 'Stock', defaultWidth: 'w-[10%]' },
  { key: 'costAmount', label: 'Cost', defaultWidth: 'w-[10%]' },
  { key: 'pricePerGramUSD', label: 'Retail', defaultWidth: 'w-[10%]' },
] as const;

const TEAWARE_COLUMN_DEFS = [
  { key: 'productName', label: 'Product', defaultWidth: 'w-[30%]', alwaysVisible: true },
  { key: 'teawareCategory', label: 'Category', defaultWidth: 'w-[12%]' },
  { key: 'material', label: 'Material', defaultWidth: 'w-[14%]' },
  { key: 'capacityMl', label: 'Capacity', defaultWidth: 'w-[10%]' },
  { key: 'quantityUnits', label: 'Units', defaultWidth: 'w-[8%]' },
  { key: 'costAmount', label: 'Cost', defaultWidth: 'w-[10%]' },
  { key: 'pricePerGramUSD', label: 'Retail', defaultWidth: 'w-[10%]' },
] as const;


const GROUPBY_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'type', label: 'Type' },
  { value: 'vendor', label: 'Vendor' },
  { value: 'status', label: 'Status' },
  { value: 'originCountry', label: 'Origin Country' },
] as const;

const DEFAULT_TEA_VIEWS = [
  {
    id: 'default-all',
    name: 'All Tea',
    columns: ['productName', 'type', 'year', 'originRegion', 'stockGrams', 'costAmount', 'pricePerGramUSD'],
    sortConfig: [{ key: 'type', direction: 'asc' as const }],
    filterType: 'All',
    groupBy: null,
  },
  {
    id: 'default-low-stock',
    name: 'Low Stock',
    columns: ['productName', 'type', 'year', 'originRegion', 'stockGrams', 'costAmount', 'pricePerGramUSD'],
    sortConfig: [{ key: 'stockGrams', direction: 'asc' as const }],
    filterType: 'Alerts',
    groupBy: null,
  },
  {
    id: 'default-unpublished',
    name: 'Unpublished',
    columns: ['productName', 'type', 'stockGrams', 'pricePerGramUSD'],
    sortConfig: [{ key: 'type', direction: 'asc' as const }],
    filterType: 'Unpublished',
    groupBy: null,
  },
];

const DEFAULT_TEAWARE_VIEWS = [
  {
    id: 'default-teaware-all',
    name: 'All Teaware',
    columns: ['productName', 'teawareCategory', 'material', 'capacityMl', 'quantityUnits', 'costAmount', 'pricePerGramUSD'],
    sortConfig: [{ key: 'teawareCategory', direction: 'asc' as const }],
    filterType: 'All',
    groupBy: null,
  },
  {
    id: 'default-teaware-unpublished',
    name: 'Unpublished',
    columns: ['productName', 'teawareCategory', 'material', 'costAmount', 'pricePerGramUSD'],
    sortConfig: [{ key: 'teawareCategory', direction: 'asc' as const }],
    filterType: 'Unpublished',
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
}

// --- GHOST INPUT COMPONENT ---
// Invisible input that looks like text until focused
const GhostInput = ({
    value,
    onSave,
    type = 'text',
    align = 'left',
    className = '',
    placeholder = '',
    inputMode
}: {
    value: string | number,
    onSave: (val: any) => void,
    type?: 'text' | 'number',
    align?: 'left' | 'right',
    className?: string,
    placeholder?: string,
    inputMode?: string
}) => {
    const [localValue, setLocalValue] = useState(value);
    
    // Sync with prop updates (e.g. from refresh)
    useEffect(() => {
        setLocalValue(value);
    }, [value]);

    const handleBlur = () => {
        // Simple loose equality check to prevent unnecessary saves (e.g. "10" vs 10)
        if (localValue != value) {
            onSave(localValue);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.currentTarget.blur();
        }
    };

    return (
        <input 
            type={type}
            value={localValue || ''}
            onChange={(e) => setLocalValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            inputMode={inputMode || (type === 'number' ? 'decimal' : undefined) as any}
            className={`w-full bg-transparent border-b border-transparent [@media(hover:none)]:border-dotted [@media(hover:none)]:border-tea-border/30 focus:border-tea-accent focus:border-solid focus:bg-tea-surface/50 rounded-none py-0 px-0 outline-none transition-all text-${align} placeholder-tea-text-dim/50 leading-none ${className}`}
        />
    );
};

export const InventoryView: React.FC<InventoryViewProps> = ({
  products, isLoading, isError, error, onImportClick, onAddClick, onRefresh
}) => {
  const { showToast } = useToast();

  // --- STORE ---
  const {
    inventoryColumns, toggleInventoryColumn, setInventoryColumns,
    savedViews, activeViewId, saveView, deleteView, setActiveView,
    inventoryGroupBy, setInventoryGroupBy,
    inventorySortConfig, setInventorySortConfig,
    aiPromptTemplate,
  } = useAppStore();

  // --- STATE ---
  const [inventoryCategory, setInventoryCategory] = useState<InventoryCategory>('tea');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('All');
  const [showOptions, setShowOptions] = useState(false);

  // EDIT MODE STATE
  const [isEditMode, setIsEditMode] = useState(false);
  const [localProducts, setLocalProducts] = useState<Product[]>([]);

  // Initialize/Sync Local Products for Optimistic Updates
  useEffect(() => {
    setLocalProducts(products);
  }, [products]);

  // Feature 2: Column Show/Hide popover
  const [showColumnsPopover, setShowColumnsPopover] = useState(false);

  // Feature 3: Row Grouping collapsed state
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Feature 4: Saved Views — initialize defaults
  useEffect(() => {
    if (savedViews.length === 0) {
      DEFAULT_TEA_VIEWS.forEach(v => saveView(v));
      DEFAULT_TEAWARE_VIEWS.forEach(v => saveView(v));
      setActiveView('default-all');
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
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [qrProduct, setQrProduct] = useState<Product | null>(null);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetInput, setResetInput] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);

  const { data: rates = [] } = useRates();

  // --- DATA PROCESSING ---
  const fuse = useMemo(() => new Fuse(localProducts, {
    keys: ['givenName', 'productName', 'chineseName', 'originRegion', 'vendor'],
    threshold: 0.3,
  }), [localProducts]);

  // Active column defs based on category
  const activeColumnDefs = inventoryCategory === 'teaware' ? TEAWARE_COLUMN_DEFS : TEA_COLUMN_DEFS;
  const activeDefaultViews = inventoryCategory === 'teaware' ? DEFAULT_TEAWARE_VIEWS : DEFAULT_TEA_VIEWS;

  const processedProducts = useMemo(() => {
    let result = localProducts;

    // 0. Category filter: tea vs teaware
    if (inventoryCategory === 'teaware') {
      result = result.filter(p => p.type === 'Teaware');
    } else {
      result = result.filter(p => p.type !== 'Teaware');
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
    } else if (filterType === 'Pending') {
      result = result.filter(p => p.lore && !p.showWisdom);
    } else if (filterType === 'Unpublished') {
      result = result.filter(p => !p.isPublic);
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
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;
        const comparison = aVal < bVal ? -1 : 1;
        const result = sort.direction === 'asc' ? comparison : -comparison;
        if (result !== 0) return result;
      }
      return 0;
    });
  }, [localProducts, searchQuery, filterType, inventorySortConfig, fuse]);

  // Visible columns (filtered by store, adapted to category)
  const visibleCols = useMemo(() => activeColumnDefs.filter(col => inventoryColumns.includes(col.key)), [inventoryColumns, activeColumnDefs]);
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
      if (scrollContainerRef.current) {
          setContainerHeight(scrollContainerRef.current.clientHeight);
      }
      const handleResize = () => {
          if (scrollContainerRef.current) {
              setContainerHeight(scrollContainerRef.current.clientHeight);
          }
      };
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
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
  const handleProductUpdate = async (id: string, field: keyof Product, value: any) => {
    // 1. Optimistic Update
    setLocalProducts(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));

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
    else if (field === 'material') dbPayload = { material: value };
    else if (field === 'capacityMl') dbPayload = { capacity_ml: Number(value) };
    else if (field === 'teawareCategory') dbPayload = { teaware_category: value };
    else if (field === 'quantityUnits') dbPayload = { quantity_units: Number(value) };
    else return; // Unsupported field for quick edit

    // 3. Fire & Forget (with Error Revert)
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
          className={`px-4 py-2 cursor-pointer hover:text-tea-text transition-colors select-none border-b border-tea-border group text-[10px] uppercase tracking-wider font-serif text-tea-text-dim text-${align} truncate`}
          onClick={() => handleSort(colKey)}
        >
          <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : ''}`}>
             {label}
             <div className="flex-shrink-0 relative z-0 flex items-center">
              {sortEntry ? (
                <span className="flex items-center">
                  {sortEntry.direction === 'asc' ? <ArrowUp size={10} className="ml-1 text-tea-text-dim" /> : <ArrowDown size={10} className="ml-1 text-tea-text-dim" />}
                  {showBadge && <span className="ml-0.5 text-[8px] text-tea-accent font-bold">{sortIndex + 1}</span>}
                </span>
              ) : <ArrowUpDown size={10} className="opacity-0 group-hover:opacity-100 text-tea-text-dim/50 ml-1 transition-opacity" />}
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
                  <span className="text-sm font-serif text-tea-text tracking-wide group-hover:text-tea-accent transition-colors truncate flex items-center gap-2">
                    {product.productName}
                    {product.lore && (
                      <span title={product.isCustomWisdom ? "Handcrafted Wisdom" : "AI Generated Wisdom"}>
                        {product.isCustomWisdom ? <Pencil size={10} className="text-tea-accent" /> : <Sparkles size={10} className="text-tea-text-dim" />}
                      </span>
                    )}
                  </span>
                  {product.givenName && (
                    <span className="text-[10px] text-tea-text-dim font-sans mt-0.5 truncate block">
                      {product.givenName}
                      {product.form && <span className="ml-1 opacity-50">· {product.form}</span>}
                    </span>
                  )}
                  {!product.givenName && product.form && (
                    <span className="text-[10px] text-tea-text-dim/50 font-sans mt-0.5 truncate block">{product.form}</span>
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
            <span className="flex items-center gap-2 text-xs font-medium tracking-wide text-tea-text-dim truncate">
              <span style={{ color: dotColor, fontSize: '10px' }}>&#9679;</span> {product.type}
            </span>
          </td>
        );
      }
      case 'year':
        return (
          <td id={`cell-${rowIndex}-${colIndex}`} className={`px-4 align-middle overflow-hidden ${focusRing}`}>
            {isEditMode ? (
              <GhostInput id={ghostId} value={product.year || ''} onSave={(val) => handleProductUpdate(product.id, 'year', val)} type="number" placeholder="YYYY" className="font-sans text-xs text-tea-text-dim tabular-nums" />
            ) : <span className="text-xs text-tea-text-dim font-sans tabular-nums">{product.year || '-'}</span>}
          </td>
        );
      case 'originRegion':
        return (
          <td id={`cell-${rowIndex}-${colIndex}`} className={`px-4 align-middle overflow-hidden ${focusRing}`}>
            {isEditMode ? (
              <GhostInput id={ghostId} value={product.originRegion} onSave={(val) => handleProductUpdate(product.id, 'originRegion', val)} className="font-sans text-xs text-tea-text-dim truncate" />
            ) : <span className="text-xs text-tea-text-dim font-sans truncate block">{product.originRegion}</span>}
          </td>
        );
      case 'stockGrams': {
        const isLow = product.stockGrams <= product.lowStockThreshold;
        return (
          <td id={`cell-${rowIndex}-${colIndex}`} className={`px-4 align-middle overflow-hidden text-right ${focusRing}`}>
            {isEditMode ? (
              <div className="flex items-center justify-end gap-1">
                <GhostInput id={ghostId} value={product.stockGrams} onSave={(val) => handleProductUpdate(product.id, 'stockGrams', val)} type="number" align="right" className="num text-xs" />
                <button title={product.recheckStock ? "Clear recheck flag" : "Flag for stock recheck"} onClick={(e) => { e.stopPropagation(); handleProductUpdate(product.id, 'recheckStock', !product.recheckStock); }} className={`text-[10px] transition-colors ${product.recheckStock ? 'text-amber-400 hover:text-tea-text-dim' : 'text-tea-border hover:text-amber-400'}`}>&#9888;</button>
              </div>
            ) : (
              <span className={`num text-xs flex items-center justify-end gap-1 ${isLow ? 'text-tea-accent font-bold' : 'text-tea-text-dim'}`}>
                {product.recheckStock && <span title="Stock needs rechecking" className="text-amber-400 text-[10px]">&#9888;</span>}
                {product.stockGrams}g
              </span>
            )}
          </td>
        );
      }
      case 'costAmount':
        return (
          <td id={`cell-${rowIndex}-${colIndex}`} className={`px-4 align-middle overflow-hidden text-right ${focusRing}`}>
            {isEditMode ? (
              <GhostInput id={ghostId} value={product.costAmount} onSave={(val) => handleProductUpdate(product.id, 'costAmount', val)} type="number" align="right" className="num text-xs" />
            ) : <span className="num text-xs text-tea-text-dim">{product.costAmount > 0 ? product.costAmount.toLocaleString() : '-'}</span>}
          </td>
        );
      case 'pricePerGramUSD':
        return (
          <td id={`cell-${rowIndex}-${colIndex}`} className={`px-4 align-middle overflow-hidden text-right ${focusRing}`}>
            {isEditMode ? (
              <GhostInput id={ghostId} value={product.pricePerGramUSD?.toFixed(2)} onSave={(val) => handleProductUpdate(product.id, 'pricePerGramUSD', val)} type="number" align="right" className="num text-xs" />
            ) : <span className="num text-xs text-tea-text">{product.pricePerGramUSD != null ? fmtNum(product.pricePerGramUSD) : '-'}</span>}
          </td>
        );
      case 'material':
        return (
          <td id={`cell-${rowIndex}-${colIndex}`} className={`px-4 align-middle overflow-hidden ${focusRing}`}>
            {isEditMode ? (
              <GhostInput id={ghostId} value={product.material || ''} onSave={(val) => handleProductUpdate(product.id, 'material', val)} className="font-sans text-xs text-tea-text-dim truncate" />
            ) : <span className="text-xs text-tea-text-dim font-sans truncate block">{product.material || '-'}</span>}
          </td>
        );
      case 'teawareCategory':
        return (
          <td id={`cell-${rowIndex}-${colIndex}`} className={`px-4 align-middle overflow-hidden ${focusRing}`}>
            {isEditMode ? (
              <GhostInput id={ghostId} value={product.teawareCategory || ''} onSave={(val) => handleProductUpdate(product.id, 'teawareCategory', val)} className="font-sans text-xs text-tea-text-dim truncate" />
            ) : <span className="text-xs text-tea-text-dim font-sans capitalize truncate block">{product.teawareCategory || '-'}</span>}
          </td>
        );
      case 'capacityMl':
        return (
          <td id={`cell-${rowIndex}-${colIndex}`} className={`px-4 align-middle overflow-hidden text-right ${focusRing}`}>
            {isEditMode ? (
              <GhostInput id={ghostId} value={product.capacityMl || ''} onSave={(val) => handleProductUpdate(product.id, 'capacityMl', val)} type="number" align="right" className="num text-xs" />
            ) : <span className="num text-xs text-tea-text-dim">{product.capacityMl ? `${product.capacityMl}ml` : '-'}</span>}
          </td>
        );
      case 'quantityUnits':
        return (
          <td id={`cell-${rowIndex}-${colIndex}`} className={`px-4 align-middle overflow-hidden text-right ${focusRing}`}>
            {isEditMode ? (
              <GhostInput id={ghostId} value={product.quantityUnits || ''} onSave={(val) => handleProductUpdate(product.id, 'quantityUnits', val)} type="number" align="right" className="num text-xs" />
            ) : <span className="num text-xs text-tea-text-dim">{product.quantityUnits ?? '-'}</span>}
          </td>
        );
      default:
        return <td className="px-4 align-middle text-xs text-tea-text-dim">-</td>;
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
    return <div className="p-12 text-center text-tea-text-dim font-serif italic"><Loader2 className="animate-spin inline mr-2" /> Loading inventory...</div>;
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-center">
        <div className="p-4 bg-red-500/10 rounded-full border border-red-500/20 mb-6">
          <AlertTriangle className="text-red-400" size={32} />
        </div>
        <h2 className="text-lg font-serif text-tea-text mb-2">Failed to load inventory</h2>
        <p className="text-tea-text-dim text-sm mb-6 max-w-md">
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
    <div className={`h-[calc(100vh-64px)] flex flex-col overflow-hidden bg-tea-bg ${panelProduct ? 'md:mr-[420px]' : ''} transition-all duration-300`}>

      {/* --- CATEGORY TOGGLE + SAVED VIEWS TAB BAR --- */}
      <div className="flex items-center gap-1 px-6 py-1.5 border-b border-tea-border/50 bg-tea-bg overflow-x-auto custom-scrollbar">
        {/* Tea / Teaware category toggle */}
        <div className="flex items-center bg-tea-surface rounded-lg border border-tea-border/50 p-0.5 mr-2 flex-shrink-0">
          <button
            onClick={() => setInventoryCategory('tea')}
            className={`flex items-center gap-1.5 px-3 py-1 text-[10px] uppercase tracking-[0.15em] rounded-md whitespace-nowrap transition-colors ${
              inventoryCategory === 'tea'
                ? 'bg-tea-bg text-tea-text shadow-sm'
                : 'text-tea-text-dim hover:text-tea-text'
            }`}
          >
            Tea
          </button>
          <button
            onClick={() => setInventoryCategory('teaware')}
            className={`flex items-center gap-1.5 px-3 py-1 text-[10px] uppercase tracking-[0.15em] rounded-md whitespace-nowrap transition-colors ${
              inventoryCategory === 'teaware'
                ? 'bg-tea-bg text-tea-text shadow-sm'
                : 'text-tea-text-dim hover:text-tea-text'
            }`}
          >
            Teaware
          </button>
        </div>
        <div className="w-px h-4 bg-tea-border/30 mr-1" />
        {(savedViews.length > 0 ? savedViews.filter(v => inventoryCategory === 'teaware' ? v.id.includes('teaware') : !v.id.includes('teaware')) : activeDefaultViews).map(view => (
          <button
            key={view.id}
            onClick={() => {
              setActiveView(view.id);
              setInventoryColumns(view.columns);
              setInventorySortConfig(view.sortConfig);
              setFilterType(view.filterType);
              setInventoryGroupBy(view.groupBy);
            }}
            className={`flex items-center gap-1.5 px-3 py-1 text-[10px] uppercase tracking-[0.15em] rounded-md whitespace-nowrap transition-colors ${
              activeViewId === view.id
                ? 'bg-tea-accent/15 text-tea-accent border border-tea-accent/30'
                : 'text-tea-text-dim hover:text-tea-text hover:bg-tea-surface border border-transparent'
            }`}
          >
            {view.name}
            {!view.id.startsWith('default-') && (
              <span
                onClick={(e) => { e.stopPropagation(); deleteView(view.id); }}
                className="ml-1 text-tea-text-dim/40 hover:text-tea-accent transition-colors"
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
              className="bg-transparent border-b border-tea-border text-[10px] text-tea-text outline-none w-24 py-0.5 px-1"
            />
            <button onClick={() => { setShowSaveViewPrompt(false); setNewViewName(''); }} className="text-tea-text-dim/40 hover:text-tea-text-dim"><XIcon size={10} /></button>
          </div>
        ) : (
          <button
            onClick={() => setShowSaveViewPrompt(true)}
            className="flex items-center gap-1 px-2 py-1 text-[10px] text-tea-text-dim/50 hover:text-tea-text-dim uppercase tracking-[0.15em] transition-colors"
          >
            <Save size={10} /> Save View
          </button>
        )}
      </div>

      {/* --- HEADER CONTROLS --- */}
      <div className={`sticky top-0 z-30 border-b border-tea-border py-2.5 transition-colors ${isEditMode ? 'bg-tea-surface/95 border-b-tea-accent/30' : 'bg-tea-bg/90 backdrop-blur-md'}`}>
        <div className="px-6 max-w-7xl mx-auto flex items-center gap-4">
            <div className="flex items-center gap-2 shrink-0">
                <Settings size={16} className={isEditMode ? "text-tea-text-dim" : "text-tea-accent"} />
                <h2 className="text-sm font-serif text-tea-text uppercase tracking-[0.15em]">
                    {isEditMode ? 'Editing' : 'Inventory'}
                </h2>
                <span className="text-tea-text-dim text-xs tracking-wide">
                    {isEditMode ? '— click cells to edit' : `— ${processedProducts.length} items`}
                </span>
            </div>

            <div className="flex items-center gap-4 ml-auto">
                {/* Search */}
                <div className="relative w-48">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-tea-text-dim" size={14} />
                    <input 
                        type="text" 
                        placeholder="Search master list..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-transparent border-b border-tea-border rounded-none pl-9 pr-3 py-1.5 text-xs text-tea-text outline-none focus:border-tea-text-dim font-serif placeholder-tea-text-dim/50 transition-colors"
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
                            : 'text-tea-text-dim border-transparent hover:border-tea-border hover:text-tea-text'
                        }`}
                    >
                        {isEditMode ? <Check size={14} /> : <Pencil size={14} />}
                        {isEditMode ? 'Done' : 'Edit'}
                    </button>

                    <div className="w-px h-4 bg-tea-border mx-1"></div>

                    <button onClick={onAddClick} className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] font-bold text-tea-text-dim hover:text-tea-text transition-colors px-3 py-1.5 border border-transparent hover:border-tea-border rounded-lg">
                        <Plus size={14} /> New
                    </button>

                    {/* Columns Toggle */}
                    <div className="relative">
                      <button
                        onClick={() => setShowColumnsPopover(!showColumnsPopover)}
                        className={`p-1.5 rounded-lg transition-colors ${showColumnsPopover ? 'text-tea-accent bg-tea-surface' : 'text-tea-text-dim hover:text-tea-text hover:bg-tea-surface'}`}
                        title="Show/Hide Columns"
                      >
                        <Columns size={15} />
                      </button>
                      {showColumnsPopover && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setShowColumnsPopover(false)} />
                          <div className="absolute right-0 top-full mt-2 w-44 bg-tea-surface border border-tea-border shadow-xl rounded-xl z-50 py-2">
                            <div className="px-3 pb-1.5 text-[9px] text-tea-text-dim/60 uppercase tracking-[0.2em]">Visible Columns</div>
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
                        onClick={() => {
                          const el = document.getElementById('groupby-dropdown');
                          if (el) el.classList.toggle('hidden');
                        }}
                        className={`flex items-center gap-1 p-1.5 rounded-lg text-xs transition-colors ${inventoryGroupBy ? 'text-tea-accent bg-tea-surface' : 'text-tea-text-dim hover:text-tea-text hover:bg-tea-surface'}`}
                        title="Group By"
                      >
                        <Layers size={15} />
                      </button>
                      <div id="groupby-dropdown" className="hidden absolute right-0 top-full mt-2 w-40 bg-tea-surface border border-tea-border shadow-xl rounded-xl z-50 py-1">
                        {GROUPBY_OPTIONS.map(opt => (
                          <button
                            key={opt.value}
                            onClick={() => {
                              setInventoryGroupBy(opt.value || null);
                              document.getElementById('groupby-dropdown')?.classList.add('hidden');
                            }}
                            className={`w-full px-3 py-1.5 text-left text-xs hover:bg-tea-bg transition-colors ${(inventoryGroupBy || '') === opt.value ? 'text-tea-accent' : 'text-tea-text-dim'}`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                        onClick={() => setShowOptions(!showOptions)}
                        className="p-1.5 text-tea-text-dim hover:text-tea-text transition-colors rounded-lg hover:bg-tea-surface"
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
                                className={`px-4 py-2 text-left text-xs flex items-center gap-2 hover:bg-tea-bg transition-colors ${filterType === 'Alerts' ? 'text-tea-accent' : 'text-tea-text-dim'}`}
                            >
                                <AlertTriangle size={14} /> Low Stock Alerts
                            </button>
                            <button
                                onClick={() => { setFilterType(filterType === 'Pending' ? 'All' : 'Pending'); setShowOptions(false); }}
                                className={`px-4 py-2 text-left text-xs flex items-center gap-2 hover:bg-tea-bg transition-colors ${filterType === 'Pending' ? 'text-tea-accent' : 'text-tea-text-dim'}`}
                            >
                                <Sparkles size={14} />
                                Pending AI Approval
                                {pendingCount > 0 && (
                                    <span className="ml-auto bg-tea-accent/20 text-tea-accent text-[10px] font-bold px-1.5 py-0.5 rounded-full">{pendingCount}</span>
                                )}
                            </button>
                            <button onClick={() => { onImportClick(); setShowOptions(false); }} className="px-4 py-2 text-left text-xs text-tea-text-dim hover:text-tea-text hover:bg-tea-bg flex items-center gap-2 transition-colors">
                                <FileSpreadsheet size={14} /> Import CSV
                            </button>
                            <button onClick={() => { handleExport(); setShowOptions(false); }} className="px-4 py-2 text-left text-xs text-tea-text-dim hover:text-tea-text hover:bg-tea-bg flex items-center gap-2 transition-colors">
                                <Download size={14} /> Export CSV
                            </button>
                            <button 
                                onClick={() => { handleBulkEnrich(); setShowOptions(false); }} 
                                disabled={isEnriching}
                                className="px-4 py-2 text-left text-xs text-tea-text-dim hover:text-tea-text hover:bg-tea-bg flex items-center gap-2 transition-colors disabled:opacity-50"
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
            <div className="text-[10px] text-tea-text-dim uppercase tracking-[0.2em] mb-1.5">
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

        {/* REVIEW FEED (Pending AI Approval mode) */}
        {filterType === 'Pending' && (
          <div className="max-w-3xl mx-auto py-6 px-4 space-y-4">
            {/* Feed header */}
            <div className="sticky top-0 z-10 bg-tea-bg/95 backdrop-blur py-3 flex items-center justify-between border-b border-tea-border pb-4">
              <span className="text-tea-text-dim text-[10px] uppercase tracking-[0.2em]">
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
                  className="text-[10px] text-tea-text-dim/60 hover:text-tea-accent uppercase tracking-[0.2em] transition-colors px-2 py-1.5"
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
              const fieldClass = "w-full bg-transparent border-b border-tea-border text-xs text-tea-text outline-none focus:border-tea-accent transition-colors py-1";

              return (
                <div key={product.id} className="bg-tea-surface border border-tea-border rounded-xl overflow-hidden">
                  {/* Identity */}
                  <div className="px-5 py-3 bg-tea-bg/50 border-b border-tea-border flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-serif text-tea-text text-sm truncate">{product.productName}</span>
                      {product.chineseName && <span className="text-tea-text-dim text-xs font-serif flex-shrink-0">{product.chineseName}</span>}
                    </div>
                    <span className="text-[10px] text-tea-text-dim uppercase tracking-[0.2em] flex-shrink-0">
                      {product.type}{product.originRegion ? ` · ${product.originRegion}` : ''}{product.year ? ` · ${product.year}` : ''}
                    </span>
                  </div>

                  <div className="p-5 space-y-4">
                    {/* Story preview */}
                    {storyPreview && (
                      <div className="bg-tea-bg/60 border border-tea-border/50 rounded-lg p-4">
                        <div className="text-[10px] text-tea-text-dim/60 uppercase tracking-[0.2em] mb-2">Story Preview</div>
                        <p className="text-tea-text/70 text-xs font-serif italic leading-relaxed">{storyPreview}</p>
                      </div>
                    )}

                    {/* Lore */}
                    <div>
                      <label className="text-[10px] text-tea-text-dim uppercase tracking-[0.2em] block mb-1">Lore</label>
                      <textarea
                        value={draft.lore || ''}
                        onChange={e => setReviewDrafts(prev => ({ ...prev, [product.id]: { ...prev[product.id], lore: e.target.value } }))}
                        rows={3}
                        className="w-full bg-transparent border-b border-tea-border text-sm text-tea-text font-serif outline-none focus:border-tea-accent transition-colors resize-none leading-relaxed py-1"
                      />
                    </div>

                    {/* Grid fields */}
                    <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                      <div>
                        <label className="text-[10px] text-tea-text-dim uppercase tracking-[0.2em] block mb-1">Terroir</label>
                        <input value={draft.terroir || ''} onChange={e => setReviewDrafts(prev => ({ ...prev, [product.id]: { ...prev[product.id], terroir: e.target.value } }))} className={fieldClass} />
                      </div>
                      <div>
                        <label className="text-[10px] text-tea-text-dim uppercase tracking-[0.2em] block mb-1">Processing</label>
                        <input value={draft.processingNotes || ''} onChange={e => setReviewDrafts(prev => ({ ...prev, [product.id]: { ...prev[product.id], processingNotes: e.target.value } }))} className={fieldClass} />
                      </div>
                      <div>
                        <label className="text-[10px] text-tea-text-dim uppercase tracking-[0.2em] block mb-1">Mood</label>
                        <input value={draft.mood || ''} onChange={e => setReviewDrafts(prev => ({ ...prev, [product.id]: { ...prev[product.id], mood: e.target.value } }))} className={fieldClass} />
                      </div>
                      <div>
                        <label className="text-[10px] text-tea-text-dim uppercase tracking-[0.2em] block mb-1">Tasting Notes</label>
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
                      <label className="text-[10px] text-tea-text-dim uppercase tracking-[0.2em] block mb-1">Experience</label>
                      <textarea
                        value={draft.experience || ''}
                        onChange={e => setReviewDrafts(prev => ({ ...prev, [product.id]: { ...prev[product.id], experience: e.target.value } }))}
                        rows={2}
                        className="w-full bg-transparent border-b border-tea-border text-xs text-tea-text outline-none focus:border-tea-accent transition-colors resize-none leading-relaxed py-1"
                      />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="px-5 py-3 border-t border-tea-border flex justify-between items-center bg-tea-bg/30">
                    <button
                      onClick={() => handleRegenerateOne(product)}
                      disabled={!!regeneratingId}
                      className="flex items-center gap-1.5 text-[10px] text-tea-text-dim hover:text-tea-text uppercase tracking-[0.2em] transition-colors disabled:opacity-40"
                    >
                      {isRegenerating ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                      Regenerate
                    </button>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleDiscardOne(product.id)}
                        className="text-[10px] text-tea-text-dim/50 hover:text-tea-accent uppercase tracking-[0.2em] transition-colors"
                      >
                        Discard
                      </button>
                      <button
                        onClick={() => handleApproveOne(product)}
                        disabled={isApproving}
                        className="flex items-center gap-1.5 px-3 py-1 bg-tea-accent/10 border border-tea-accent/30 text-tea-accent text-[10px] uppercase tracking-[0.2em] rounded-lg hover:bg-tea-accent/20 transition-colors disabled:opacity-40"
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
              <div className="text-center py-16 text-tea-text-dim font-serif italic">
                All caught up — no pending wisdom to review.
              </div>
            )}
          </div>
        )}

        {/* MOBILE CARDS — compact list with expandable detail */}
        <div className={`md:hidden pb-24 ${filterType === 'Pending' ? 'hidden' : ''}`}>
            {processedProducts.map((product, idx) => {
                const dotColor = getThemeColor(product.type);
                const isExpanded = expandedCardId === product.id;
                const isOutOfStock = product.stockGrams === 0;
                const isLowStock = product.stockGrams > 0 && product.stockGrams <= (product.lowStockThreshold || 10);
                return (
                <div key={product.id}>
                    {/* Compact row */}
                    <button
                        className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors active:bg-tea-surface/80 ${isExpanded ? 'bg-tea-surface/60' : idx % 2 === 0 ? 'bg-transparent' : 'bg-tea-surface/20'} ${getRowBorderClass(product)} ${!product.isPublic ? 'opacity-70' : ''}`}
                        onClick={() => setExpandedCardId(isExpanded ? null : product.id)}
                    >
                        {/* Type dot */}
                        <span className="flex-shrink-0 w-2 h-2 rounded-full" style={{ backgroundColor: dotColor }} />

                        {/* Name + given name */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                                <span className="text-tea-text text-sm font-serif truncate">{product.productName}</span>
                                {product.isFeatured && <Star size={10} className="flex-shrink-0 text-tea-accent fill-tea-accent" />}
                                {!product.isPublic && <EyeOff size={10} className="flex-shrink-0 text-tea-text-dim/40" />}
                                {product.lore && (
                                    product.isCustomWisdom
                                        ? <Pencil size={9} className="flex-shrink-0 text-tea-accent/60" />
                                        : <Sparkles size={9} className="flex-shrink-0 text-tea-text-dim/40" />
                                )}
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] text-tea-text-dim/70 mt-0.5">
                                <span>{product.type}</span>
                                {product.originRegion && (
                                    <>
                                        <span className="opacity-40">·</span>
                                        <span className="truncate">{product.originRegion}</span>
                                    </>
                                )}
                                {product.year && (
                                    <>
                                        <span className="opacity-40">·</span>
                                        <span>{product.year}</span>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Stock + Price */}
                        <div className="flex-shrink-0 text-right">
                            {inventoryCategory === 'teaware' ? (
                              <>
                                <div className="text-xs text-tea-text/80 tabular-nums">
                                  {product.quantityUnits ?? '-'} units
                                </div>
                                <div className="text-[10px] text-tea-text-dim/60 tabular-nums">
                                  {product.material || product.teawareCategory || '-'}
                                </div>
                              </>
                            ) : (
                              <>
                                <div className={`text-xs tabular-nums ${isOutOfStock ? 'text-tea-text-dim/40' : isLowStock ? 'text-amber-500/80' : 'text-tea-text/80'}`}>
                                    {product.stockGrams}g
                                </div>
                                <div className="text-[10px] text-tea-text-dim/60 tabular-nums">
                                    ${fmtNum(product.pricePerGramUSD)}/g
                                </div>
                              </>
                            )}
                        </div>

                        {/* Expand indicator */}
                        <ChevronDown size={14} className={`flex-shrink-0 text-tea-text-dim/30 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Expanded detail panel */}
                    {isExpanded && (
                        <div className="bg-tea-surface/40 px-4 pb-3 pt-1 border-b border-tea-border/30">
                            {/* Info grid */}
                            <div className="grid grid-cols-3 gap-x-4 gap-y-2 py-2">
                              {inventoryCategory === 'teaware' ? (
                                <>
                                  {product.teawareCategory && (
                                    <div>
                                      <div className="text-[9px] text-tea-text-dim/50 uppercase tracking-wider">Category</div>
                                      <div className="text-sm text-tea-text capitalize">{product.teawareCategory}</div>
                                    </div>
                                  )}
                                  {product.material && (
                                    <div>
                                      <div className="text-[9px] text-tea-text-dim/50 uppercase tracking-wider">Material</div>
                                      <div className="text-sm text-tea-text">{product.material}</div>
                                    </div>
                                  )}
                                  {product.capacityMl && (
                                    <div>
                                      <div className="text-[9px] text-tea-text-dim/50 uppercase tracking-wider">Capacity</div>
                                      <div className="text-sm text-tea-text tabular-nums">{product.capacityMl}ml</div>
                                    </div>
                                  )}
                                  <div>
                                    <div className="text-[9px] text-tea-text-dim/50 uppercase tracking-wider">Units</div>
                                    <div className="text-sm text-tea-text tabular-nums">{product.quantityUnits ?? '-'}</div>
                                  </div>
                                  <div>
                                    <div className="text-[9px] text-tea-text-dim/50 uppercase tracking-wider">Cost</div>
                                    <div className="text-sm text-tea-text tabular-nums">{product.costAmount > 0 ? `$${product.costAmount.toLocaleString()}` : '-'}</div>
                                  </div>
                                  <div>
                                    <div className="text-[9px] text-tea-text-dim/50 uppercase tracking-wider">Status</div>
                                    <div className="text-sm text-tea-text">{product.status}</div>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div>
                                      <div className="text-[9px] text-tea-text-dim/50 uppercase tracking-wider">Stock</div>
                                      <div className={`text-sm tabular-nums ${isOutOfStock ? 'text-tea-text-dim/40' : 'text-tea-text'}`}>{product.stockGrams}g</div>
                                  </div>
                                  <div>
                                      <div className="text-[9px] text-tea-text-dim/50 uppercase tracking-wider">Retail</div>
                                      <div className="text-sm text-tea-text tabular-nums">${fmtNum(product.pricePerGramUSD)}/g</div>
                                  </div>
                                  <div>
                                      <div className="text-[9px] text-tea-text-dim/50 uppercase tracking-wider">Status</div>
                                      <div className="text-sm text-tea-text">{product.status}</div>
                                  </div>
                                  {product.originRegion && (
                                      <div className="col-span-2">
                                          <div className="text-[9px] text-tea-text-dim/50 uppercase tracking-wider">Origin</div>
                                          <div className="text-sm text-tea-text">{product.originCountry}{product.originRegion ? `, ${product.originRegion}` : ''}</div>
                                      </div>
                                  )}
                                  {product.vendor && (
                                      <div>
                                          <div className="text-[9px] text-tea-text-dim/50 uppercase tracking-wider">Vendor</div>
                                          <div className="text-sm text-tea-text truncate">{product.vendor}</div>
                                      </div>
                                  )}
                                </>
                              )}
                            </div>

                            {/* Description / Lore */}
                            {(product.lore || product.description) && (
                                <p className="text-xs text-tea-text-dim/70 font-serif italic leading-relaxed mt-1 mb-2 line-clamp-3">
                                    {product.showWisdom && product.lore ? product.lore : product.description}
                                </p>
                            )}

                            {/* Tasting notes */}
                            {product.tastingNotes && product.tastingNotes.length > 0 && product.showWisdom && (
                                <div className="flex flex-wrap gap-1.5 mb-2">
                                    {product.tastingNotes.map(note => (
                                        <span key={note} className="text-[10px] text-tea-text-dim/60 bg-tea-bg/60 px-2 py-0.5 rounded-full">{note}</span>
                                    ))}
                                </div>
                            )}

                            {/* Action buttons */}
                            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-tea-border/20">
                                <button
                                    onClick={() => handleProductUpdate(product.id, 'isFeatured', !product.isFeatured)}
                                    className={`p-1.5 rounded-md transition-colors ${product.isFeatured ? 'text-tea-accent' : 'text-tea-text-dim/50 hover:text-tea-text-dim'}`}
                                >
                                    <Star size={15} className={product.isFeatured ? "fill-tea-accent" : ""} />
                                </button>
                                {(!product.showWisdom && product.lore) && (
                                    <button
                                        onClick={() => handleProductUpdate(product.id, 'showWisdom', true)}
                                        className="p-1.5 rounded-md text-tea-accent/70 hover:text-tea-accent transition-colors"
                                        title="Approve AI Wisdom"
                                    >
                                        <Check size={15} />
                                    </button>
                                )}
                                <button
                                    onClick={() => handleProductUpdate(product.id, 'isPublic', !product.isPublic)}
                                    className={`p-1.5 rounded-md transition-colors ${product.isPublic ? 'text-tea-text-dim/50 hover:text-tea-text-dim' : 'text-tea-text-dim/30'}`}
                                >
                                    {product.isPublic ? <Eye size={15} /> : <EyeOff size={15} />}
                                </button>
                                <button onClick={() => setQrProduct(product)} className="p-1.5 rounded-md text-tea-text-dim/50 hover:text-tea-text-dim transition-colors">
                                    <QrCode size={15} />
                                </button>

                                <div className="ml-auto">
                                    <button
                                        onClick={() => setEditingProduct(product)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] uppercase tracking-[0.15em] text-tea-text-dim hover:text-tea-text bg-tea-bg/60 hover:bg-tea-bg rounded-md transition-colors"
                                    >
                                        <Pencil size={12} /> Edit
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )})}

            {processedProducts.length === 0 && (
              <div className="text-center py-16 text-tea-text-dim font-serif italic">
                No items found.
              </div>
            )}
        </div>

        {/* DESKTOP TABLE */}
        <div className={`w-full max-w-7xl mx-auto border-x border-tea-border bg-tea-surface min-h-full ${filterType === 'Pending' ? 'hidden' : 'hidden md:block'}`}>

          {/* --- GROUPED VIEW --- */}
          {groupedProducts ? (
            <div>
              {/* Table header (sticky) */}
              <table className="w-full table-fixed border-collapse">
                <colgroup>
                  {isEditMode && <col className="w-[32px]" />}
                  {visibleCols.map(col => <col key={col.key} className={col.defaultWidth} />)}
                  <col className="w-[7%]" />
                </colgroup>
                <thead className="sticky top-0 z-20 bg-tea-bg shadow-sm">
                  <tr>
                    {isEditMode && (
                      <th className="px-2 py-2 border-b border-tea-border">
                        <button onClick={toggleSelectAll} className="text-tea-text-dim hover:text-tea-text">
                          {selectedIds.size === processedProducts.length ? <CheckSquare size={14} /> : <Square size={14} />}
                        </button>
                      </th>
                    )}
                    {visibleCols.map(col => (
                      <SortHeader key={col.key} colKey={col.key as keyof Product} label={col.label} align={['stockGrams','costAmount','pricePerGramUSD','capacityMl','quantityUnits'].includes(col.key) ? 'right' : 'left'} />
                    ))}
                    <th className="px-4 py-2 border-b border-tea-border"></th>
                  </tr>
                </thead>
              </table>

              {/* Grouped sections */}
              {Object.entries(groupedProducts).map(([groupKey, items]) => {
                const isCollapsed = collapsedGroups.has(groupKey);
                const totalStock = items.reduce((sum, p) => sum + (p.stockGrams || 0), 0);
                const totalRetail = items.reduce((sum, p) => sum + (p.pricePerGramUSD || 0) * (p.stockGrams || 0), 0);
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
                      {isCollapsed ? <ChevronRight size={14} className="text-tea-text-dim" /> : <ChevronDown size={14} className="text-tea-text-dim" />}
                      <span className="text-sm font-serif text-tea-text">{groupKey}</span>
                      <span className="text-[10px] text-tea-text-dim uppercase tracking-[0.15em]">{items.length} items</span>
                      <span className="text-[10px] text-tea-text-dim tabular-nums ml-auto">{totalStock}g total</span>
                      <span className="text-[10px] text-tea-text-dim tabular-nums">${fmtNum(totalRetail)} value</span>
                    </button>
                    {!isCollapsed && (
                      <table className="w-full table-fixed border-collapse">
                        <colgroup>
                          {isEditMode && <col className="w-[32px]" />}
                          {visibleCols.map(col => <col key={col.key} className={col.defaultWidth} />)}
                          <col className="w-[7%]" />
                        </colgroup>
                        <tbody>
                          {items.map((product, rowIdx) => {
                            const globalIdx = processedProducts.indexOf(product);
                            return (
                              <tr
                                key={product.id}
                                className={`transition-colors border-b border-tea-border group ${isEditMode ? '' : 'hover:bg-tea-bg/50 cursor-pointer'} ${getRowBorderClass(product)} ${!product.isPublic ? 'opacity-70' : ''}`}
                                style={{ height: ROW_HEIGHT }}
                                onClick={() => !isEditMode && setPanelProduct(product)}
                              >
                                {isEditMode && (
                                  <td className="px-2 align-middle" onClick={(e) => e.stopPropagation()}>
                                    <button onClick={() => toggleSelectId(product.id)} className="text-tea-text-dim hover:text-tea-text">
                                      {selectedIds.has(product.id) ? <CheckSquare size={14} className="text-tea-accent" /> : <Square size={14} />}
                                    </button>
                                  </td>
                                )}
                                {visibleCols.map((col, colIdx) => renderCell(product, col.key, globalIdx, colIdx))}
                                <td className="px-4 align-middle text-right">
                                  <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                                    {!isEditMode && (
                                      <>
                                        <button onClick={() => handleProductUpdate(product.id, 'isFeatured', !product.isFeatured)} className={`${product.isFeatured ? 'text-tea-accent' : 'text-tea-text-dim hover:text-tea-text'} p-1 transition-colors`}><Star size={14} className={product.isFeatured ? "fill-tea-accent" : ""} /></button>
                                        <button onClick={() => handleProductUpdate(product.id, 'isPublic', !product.isPublic)} className="text-tea-text-dim hover:text-tea-text p-1 transition-colors">{product.isPublic ? <Eye size={14}/> : <EyeOff size={14}/>}</button>
                                        <button onClick={() => setEditingProduct(product)} className="text-tea-text-dim hover:text-tea-text p-1 transition-colors"><Pencil size={14}/></button>
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
                    <col className="w-[7%]" />
                </colgroup>

                <thead className="sticky top-0 z-20 bg-tea-bg shadow-sm">
                    <tr>
                        {isEditMode && (
                          <th className="px-2 py-2 border-b border-tea-border">
                            <button onClick={toggleSelectAll} className="text-tea-text-dim hover:text-tea-text">
                              {selectedIds.size === processedProducts.length ? <CheckSquare size={14} /> : <Square size={14} />}
                            </button>
                          </th>
                        )}
                        {visibleCols.map(col => (
                          <SortHeader key={col.key} colKey={col.key as keyof Product} label={col.label} align={['stockGrams','costAmount','pricePerGramUSD','capacityMl','quantityUnits'].includes(col.key) ? 'right' : 'left'} />
                        ))}
                        <th className="px-4 py-2 border-b border-tea-border"></th>
                    </tr>
                </thead>

                <tbody>
                    {paddingTop > 0 && <tr style={{ height: paddingTop }}><td colSpan={colCountWithBulk}></td></tr>}

                    {visibleProducts.map((product, idx) => {
                        const globalIdx = startIndex + idx;
                        return (
                            <tr
                                key={product.id}
                                className={`transition-colors border-b border-tea-border group ${isEditMode ? '' : 'hover:bg-tea-bg/50 cursor-pointer'} ${getRowBorderClass(product)} ${!product.isPublic ? 'opacity-70' : ''} ${panelProduct?.id === product.id ? 'bg-tea-accent/5' : ''}`}
                                style={{ height: ROW_HEIGHT }}
                                onClick={() => !isEditMode && setPanelProduct(product)}
                            >
                                {isEditMode && (
                                  <td className="px-2 align-middle" onClick={(e) => e.stopPropagation()}>
                                    <button onClick={() => toggleSelectId(product.id)} className="text-tea-text-dim hover:text-tea-text">
                                      {selectedIds.has(product.id) ? <CheckSquare size={14} className="text-tea-accent" /> : <Square size={14} />}
                                    </button>
                                  </td>
                                )}

                                {visibleCols.map((col, colIdx) => renderCell(product, col.key, globalIdx, colIdx))}

                                {/* Actions */}
                                <td className="px-4 align-middle text-right">
                                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                                        {!isEditMode && (
                                            <>
                                                {(!product.showWisdom && product.lore) && (
                                                    <button onClick={() => handleProductUpdate(product.id, 'showWisdom', true)} className="text-tea-accent hover:text-tea-accent/80 p-1 transition-colors" title="Approve AI Wisdom"><Check size={14}/></button>
                                                )}
                                                <button onClick={() => handleProductUpdate(product.id, 'isFeatured', !product.isFeatured)} className={`${product.isFeatured ? 'text-tea-accent hover:text-tea-accent/80' : 'text-tea-text-dim hover:text-tea-text'} p-1 transition-colors`} title={product.isFeatured ? "Remove from Featured" : "Mark as Featured"}><Star size={14} className={product.isFeatured ? "fill-tea-accent" : ""} /></button>
                                                <button onClick={() => handleProductUpdate(product.id, 'isPublic', !product.isPublic)} className={`${product.isPublic ? 'text-tea-text-dim hover:text-tea-text' : 'text-tea-text-dim/50 hover:text-tea-text-dim'} p-1 transition-colors`} title={product.isPublic ? "Hide from Glossary" : "Show in Glossary"}>{product.isPublic ? <Eye size={14}/> : <EyeOff size={14}/>}</button>
                                                <button onClick={() => setQrProduct(product)} className="text-tea-text-dim hover:text-tea-text p-1 transition-colors"><QrCode size={14}/></button>
                                                <button onClick={() => setEditingProduct(product)} className="text-tea-text-dim hover:text-tea-text p-1 transition-colors"><Pencil size={14}/></button>
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
      <AddProductModal 
        isOpen={!!editingProduct} 
        onClose={() => setEditingProduct(null)} 
        initialData={editingProduct}
        onSuccess={() => { setEditingProduct(null); onRefresh(); }}
        rates={rates} 
      />
      
      {/* RESET CONFIRMATION */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-modal flex items-center justify-center bg-tea-text/95 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-tea-bg border border-tea-accent/30 rounded-xl max-w-sm w-full p-8 relative shadow-2xl">
                <div className="flex flex-col items-center text-center space-y-4">
                    <div className="p-4 rounded-full border border-tea-accent/30 text-tea-accent bg-tea-accent/10">
                        {isResetting ? <Loader2 className="animate-spin" size={32} /> : <AlertOctagon size={32} />}
                    </div>
                    <h3 className="text-xl font-serif text-tea-text">Danger Zone</h3>
                    <p className="text-tea-text-dim text-sm">
                        Confirm full database wipe? This is irreversible.
                    </p>
                    <div className="w-full pt-4">
                        <input 
                            type="text" 
                            className="w-full bg-black border border-tea-accent/30 rounded-lg p-3 text-center text-tea-accent num text-xs outline-none focus:border-tea-accent transition-colors"
                            value={resetInput}
                            onChange={(e) => setResetInput(e.target.value)}
                            placeholder='Type "delete" to confirm'
                            disabled={isResetting}
                        />
                    </div>
                    <div className="flex gap-3 w-full pt-4">
                        <button onClick={() => setShowResetConfirm(false)} className="flex-1 py-3 text-tea-text-dim hover:text-tea-text transition-colors text-xs uppercase tracking-[0.2em]" disabled={isResetting}>Cancel</button>
                        <button 
                            onClick={handleResetDatabase} 
                            disabled={resetInput !== 'delete' || isResetting}
                            className="flex-1 py-3 bg-tea-accent/20 border border-tea-accent/50 text-tea-accent text-xs font-bold uppercase tracking-[0.2em] rounded-lg hover:bg-tea-accent/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
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
                         <div className="p-2 border border-tea-accent/30 text-tea-accent rounded-lg bg-tea-accent/10">
                            <AlertTriangle size={16} />
                         </div>
                         <h3 className="text-lg font-serif text-tea-text">Permission Error</h3>
                    </div>
                    <button onClick={() => setShowMaintenanceModal(false)} className="text-tea-text-dim hover:text-tea-text transition-colors">
                        <XIcon size={20} />
                    </button>
                </div>
                <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                    <p className="text-tea-text-dim mb-4 text-sm font-serif italic">
                        The archives are locked. Supabase requires administrative SQL execution to bypass integrity checks.
                    </p>
                    <div className="relative group mt-6">
                        <pre className="bg-black border border-tea-border p-4 rounded-xl text-[10px] font-mono text-tea-text-dim overflow-x-auto whitespace-pre-wrap">
                            {MAINTENANCE_SQL}
                        </pre>
                        <button 
                            onClick={() => {
                                navigator.clipboard.writeText(MAINTENANCE_SQL);
                                showToast("SQL copied to clipboard", 'info');
                            }}
                            className="absolute top-2 right-2 border border-tea-border bg-tea-surface text-tea-text-dim p-2 rounded-lg hover:text-tea-text hover:border-tea-text-dim flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] transition-colors"
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
        {panelProduct && (
          <>
            {/* Mobile: full overlay */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed inset-0 md:inset-auto md:right-0 md:top-0 md:bottom-0 md:w-[420px] z-50 bg-tea-bg border-l border-tea-border shadow-2xl flex flex-col"
            >
              {/* Panel Header */}
              <div className="flex items-center gap-3 px-5 py-3 border-b border-tea-border bg-tea-surface/50">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: getThemeColor(panelProduct.type) }} />
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-serif text-tea-text truncate">{panelProduct.productName}</h3>
                  <span className="text-[10px] text-tea-text-dim">{panelProduct.type} {panelProduct.year ? `· ${panelProduct.year}` : ''}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      const idx = processedProducts.findIndex(p => p.id === panelProduct.id);
                      if (idx > 0) setPanelProduct(processedProducts[idx - 1]);
                    }}
                    className="p-1 text-tea-text-dim hover:text-tea-text transition-colors"
                    title="Previous"
                  ><ChevronUp size={16} /></button>
                  <button
                    onClick={() => {
                      const idx = processedProducts.findIndex(p => p.id === panelProduct.id);
                      if (idx < processedProducts.length - 1) setPanelProduct(processedProducts[idx + 1]);
                    }}
                    className="p-1 text-tea-text-dim hover:text-tea-text transition-colors"
                    title="Next"
                  ><ChevronDown size={16} /></button>
                  <button onClick={() => setPanelProduct(null)} className="p-1 text-tea-text-dim hover:text-tea-text transition-colors ml-1"><XIcon size={16} /></button>
                </div>
              </div>

              {/* Panel Content */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4">
                {/* Image */}
                {panelProduct.imageUrl && (
                  <div className="rounded-lg overflow-hidden border border-tea-border">
                    <img src={panelProduct.imageUrl} alt={panelProduct.productName} className="w-full h-40 object-cover" />
                  </div>
                )}

                {/* Fields */}
                {(inventoryCategory === 'teaware' ? [
                  { label: 'Category', field: 'teawareCategory' as const, value: panelProduct.teawareCategory || '', editable: true },
                  { label: 'Material', field: 'material' as const, value: panelProduct.material || '', editable: true },
                  { label: 'Capacity', field: 'capacityMl' as const, value: panelProduct.capacityMl || '', editable: true, type: 'number' as const },
                  { label: 'Units', field: 'quantityUnits' as const, value: panelProduct.quantityUnits || '', editable: true, type: 'number' as const },
                  { label: 'Cost', field: 'costAmount' as const, value: panelProduct.costAmount, editable: true, type: 'number' as const },
                  { label: 'Retail', field: 'pricePerGramUSD' as const, value: panelProduct.pricePerGramUSD, editable: true, type: 'number' as const },
                  { label: 'Status', field: 'status' as const, value: panelProduct.status },
                ] : [
                  { label: 'Type', field: 'type' as const, value: panelProduct.type },
                  { label: 'Year', field: 'year' as const, value: panelProduct.year || '', editable: true, type: 'number' as const },
                  { label: 'Origin', field: 'originRegion' as const, value: panelProduct.originRegion, editable: true },
                  { label: 'Vendor', field: 'vendor' as const, value: panelProduct.vendor || '' },
                  { label: 'Stock (g)', field: 'stockGrams' as const, value: panelProduct.stockGrams, editable: true, type: 'number' as const },
                  { label: 'Cost', field: 'costAmount' as const, value: panelProduct.costAmount, editable: true, type: 'number' as const },
                  { label: 'Retail ($/g)', field: 'pricePerGramUSD' as const, value: panelProduct.pricePerGramUSD, editable: true, type: 'number' as const },
                  { label: 'Status', field: 'status' as const, value: panelProduct.status },
                ]).map(item => (
                  <div key={item.field} className="flex items-center justify-between gap-4 py-1.5 border-b border-tea-border/30">
                    <span className="text-[10px] text-tea-text-dim uppercase tracking-[0.15em] flex-shrink-0 w-20">{item.label}</span>
                    {item.editable ? (
                      <GhostInput
                        value={item.value}
                        onSave={(val) => {
                          handleProductUpdate(panelProduct.id, item.field, val);
                          setPanelProduct(prev => prev ? { ...prev, [item.field]: item.type === 'number' ? Number(val) : val } : null);
                        }}
                        type={item.type || 'text'}
                        align="right"
                        className="text-xs text-tea-text flex-1"
                      />
                    ) : (
                      <span className="text-xs text-tea-text">{String(item.value || '-')}</span>
                    )}
                  </div>
                ))}

                {/* Lore */}
                {panelProduct.lore && (
                  <div className="mt-4">
                    <div className="text-[10px] text-tea-text-dim/60 uppercase tracking-[0.2em] mb-1.5">Lore</div>
                    <p className="text-xs text-tea-text/70 font-serif italic leading-relaxed">{panelProduct.lore}</p>
                  </div>
                )}

                {/* Tasting Notes */}
                {panelProduct.tastingNotes && panelProduct.tastingNotes.length > 0 && (
                  <div>
                    <div className="text-[10px] text-tea-text-dim/60 uppercase tracking-[0.2em] mb-1.5">Tasting Notes</div>
                    <div className="flex flex-wrap gap-1.5">
                      {panelProduct.tastingNotes.map(note => (
                        <span key={note} className="text-[10px] text-tea-text-dim bg-tea-surface px-2 py-0.5 rounded-full border border-tea-border/50">{note}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Panel Quick Actions */}
              <div className="px-5 py-3 border-t border-tea-border flex items-center gap-2 flex-wrap bg-tea-surface/30">
                <button
                  onClick={() => { handleProductUpdate(panelProduct.id, 'isFeatured', !panelProduct.isFeatured); setPanelProduct(prev => prev ? { ...prev, isFeatured: !prev.isFeatured } : null); }}
                  className={`flex items-center gap-1 px-2.5 py-1 text-[10px] uppercase tracking-[0.15em] rounded-md border transition-colors ${panelProduct.isFeatured ? 'text-tea-accent border-tea-accent/30 bg-tea-accent/10' : 'text-tea-text-dim border-tea-border hover:border-tea-text-dim'}`}
                ><Star size={11} className={panelProduct.isFeatured ? "fill-tea-accent" : ""} /> Featured</button>
                <button
                  onClick={() => { handleProductUpdate(panelProduct.id, 'isPublic', !panelProduct.isPublic); setPanelProduct(prev => prev ? { ...prev, isPublic: !prev.isPublic } : null); }}
                  className={`flex items-center gap-1 px-2.5 py-1 text-[10px] uppercase tracking-[0.15em] rounded-md border transition-colors ${panelProduct.isPublic ? 'text-tea-accent border-tea-accent/30 bg-tea-accent/10' : 'text-tea-text-dim border-tea-border hover:border-tea-text-dim'}`}
                >{panelProduct.isPublic ? <Eye size={11} /> : <EyeOff size={11} />} Public</button>
                <button
                  onClick={() => { handleProductUpdate(panelProduct.id, 'recheckStock', !panelProduct.recheckStock); setPanelProduct(prev => prev ? { ...prev, recheckStock: !prev.recheckStock } : null); }}
                  className={`flex items-center gap-1 px-2.5 py-1 text-[10px] uppercase tracking-[0.15em] rounded-md border transition-colors ${panelProduct.recheckStock ? 'text-amber-400 border-amber-400/30 bg-amber-400/10' : 'text-tea-text-dim border-tea-border hover:border-tea-text-dim'}`}
                ><RefreshCw size={11} /> Recheck</button>
                <button onClick={() => setQrProduct(panelProduct)} className="flex items-center gap-1 px-2.5 py-1 text-[10px] text-tea-text-dim uppercase tracking-[0.15em] rounded-md border border-tea-border hover:border-tea-text-dim transition-colors">
                  <QrCode size={11} /> QR
                </button>
                <button
                  onClick={() => { setEditingProduct(panelProduct); }}
                  className="ml-auto flex items-center gap-1 px-3 py-1 text-[10px] uppercase tracking-[0.15em] bg-tea-accent/10 border border-tea-accent/30 text-tea-accent rounded-md hover:bg-tea-accent/20 transition-colors"
                ><Pencil size={11} /> Edit Full</button>
              </div>
            </motion.div>
            {/* Mobile backdrop */}
            <div className="fixed inset-0 z-40 bg-tea-text/50 md:hidden" onClick={() => setPanelProduct(null)} />
          </>
        )}
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
              className="bg-tea-bg border border-tea-border rounded-md text-xs text-tea-text px-2 py-1 outline-none"
            >
              {BULK_EDIT_FIELDS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
            {(() => {
              const fieldDef = BULK_EDIT_FIELDS.find(f => f.key === bulkField);
              if (fieldDef?.type === 'select') {
                return (
                  <select value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} className="bg-tea-bg border border-tea-border rounded-md text-xs text-tea-text px-2 py-1 outline-none">
                    <option value="">Select...</option>
                    {fieldDef.options.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                );
              } else if (fieldDef?.type === 'boolean') {
                return (
                  <select value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} className="bg-tea-bg border border-tea-border rounded-md text-xs text-tea-text px-2 py-1 outline-none">
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
              className="text-[10px] text-tea-text-dim hover:text-tea-text uppercase tracking-[0.15em] transition-colors"
            >Cancel</button>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};