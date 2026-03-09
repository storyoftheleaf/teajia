import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Loader2, FileSpreadsheet, Plus, Search, QrCode, Download,
  Trash2, AlertTriangle, Archive, Pencil, AlertOctagon, ArrowUpDown, ArrowUp, ArrowDown, Copy, Layers, Settings, MoreHorizontal, Check, X as XIcon, Eye, EyeOff, Star, Sparkles, RefreshCw, ChevronDown, MapPin
} from 'lucide-react';
import Papa from 'papaparse';
import Fuse from 'fuse.js';
import { api } from '../../lib/api';
import { Product } from '../types';
import { QrCodeModal } from './QrCodeModal';
import { AddProductModal } from './AddProductModal';
import { useRates } from '../hooks/useAdminData';
import { useToast } from './Toast';
import { GoogleGenAI, Type } from "@google/genai";
import { useAppStore } from '../store';
import { fmtNum } from '../../utils/formatNumber';
import { getThemeColor } from '../themeUtils';

const MAINTENANCE_SQL = `-- Reset all data via API\n// Use the admin panel's reset function`;

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
    placeholder = ''
}: { 
    value: string | number, 
    onSave: (val: any) => void, 
    type?: 'text' | 'number',
    align?: 'left' | 'right',
    className?: string,
    placeholder?: string
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
            className={`w-full bg-transparent border-b border-transparent focus:border-tea-accent focus:bg-tea-surface/50 rounded-none py-0 px-0 outline-none transition-all text-${align} placeholder-tea-muted/50 leading-none ${className}`}
        />
    );
};

export const InventoryView: React.FC<InventoryViewProps> = ({
  products, isLoading, isError, error, onImportClick, onAddClick, onRefresh
}) => {
  const { showToast } = useToast();
  
  // --- STATE ---
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

  // Sorting
  const [sortConfig, setSortConfig] = useState<{ key: keyof Product; direction: 'asc' | 'desc' }>({ key: 'type', direction: 'asc' });

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

  const processedProducts = useMemo(() => {
    let result = localProducts;

    // 1. Search
    if (searchQuery) {
      result = fuse.search(searchQuery).map(r => r.item);
    }

    // 2. Filter
    if (filterType === 'Alerts') {
      result = result.filter(p => p.status === 'Draft' || p.stockGrams <= p.lowStockThreshold || p.pricePerGramUSD === 0 || p.recheckStock);
    } else if (filterType === 'Pending') {
      result = result.filter(p => p.lore && !p.showWisdom);
    } else if (filterType !== 'All') {
      result = result.filter(p => p.type === filterType);
    }

    // 3. Sort
    return [...result].sort((a, b) => {
        if (sortConfig.key === 'type') {
             if (a.type === 'Teaware' && b.type !== 'Teaware') return 1;
             if (a.type !== 'Teaware' && b.type === 'Teaware') return -1;
        }

        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        
        if (aVal === bVal) return 0;
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;
        
        const comparison = aVal < bVal ? -1 : 1;
        return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  }, [localProducts, searchQuery, filterType, sortConfig, fuse]);

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
  const { aiPromptTemplate } = useAppStore();

  const handleSort = (key: keyof Product) => {
      let direction: 'asc' | 'desc' = 'asc';
      if (sortConfig.key === key && sortConfig.direction === 'asc') {
          direction = 'desc';
      }
      setSortConfig({ key, direction });
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
        const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

        for (let i = 0; i < teasToEnrich.length; i++) {
            const tea = teasToEnrich[i];
            setEnrichProgress({ current: i + 1, total: teasToEnrich.length, currentName: tea.productName });
            try {
                const prompt = aiPromptTemplate
                    .replace('{{productName}}', tea.productName)
                    .replace('{{type}}', tea.type);

                const response = await ai.models.generateContent({
                    model: "gemini-3-flash-preview",
                    contents: prompt,
                    config: {
                        responseMimeType: "application/json",
                        responseSchema: {
                            type: Type.OBJECT,
                            properties: {
                                lore: { type: Type.STRING },
                                tastingNotes: { type: Type.ARRAY, items: { type: Type.STRING } },
                                chineseName: { type: Type.STRING },
                                originRegion: { type: Type.STRING },
                                processingNotes: { type: Type.STRING },
                                terroir: { type: Type.STRING },
                                mood: { type: Type.STRING },
                                experience: { type: Type.STRING },
                            },
                            required: ["lore", "tastingNotes"]
                        }
                    }
                });

                const jsonStr = response.text?.trim();
                if (jsonStr) {
                    const data = JSON.parse(jsonStr);
                    
                    const dbPayload = {
                        lore: data.lore,
                        tasting_notes: data.tastingNotes,
                        chinese_name: tea.chineseName || data.chineseName || '',
                        origin_region: tea.originRegion || data.originRegion || '',
                        processing_notes: data.processingNotes || '',
                        terroir: data.terroir || '',
                        mood: data.mood || '',
                        experience: data.experience || '',
                        is_custom_wisdom: false,
                        show_wisdom: false // Set to false so user has to approve it
                    };

                    await api.products.update(tea.id, dbPayload);
                    
                    successCount++;
                }
                // Add a small delay to avoid hitting rate limits, even on paid tiers
                await delay(2000);
            } catch (err) {
                console.error(`Failed to enrich ${tea.productName}:`, err);
                failCount++;
            }
        }
    } catch (error: any) {
        console.error("Bulk enrich error:", error);
        showToast("Error initializing AI.", "error");
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
      const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
      const prompt = aiPromptTemplate
        .replace('{{productName}}', product.productName)
        .replace('{{type}}', product.type);
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              lore: { type: Type.STRING },
              tastingNotes: { type: Type.ARRAY, items: { type: Type.STRING } },
              chineseName: { type: Type.STRING },
              originRegion: { type: Type.STRING },
              processingNotes: { type: Type.STRING },
              terroir: { type: Type.STRING },
              mood: { type: Type.STRING },
              experience: { type: Type.STRING },
            },
            required: ["lore", "tastingNotes"]
          }
        }
      });
      const jsonStr = response.text?.trim();
      if (jsonStr) {
        const data = JSON.parse(jsonStr);
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
      }
    } catch (err: any) {
      showToast(`Regeneration failed: ${err.message}`, 'error');
    } finally {
      setRegeneratingId(null);
    }
  };

  // --- COMPONENTS ---
  // Replaced div SortHeader with th
  const SortHeader = ({ colKey, label, align = 'left' }: { colKey: keyof Product, label: string, align?: 'left' | 'right' | 'center' }) => (
      <th 
        className={`px-4 py-2 cursor-pointer hover:text-tea-text transition-colors select-none border-b border-tea-border group text-[10px] uppercase tracking-wider font-serif text-tea-muted text-${align} truncate`}
        onClick={() => handleSort(colKey)}
      >
        <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : ''}`}>
           {label}
           <div className="flex-shrink-0 relative z-0 flex items-center">
            {sortConfig.key === colKey ? (
                sortConfig.direction === 'asc' ? <ArrowUp size={10} className="ml-1 text-tea-muted" /> : <ArrowDown size={10} className="ml-1 text-tea-muted" />
            ) : <ArrowUpDown size={10} className="opacity-0 group-hover:opacity-100 text-tea-muted/50 ml-1 transition-opacity" />}
           </div>
        </div>
      </th>
  );

  if (isLoading) {
    return <div className="p-12 text-center text-tea-muted font-serif italic"><Loader2 className="animate-spin inline mr-2" /> Loading inventory...</div>;
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-center">
        <div className="p-4 bg-red-500/10 rounded-full border border-red-500/20 mb-6">
          <AlertTriangle className="text-red-400" size={32} />
        </div>
        <h2 className="text-lg font-serif text-tea-text mb-2">Failed to load inventory</h2>
        <p className="text-tea-muted text-sm mb-6 max-w-md">
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
    <div className="h-[calc(100vh-64px)] flex flex-col overflow-hidden bg-tea-bg">
      
      {/* --- HEADER CONTROLS --- */}
      <div className={`sticky top-0 z-30 border-b border-tea-border py-2.5 transition-colors ${isEditMode ? 'bg-tea-surface/95 border-b-tea-accent/30' : 'bg-tea-bg/90 backdrop-blur-md'}`}>
        <div className="px-6 max-w-7xl mx-auto flex items-center gap-4">
            <div className="flex items-center gap-2 shrink-0">
                <Settings size={16} className={isEditMode ? "text-tea-muted" : "text-tea-accent"} />
                <h2 className="text-sm font-serif text-tea-text uppercase tracking-[0.15em]">
                    {isEditMode ? 'Editing' : 'Inventory'}
                </h2>
                <span className="text-tea-muted text-xs tracking-wide">
                    {isEditMode ? '— click cells to edit' : `— ${processedProducts.length} items`}
                </span>
            </div>

            <div className="flex items-center gap-4 ml-auto">
                {/* Search */}
                <div className="relative w-48">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-tea-muted" size={14} />
                    <input 
                        type="text" 
                        placeholder="Search master list..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-transparent border-b border-tea-border rounded-none pl-9 pr-3 py-1.5 text-xs text-tea-text outline-none focus:border-tea-muted font-serif placeholder-tea-muted/50 transition-colors"
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
                            : 'text-tea-muted border-transparent hover:border-tea-border hover:text-tea-text'
                        }`}
                    >
                        {isEditMode ? <Check size={14} /> : <Pencil size={14} />}
                        {isEditMode ? 'Done' : 'Edit'}
                    </button>

                    <div className="w-px h-4 bg-tea-border mx-1"></div>

                    <button onClick={onAddClick} className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] font-bold text-tea-muted hover:text-tea-text transition-colors px-3 py-1.5 border border-transparent hover:border-tea-border rounded-lg">
                        <Plus size={14} /> New
                    </button>

                    <button 
                        onClick={() => setShowOptions(!showOptions)}
                        className="p-1.5 text-tea-muted hover:text-tea-text transition-colors rounded-lg hover:bg-tea-surface"
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
                                className={`px-4 py-2 text-left text-xs flex items-center gap-2 hover:bg-tea-bg transition-colors ${filterType === 'Alerts' ? 'text-tea-accent' : 'text-tea-muted'}`}
                            >
                                <AlertTriangle size={14} /> Low Stock Alerts
                            </button>
                            <button
                                onClick={() => { setFilterType(filterType === 'Pending' ? 'All' : 'Pending'); setShowOptions(false); }}
                                className={`px-4 py-2 text-left text-xs flex items-center gap-2 hover:bg-tea-bg transition-colors ${filterType === 'Pending' ? 'text-tea-accent' : 'text-tea-muted'}`}
                            >
                                <Sparkles size={14} />
                                Pending AI Approval
                                {pendingCount > 0 && (
                                    <span className="ml-auto bg-tea-accent/20 text-tea-accent text-[10px] font-bold px-1.5 py-0.5 rounded-full">{pendingCount}</span>
                                )}
                            </button>
                            <button onClick={() => { onImportClick(); setShowOptions(false); }} className="px-4 py-2 text-left text-xs text-tea-muted hover:text-tea-text hover:bg-tea-bg flex items-center gap-2 transition-colors">
                                <FileSpreadsheet size={14} /> Import CSV
                            </button>
                            <button onClick={() => { handleExport(); setShowOptions(false); }} className="px-4 py-2 text-left text-xs text-tea-muted hover:text-tea-text hover:bg-tea-bg flex items-center gap-2 transition-colors">
                                <Download size={14} /> Export CSV
                            </button>
                            <button 
                                onClick={() => { handleBulkEnrich(); setShowOptions(false); }} 
                                disabled={isEnriching}
                                className="px-4 py-2 text-left text-xs text-tea-muted hover:text-tea-text hover:bg-tea-bg flex items-center gap-2 transition-colors disabled:opacity-50"
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
            <div className="text-[10px] text-tea-muted uppercase tracking-[0.2em] mb-1.5">
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
              <span className="text-tea-muted text-[10px] uppercase tracking-[0.2em]">
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
                  className="text-[10px] text-tea-muted/60 hover:text-tea-accent uppercase tracking-[0.2em] transition-colors px-2 py-1.5"
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
                      {product.chineseName && <span className="text-tea-muted text-xs font-serif flex-shrink-0">{product.chineseName}</span>}
                    </div>
                    <span className="text-[10px] text-tea-muted uppercase tracking-[0.2em] flex-shrink-0">
                      {product.type}{product.originRegion ? ` · ${product.originRegion}` : ''}{product.year ? ` · ${product.year}` : ''}
                    </span>
                  </div>

                  <div className="p-5 space-y-4">
                    {/* Story preview */}
                    {storyPreview && (
                      <div className="bg-tea-bg/60 border border-tea-border/50 rounded-lg p-4">
                        <div className="text-[10px] text-tea-muted/60 uppercase tracking-[0.2em] mb-2">Story Preview</div>
                        <p className="text-tea-text/70 text-xs font-serif italic leading-relaxed">{storyPreview}</p>
                      </div>
                    )}

                    {/* Lore */}
                    <div>
                      <label className="text-[10px] text-tea-muted uppercase tracking-[0.2em] block mb-1">Lore</label>
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
                        <label className="text-[10px] text-tea-muted uppercase tracking-[0.2em] block mb-1">Terroir</label>
                        <input value={draft.terroir || ''} onChange={e => setReviewDrafts(prev => ({ ...prev, [product.id]: { ...prev[product.id], terroir: e.target.value } }))} className={fieldClass} />
                      </div>
                      <div>
                        <label className="text-[10px] text-tea-muted uppercase tracking-[0.2em] block mb-1">Processing</label>
                        <input value={draft.processingNotes || ''} onChange={e => setReviewDrafts(prev => ({ ...prev, [product.id]: { ...prev[product.id], processingNotes: e.target.value } }))} className={fieldClass} />
                      </div>
                      <div>
                        <label className="text-[10px] text-tea-muted uppercase tracking-[0.2em] block mb-1">Mood</label>
                        <input value={draft.mood || ''} onChange={e => setReviewDrafts(prev => ({ ...prev, [product.id]: { ...prev[product.id], mood: e.target.value } }))} className={fieldClass} />
                      </div>
                      <div>
                        <label className="text-[10px] text-tea-muted uppercase tracking-[0.2em] block mb-1">Tasting Notes</label>
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
                      <label className="text-[10px] text-tea-muted uppercase tracking-[0.2em] block mb-1">Experience</label>
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
                      className="flex items-center gap-1.5 text-[10px] text-tea-muted hover:text-tea-text uppercase tracking-[0.2em] transition-colors disabled:opacity-40"
                    >
                      {isRegenerating ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                      Regenerate
                    </button>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleDiscardOne(product.id)}
                        className="text-[10px] text-tea-muted/50 hover:text-tea-accent uppercase tracking-[0.2em] transition-colors"
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
              <div className="text-center py-16 text-tea-muted font-serif italic">
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
                        className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors active:bg-tea-surface/80 ${isExpanded ? 'bg-tea-surface/60' : idx % 2 === 0 ? 'bg-transparent' : 'bg-tea-surface/20'}`}
                        onClick={() => setExpandedCardId(isExpanded ? null : product.id)}
                    >
                        {/* Type dot */}
                        <span className="flex-shrink-0 w-2 h-2 rounded-full" style={{ backgroundColor: dotColor }} />

                        {/* Name + given name */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                                <span className="text-tea-text text-sm font-serif truncate">{product.productName}</span>
                                {product.isFeatured && <Star size={10} className="flex-shrink-0 text-tea-accent fill-tea-accent" />}
                                {!product.isPublic && <EyeOff size={10} className="flex-shrink-0 text-tea-muted/40" />}
                                {product.lore && (
                                    product.isCustomWisdom
                                        ? <Pencil size={9} className="flex-shrink-0 text-tea-accent/60" />
                                        : <Sparkles size={9} className="flex-shrink-0 text-tea-muted/40" />
                                )}
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] text-tea-muted/70 mt-0.5">
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
                            <div className={`text-xs tabular-nums ${isOutOfStock ? 'text-tea-muted/40' : isLowStock ? 'text-amber-500/80' : 'text-tea-text/80'}`}>
                                {product.stockGrams}g
                            </div>
                            <div className="text-[10px] text-tea-muted/60 tabular-nums">
                                ${fmtNum(product.pricePerGramUSD)}/g
                            </div>
                        </div>

                        {/* Expand indicator */}
                        <ChevronDown size={14} className={`flex-shrink-0 text-tea-muted/30 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Expanded detail panel */}
                    {isExpanded && (
                        <div className="bg-tea-surface/40 px-4 pb-3 pt-1 border-b border-tea-border/30">
                            {/* Info grid */}
                            <div className="grid grid-cols-3 gap-x-4 gap-y-2 py-2">
                                <div>
                                    <div className="text-[9px] text-tea-muted/50 uppercase tracking-wider">Stock</div>
                                    <div className={`text-sm tabular-nums ${isOutOfStock ? 'text-tea-muted/40' : 'text-tea-text'}`}>{product.stockGrams}g</div>
                                </div>
                                <div>
                                    <div className="text-[9px] text-tea-muted/50 uppercase tracking-wider">Retail</div>
                                    <div className="text-sm text-tea-text tabular-nums">${fmtNum(product.pricePerGramUSD)}/g</div>
                                </div>
                                <div>
                                    <div className="text-[9px] text-tea-muted/50 uppercase tracking-wider">Status</div>
                                    <div className="text-sm text-tea-text">{product.status}</div>
                                </div>
                                {product.originRegion && (
                                    <div className="col-span-2">
                                        <div className="text-[9px] text-tea-muted/50 uppercase tracking-wider">Origin</div>
                                        <div className="text-sm text-tea-text">{product.originCountry}{product.originRegion ? `, ${product.originRegion}` : ''}</div>
                                    </div>
                                )}
                                {product.vendor && (
                                    <div>
                                        <div className="text-[9px] text-tea-muted/50 uppercase tracking-wider">Vendor</div>
                                        <div className="text-sm text-tea-text truncate">{product.vendor}</div>
                                    </div>
                                )}
                            </div>

                            {/* Description / Lore */}
                            {(product.lore || product.description) && (
                                <p className="text-xs text-tea-muted/70 font-serif italic leading-relaxed mt-1 mb-2 line-clamp-3">
                                    {product.showWisdom && product.lore ? product.lore : product.description}
                                </p>
                            )}

                            {/* Tasting notes */}
                            {product.tastingNotes && product.tastingNotes.length > 0 && product.showWisdom && (
                                <div className="flex flex-wrap gap-1.5 mb-2">
                                    {product.tastingNotes.map(note => (
                                        <span key={note} className="text-[10px] text-tea-muted/60 bg-tea-bg/60 px-2 py-0.5 rounded-full">{note}</span>
                                    ))}
                                </div>
                            )}

                            {/* Action buttons */}
                            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-tea-border/20">
                                <button
                                    onClick={() => handleProductUpdate(product.id, 'isFeatured', !product.isFeatured)}
                                    className={`p-1.5 rounded-md transition-colors ${product.isFeatured ? 'text-tea-accent' : 'text-tea-muted/50 hover:text-tea-muted'}`}
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
                                    className={`p-1.5 rounded-md transition-colors ${product.isPublic ? 'text-tea-muted/50 hover:text-tea-muted' : 'text-tea-muted/30'}`}
                                >
                                    {product.isPublic ? <Eye size={15} /> : <EyeOff size={15} />}
                                </button>
                                <button onClick={() => setQrProduct(product)} className="p-1.5 rounded-md text-tea-muted/50 hover:text-tea-muted transition-colors">
                                    <QrCode size={15} />
                                </button>

                                <div className="ml-auto">
                                    <button
                                        onClick={() => setEditingProduct(product)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] uppercase tracking-[0.15em] text-tea-muted hover:text-tea-text bg-tea-bg/60 hover:bg-tea-bg rounded-md transition-colors"
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
              <div className="text-center py-16 text-tea-muted font-serif italic">
                No items found.
              </div>
            )}
        </div>

        {/* DESKTOP TABLE */}
        <div className={`w-full max-w-7xl mx-auto border-x border-tea-border bg-tea-surface min-h-full ${filterType === 'Pending' ? 'hidden' : 'hidden md:block'}`}>
            <table className="w-full table-fixed border-collapse">
                <colgroup>
                    <col className="w-[30%]" />
                    <col className="w-[10%]" />
                    <col className="w-[8%]" />
                    <col className="w-[15%]" />
                    <col className="w-[10%]" />
                    <col className="w-[10%]" />
                    <col className="w-[10%]" />
                    <col className="w-[7%]" />
                </colgroup>
                
                {/* Sticky Header inside scroll container */}
                <thead className="sticky top-0 z-20 bg-tea-bg shadow-sm">
                    <tr>
                        <SortHeader colKey="productName" label="Product" />
                        <SortHeader colKey="type" label="Type" />
                        <SortHeader colKey="year" label="Year" />
                        <SortHeader colKey="originRegion" label="Origin" />
                        <SortHeader colKey="stockGrams" label="Stock" align="right" />
                        <SortHeader colKey="costAmount" label="Cost" align="right" />
                        <SortHeader colKey="pricePerGramUSD" label="Retail" align="right" />
                        <th className="px-4 py-2 border-b border-tea-border"></th>
                    </tr>
                </thead>

                <tbody>
                    {/* Top Spacer */}
                    {paddingTop > 0 && <tr style={{ height: paddingTop }}><td colSpan={8}></td></tr>}
                    
                    {visibleProducts.map(product => {
                        const dotColor = getThemeColor(product.type);
                        const isLow = product.stockGrams <= product.lowStockThreshold;

                        return (
                            <tr 
                                key={product.id}
                                className={`transition-colors border-b border-tea-border group ${isEditMode ? '' : 'hover:bg-tea-bg/50 cursor-pointer'}`}
                                style={{ height: ROW_HEIGHT }}
                                onClick={() => !isEditMode && setEditingProduct(product)}
                            >
                                {/* Product Name */}
                                <td className="px-4 align-middle overflow-hidden">
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
                                                    {!isEditMode && product.lore && (
                                                        <span title={product.isCustomWisdom ? "Handcrafted Wisdom" : "AI Generated Wisdom"}>
                                                            {product.isCustomWisdom ? (
                                                                <Pencil size={10} className="text-tea-accent" />
                                                            ) : (
                                                                <Sparkles size={10} className="text-tea-muted" />
                                                            )}
                                                        </span>
                                                    )}
                                                </span>
                                                {product.givenName && (
                                                    <span className="text-[10px] text-tea-muted font-sans mt-0.5 truncate block">
                                                        {product.givenName}
                                                        {product.form && <span className="ml-1 opacity-50">· {product.form}</span>}
                                                    </span>
                                                )}
                                                {!product.givenName && product.form && (
                                                    <span className="text-[10px] text-tea-muted/50 font-sans mt-0.5 truncate block">{product.form}</span>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </td>

                                {/* Type */}
                                <td className="px-4 align-middle overflow-hidden">
                                    <span className="flex items-center gap-2 text-xs font-medium tracking-wide text-tea-muted truncate">
                                        <span style={{ color: dotColor, fontSize: '10px' }}>●</span> {product.type}
                                    </span>
                                </td>

                                {/* Year */}
                                <td className="px-4 align-middle overflow-hidden">
                                    {isEditMode ? (
                                        <GhostInput 
                                            value={product.year || ''} 
                                            onSave={(val) => handleProductUpdate(product.id, 'year', val)}
                                            type="number"
                                            placeholder="YYYY"
                                            className="font-sans text-xs text-tea-muted tabular-nums"
                                        />
                                    ) : <span className="text-xs text-tea-muted font-sans tabular-nums">{product.year || '-'}</span>}
                                </td>

                                {/* Origin */}
                                <td className="px-4 align-middle overflow-hidden">
                                    {isEditMode ? (
                                        <GhostInput 
                                            value={product.originRegion} 
                                            onSave={(val) => handleProductUpdate(product.id, 'originRegion', val)}
                                            className="font-sans text-xs text-tea-muted truncate"
                                        />
                                    ) : <span className="text-xs text-tea-muted font-sans truncate block">{product.originRegion}</span>}
                                </td>
                                
                                {/* Stock */}
                                <td className="px-4 align-middle overflow-hidden text-right">
                                    {isEditMode ? (
                                        <div className="flex items-center justify-end gap-1">
                                            <GhostInput
                                                value={product.stockGrams}
                                                onSave={(val) => handleProductUpdate(product.id, 'stockGrams', val)}
                                                type="number"
                                                align="right"
                                                className="num text-xs"
                                            />
                                            <button
                                                title={product.recheckStock ? "Clear recheck flag" : "Flag for stock recheck"}
                                                onClick={(e) => { e.stopPropagation(); handleProductUpdate(product.id, 'recheckStock', !product.recheckStock); }}
                                                className={`text-[10px] transition-colors ${product.recheckStock ? 'text-amber-400 hover:text-tea-muted' : 'text-tea-border hover:text-amber-400'}`}
                                            >⚠</button>
                                        </div>
                                    ) : (
                                        <span className={`num text-xs flex items-center justify-end gap-1 ${isLow ? 'text-tea-accent font-bold' : 'text-tea-muted'}`}>
                                            {product.recheckStock && <span title="Stock needs rechecking" className="text-amber-400 text-[10px]">⚠</span>}
                                            {product.stockGrams}g
                                        </span>
                                    )}
                                </td>

                                {/* Cost */}
                                <td className="px-4 align-middle overflow-hidden text-right">
                                    {isEditMode ? (
                                        <GhostInput 
                                            value={product.costAmount} 
                                            onSave={(val) => handleProductUpdate(product.id, 'costAmount', val)}
                                            type="number"
                                            align="right"
                                            className="num text-xs"
                                        />
                                    ) : <span className="num text-xs text-tea-muted">{product.costAmount > 0 ? product.costAmount.toLocaleString() : '-'}</span>}
                                </td>

                                {/* Retail */}
                                <td className="px-4 align-middle overflow-hidden text-right">
                                    {isEditMode ? (
                                        <GhostInput 
                                            value={product.pricePerGramUSD?.toFixed(2)} 
                                            onSave={(val) => handleProductUpdate(product.id, 'pricePerGramUSD', val)}
                                            type="number"
                                            align="right"
                                            className="num text-xs"
                                        />
                                    ) : <span className="num text-xs text-tea-text">{product.pricePerGramUSD != null ? fmtNum(product.pricePerGramUSD) : '-'}</span>}
                                </td>

                                {/* Actions */}
                                <td className="px-4 align-middle text-right">
                                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                                        {!isEditMode && (
                                            <>
                                                {(!product.showWisdom && product.lore) && (
                                                    <button 
                                                        onClick={() => handleProductUpdate(product.id, 'showWisdom', true)} 
                                                        className="text-tea-accent hover:text-tea-accent/80 p-1 transition-colors"
                                                        title="Approve AI Wisdom"
                                                    >
                                                        <Check size={14}/>
                                                    </button>
                                                )}
                                                <button 
                                                    onClick={() => handleProductUpdate(product.id, 'isFeatured', !product.isFeatured)} 
                                                    className={`${product.isFeatured ? 'text-tea-accent hover:text-tea-accent/80' : 'text-tea-muted hover:text-tea-text'} p-1 transition-colors`}
                                                    title={product.isFeatured ? "Remove from Featured" : "Mark as Featured"}
                                                >
                                                    <Star size={14} className={product.isFeatured ? "fill-tea-accent" : ""} />
                                                </button>
                                                <button 
                                                    onClick={() => handleProductUpdate(product.id, 'isPublic', !product.isPublic)} 
                                                    className={`${product.isPublic ? 'text-tea-muted hover:text-tea-text' : 'text-tea-muted/50 hover:text-tea-muted'} p-1 transition-colors`}
                                                    title={product.isPublic ? "Hide from Glossary" : "Show in Glossary"}
                                                >
                                                    {product.isPublic ? <Eye size={14}/> : <EyeOff size={14}/>}
                                                </button>
                                                <button onClick={() => setQrProduct(product)} className="text-tea-muted hover:text-tea-text p-1 transition-colors"><QrCode size={14}/></button>
                                                <button onClick={() => setEditingProduct(product)} className="text-tea-muted hover:text-tea-text p-1 transition-colors"><Pencil size={14}/></button>
                                            </>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        );
                    })}

                    {/* Bottom Spacer */}
                    {paddingBottom > 0 && <tr style={{ height: paddingBottom }}><td colSpan={8}></td></tr>}
                </tbody>
            </table>
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-tea-bg border border-tea-accent/30 rounded-xl max-w-sm w-full p-8 relative shadow-2xl">
                <div className="flex flex-col items-center text-center space-y-4">
                    <div className="p-4 rounded-full border border-tea-accent/30 text-tea-accent bg-tea-accent/10">
                        {isResetting ? <Loader2 className="animate-spin" size={32} /> : <AlertOctagon size={32} />}
                    </div>
                    <h3 className="text-xl font-serif text-tea-text">Danger Zone</h3>
                    <p className="text-tea-muted text-sm">
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
                        <button onClick={() => setShowResetConfirm(false)} className="flex-1 py-3 text-tea-muted hover:text-tea-text transition-colors text-xs uppercase tracking-[0.2em]" disabled={isResetting}>Cancel</button>
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
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/95 backdrop-blur-md p-4 animate-in fade-in duration-300">
            <div className="bg-tea-bg border border-tea-border w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-tea-border flex justify-between items-center bg-tea-surface">
                    <div className="flex items-center gap-3">
                         <div className="p-2 border border-tea-accent/30 text-tea-accent rounded-lg bg-tea-accent/10">
                            <AlertTriangle size={16} />
                         </div>
                         <h3 className="text-lg font-serif text-tea-text">Permission Error</h3>
                    </div>
                    <button onClick={() => setShowMaintenanceModal(false)} className="text-tea-muted hover:text-tea-text transition-colors">
                        <XIcon size={20} />
                    </button>
                </div>
                <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                    <p className="text-tea-muted mb-4 text-sm font-serif italic">
                        The archives are locked. Supabase requires administrative SQL execution to bypass integrity checks.
                    </p>
                    <div className="relative group mt-6">
                        <pre className="bg-black border border-tea-border p-4 rounded-xl text-[10px] font-mono text-tea-muted overflow-x-auto whitespace-pre-wrap">
                            {MAINTENANCE_SQL}
                        </pre>
                        <button 
                            onClick={() => {
                                navigator.clipboard.writeText(MAINTENANCE_SQL);
                                showToast("SQL copied to clipboard", 'info');
                            }}
                            className="absolute top-2 right-2 border border-tea-border bg-tea-surface text-tea-muted p-2 rounded-lg hover:text-tea-text hover:border-tea-muted flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] transition-colors"
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

    </div>
  );
};