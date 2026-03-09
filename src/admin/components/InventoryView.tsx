import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Loader2, FileSpreadsheet, Plus, Search, QrCode, Download, 
  Trash2, AlertTriangle, Archive, Pencil, AlertOctagon, ArrowUpDown, ArrowUp, ArrowDown, Copy, Layers, Settings, MoreHorizontal, Check, X as XIcon, Eye, EyeOff, Star, Sparkles
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
  products, isLoading, onImportClick, onAddClick, onRefresh 
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
      result = result.filter(p => p.status === 'Draft' || p.stockGrams <= p.lowStockThreshold || p.pricePerGramUSD === 0);
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
    let successCount = 0;
    let failCount = 0;

    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    try {
        const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

        for (const tea of teasToEnrich) {
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
                                mood: { type: Type.STRING },
                                experience: { type: Type.STRING },
                                liquorColor: { type: Type.STRING }
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
                        mood: data.mood || '',
                        experience: data.experience || '',
                        liquor_color: data.liquorColor || '',
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
                                <Sparkles size={14} /> Pending AI Approval
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

      {/* --- SCROLL CONTAINER --- */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-auto custom-scrollbar bg-tea-bg md:px-6"
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      >
        
        {/* MOBILE CARDS */}
        <div className="md:hidden p-4 space-y-4 pb-24">
            {processedProducts.map(product => {
                const dotColor = getThemeColor(product.type);
                return (
                <div key={product.id} className="bg-tea-surface border border-tea-border rounded-xl p-4 flex flex-col gap-3" onClick={() => setEditingProduct(product)}>
                    <div className="flex justify-between items-start">
                        <div>
                            <span className="text-tea-text font-serif text-lg flex items-center gap-2">
                                {product.productName}
                                {product.lore && (
                                    <span title={product.isCustomWisdom ? "Handcrafted Wisdom" : "AI Generated Wisdom"}>
                                        {product.isCustomWisdom ? (
                                            <Pencil size={12} className="text-tea-accent" />
                                        ) : (
                                            <Sparkles size={12} className="text-tea-muted" />
                                        )}
                                    </span>
                                )}
                            </span>
                            <span className="text-tea-muted text-xs">{product.givenName}</span>
                        </div>
                        <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-tea-muted">
                             <span style={{ color: dotColor }}>●</span> {product.type}
                        </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 py-2 border-t border-tea-border mt-1">
                        <div>
                            <label className="text-[10px] text-tea-muted uppercase tracking-wider">Stock</label>
                            <div className="text-tea-text num">{product.stockGrams}g</div>
                        </div>
                        <div>
                             <label className="text-[10px] text-tea-muted uppercase tracking-wider">Retail</label>
                             <div className="text-tea-text num">${fmtNum(product.pricePerGramUSD)}</div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-2 border-t border-tea-border/50">
                        <button 
                            onClick={(e) => {e.stopPropagation(); handleProductUpdate(product.id, 'isFeatured', !product.isFeatured);}} 
                            className={`p-2 rounded-lg transition-colors ${product.isFeatured ? 'bg-tea-accent/10 text-tea-accent' : 'bg-tea-bg text-tea-muted hover:text-tea-text'}`}
                        >
                            <Star size={16} className={product.isFeatured ? "fill-tea-accent" : ""} />
                        </button>
                        {(!product.showWisdom && product.lore) && (
                            <button 
                                onClick={(e) => {e.stopPropagation(); handleProductUpdate(product.id, 'showWisdom', true);}} 
                                className="p-2 bg-tea-accent/10 rounded-lg text-tea-accent hover:bg-tea-accent/20 transition-colors"
                                title="Approve AI Wisdom"
                            >
                                <Check size={16}/>
                            </button>
                        )}
                        <button 
                            onClick={(e) => {e.stopPropagation(); handleProductUpdate(product.id, 'isPublic', !product.isPublic);}} 
                            className={`p-2 rounded-lg transition-colors ${product.isPublic ? 'bg-tea-bg text-tea-muted hover:text-tea-text' : 'bg-tea-muted/20 text-tea-muted'}`}
                        >
                            {product.isPublic ? <Eye size={16}/> : <EyeOff size={16}/>}
                        </button>
                        <button onClick={(e) => {e.stopPropagation(); setEditingProduct(product);}} className="p-2 bg-tea-bg rounded-lg text-tea-muted hover:text-tea-text transition-colors"><Pencil size={16}/></button>
                        <button onClick={(e) => {e.stopPropagation(); setQrProduct(product);}} className="p-2 bg-tea-bg rounded-lg text-tea-muted hover:text-tea-text transition-colors"><QrCode size={16}/></button>
                    </div>
                </div>
            )})}
        </div>

        {/* DESKTOP TABLE */}
        <div className="hidden md:block w-full max-w-7xl mx-auto border-x border-tea-border bg-tea-surface min-h-full">
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
                                                    <span className="text-[10px] text-tea-muted font-sans mt-0.5 truncate block">{product.givenName}</span>
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
                                        <GhostInput 
                                            value={product.stockGrams} 
                                            onSave={(val) => handleProductUpdate(product.id, 'stockGrams', val)}
                                            type="number"
                                            align="right"
                                            className="num text-xs"
                                        />
                                    ) : (
                                        <span className={`num text-xs ${isLow ? 'text-tea-accent font-bold' : 'text-tea-muted'}`}>
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