import React, { useState, useMemo, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { AnchoredMenu } from '../../components/shared/AnchoredMenu';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import {
  Loader2, FileSpreadsheet, Plus, Download,
  AlertTriangle, Archive, Pencil, ArrowUpDown, ArrowUp, ArrowDown, Layers, Settings, MoreHorizontal, Check, X as XIcon, Eye, EyeOff, Star, Sparkles, FlaskConical, RefreshCw, ChevronDown, ChevronRight, ChevronLeft, MapPin, Save, Columns, Square, CheckSquare, Leaf, Image as ImageIcon, Globe, Tag, PenLine, User, Receipt, History
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Papa from 'papaparse';
import { api } from '../../lib/api';
import { calculatePricing } from '../utils';
import { Product } from '../types';
import { QrCodeModal } from './QrCodeModal';
import { useRates, useCustomers } from '../hooks/useAdminData';
import { useToast } from './Toast';
import { useAppStore } from '../store';
import { selectHasBundle } from '../../lib/store';
import { useShallow } from 'zustand/react/shallow';
import { fmtNum } from '../../utils/formatNumber';
import { getThemeColor } from '../themeUtils';
import { TastingEditorModal } from './TastingEditorModal';
import { StockLedgerPanel } from './StockLedgerPanel';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import { TeaDetailsModal } from './TeaDetailsModal';
import { ContentLinksEditor } from './ContentLinksEditor';
import { useSampleStore } from '../../samples/sampleStore';
import { createEmptySampleSet, createEmptySample } from '../../samples/types';
import type { TeaType } from '../../components/TeaCompass/types';
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
import { AutocompleteInput } from '../../components/TeaCompass/AutocompleteInput';
import { buildVarietyDataMap, getTeaVarietySuggestions } from '../../data/teaVarieties';
import { CollectionShareSheet } from './collections/CollectionShareSheet';
import { AddToCollectionModal } from './collections/AddToCollectionModal';
import { QuickInvoiceModal } from './QuickInvoiceModal';
import {
  BULK_EDIT_FIELDS,
  DEFAULT_TEA_VIEWS,
  DEFAULT_TEAWARE_VIEWS,
  GROUPBY_OPTIONS,
  VIEW_FILTER_LABELS,
  VIEW_ICON_MAP,
} from './inventory/config';
import type { InventoryCategory } from './inventory/types';
import { isFeaturedButHidden } from './inventory/helpers';
import { InventoryRow } from './inventory/InventoryRow';
import { InventoryActionRail, INVENTORY_ACTION_RAIL_WIDTH } from './inventory/InventoryActionRail';
import { useInventoryProducts } from './inventory/useInventoryProducts';
import { InventoryConfirmations } from './inventory/InventoryConfirmations';
import { InventoryBulkToolbar } from './inventory/InventoryBulkToolbar';

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

// Shared inline-edit components + ProductEditPanel (extracted for reuse)
import { GhostInput, GhostTextarea, GhostAutocompleteInput, GhostSelect, VendorPicker, ImageManager, ProductEditPanel, CollapsibleSection, buildProductUpdatePayload } from './ProductEditPanel';

/**
 * SavedPill — micro feedback for successful inline edits
 * Renders "✓ Saved" with fade-in animation, pointer-events-none
 */
const SavedPill: React.FC<{ isVisible: boolean }> = ({ isVisible }) => {
  if (!isVisible) return null;
  return (
    <span
      className={`
        inline-block px-2 py-0.5 rounded-full
        text-ui-10 text-tea-gold font-medium
        whitespace-nowrap pointer-events-none
        animate-fadeIn
      `}
      aria-live="polite"
      aria-atomic="true"
    >
      ✓ Saved
    </span>
  );
};

export const InventoryView: React.FC<InventoryViewProps> = ({
  products, isLoading, isError, error, onImportClick, onAddClick, onRefresh,
  externalCategory = 'tea', externalSearchQuery = '',
  externalShowOptions, onOptionsToggle,
}) => {
  const { showToast } = useToast();

  // --- STORE ---
  // useShallow selector: component only re-renders when these specific fields change,
  // not on every unrelated store update (cart, account, etc.)
  const {
    inventoryColumns, toggleInventoryColumn, setInventoryColumns,
    savedViews, activeViewId, saveView, deleteView, setActiveView,
    inventoryGroupBy, setInventoryGroupBy,
    inventorySortConfig, setInventorySortConfig,
    priceMode, setPriceMode,
    aiPromptTemplate,
    currency, setCurrency,
    addToCart, setIsCartOpen,
  } = useAppStore(useShallow(s => ({
    inventoryColumns: s.inventoryColumns,
    toggleInventoryColumn: s.toggleInventoryColumn,
    setInventoryColumns: s.setInventoryColumns,
    savedViews: s.savedViews,
    activeViewId: s.activeViewId,
    saveView: s.saveView,
    deleteView: s.deleteView,
    setActiveView: s.setActiveView,
    inventoryGroupBy: s.inventoryGroupBy,
    setInventoryGroupBy: s.setInventoryGroupBy,
    inventorySortConfig: s.inventorySortConfig,
    setInventorySortConfig: s.setInventorySortConfig,
    priceMode: s.inventoryPriceMode,
    setPriceMode: s.setInventoryPriceMode,
    aiPromptTemplate: s.aiPromptTemplate,
    currency: s.currency,
    setCurrency: s.setCurrency,
    addToCart: s.addToCart,
    setIsCartOpen: s.setIsCartOpen,
  })));

  // Catalog bundle gates the "Carry from network" entry point. Per Step 2 of
  // the Network Rollout — partners with the Catalog bundle can carry teas
  // from Adrian's curated catalog into their own listings.
  // Reactive subscription, not a one-shot snapshot — store hydrates async after mount.
  const hasCatalogBundle = useAppStore(s => selectHasBundle(s, 'catalog'));

  const { addSampleSet, addSample, setActiveSet } = useSampleStore();

  // --- STATE ---
  const [searchParams, setSearchParams] = useSearchParams();
  const vendorFilter = searchParams.get('vendor') || '';
  const batchFilter = searchParams.get('batch') || '';
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
  const [viewTabsExpanded, setViewTabsExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 767px)').matches);
  // Viewport width, tracked so the action rail can tuck against the left edge of
  // the ProductEditPanel (whose width is responsive: md 360, lg 420, xl 440).
  const [winWidth, setWinWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    const onResize = () => setWinWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Reset glossary mode when switching categories
  useEffect(() => { setGlossaryMode(false); setGlossaryLimit(48); }, [externalCategory]);
  useEffect(() => { setPendingLimit(20); }, [filterType]);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

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

  // Intake batches: list (for the filter banner label) + the product-id set of
  // the active batch (for "show everything in this shipment").
  const [batches, setBatches] = useState<{ id: string; label: string; intake_date: string | null; item_count?: number }[]>([]);
  const [batchProductIds, setBatchProductIds] = useState<Set<string> | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.batches.list().then(r => { if (!cancelled) setBatches(r.batches || []); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!batchFilter) { setBatchProductIds(null); return; }
    let cancelled = false;
    setBatchProductIds(new Set()); // empty while loading → grid shows nothing rather than everything
    api.batches.products(batchFilter)
      .then(r => { if (!cancelled) setBatchProductIds(new Set(r.product_ids || [])); })
      .catch(() => { if (!cancelled) setBatchProductIds(new Set()); });
    return () => { cancelled = true; };
  }, [batchFilter]);

  const activeBatch = batches.find(b => b.id === batchFilter) || null;

  // Initialize/Sync Local Products for Optimistic Updates
  // Vendor filter narrows to one source; batch filter narrows to one shipment.
  useEffect(() => {
    let list = products;
    if (vendorFilter) {
      const vendorLower = vendorFilter.toLowerCase();
      list = list.filter(p => p.vendor && p.vendor.toLowerCase() === vendorLower);
    }
    if (batchFilter && batchProductIds) {
      list = list.filter(p => batchProductIds.has(p.id));
    }
    setLocalProducts(list);
  }, [products, vendorFilter, batchFilter, batchProductIds]);

  // Feature 2: Column Show/Hide popover
  const [showColumnsPopover, setShowColumnsPopover] = useState(false);
  const [showVendorDropdown, setShowVendorDropdown] = useState(false);

  // Feature 3: Row Grouping collapsed state
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Feature 4: Saved Views — initialize defaults + sync names/icons/sortConfig from defaults
  useEffect(() => {
    // Migration: remove retired default-drafts view
    if (savedViews.some(v => v.id === 'default-drafts')) {
      deleteView('default-drafts');
      if (activeViewId === 'default-drafts') setActiveView('default-all');
    }
    if (savedViews.length === 0) {
      DEFAULT_TEA_VIEWS.forEach(v => saveView(v));
      DEFAULT_TEAWARE_VIEWS.forEach(v => saveView(v));
      setActiveView('default-all');
    } else {
      // Sync default view names, icons, and sortConfig, and add any new defaults
      [...DEFAULT_TEA_VIEWS, ...DEFAULT_TEAWARE_VIEWS].forEach(def => {
        const existing = savedViews.find(v => v.id === def.id);
        if (!existing) {
          saveView(def);
        } else {
          const nameChanged = existing.name !== def.name || existing.icon !== def.icon;
          const sortChanged = JSON.stringify(existing.sortConfig) !== JSON.stringify(def.sortConfig);
          if (nameChanged || sortChanged) {
            saveView({ ...existing, name: def.name, icon: def.icon, sortConfig: def.sortConfig });
          }
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
    setScrollTop(0);
    if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0;
  }, [inventoryCategory]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset scroll position when filter or search changes so the virtual window starts at the top
  const prevFilterRef = useRef(filterType);
  const prevSearchRef = useRef(searchQuery);
  useEffect(() => {
    if (prevFilterRef.current === filterType && prevSearchRef.current === searchQuery) return;
    prevFilterRef.current = filterType;
    prevSearchRef.current = searchQuery;
    setScrollTop(0);
    if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0;
  }, [filterType, searchQuery]);

  // Feature 4: Save View prompt
  const [showSaveViewPrompt, setShowSaveViewPrompt] = useState(false);
  const [newViewName, setNewViewName] = useState('');
  // Desktop view-tab row: only these filters stay inline; the rest fold into a "More" menu
  // so the row never overflows horizontally. Custom saved views always stay inline.
  const [moreViewsOpen, setMoreViewsOpen] = useState(false);

  // Feature 5: Record Panel
  const [panelProduct, setPanelProduct] = useState<Product | null>(null);
  const [panelDirty, setPanelDirty] = useState(false);
  const [rowDropdownId, setRowDropdownId] = useState<string | null>(null);
  const [panelBreakdownOpen, setPanelBreakdownOpen] = useState(false);
  const [panelHistoryOpen, setPanelHistoryOpen] = useState(false);
  const [showContentLinks, setShowContentLinks] = useState(false);
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

  const loadProductTastings = async (events: Array<{ id: string }>, productName: string) => {
    try {
      interface TastingNoteRow {
        teaName?: string;
        rating?: number;
        isFavorite?: boolean;
        is_favorite?: boolean;
        impression?: string;
      }
      const allNotes: TastingNoteRow[] = [];
      for (const event of events.slice(0, 5)) {
        try {
          const notes = await api.events.getTastingNotes(event.id);
          const rawList = Array.isArray(notes) ? notes : (notes as { tasting_notes?: TastingNoteRow[] }).tasting_notes ?? [];
          const eventNotes = rawList as TastingNoteRow[];
          const productNotes = eventNotes.filter((n) =>
            n.teaName && n.teaName.toLowerCase().includes(productName.toLowerCase())
          );
          allNotes.push(...productNotes);
        } catch { /* skip failed event */ }
      }
      if (allNotes.length > 0) {
        const ratings = allNotes.filter((n) => n.rating).map((n) => n.rating as number);
        setProductTastingAgg({
          avgRating: ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0,
          totalNotes: allNotes.length,
          favoriteCount: allNotes.filter((n) => n.isFavorite || n.is_favorite).length,
          impressions: allNotes
            .filter((n) => n.impression)
            .map((n) => n.impression as string)
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
        const events = Array.isArray(data) ? data : ((data as { events?: Array<{ id: string }> }).events ?? []);
        if (!cancelled) {
          setProductEvents(events);
          if (events.length > 0) {
            loadProductTastings(events, panelProduct.givenName || panelProduct.productName || '');
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
  const [shareToNetworkOpen, setShareToNetworkOpen] = useState(false);
  const [invoiceFromInventoryOpen, setInvoiceFromInventoryOpen] = useState(false);
  const [addToCollectionOpen, setAddToCollectionOpen] = useState(false);
  const [bulkField, setBulkField] = useState<string>('status');
  const [bulkValue, setBulkValue] = useState<string>('');
  const [isBulkApplying, setIsBulkApplying] = useState(false);
  const lastSelectedIdxRef = useRef<number | null>(null);

  // Virtualization State
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const scrollRAFRef = useRef<number | null>(null);
  const [containerHeight, setContainerHeight] = useState(600);

  // The desktop table wrapper — kept for layout queries (the old floating drawer
  // anchored to it; the action rail replaced the drawer but the ref is harmless).
  const tableWrapperRef = useRef<HTMLDivElement>(null);

  // Modals
  const [qrProduct, setQrProduct] = useState<Product | null>(null);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [detailsProduct, setDetailsProduct] = useState<Product | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetInput, setResetInput] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [showEnrichConfirm, setShowEnrichConfirm] = useState(false);
  const [showVerificationResetConfirm, setShowVerificationResetConfirm] = useState(false);
  const [stockHistoryProduct, setStockHistoryProduct] = useState<{ id: string; name: string } | null>(null);

  // Permanent single-product delete (mistyped/junk row). deleteTarget holds the
  // product being confirmed; deleteInput must equal "delete" before it fires.
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteInput, setDeleteInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Track recently saved cells for visual feedback
  const [recentlySavedCells, setRecentlySavedCells] = useState<Set<string>>(new Set());
  const timeoutRefsMap = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Edit-mode save status — drives the persistent "Saving… / All changes saved"
  // indicator in the edit toolbar so inline auto-save is visible at all times
  // (the old per-cell pill alone was too easy to miss). `savingCount` tracks
  // in-flight writes; `lastSavedAt` flips the idle state to "saved" once one
  // has succeeded this session.
  const [savingCount, setSavingCount] = useState(0);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  const { data: rates = [] } = useRates();

  const {
    activeColumnDefs,
    activeDefaultViews,
    processedProducts,
    visibleCols,
    productIndexMap,
    groupedProducts,
    pendingCount,
    verificationStats,
  } = useInventoryProducts({
    localProducts,
    inventoryCategory,
    searchQuery,
    filterType,
    inventorySortConfig,
    inventoryColumns,
    inventoryGroupBy,
    priceMode,
    isEditMode,
  });

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
  // Canonical row sizing — tightened to match People/TeaTable (36px) so the
  // two surfaces feel like one design language. Split view stays slightly
  // more compressed.
  const ROW_HEIGHT = 36;
  const SPLIT_ROW_HEIGHT = 32;
  const BUFFER_ROWS = 5;
  const splitView = !!panelProduct;
  const effectiveRowHeight = splitView ? SPLIT_ROW_HEIGHT : ROW_HEIGHT;

  const splitViewCols = useMemo(() => {
    const essential = inventoryCategory === 'teaware'
      ? new Set(['productName', 'quantityUnits', 'pricePerGramUSD', 'costAmount'])
      : new Set(['productName', 'stockGrams', 'pricePerGramUSD', 'costPerGramUSD', 'costAmount']);
    return visibleCols.filter(col => essential.has(col.key));
  }, [visibleCols, inventoryCategory]);

  const splitColWidth = (key: string): string => {
    if (key === 'productName') return '';
    // Stock must always show its full gram value (e.g. 12,345), never clip — the
    // cell also carries the history + recount-flag buttons, so it needs real room.
    if (key === 'stockGrams') return 'w-[88px]';
    if (key === 'quantityUnits') return 'w-[60px]';
    return 'w-[78px]';
  };

  // Autocomplete data for the panel's product name field
  const panelNameSuggestions = useMemo(() => {
    const varieties = panelProduct ? getTeaVarietySuggestions(panelProduct.type as any) : [];
    const otherNames = products
      .filter(p => p.id !== panelProduct?.id && p.productName)
      .map(p => p.productName);
    return [...new Set([...varieties, ...otherNames])];
  }, [panelProduct?.id, panelProduct?.type, products]);

  const panelNameItemData = useMemo(() => {
    const varietyMap = panelProduct ? buildVarietyDataMap(panelProduct.type as any) : {};
    const productMap: Record<string, any> = {};
    for (const p of products) {
      if (p.productName && !productMap[p.productName]) productMap[p.productName] = p;
    }
    // product-specific data (has year) overwrites variety defaults where names overlap
    return { ...varietyMap, ...productMap };
  }, [panelProduct?.id, panelProduct?.type, products]);

  useEffect(() => {
      const el = scrollContainerRef.current;
      if (!el) return;
      setContainerHeight(el.clientHeight);

      // Dev-only guard: the scroll container relies on a chain of ancestor heights
      // (h-full / flex-1 / min-h-0) up through PageTransition, the routes wrapper,
      // <main>, AdminContent root, and App.tsx's outer h-screen container. If any
      // of those lose their height contract (a wrapper inserted without h-full,
      // a flex parent missing min-h-0, etc.) this element collapses to 0 and the
      // page silently stops scrolling. Warn loudly the moment that happens.
      const warnIfCollapsed = () => {
          if (!import.meta.env.DEV) return;
          if (!el.isConnected) return;
          if (el.clientHeight < 100) {
              console.error(
                  '[InventoryView] Scroll container collapsed to ' + el.clientHeight + 'px. ' +
                  'The h-full / flex-1 / min-h-0 chain from App.tsx down to InventoryView is broken. ' +
                  'See CLAUDE.md > "InventoryView height chain".',
                  el
              );
          }
      };
      // Check after layout settles
      const t = setTimeout(warnIfCollapsed, 500);

      const ro = new ResizeObserver((entries) => {
          for (const entry of entries) {
              setContainerHeight(entry.contentRect.height);
          }
          warnIfCollapsed();
      });
      ro.observe(el);
      return () => { clearTimeout(t); ro.disconnect(); };
  }, []);

  // Action rail derived state — the rail replaces the old floating selection
  // drawer + the per-row action cluster. It slides in whenever rows are selected.
  // Exactly one selected unlocks the Edit door to the full ProductEditPanel.
  const railOpen = selectedIds.size > 0 && !isEditMode;
  const railSingle = selectedIds.size === 1;
  // The rail always rides the far right edge of the viewport (rightOffset 0). When
  // the edit panel is open on desktop, the PANEL sits to the LEFT of the rail,
  // offset inward by the rail width, so the order reads spreadsheet -> edit panel
  // -> rail. On mobile the panel is a full-screen overlay (it covers the rail),
  // so the offset is unused there.
  const panelWidth = winWidth >= 1280 ? 440 : winWidth >= 1024 ? 420 : 360;
  const railRightOffset = 0;
  const panelRightOffset = !isMobile && railOpen ? INVENTORY_ACTION_RAIL_WIDTH : 0;

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

  // ── STABLE HANDLER INFRASTRUCTURE ──────────────────────────────────────────
  // Refs keep reactive values accessible in useCallback without listing them as
  // deps — so the callback reference stays stable across renders.
  const selectedIdsRef = useRef(selectedIds);
  const processedProductsRef = useRef(processedProducts);
  const productIndexMapRef = useRef(productIndexMap);
  const ratesRef = useRef(rates);
  const isEditModeRef = useRef(isEditMode);
  const panelProductRef = useRef(panelProduct);
  useLayoutEffect(() => { selectedIdsRef.current = selectedIds; }, [selectedIds]);
  useLayoutEffect(() => { processedProductsRef.current = processedProducts; }, [processedProducts]);
  useLayoutEffect(() => { productIndexMapRef.current = productIndexMap; }, [productIndexMap]);
  useLayoutEffect(() => { ratesRef.current = rates; }, [rates]);
  useLayoutEffect(() => { isEditModeRef.current = isEditMode; }, [isEditMode]);
  useLayoutEffect(() => { panelProductRef.current = panelProduct; }, [panelProduct]);

  // Stable open-panel — row passes the product object directly.
  // stableRowClick and stableLongPressSelect are declared after toggleSelectId below.
  const stableOpenPanel = useCallback((product: Product) => {
    setPanelProduct(product);
  }, [setPanelProduct]);

  // Stable dropdown toggle.
  const stableToggleDropdown = useCallback((productId: string | null) => {
    setRowDropdownId(productId);
  }, []);

  // Stable stock history — row has id + name.
  const stableStockHistory = useCallback((id: string, name: string) => {
    setStockHistoryProduct({ id, name });
  }, []);

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
    navigate(`/admin/compass?tab=sourcing`);
  }, [startNewCapture, updateCompassEntry, navigate]);

  const handleProductUpdate = useCallback(async (id: string, field: keyof Product, value: any, options?: { throwOnError?: boolean }) => {
    // 1. Optimistic Update — single setState call handles both the field change and any
    //    derived retail recalculation to avoid a double re-render.
    const pricingFieldsSet = new Set<keyof Product>(['costAmount', 'quantityPurchased', 'shippingRatePerKg', 'costCurrency']);
    const needsRetailCalc = pricingFieldsSet.has(field);
    setLocalProducts(prev => prev.map(p => {
      if (p.id !== id) return p;
      const updated = { ...p, [field]: value };
      if (needsRetailCalc) {
        const isTeaware = updated.type === 'Teaware';
        const calc = calculatePricing(
          Number(field === 'costAmount' ? value : p.costAmount) || 0,
          Number(field === 'shippingRatePerKg' ? value : p.shippingRatePerKg) || 13,
          Number(field === 'quantityPurchased' ? value : p.quantityPurchased) || 0,
          (String(field === 'costCurrency' ? value : p.costCurrency) || 'USD') as import('../types').Currency,
          ratesRef.current,
          isTeaware
        );
        if (calc.suggestedRetailUSD > 0) {
          updated.pricePerGramUSD = parseFloat(calc.suggestedRetailUSD.toFixed(4));
        }
      }
      return updated;
    }));
    setPanelDirty(true);

    // 2. Route special collection-backed fields, then use the shared field → DB mapper.
    if (field === 'isFeatured') {
      // Route through the Featured collection endpoint instead of writing the
      // legacy is_featured column. Optimistic local state is already updated above.
      // Refetch on success so the derived value (computed from active shop
      // collections) lands consistently in local state.
      setSavingCount(c => c + 1);
      try {
        await api.products.setFeatured(id, Boolean(value));
        setLastSavedAt(Date.now());
        onRefresh();
      } catch (err: any) {
        showToast(`Update failed: ${err.message}`, 'error');
        onRefresh();
        if (options?.throwOnError) throw err;
      } finally {
        setSavingCount(c => Math.max(0, c - 1));
      }
      return;
    }

    const dbPayload = buildProductUpdatePayload(field, value);
    if (!dbPayload) return; // Unsupported field for quick edit

    // 3. Fire & Forget (with Error Revert)
    setSavingCount(c => c + 1);
    try {
      await api.products.updateByDomain(id, dbPayload);
      setLastSavedAt(Date.now());
      // Show saved pill feedback for this cell
      const cellId = `${id}-${String(field)}`;
      setRecentlySavedCells(prev => new Set([...prev, cellId]));

      // Clear any existing timeout for this cell
      if (timeoutRefsMap.current.has(cellId)) {
        clearTimeout(timeoutRefsMap.current.get(cellId)!);
      }

      // Schedule removal after 1500ms
      const timeout = setTimeout(() => {
        setRecentlySavedCells(prev => {
          const next = new Set(prev);
          next.delete(cellId);
          return next;
        });
        timeoutRefsMap.current.delete(cellId);
      }, 1500);

      timeoutRefsMap.current.set(cellId, timeout);
    } catch (err: any) {
      showToast(`Update failed: ${err.message}`, 'error');
      onRefresh();
      if (options?.throwOnError) throw err;
    } finally {
      setSavingCount(c => Math.max(0, c - 1));
    }
  }, [setLocalProducts, setPanelDirty, showToast, onRefresh]);

  // Permanent delete — only reachable through the typed-"delete" confirmation.
  // Optimistically drops the row, then refetches to reconcile with the server.
  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    const { id, name } = deleteTarget;
    setIsDeleting(true);
    try {
      await api.products.delete(id);
      setLocalProducts(prev => prev.filter(p => p.id !== id));
      showToast(`${name} deleted`, 'success');
      setDeleteTarget(null);
      setDeleteInput('');
      onRefresh();
    } catch (err: any) {
      showToast(`Delete failed: ${err.message}`, 'error');
    } finally {
      setIsDeleting(false);
    }
  }, [deleteTarget, setLocalProducts, showToast, onRefresh]);

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
  const [pendingLimit, setPendingLimit] = useState(20);
  const [glossaryLimit, setGlossaryLimit] = useState(48);

  const handleBulkEnrich = async () => {
    const teasToEnrich = localProducts.filter(p => !p.lore && p.type !== 'Teaware' && p.type !== 'Misc');
    
    if (teasToEnrich.length === 0) {
        showToast("All teas already have wisdom.", "success");
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

                await api.products.updateByDomain(tea.id, {
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

  const handleResetStockVerification = async () => {
    try {
      await api.rpc.resetStockVerification();
      setLocalProducts(prev => prev.map(p => ({ ...p, stockVerifiedAt: null })));
      setShowVerificationResetConfirm(false);
      onRefresh();
      showToast('Verification reset — ready for a new stock check', 'success');
    } catch (err: any) {
      showToast(`Reset failed: ${err.message}`, 'error');
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
      await api.products.updateByDomain(product.id, {
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
        return api.products.updateByDomain(p.id, {
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
      await api.products.updateByDomain(productId, { lore: '', show_wisdom: false });
      setLocalProducts(prev => prev.map(p => p.id === productId ? { ...p, lore: '', showWisdom: false } : p));
      setReviewDrafts(prev => { const n = { ...prev }; delete n[productId]; return n; });
    } catch (err: any) {
      showToast(`Discard failed: ${err.message}`, 'error');
    }
  };

  const handleDiscardAll = async () => {
    const pending = processedProducts;
    try {
      await Promise.all(pending.map(p => api.products.updateByDomain(p.id, { lore: '', show_wisdom: false })));
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
  // Canonical column header — font-serif text-ui-11 uppercase tracking-display text-tea-text-sec.
  // Numeric columns (grams, retail/g, cost, capacity, units) right-align; everything else left.
  const RIGHT_ALIGN_KEYS = new Set([
    'stockGrams', 'pricePerGramUSD', 'costAmount', 'costPerGramUSD', 'capacityMl', 'quantityUnits',
  ]);
  const SortHeader = ({ colKey, label, align: alignProp }: { colKey: keyof Product, label: string, align?: 'left' | 'right' | 'center' }) => {
      const align: 'left' | 'right' | 'center' = alignProp ?? (RIGHT_ALIGN_KEYS.has(colKey as string) ? 'right' : 'left');
      const sortIndex = inventorySortConfig.findIndex(s => s.key === colKey);
      const sortEntry = sortIndex >= 0 ? inventorySortConfig[sortIndex] : null;
      const showBadge = inventorySortConfig.length > 1 && sortEntry;
      const ariaSort = sortEntry ? (sortEntry.direction === 'asc' ? 'ascending' : 'descending') : 'none';
      return (
        <th
          aria-sort={ariaSort}
          className={`font-sans text-ui-11 uppercase tracking-caps text-tea-text-sec font-medium px-3 py-1 border-b border-tea-border ${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'}`}
        >
          <button
            type="button"
            onClick={() => handleSort(colKey)}
            className={`group inline-flex items-center gap-1 hover:text-tea-text transition-colors select-none min-h-[24px] ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start'}`}
            aria-label={`Sort by ${label}${sortEntry ? `, currently ${sortEntry.direction === 'asc' ? 'ascending' : 'descending'}` : ''}`}
          >
             {label}
             <span className="flex-shrink-0 inline-flex items-center">
              {sortEntry ? (
                <>
                  {sortEntry.direction === 'asc' ? <ArrowUp size={10} className="ml-1 text-tea-readgold" /> : <ArrowDown size={10} className="ml-1 text-tea-readgold" />}
                  {showBadge && <span className="ml-0.5 text-ui-9 text-tea-readgold font-bold">{sortIndex + 1}</span>}
                </>
              ) : <ArrowUpDown size={10} className="opacity-0 group-hover:opacity-100 text-tea-text-dim ml-1 transition-opacity" />}
             </span>
          </button>
        </th>
      );
  };

  // --- FEATURE 5: Panel keyboard shortcuts ---
  useEffect(() => {
    if (!panelProduct) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setPanelProduct(null); e.preventDefault(); return; }
      // Never steal arrow keys while the user is typing in a field — they need
      // them to move the text cursor (e.g. editing a stock value in the panel).
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
      if (typing) return;
      const goTo = (next: Product | undefined) => {
        if (!next) return;
        setPanelProduct(next);
        document.querySelector(`[data-product-id="${next.id}"]`)
          ?.scrollIntoView({ block: 'nearest' });
        e.preventDefault();
      };
      if (e.key === 'ArrowUp') {
        const idx = productIndexMap.get(panelProduct.id) ?? -1;
        if (idx > 0) goTo(processedProducts[idx - 1]);
      } else if (e.key === 'ArrowDown') {
        const idx = productIndexMap.get(panelProduct.id) ?? -1;
        if (idx < processedProducts.length - 1) goTo(processedProducts[idx + 1]);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [panelProduct, processedProducts]);

  // Selection keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedIds.size > 0 && !panelProduct) {
        setSelectedIds(new Set());
        lastSelectedIdxRef.current = null;
        e.preventDefault();
      } else if (e.key === 'a' && (e.metaKey || e.ctrlKey) && !isEditMode && !panelProduct) {
        e.preventDefault();
        setSelectedIds(new Set(processedProducts.map(p => p.id)));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedIds, panelProduct, isEditMode, processedProducts]);

  // Long-press timers now live inside InventoryRow instances and clean up on unmount.

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
  const toggleSelectId = (id: string, idx: number, shiftKey = false) => {
    if (shiftKey && lastSelectedIdxRef.current !== null) {
      const start = Math.min(lastSelectedIdxRef.current, idx);
      const end = Math.max(lastSelectedIdxRef.current, idx);
      const rangeIds = processedProducts.slice(start, end + 1).map(p => p.id);
      const adding = !selectedIds.has(id);
      setSelectedIds(prev => {
        const next = new Set(prev);
        rangeIds.forEach(rid => adding ? next.add(rid) : next.delete(rid));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
      });
    }
    lastSelectedIdxRef.current = idx;
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === processedProducts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(processedProducts.map(p => p.id)));
    }
  };

  // Declared after toggleSelectId so useCallback deps resolve correctly.
  // The row body SELECTS — it never opens the edit panel (that door is the rail's
  // Edit button now). Plain click = single-select, replacing any prior selection;
  // clicking the already-single-selected row deselects it. Cmd/Ctrl-click and
  // shift-click ADD to the selection (toggle / range). Long-press on mobile adds
  // too (stableLongPressSelect). When the panel happens to be open, a plain click
  // closes it and re-selects, so the row stays information-first.
  const stableRowClick = useCallback((productId: string, globalIdx: number, e: React.MouseEvent) => {
    if (isEditModeRef.current) return;
    if (e.metaKey || e.ctrlKey) {
      toggleSelectId(productId, globalIdx, false);
      return;
    }
    if (e.shiftKey) {
      e.preventDefault();
      toggleSelectId(productId, globalIdx, true);
      return;
    }
    // Plain click — single-select replace. Close the panel if it was open.
    if (panelProductRef.current) setPanelProduct(null);
    const isOnlySelected = selectedIdsRef.current.size === 1 && selectedIdsRef.current.has(productId);
    if (isOnlySelected) {
      setSelectedIds(new Set());
      lastSelectedIdxRef.current = null;
    } else {
      setSelectedIds(new Set([productId]));
      lastSelectedIdxRef.current = globalIdx;
    }
  }, [toggleSelectId, setPanelProduct]);

  const stableLongPressSelect = useCallback((productId: string, globalIdx: number) => {
    toggleSelectId(productId, globalIdx, false);
  }, [toggleSelectId]);

  const handleBulkApply = async () => {
    if (selectedIds.size === 0 || !bulkField) return;
    setIsBulkApplying(true);
    const fieldDef = BULK_EDIT_FIELDS.find(f => f.key === bulkField);
    const parsedValue = fieldDef?.type === 'boolean' ? bulkValue === 'true' : bulkValue;
    try {
      const results = await Promise.allSettled(
        [...selectedIds].map(id => handleProductUpdate(id, bulkField as keyof Product, parsedValue, { throwOnError: true }))
      );
      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.length - succeeded;
      showToast(failed > 0 ? `Updated ${succeeded}, failed ${failed}` : `Updated ${succeeded} items`, failed > 0 ? 'error' : 'success');
      setSelectedIds(new Set());
    } catch (err: any) {
      showToast(`Bulk update failed: ${err.message}`, 'error');
    } finally {
      setIsBulkApplying(false);
    }
  };

  const handleBulkVisibility = async (makePublic: boolean) => {
    setIsBulkApplying(true);
    try {
      const results = await Promise.allSettled(
        [...selectedIds].map(id => handleProductUpdate(id, 'isPublic', makePublic, { throwOnError: true }))
      );
      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.length - succeeded;
      showToast(
        failed > 0 ? `${makePublic ? 'Published' : 'Unpublished'} ${succeeded}, failed ${failed}` : `${makePublic ? 'Published' : 'Unpublished'} ${succeeded} items`,
        failed > 0 ? 'error' : 'success'
      );
      setSelectedIds(new Set());
      lastSelectedIdxRef.current = null;
    } catch (err: any) {
      showToast(`Bulk update failed: ${err.message}`, 'error');
    } finally {
      setIsBulkApplying(false);
    }
  };

  // Rail Star action — toggle isFeatured across the selection. Reads the current
  // selection's prevailing state and flips it: if every selected row is already
  // featured, un-feature them all; otherwise feature them all.
  const handleBulkFeature = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    const allFeatured = ids.every(id => localProducts.find(p => p.id === id)?.isFeatured);
    const makeFeatured = !allFeatured;
    setIsBulkApplying(true);
    try {
      const results = await Promise.allSettled(
        ids.map(id => handleProductUpdate(id, 'isFeatured', makeFeatured, { throwOnError: true }))
      );
      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.length - succeeded;
      showToast(
        failed > 0 ? `${makeFeatured ? 'Featured' : 'Unfeatured'} ${succeeded}, failed ${failed}` : `${makeFeatured ? 'Featured' : 'Unfeatured'} ${succeeded} item${succeeded !== 1 ? 's' : ''}`,
        failed > 0 ? 'error' : 'success'
      );
      setSelectedIds(new Set());
      lastSelectedIdxRef.current = null;
    } catch (err: any) {
      showToast(`Bulk update failed: ${err.message}`, 'error');
    } finally {
      setIsBulkApplying(false);
    }
  };

  // Rail Archive action — set status to Archived across the selection.
  const handleBulkArchive = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setIsBulkApplying(true);
    try {
      const results = await Promise.allSettled(
        ids.map(id => handleProductUpdate(id, 'status', 'Archived', { throwOnError: true }))
      );
      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.length - succeeded;
      showToast(
        failed > 0 ? `Archived ${succeeded}, failed ${failed}` : `Archived ${succeeded} item${succeeded !== 1 ? 's' : ''}`,
        failed > 0 ? 'error' : 'success'
      );
      setSelectedIds(new Set());
      lastSelectedIdxRef.current = null;
    } catch (err: any) {
      showToast(`Bulk update failed: ${err.message}`, 'error');
    } finally {
      setIsBulkApplying(false);
    }
  };

  // Rail Edit action — open the full ProductEditPanel for the single selected row.
  // Edit toggles the full panel: press once to open, again to close it down.
  const handleRailEdit = () => {
    if (selectedIds.size !== 1) return;
    const id = [...selectedIds][0];
    if (panelProduct && panelProduct.id === id) { setPanelProduct(null); return; }
    const product = processedProducts.find(p => p.id === id) ?? localProducts.find(p => p.id === id);
    if (product) setPanelProduct(product);
  };

  // Spreadsheet-style row action: if the clicked product is in the selection, apply to all selected
  const handleSelectionAwareUpdate = useCallback(async (product: Product, field: keyof Product, value: any) => {
    if (selectedIdsRef.current.size > 0 && selectedIdsRef.current.has(product.id)) {
      setIsBulkApplying(true);
      try {
        const results = await Promise.allSettled(
          [...selectedIdsRef.current].map(id => handleProductUpdate(id, field, value, { throwOnError: true }))
        );
        const succeeded = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.length - succeeded;
        showToast(failed > 0 ? `Updated ${succeeded}, failed ${failed}` : `Updated ${succeeded} items`, failed > 0 ? 'error' : 'success');
      } catch (err: any) {
        showToast(`Update failed: ${err.message}`, 'error');
      } finally {
        setIsBulkApplying(false);
      }
    } else {
      handleProductUpdate(product.id, field, value);
    }
  }, [handleProductUpdate, showToast, setIsBulkApplying]);

  // Send selected products to a new sample set and navigate to /admin/samples
  const handleSendToSamples = () => {
    const selected = localProducts.filter(p => selectedIds.has(p.id));
    if (selected.length === 0) return;
    const newSet = createEmptySampleSet({ purpose: 'sourcing' });
    newSet.name = `Inventory — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    const newSamples = selected.map(p => ({
      ...createEmptySample(newSet.id),
      name: p.productName || p.givenName,
      chineseName: p.chineseName || undefined,
      type: p.type as TeaType,
      year: p.year,
      originRegion: p.originRegion,
      productId: p.id,
    }));
    newSet.sampleIds = newSamples.map(s => s.id);
    addSampleSet(newSet);
    newSamples.forEach(s => addSample(s));
    setActiveSet(newSet.id);
    setSelectedIds(new Set());
    lastSelectedIdxRef.current = null;
    navigate('/admin/compass?tab=samples');
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center text-center max-w-sm mx-auto py-20 px-6">
        <Loader2 size={20} className="animate-spin text-tea-text-dim mb-3" aria-hidden="true" />
        <div className="font-display text-ui-17 text-tea-text">Loading inventory</div>
        <p className="font-sans text-ui-11 text-tea-text-dim uppercase mt-1.5" style={{ letterSpacing: '0.08em' }}>Reading the ledger</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center text-center max-w-sm mx-auto py-20 px-6" role="alert">
        <AlertTriangle size={28} strokeWidth={1.25} className="text-tea-error mb-3" aria-hidden="true" />
        <div className="font-display text-ui-17 text-tea-text">Failed to load inventory</div>
        <p className="text-ui-12 text-tea-text-sec leading-relaxed mt-2">
          {error?.message || 'Could not connect to the server. Please check your connection and try again.'}
        </p>
        <button
          onClick={onRefresh}
          className="mt-4 inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-tea-border text-tea-text-sec hover:text-tea-text hover:bg-tea-accent-sub transition-colors text-xs"
        >
          <RefreshCw size={13} aria-hidden="true" />
          <span>Try again</span>
        </button>
      </div>
    );
  }

  // Reserve room on the right for the fixed ProductEditPanel and/or the action
  // rail so the spreadsheet never hides under either. On mobile the edit panel
  // is a full-screen overlay (no margin needed for it), but the action rail is a
  // 60px edge strip on EVERY screen size, so the row content must give up that
  // 60px when the rail is open or the stock number and price hide beneath it.
  const contentRightMargin = isMobile
    ? (railOpen ? INVENTORY_ACTION_RAIL_WIDTH : 0)
    : (panelProduct ? panelWidth : 0) + (railOpen ? INVENTORY_ACTION_RAIL_WIDTH : 0);

  return (
    <div
      className="h-full flex flex-col overflow-hidden bg-tea-bg transition-all duration-300"
      style={{ marginRight: contentRightMargin }}
    >

      {/* --- VENDOR FILTER BANNER --- */}
      {vendorFilter && (
        <div className="flex items-center gap-3 px-4 md:px-6 py-2 bg-tea-surface/60 border-b border-tea-accent-sub">
          <button
            onClick={() => navigate('/admin/people')}
            className="flex items-center gap-1.5 text-xs text-tea-text-sec hover:text-tea-text transition-colors"
          >
            <ChevronLeft size={14} />
            <span className="uppercase tracking-[0.15em] text-ui-10 font-bold">Sources</span>
          </button>
          <div className="w-px h-4 bg-tea-border" />
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <User size={14} className="text-tea-gold flex-shrink-0" />
            <span className="text-sm font-serif text-tea-text truncate">{vendorFilter}</span>
            <span className="text-ui-10 text-tea-text-sec uppercase tracking-[0.15em]">
              — {processedProducts.length} tea{processedProducts.length !== 1 ? 's' : ''} supplied
            </span>
          </div>
          <button
            onClick={() => { setSearchParams({}); }}
            className="flex items-center gap-1 text-ui-10 text-tea-text-sec hover:text-tea-text uppercase tracking-[0.15em] transition-colors px-2 py-1 hover:bg-tea-bg rounded-md"
          >
            <XIcon size={12} /> Clear Filter
          </button>
        </div>
      )}

      {batchFilter && (
        <div className="flex items-center gap-3 px-4 md:px-6 py-2 bg-tea-surface/60 border-b border-tea-accent-sub">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Layers size={14} className="text-tea-gold flex-shrink-0" />
            <span className="text-ui-10 uppercase tracking-[0.15em] text-tea-text-sec">Batch</span>
            <span className="text-sm font-serif text-tea-text truncate">
              {activeBatch?.label || 'Selected batch'}
              {activeBatch?.intake_date ? ` — ${activeBatch.intake_date}` : ''}
            </span>
            <span className="text-ui-10 text-tea-text-sec uppercase tracking-[0.15em]">
              — {processedProducts.length} tea{processedProducts.length !== 1 ? 's' : ''}
            </span>
          </div>
          <button
            onClick={() => { searchParams.delete('batch'); setSearchParams(searchParams); }}
            className="flex items-center gap-1 text-ui-10 text-tea-text-sec hover:text-tea-text uppercase tracking-[0.15em] transition-colors px-2 py-1 hover:bg-tea-bg rounded-md"
          >
            <XIcon size={12} /> Clear Filter
          </button>
        </div>
      )}

      {/* --- MERGED VIEWS + CONTROLS BAR (mobile) --- */}
      <div className={`md:hidden sticky top-0 z-sticky bg-tea-bg/95 backdrop-blur-md transition-colors ${isEditMode ? 'bg-tea-surface/95' : ''}`}>
        <div className="flex flex-col border-b border-tea-border">
        <div className="flex items-center px-2 pt-1.5 pb-0 gap-0.5 overflow-x-auto hide-scrollbar">
          {/* View tabs — all visible, horizontally scrollable */}
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
                      className={`tap-target relative flex items-center gap-1 shrink-0 ${isIconOnly && !viewTabsExpanded ? 'w-9 h-9 justify-center' : 'px-2 h-9 text-ui-11 uppercase tracking-[0.08em]'} rounded-md transition-colors ${
                        activeViewId === view.id
                          ? 'bg-tea-gold/10 text-tea-text ring-1 ring-tea-gold/40'
                          : view.filterType === 'Archived'
                          ? 'text-tea-text-dim/50 hover:text-tea-text-dim'
                          : 'text-tea-text-dim hover:text-tea-text-sec'
                      }`}
                      title={filterLabel}
                      aria-label={`Show ${filterLabel} view`}
                      aria-pressed={activeViewId === view.id}
                    >
                      {view.icon && VIEW_ICON_MAP[view.icon] && React.createElement(VIEW_ICON_MAP[view.icon], { size: 15 })}
                      {viewTabsExpanded && isIconOnly ? <span className="text-ui-11 uppercase tracking-[0.08em]">{filterLabel}</span> : (view.name || null)}
                      {!view.id.startsWith('default-') && (
                        <span
                          onClick={(e) => { e.stopPropagation(); deleteView(view.id); }}
                          className="ml-1 text-tea-text-sec/40 hover:text-tea-gold transition-colors"
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
                    className={`tap-target w-7 h-7 flex items-center justify-center shrink-0 rounded-md transition-colors ${activeInHidden ? 'text-tea-gold bg-tea-gold/10' : 'text-tea-text-dim hover:text-tea-text-sec'}`}
                    title={viewTabsExpanded ? 'Show fewer views' : 'Show all views'}
                    aria-label={viewTabsExpanded ? 'Show fewer inventory views' : 'Show all inventory views'}
                  >
                    {viewTabsExpanded ? <XIcon size={13} /> : <Plus size={13} />}
                  </button>
                )}
              </>
            );
          })()}
        </div>

        {/* Row 2: controls — price toggle + group + sort */}
        <div className="flex items-center px-2 py-1 gap-0 border-t border-tea-border">
          <span className="text-ui-9 uppercase tracking-[0.15em] text-tea-text-dim/50 px-1 mr-1">
            {VIEW_FILTER_LABELS[filterType] || filterType} · {processedProducts.length}
          </span>
          <div className="ml-auto flex items-center gap-0">
            <button
              onClick={() => setPriceMode(priceMode === 'retail' ? 'cost' : 'retail')}
              className={`tap-target w-8 h-8 flex items-center justify-center rounded-md transition-colors ${priceMode === 'cost' ? 'text-tea-gold bg-tea-gold/10' : 'text-tea-text-dim hover:text-tea-text-sec'}`}
              title={`Showing ${priceMode} prices — tap to switch`}
              aria-label={`Showing ${priceMode} prices, switch price mode`}
            >
              {priceMode === 'retail' ? <Tag size={14} /> : <Receipt size={14} />}
            </button>
            <div className="relative">
              <button
                onClick={() => { setShowMobileGroupBy(!showMobileGroupBy); setShowMobileSort(false); setShowOptions(false); }}
                className={`tap-target w-8 h-8 flex items-center justify-center transition-colors rounded-md ${showMobileGroupBy || inventoryGroupBy ? 'text-tea-gold' : 'text-tea-text-dim hover:text-tea-text-sec'}`}
                aria-label="Group inventory"
                aria-expanded={showMobileGroupBy}
              >
                <Layers size={14} />
              </button>
              {/* Group-by dropdown rendered outside backdrop-blur container below */}
            </div>
            <div className="relative">
              <button
                onClick={() => { setShowMobileSort(!showMobileSort); setShowMobileGroupBy(false); setShowOptions(false); }}
                className={`tap-target w-8 h-8 flex items-center justify-center transition-colors rounded-md ${showMobileSort ? 'text-tea-gold' : 'text-tea-text-dim hover:text-tea-text-sec'}`}
                aria-label="Sort inventory"
                aria-expanded={showMobileSort}
              >
                <ArrowUpDown size={14} />
              </button>
              {/* Sort dropdown rendered outside backdrop-blur container below */}
            </div>
          </div>
        </div>
        </div>
      </div>

      {/* --- MOBILE GROUP-BY DROPDOWN (outside backdrop-blur container) --- */}
      <div className="md:hidden">
            {showMobileGroupBy && (
              <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMobileGroupBy(false)} />
              <div className="fixed right-12 top-[82px] w-40 max-w-[calc(100vw-4rem)] bg-tea-surface border border-tea-border shadow-2xl rounded-xl z-popover py-1" role="menu">
                {GROUPBY_OPTIONS.map(opt => {
                  const isActive = (inventoryGroupBy || '') === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => {
                        setInventoryGroupBy(opt.value || null);
                        setShowMobileGroupBy(false);
                      }}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-ui-13 transition-colors ${isActive ? 'text-tea-gold font-medium' : 'text-tea-text-sec active:bg-tea-bg'}`}
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
              <div className="fixed right-2 top-[82px] w-[calc(100vw-16px)] max-w-[280px] bg-tea-surface border border-tea-border shadow-2xl rounded-xl z-popover py-2 px-1" role="menu">
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
                      className={`flex items-center justify-between gap-1 px-2.5 py-2 rounded-xl text-ui-12 transition-colors ${isActive ? 'bg-tea-gold/10 text-tea-text ring-1 ring-tea-gold/40 font-medium' : 'text-tea-text-sec active:bg-tea-bg'}`}
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
                className="fixed right-2 top-[82px] w-48 max-w-[calc(100vw-1rem)] bg-tea-surface border border-tea-border shadow-2xl rounded-xl z-popover py-1 flex flex-col max-h-[calc(100dvh-100px)] overflow-y-auto"
                role="menu"
                onKeyDown={(e) => { if (e.key === 'Escape') setShowOptions(false); }}
                tabIndex={-1}
                ref={(el) => el?.focus()}
              >
                  <button
                      onClick={() => { setFilterType(filterType === 'Pending' ? 'All' : 'Pending'); setShowOptions(false); }}
                      className={`px-3 py-2 text-left text-ui-11 flex items-center gap-2 hover:bg-tea-bg transition-colors ${filterType === 'Pending' ? 'text-tea-gold' : 'text-tea-text-sec'}`}
                  >
                      <Sparkles size={13} />
                      Pending AI
                      {pendingCount > 0 && (
                          <span className="ml-auto bg-tea-gold/20 text-tea-gold text-ui-9 font-bold px-1.5 py-0.5 rounded-full">{pendingCount}</span>
                      )}
                  </button>
                  <div className="h-px bg-tea-border"></div>
                  <button onClick={() => { onImportClick(); setShowOptions(false); }} className="px-3 py-2 text-left text-ui-11 text-tea-text-sec hover:text-tea-text hover:bg-tea-bg flex items-center gap-2 transition-colors">
                      <FileSpreadsheet size={13} /> Import CSV
                  </button>
                  <button onClick={() => { navigate('/admin/intake'); setShowOptions(false); }} className="px-3 py-2 text-left text-ui-11 text-tea-text-sec hover:text-tea-text hover:bg-tea-bg flex items-center gap-2 transition-colors">
                      <Layers size={13} /> Bulk intake
                  </button>
                  <button onClick={() => { handleExport(); setShowOptions(false); }} className="px-3 py-2 text-left text-ui-11 text-tea-text-sec hover:text-tea-text hover:bg-tea-bg flex items-center gap-2 transition-colors">
                      <Download size={13} /> Export CSV
                  </button>
                  <button
                      onClick={() => { setShowEnrichConfirm(true); setShowOptions(false); }}
                      disabled={isEnriching}
                      className="px-3 py-2 text-left text-ui-11 text-tea-text-sec hover:text-tea-text hover:bg-tea-bg flex items-center gap-2 transition-colors disabled:opacity-50"
                  >
                      {isEnriching ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                      Enrich Wisdom
                  </button>
                  <div className="h-px bg-tea-border"></div>
                  <button onClick={() => { setShowMaintenanceModal(true); setShowOptions(false); }} className="px-3 py-2 text-left text-ui-11 text-tea-text-sec hover:text-tea-text hover:bg-tea-bg flex items-center gap-2 transition-colors">
                      <AlertTriangle size={13} /> Maintenance
                  </button>
              </div>
              </>
            )}
      </div>

      {/* --- SAVED VIEWS TAB BAR (desktop only) --- */}
      <div className="hidden md:flex items-center gap-1 px-4 md:px-6 lg:px-10 py-1.5 md:min-h-12 md:py-0 border-b border-tea-border bg-tea-bg/90 backdrop-blur-md flex-wrap sticky top-0 z-dropdown">
        <h1 className="h2 text-tea-text shrink-0 mr-4">Stock</h1>
        {(() => {
          const allViews = savedViews.length > 0 ? savedViews.filter(v => inventoryCategory === 'teaware' ? v.id.includes('teaware') : !v.id.includes('teaware')) : activeDefaultViews;
          // Everyday filters stay inline; the rest fold into "More" so the row never overflows.
          // Custom saved views (non-default ids) always stay inline — the operator made them.
          const PRIMARY_FILTERS = new Set(['All', 'ForSale', 'Alerts', 'Unverified']);
          const isInline = (v: typeof allViews[number]) =>
            !v.id.startsWith('default-') || PRIMARY_FILTERS.has(v.filterType);
          const inlineViews = allViews.filter(isInline);
          const moreViews = allViews.filter(v => !isInline(v));
          const activeIsInMore = moreViews.some(v => v.id === activeViewId);

          const selectView = (view: typeof allViews[number]) => {
            setGlossaryMode(false);
            setActiveView(view.id);
            setInventoryColumns(view.columns);
            setInventorySortConfig(view.sortConfig);
            setFilterType(view.filterType);
            setInventoryGroupBy(view.groupBy);
          };

          const tabClass = (view: typeof allViews[number]) =>
            `relative flex items-center gap-1.5 px-3 py-1.5 text-ui-11 uppercase tracking-[0.12em] rounded-md whitespace-nowrap transition-colors ${
              activeViewId === view.id
                ? 'bg-tea-gold/10 text-tea-text ring-1 ring-tea-gold/40'
                : view.filterType === 'Archived'
                ? 'text-tea-text-dim/50 hover:text-tea-text-dim hover:bg-tea-surface'
                : 'text-tea-text-dim hover:text-tea-text-sec hover:bg-tea-surface'
            }`;

          return (
            <>
              {inlineViews.map(view => (
                <button
                  key={view.id}
                  onClick={() => selectView(view)}
                  title={VIEW_FILTER_LABELS[view.filterType] || view.name}
                  aria-label={`Show ${VIEW_FILTER_LABELS[view.filterType] || view.name} view`}
                  aria-pressed={activeViewId === view.id}
                  className={tabClass(view)}
                >
                  {view.icon && VIEW_ICON_MAP[view.icon] && React.createElement(VIEW_ICON_MAP[view.icon], { size: 13 })}
                  {view.name}
                  {!view.id.startsWith('default-') && (
                    <span
                      onClick={(e) => { e.stopPropagation(); deleteView(view.id); }}
                      className="ml-1 text-tea-text-sec/40 hover:text-tea-gold transition-colors"
                    >
                      <XIcon size={10} />
                    </span>
                  )}
                </button>
              ))}

              {moreViews.length > 0 && (
                <div className="shrink-0">
                  <AnchoredMenu
                    align="left"
                    width={180}
                    open={moreViewsOpen}
                    onOpenChange={setMoreViewsOpen}
                    trigger={(props) => (
                      <button
                        {...props}
                        aria-label="More views"
                        className={`relative flex items-center gap-1 px-3 py-1.5 text-ui-11 uppercase tracking-[0.12em] rounded-md whitespace-nowrap transition-colors ${
                          activeIsInMore
                            ? 'bg-tea-gold/10 text-tea-text ring-1 ring-tea-gold/40'
                            : 'text-tea-text-dim hover:text-tea-text-sec hover:bg-tea-surface'
                        }`}
                      >
                        {activeIsInMore
                          ? (VIEW_FILTER_LABELS[moreViews.find(v => v.id === activeViewId)!.filterType] || 'More')
                          : 'More'}
                        <ChevronDown size={12} className={`transition-transform ${moreViewsOpen ? 'rotate-180' : ''}`} />
                      </button>
                    )}
                  >
                    {(close) => moreViews.map(view => (
                      <button
                        key={view.id}
                        role="menuitem"
                        onClick={() => { selectView(view); close(); }}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-ui-11 uppercase tracking-[0.12em] text-left transition-colors ${
                          activeViewId === view.id
                            ? 'bg-tea-gold/10 text-tea-text'
                            : 'text-tea-text-sec hover:text-tea-text hover:bg-tea-bg'
                        }`}
                      >
                        {view.icon && VIEW_ICON_MAP[view.icon] && React.createElement(VIEW_ICON_MAP[view.icon], { size: 13 })}
                        {VIEW_FILTER_LABELS[view.filterType] || view.name}
                      </button>
                    ))}
                  </AnchoredMenu>
                </div>
              )}
            </>
          );
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
                className="bg-transparent border-b border-tea-border text-ui-10 text-tea-text outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg w-24 py-0.5 px-1"
              />
              <button onClick={() => { setShowSaveViewPrompt(false); setNewViewName(''); }} className="text-tea-text-sec/40 hover:text-tea-text-sec" aria-label="Dismiss"><XIcon size={10} /></button>
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
              <div className="w-px h-4 bg-tea-border shrink-0" />
              <button
                onClick={() => setGlossaryMode(prev => !prev)}
                className={`flex items-center justify-center w-8 h-8 rounded-md transition-colors shrink-0 ${
                  glossaryMode
                    ? 'bg-tea-gold/10 text-tea-text ring-1 ring-tea-gold/40'
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
      <div className={`sticky top-0 z-sticky border-b border-tea-border py-1 transition-colors hidden md:block ${isEditMode ? 'bg-tea-surface/95' : 'bg-tea-bg/90 backdrop-blur-md'}`}>

        {/* Desktop toolbar — actions only. Count + stock-history link live INSIDE the table
            card top strip (see canonical §20 inventory table in /design/system). */}
        <div className="flex px-4 md:px-6 max-w-7xl mx-auto items-center gap-4 py-1.5">
            {isEditMode && (
              savingCount > 0 ? (
                <span className="inline-flex items-center gap-1.5 label-caps text-tea-text-sec shrink-0" aria-live="polite">
                  <Loader2 size={12} className="animate-spin" aria-hidden="true" />
                  SAVING…
                </span>
              ) : lastSavedAt ? (
                <span className="inline-flex items-center gap-1.5 label-caps text-tea-gold shrink-0" aria-live="polite">
                  <Check size={12} aria-hidden="true" />
                  ALL CHANGES SAVED
                </span>
              ) : (
                <span className="label-caps text-tea-text-dim shrink-0">
                  CLICK CELLS TO EDIT — CHANGES SAVE AUTOMATICALLY
                </span>
              )
            )}

            <div className="flex items-center gap-4 ml-auto">
                {/* Actions Group */}
                <div className="flex items-center gap-2 relative">

                    {/* Toggle Edit Mode */}
                    <div className="flex flex-col items-start gap-0.5">
                      <button
                          onClick={() => setIsEditMode(!isEditMode)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs transition-colors ${
                              isEditMode
                              ? 'bg-tea-gold text-tea-bg font-semibold hover:bg-tea-gold/90 active:bg-tea-gold/80'
                              : 'border border-tea-border text-tea-text-sec hover:text-tea-text hover:bg-tea-accent-sub'
                          }`}
                      >
                          {isEditMode ? <Check size={13} /> : <Pencil size={13} />}
                          <span>{isEditMode ? 'Done' : 'Edit'}</span>
                      </button>
                      {isEditMode && (
                        <span className="text-ui-9 text-tea-text-dim uppercase tracking-[0.12em] px-1 whitespace-nowrap">
                          Select rows, then choose a field to bulk-edit
                        </span>
                      )}
                    </div>

                    <div className="w-px h-4 bg-tea-border mx-1"></div>

                    <button onClick={onAddClick} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 active:bg-tea-gold/80 transition-colors">
                        <Plus size={13} />
                        <span>New</span>
                    </button>

                    {/* Carry from network — gated by Catalog bundle. Step 2 of the Network Rollout. */}
                    {hasCatalogBundle && (
                      <Link
                        to="/admin/network?tab=catalog"
                        className="font-body text-ui-13 text-tea-text-sec hover:text-tea-gold transition-colors px-3 py-1.5 group"
                      >
                        Carry{' '}
                        <span className="inline-block transition-transform group-hover:translate-x-0.5">→</span>
                      </Link>
                    )}

                    {/* Columns Toggle */}
                    <AnchoredMenu
                      align="right"
                      width={176}
                      className="!py-2"
                      open={showColumnsPopover}
                      onOpenChange={setShowColumnsPopover}
                      trigger={(props) => (
                        <button
                          {...props}
                          className={`flex items-center gap-1 px-2 py-1.5 rounded-xl transition-colors text-xs ${showColumnsPopover ? 'text-tea-gold bg-tea-surface' : 'text-tea-text-sec hover:text-tea-text hover:bg-tea-surface'}`}
                          title="Show/Hide Columns"
                          aria-label="Show or hide columns"
                        >
                          <Columns size={14} />
                          <span className="hidden xl:inline tracking-wide">Cols</span>
                        </button>
                      )}
                    >
                      {() => (
                        <>
                          <div className="px-3 pb-1 text-ui-9 text-tea-text-sec/60 uppercase tracking-[0.2em]">Price View</div>
                          <div className="flex items-center gap-1 px-3 pb-2">
                            <button
                              onClick={() => setPriceMode('retail')}
                              className={`flex items-center gap-1.5 flex-1 justify-center py-1.5 rounded-md text-xs transition-colors ${priceMode === 'retail' ? 'bg-tea-gold/10 text-tea-text ring-1 ring-tea-gold/40' : 'text-tea-text-sec hover:bg-tea-bg'}`}
                              title="Show retail prices"
                            >
                              <Tag size={12} /> Retail
                            </button>
                            <button
                              onClick={() => setPriceMode('cost')}
                              className={`flex items-center gap-1.5 flex-1 justify-center py-1.5 rounded-md text-xs transition-colors ${priceMode === 'cost' ? 'bg-tea-gold/10 text-tea-text ring-1 ring-tea-gold/40' : 'text-tea-text-sec hover:bg-tea-bg'}`}
                              title="Show cost prices"
                            >
                              <Receipt size={12} /> Cost
                            </button>
                          </div>
                          <div className="mx-3 mb-2 border-t border-tea-border" />
                          <div className="px-3 pb-1.5 text-ui-9 text-tea-text-sec/60 uppercase tracking-[0.2em]">Visible Columns</div>
                          {activeColumnDefs.map(col => (
                            <label key={col.key} role="menuitem" className={`flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-tea-bg transition-colors cursor-pointer ${'alwaysVisible' in col && col.alwaysVisible ? 'opacity-50 cursor-not-allowed' : ''}`}>
                              <input
                                type="checkbox"
                                checked={inventoryColumns.includes(col.key)}
                                onChange={() => !('alwaysVisible' in col && col.alwaysVisible) && toggleInventoryColumn(col.key)}
                                disabled={'alwaysVisible' in col && col.alwaysVisible}
                                className="accent-tea-gold"
                              />
                              <span className="text-tea-text">{col.label}</span>
                            </label>
                          ))}
                        </>
                      )}
                    </AnchoredMenu>

                    {/* Group By Dropdown */}
                    <AnchoredMenu
                      align="right"
                      width={160}
                      open={showGroupByDropdown}
                      onOpenChange={setShowGroupByDropdown}
                      trigger={(props) => (
                        <button
                          {...props}
                          className={`flex items-center gap-1 px-2 py-1.5 rounded-xl text-xs transition-colors ${inventoryGroupBy ? 'text-tea-gold bg-tea-surface' : 'text-tea-text-sec hover:text-tea-text hover:bg-tea-surface'}`}
                          title="Group By"
                          aria-label="Group inventory"
                        >
                          <Layers size={14} />
                          <span className="hidden xl:inline tracking-wide">Group</span>
                        </button>
                      )}
                    >
                      {(close) => GROUPBY_OPTIONS.map(opt => (
                        <button
                          key={opt.value}
                          role="menuitem"
                          onClick={() => { setInventoryGroupBy(opt.value || null); close(); }}
                          className={`w-full px-3 py-1.5 text-left text-xs hover:bg-tea-bg transition-colors ${(inventoryGroupBy || '') === opt.value ? 'text-tea-gold' : 'text-tea-text-sec'}`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </AnchoredMenu>

                    {/* Vendor Filter Dropdown */}
                    <AnchoredMenu
                      align="right"
                      width={192}
                      className="max-h-60 overflow-y-auto"
                      open={showVendorDropdown}
                      onOpenChange={setShowVendorDropdown}
                      trigger={(props) => (
                        <button
                          {...props}
                          className={`flex items-center gap-1 px-2 py-1.5 rounded-xl text-xs transition-colors ${vendorFilter ? 'text-tea-gold bg-tea-surface' : 'text-tea-text-sec hover:text-tea-text hover:bg-tea-surface'}`}
                          title="Filter by vendor"
                          aria-label="Filter by vendor"
                        >
                          <User size={14} />
                          <span className="hidden xl:inline tracking-wide">Vendor</span>
                          {vendorFilter && <XIcon size={11} onClick={(e) => { e.stopPropagation(); setSearchParams({}); setShowVendorDropdown(false); }} className="ml-0.5 hover:text-tea-text" />}
                        </button>
                      )}
                    >
                      {(close) => (
                        <>
                          <button
                            role="menuitem"
                            onClick={() => { setSearchParams({}); close(); }}
                            className={`w-full px-3 py-1.5 text-left text-xs hover:bg-tea-bg transition-colors ${!vendorFilter ? 'text-tea-gold' : 'text-tea-text-sec'}`}
                          >
                            All Vendors
                          </button>
                          {[...new Set(localProducts.map(p => p.vendor).filter(Boolean))].sort().map(vendor => (
                            <button
                              key={vendor}
                              role="menuitem"
                              onClick={() => { setSearchParams({ vendor: vendor! }); close(); }}
                              className={`w-full px-3 py-1.5 text-left text-xs hover:bg-tea-bg transition-colors truncate ${vendorFilter === vendor ? 'text-tea-gold' : 'text-tea-text-sec'}`}
                            >
                              {vendor}
                            </button>
                          ))}
                        </>
                      )}
                    </AnchoredMenu>

                    <AnchoredMenu
                      align="right"
                      width={192}
                      open={showOptions}
                      onOpenChange={setShowOptions}
                      trigger={(props) => (
                        <button
                          {...props}
                          className="p-1.5 text-tea-text-sec hover:text-tea-text transition-colors rounded-xl hover:bg-tea-surface"
                          aria-label="Open inventory actions"
                        >
                          <MoreHorizontal size={16} />
                        </button>
                      )}
                    >
                      {(close) => (
                        <>
                            <button
                                role="menuitem"
                                onClick={() => { setFilterType(filterType === 'Pending' ? 'All' : 'Pending'); close(); }}
                                className={`px-4 py-2 text-left text-xs flex items-center gap-2 hover:bg-tea-bg transition-colors ${filterType === 'Pending' ? 'text-tea-gold' : 'text-tea-text-sec'}`}
                            >
                                <Sparkles size={14} />
                                Pending AI Approval
                                {pendingCount > 0 && (
                                    <span className="ml-auto bg-tea-gold/20 text-tea-gold text-ui-10 font-bold px-1.5 py-0.5 rounded-full">{pendingCount}</span>
                                )}
                            </button>
                            <button role="menuitem" onClick={() => { setShowContentLinks(true); close(); }} className="px-4 py-2 text-left text-xs text-tea-text-sec hover:text-tea-text hover:bg-tea-bg flex items-center gap-2 transition-colors">
                                <Tag size={14} /> Content Links
                            </button>
                            <button role="menuitem" onClick={() => { onImportClick(); close(); }} className="px-4 py-2 text-left text-xs text-tea-text-sec hover:text-tea-text hover:bg-tea-bg flex items-center gap-2 transition-colors">
                                <FileSpreadsheet size={14} /> Import CSV
                            </button>
                            <button role="menuitem" onClick={() => { navigate('/admin/intake'); close(); }} className="px-4 py-2 text-left text-xs text-tea-text-sec hover:text-tea-text hover:bg-tea-bg flex items-center gap-2 transition-colors">
                                <Layers size={14} /> Bulk intake
                            </button>
                            <button role="menuitem" onClick={() => { handleExport(); close(); }} className="px-4 py-2 text-left text-xs text-tea-text-sec hover:text-tea-text hover:bg-tea-bg flex items-center gap-2 transition-colors">
                                <Download size={14} /> Export CSV
                            </button>
                            <button
                                role="menuitem"
                                onClick={() => { setShowEnrichConfirm(true); close(); }}
                                disabled={isEnriching}
                                className="px-4 py-2 text-left text-xs text-tea-text-sec hover:text-tea-text hover:bg-tea-bg flex items-center gap-2 transition-colors disabled:opacity-50"
                            >
                                {isEnriching ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                                Enrich Missing Wisdom
                            </button>
                            {batches.filter(b => (b.item_count ?? 0) > 0 || b.label !== 'Unsorted').length > 0 && (
                              <>
                                <div className="h-px bg-tea-border my-1"></div>
                                <div className="px-4 pt-1 pb-0.5 text-ui-10 uppercase tracking-[0.15em] text-tea-text-dim flex items-center gap-2">
                                  <Layers size={12} /> Filter by batch
                                </div>
                                <div className="max-h-48 overflow-y-auto custom-scrollbar">
                                  {batches.map(b => (
                                    <button
                                      key={b.id}
                                      role="menuitem"
                                      onClick={() => { searchParams.set('batch', b.id); setSearchParams(searchParams); close(); }}
                                      className={`w-full px-4 py-1.5 text-left text-xs flex items-center gap-2 hover:bg-tea-bg transition-colors ${batchFilter === b.id ? 'text-tea-gold' : 'text-tea-text-sec hover:text-tea-text'}`}
                                    >
                                      <span className="truncate">{b.label}</span>
                                      {b.intake_date && <span className="text-tea-text-dim shrink-0">{b.intake_date}</span>}
                                      {batchFilter === b.id && <Check size={12} className="ml-auto shrink-0" />}
                                    </button>
                                  ))}
                                </div>
                              </>
                            )}
                            <div className="h-px bg-tea-border my-1"></div>
                            <button role="menuitem" onClick={() => { setShowMaintenanceModal(true); close(); }} className="px-4 py-2 text-left text-xs text-tea-text-sec hover:text-tea-text hover:bg-tea-bg flex items-center gap-2 transition-colors">
                                <AlertTriangle size={14} /> Maintenance
                            </button>
                        </>
                      )}
                    </AnchoredMenu>
                </div>
            </div>
        </div>
      </div>

      {/* ENRICHMENT PROGRESS BANNER */}
      {enrichProgress && (
        <div className="px-6 py-2 bg-tea-surface/80 border-b border-tea-border flex items-center gap-4">
          <Loader2 size={13} className="animate-spin text-tea-gold flex-shrink-0" />
          <div className="flex-1">
            <div className="text-ui-10 text-tea-text-sec uppercase tracking-[0.2em] mb-1.5">
              Generating &lsquo;{enrichProgress.currentName}&rsquo; — {enrichProgress.current} of {enrichProgress.total}
            </div>
            <div className="h-0.5 bg-tea-border rounded-full overflow-hidden">
              <div
                className="h-full bg-tea-gold transition-all duration-500"
                style={{ width: `${(enrichProgress.current / enrichProgress.total) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* --- SCROLL CONTAINER --- */}
      <div
        ref={scrollContainerRef}
        data-testid="inventory-scroll"
        className="flex-1 overflow-auto custom-scrollbar bg-tea-bg pt-3 pb-nav-gap"
        onScroll={(e) => {
          if (filterType === 'Pending') return;
          const top = e.currentTarget.scrollTop;
          if (scrollRAFRef.current) cancelAnimationFrame(scrollRAFRef.current);
          scrollRAFRef.current = requestAnimationFrame(() => setScrollTop(top));
        }}
      >

        {/* Active filter label was here — removed; count + label now live inside
            the bordered table card's top strip (canonical §20). */}

        {/* STOCK VERIFICATION BANNER */}
        {filterType === 'Unverified' && (
          <div className="max-w-7xl mx-auto px-4 md:px-0 pt-4 pb-2">
            <div className="bg-tea-surface rounded-xl px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-ui-10 text-tea-text-sec uppercase tracking-[0.15em]">
                  Confirm each tea's stock matches your shelf
                </span>
                <div className="flex items-center gap-3">
                  {verificationStats.remaining === 0 && verificationStats.total > 0 ? (
                    <span className="text-ui-10 text-tea-gold font-medium uppercase tracking-[0.15em]">All verified</span>
                  ) : (
                    <span className="text-ui-10 text-tea-text-dim tabular-nums">
                      {verificationStats.verified} of {verificationStats.total}
                    </span>
                  )}
                  {verificationStats.verified > 0 && (
                    <button
                      onClick={() => setShowVerificationResetConfirm(true)}
                      className="text-ui-10 text-tea-text-dim hover:text-tea-gold transition-colors uppercase tracking-[0.12em]"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>
              <div className="w-full bg-tea-bg rounded-full h-1 overflow-hidden">
                <div
                  className="h-full rounded-full transition-transform duration-500 ease-out bg-tea-gold/70 origin-left"
                  style={{ transform: `scaleX(${verificationStats.total > 0 ? verificationStats.verified / verificationStats.total : 0})` }}
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
              <span className="text-tea-text-sec text-ui-10 uppercase tracking-[0.2em]">
                {processedProducts.length} pending review
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleApproveAll}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-tea-gold text-tea-bg text-ui-10 font-bold uppercase tracking-[0.2em] rounded-xl hover:bg-tea-gold/90 transition-colors"
                >
                  <Check size={11} /> Approve All
                </button>
                <button
                  onClick={handleDiscardAll}
                  className="text-ui-10 text-tea-text-sec/60 hover:text-tea-gold uppercase tracking-[0.2em] transition-colors px-2 py-1.5"
                >
                  Discard All
                </button>
              </div>
            </div>

            {/* Review cards — limited to pendingLimit to avoid mounting 400+ complex editors at once */}
            {processedProducts.slice(0, pendingLimit).map(product => {
              const draft = reviewDrafts[product.id] || {};
              const isApproving = approvingIds.has(product.id);
              const isRegenerating = regeneratingId === product.id;
              const loreExtras = [draft.terroir, draft.processingNotes].filter(Boolean).join(' ');
              const storyPreview = (draft.lore || '') + (loreExtras ? ' ' + loreExtras : '');
              const fieldClass = "w-full bg-transparent border-b border-tea-border text-xs text-tea-text outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg focus:border-tea-gold transition-colors py-1";

              return (
                <div key={product.id} className="bg-tea-surface border border-tea-border rounded-xl overflow-hidden">
                  {/* Identity */}
                  <div className="px-5 py-3 bg-tea-bg/50 border-b border-tea-border flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-serif text-tea-text text-sm truncate">{product.productName}</span>
                      {product.chineseName && <span className="text-tea-text-sec text-xs font-serif flex-shrink-0">{product.chineseName}</span>}
                    </div>
                    <span className="text-ui-10 text-tea-text-sec uppercase tracking-[0.2em] flex-shrink-0">
                      {product.type}{product.originRegion ? ` · ${product.originRegion}` : ''}{product.year ? ` · ${product.year}` : ''}
                    </span>
                  </div>

                  <div className="p-5 space-y-4">
                    {/* Story preview */}
                    {storyPreview && (
                      <div className="bg-tea-bg/60 border border-tea-border rounded-xl p-4">
                        <div className="text-ui-10 text-tea-text-sec/60 uppercase tracking-[0.2em] mb-2">Story Preview</div>
                        <p className="text-tea-text/70 text-xs font-serif italic leading-relaxed">{storyPreview}</p>
                      </div>
                    )}

                    {/* Lore */}
                    <div>
                      <label className="text-ui-10 text-tea-text-sec uppercase tracking-[0.2em] block mb-1">Lore</label>
                      <textarea
                        value={draft.lore || ''}
                        onChange={e => setReviewDrafts(prev => ({ ...prev, [product.id]: { ...prev[product.id], lore: e.target.value } }))}
                        rows={3}
                        className="w-full bg-transparent border-b border-tea-border text-sm text-tea-text font-serif outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg focus:border-tea-gold transition-colors resize-none leading-relaxed py-1"
                      />
                    </div>

                    {/* Grid fields */}
                    <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                      <div>
                        <label className="text-ui-10 text-tea-text-sec uppercase tracking-[0.2em] block mb-1">Terroir</label>
                        <input value={draft.terroir || ''} onChange={e => setReviewDrafts(prev => ({ ...prev, [product.id]: { ...prev[product.id], terroir: e.target.value } }))} className={fieldClass} />
                      </div>
                      <div>
                        <label className="text-ui-10 text-tea-text-sec uppercase tracking-[0.2em] block mb-1">Processing</label>
                        <input value={draft.processingNotes || ''} onChange={e => setReviewDrafts(prev => ({ ...prev, [product.id]: { ...prev[product.id], processingNotes: e.target.value } }))} className={fieldClass} />
                      </div>
                      <div>
                        <label className="text-ui-10 text-tea-text-sec uppercase tracking-[0.2em] block mb-1">Mood</label>
                        <input value={draft.mood || ''} onChange={e => setReviewDrafts(prev => ({ ...prev, [product.id]: { ...prev[product.id], mood: e.target.value } }))} className={fieldClass} />
                      </div>
                      <div>
                        <label className="text-ui-10 text-tea-text-sec uppercase tracking-[0.2em] block mb-1">Tasting Notes</label>
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
                      <label className="text-ui-10 text-tea-text-sec uppercase tracking-[0.2em] block mb-1">Experience</label>
                      <textarea
                        value={draft.experience || ''}
                        onChange={e => setReviewDrafts(prev => ({ ...prev, [product.id]: { ...prev[product.id], experience: e.target.value } }))}
                        rows={2}
                        className="w-full bg-transparent border-b border-tea-border text-xs text-tea-text outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg focus:border-tea-gold transition-colors resize-none leading-relaxed py-1"
                      />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="px-5 py-3 border-t border-tea-border flex justify-between items-center bg-tea-bg/30">
                    <button
                      onClick={() => handleRegenerateOne(product)}
                      disabled={!!regeneratingId}
                      className="inline-flex items-center gap-1.5 px-2 py-1 text-xs text-tea-text-sec hover:text-tea-text transition-colors disabled:opacity-40"
                    >
                      {isRegenerating ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                      Regenerate
                    </button>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleDiscardOne(product.id)}
                        className="text-xs text-tea-text-sec hover:text-tea-text transition-colors"
                      >
                        Discard
                      </button>
                      <button
                        onClick={() => handleApproveOne(product)}
                        disabled={isApproving}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 active:bg-tea-gold/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
              <div className="flex flex-col items-center text-center max-w-sm mx-auto py-20 px-6">
                <Sparkles size={28} strokeWidth={1.25} className="text-tea-text-dim mb-3" />
                <div className="font-display text-ui-17 text-tea-text">All caught up</div>
                <p className="text-ui-12 text-tea-text-sec leading-relaxed mt-2">No pending wisdom to review.</p>
              </div>
            )}
            {processedProducts.length > pendingLimit && (
              <button
                onClick={() => setPendingLimit(n => n + 20)}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md border border-tea-border text-tea-text-sec hover:text-tea-text hover:bg-tea-accent-sub transition-colors text-xs"
              >
                Show more ({processedProducts.length - pendingLimit} remaining)
              </button>
            )}
          </div>
        )}

        {/* GLOSSARY MODE — card grid for browsing */}
        {glossaryMode && filterType !== 'Pending' && (
          <div className="pb-24 px-3 md:px-6 pt-3">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-5">
              {processedProducts.slice(0, glossaryLimit).map(product => {
                const dotColor = getThemeColor(product.type);
                return (
                  <button
                    key={product.id}
                    onClick={() => setDetailsProduct(product)}
                    className="group text-left bg-tea-surface/50 hover:bg-tea-surface rounded-xl overflow-hidden transition-all duration-200"
                  >
                    {product.imageUrl ? (
                      <div className="aspect-square overflow-hidden">
                        <img src={product.imageUrl} alt={product.productName} className="w-full h-full object-cover transition-transform duration-300" loading="lazy" />
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
                        <span className="text-ui-11 text-tea-text-sec">{product.type}</span>
                        {product.year && <span className="text-ui-11 text-tea-text-dim">· {product.year}</span>}
                      </div>
                      {product.tastingNotes && product.tastingNotes.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {product.tastingNotes.slice(0, 3).map(note => (
                            <span key={note} className="tag text-ui-9">{note}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
            {processedProducts.length === 0 && (
              <div className="flex flex-col items-center text-center max-w-sm mx-auto py-20 px-6">
                <Leaf size={28} strokeWidth={1.25} className="text-tea-text-dim mb-3" />
                <div className="font-display text-ui-17 text-tea-text">Nothing here yet</div>
              </div>
            )}
            {processedProducts.length > glossaryLimit && (
              <div className="pt-6 pb-8 flex justify-center">
                <button
                  onClick={() => setGlossaryLimit(n => n + 48)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-tea-border text-tea-text-sec hover:text-tea-text hover:bg-tea-accent-sub transition-colors text-xs"
                >
                  Show more ({processedProducts.length - glossaryLimit} remaining)
                </button>
              </div>
            )}
          </div>
        )}

        {/* MOBILE CARDS — only mounted on mobile; skipping on desktop prevents reconciling 400+ cards on every state change */}
        {isMobile && filterType !== 'Pending' && !glossaryMode && <div className="pb-24">
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
                        <span className="text-ui-12 uppercase tracking-[0.12em] font-semibold text-tea-text">{groupValue}</span>
                        <div className="flex-1 h-px bg-tea-border" />
                      </div>
                    )}

                    <div className={`${!product.isPublic ? 'opacity-50' : ''} ${idx % 2 === 0 ? 'bg-tea-bg' : 'bg-tea-surface/15'}`}>
                        {/* Main row — tap to expand, with inline action icons */}
                        <div
                            className="inv-row-accent w-full flex items-center transition-colors active:bg-tea-surface/60"
                            style={{ '--row-type-color': dotColor } as React.CSSProperties}
                        >
                            {/* Tappable name area — expands card. Canonical mobile signature:
                                font-display 17px name + font-sans 11px type/year/origin subtitle,
                                font-serif 15px tabular-nums stock + retail. */}
                            {/* Name area is informational now. Quick edit opens via
                                the pen icon on the right, not by tapping the name. */}
                            <div
                                className="flex-1 min-w-0 text-left px-4 py-3 flex items-center gap-2"
                            >
                                {/* Name + metadata */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <span className={`font-display text-ui-17 leading-tight truncate ${isOutOfStock ? 'text-tea-text-sec' : isLowStock ? 'text-tea-readgold' : 'text-tea-text'}`}>{product.productName}</span>
                                        {product.isFeatured && (
                          <>
                            <Star size={11} className="flex-shrink-0 text-tea-readgold" style={{ fill: 'currentColor' }} />
                            {isFeaturedButHidden(product) && <span className="font-body italic text-ui-10 text-tea-text-sec leading-none">hidden</span>}
                          </>
                        )}
                                        {!product.isPublic && <EyeOff size={10} className="flex-shrink-0 text-tea-text-dim" />}
                                    </div>
                                    <div className="flex items-center gap-1.5 mt-0.5 font-sans text-ui-11 text-tea-text-dim" style={{ letterSpacing: '0.02em' }}>
                                        <span className="inline-flex items-center gap-1.5">
                                          <span className="w-1.5 h-1.5 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: dotColor }} />
                                          {product.type}
                                        </span>
                                        {product.originRegion && (
                                            <>
                                                <span>·</span>
                                                <span className="truncate">{product.originRegion}</span>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Stock + Price — canonical serif numerics */}
                                <div className="flex-shrink-0 text-right min-w-[64px]">
                                    {inventoryCategory === 'teaware' ? (
                                      <>
                                        <div className="font-serif text-ui-15 text-tea-text tabular-nums">
                                          {product.quantityUnits ?? '—'} <span className="font-sans text-tea-text-dim text-ui-11">u</span>
                                        </div>
                                        <div className="font-sans text-ui-11 text-tea-text-dim">
                                          {product.material || product.teawareCategory || '—'}
                                        </div>
                                      </>
                                    ) : (
                                      <>
                                        <div className={`font-serif text-ui-15 tabular-nums ${isOutOfStock ? 'text-tea-text-dim' : isLowStock ? 'text-tea-readgold' : 'text-tea-text'}`}>
                                            {isOutOfStock ? '0' : Math.round(product.stockGrams)}
                                        </div>
                                        <div className={`font-serif text-ui-13 tabular-nums ${isOutOfStock ? 'text-tea-text-dim' : isLowStock ? 'text-tea-readgold' : 'text-tea-text-sec'}`}>
                                            {priceMode === 'cost'
                                              ? `${product.costPerGramUSD > 0 ? fmtNum(product.costPerGramUSD) : '0.00'}`
                                              : `${fmtNum(product.fixedRetailPriceUSD ?? product.pricePerGramUSD)}`
                                            }
                                            <span className="font-sans text-ui-11 text-tea-text-dim ml-0.5">/g</span>
                                        </div>
                                      </>
                                    )}
                                </div>
                            </div>

                            {/* Inline action icons — Quick edit (toggles the inline
                                panel below) + full Edit (opens the panel, where the
                                store preview now lives). The old Details/Alcove link
                                is gone: quick fields live in the inline panel, the
                                store view lives inside full Edit. */}
                            <div className="flex items-center gap-0 pr-2 flex-shrink-0">
                                <button
                                    onClick={() => setExpandedCardId(isExpanded ? null : product.id)}
                                    className={`tap-target w-10 h-10 flex items-center justify-center transition-colors rounded-xl ${isExpanded ? 'text-tea-gold-lt' : 'text-tea-text-dim hover:text-tea-text-sec'}`}
                                    aria-label={isExpanded ? 'Close quick edit' : 'Quick edit'}
                                    aria-expanded={isExpanded}
                                >
                                    <PenLine size={16} />
                                </button>
                                <button
                                    onClick={() => setPanelProduct(product)}
                                    className="tap-target w-10 h-10 flex items-center justify-center text-tea-text-dim hover:text-tea-text transition-colors rounded-xl"
                                    aria-label="Full edit"
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
                                className={`tap-target flex-shrink-0 w-10 h-10 mr-2 rounded-xl flex items-center justify-center transition-colors ${product.stockVerifiedAt ? 'bg-tea-surface text-tea-text' : 'bg-tea-surface text-tea-text-dim'}`}
                                aria-label={product.stockVerifiedAt ? `Clear verification for ${product.productName}` : `Mark ${product.productName} as verified`}
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
                                <div className="flex items-baseline justify-between gap-3 pb-2 mb-2" style={{ boxShadow: '0 1px 0 var(--tea-accent-sub)' }}>
                                  <span className="text-ui-13 text-tea-text font-serif italic truncate">
                                    {product.givenName || product.chineseName || '—'}
                                  </span>
                                  {product.vendor && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); navigate(`/admin/people?tab=sources&search=${encodeURIComponent(product.vendor!)}`); }}
                                      className="text-ui-11 text-tea-text-dim hover:text-tea-gold truncate shrink-0 flex items-center gap-1 transition-colors"
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
                                        <span className="text-ui-11 text-tea-text-sec uppercase tracking-[0.06em] shrink-0">Units</span>
                                        <div className="flex items-center gap-1">
                                          <GhostInput
                                            value={product.quantityUnits ?? ''}
                                            onSave={(val) => handleProductUpdate(product.id, 'quantityUnits', val)}
                                            type="number"
                                            align="right"
                                            className="num text-ui-13 text-tea-text font-medium"
                                          />
                                          <SavedPill isVisible={recentlySavedCells.has(`${product.id}-quantityUnits`)} />
                                        </div>
                                      </div>
                                      {priceMode === 'retail' ? (
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="text-ui-11 text-tea-text-sec uppercase tracking-[0.06em] shrink-0">Retail</span>
                                        <div className="flex items-center gap-1">
                                          <GhostInput
                                            value={(product.fixedRetailPriceUSD ?? product.pricePerGramUSD)?.toFixed(2) || ''}
                                            onSave={(val) => handleProductUpdate(product.id, 'fixedRetailPriceUSD', val ? Number(val) : null)}
                                            type="number"
                                            align="right"
                                            className="num text-ui-13 text-tea-text font-medium"
                                          />
                                          <SavedPill isVisible={recentlySavedCells.has(`${product.id}-fixedRetailPriceUSD`)} />
                                        </div>
                                      </div>
                                      ) : (
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="text-ui-11 text-tea-text-sec uppercase tracking-[0.06em] shrink-0">Cost</span>
                                        <div className="flex items-center gap-1">
                                          <GhostInput
                                            value={product.costAmount || ''}
                                            onSave={(val) => handleProductUpdate(product.id, 'costAmount', val)}
                                            type="number"
                                            align="right"
                                            className="num text-ui-13 text-tea-text-sec"
                                          />
                                          <SavedPill isVisible={recentlySavedCells.has(`${product.id}-costAmount`)} />
                                          <span className="text-ui-10 text-tea-text-dim">{product.costCurrency || 'USD'}</span>
                                        </div>
                                      </div>
                                      )}
                                    </>
                                  ) : (
                                    <>
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="text-ui-11 text-tea-text-sec uppercase tracking-[0.06em] shrink-0">Year</span>
                                        <div className="flex items-center gap-1">
                                          <GhostInput
                                            value={product.year || ''}
                                            onSave={(val) => handleProductUpdate(product.id, 'year', val)}
                                            type="number"
                                            align="right"
                                            placeholder="YYYY"
                                            className="num text-ui-13 text-tea-text-sec"
                                          />
                                          <SavedPill isVisible={recentlySavedCells.has(`${product.id}-year`)} />
                                        </div>
                                      </div>
                                      {priceMode === 'cost' ? (
                                      <>
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="text-ui-11 text-tea-text-sec uppercase tracking-[0.06em] shrink-0">Batch</span>
                                        <div className="flex items-center gap-1">
                                          <GhostInput
                                            value={product.costAmount || ''}
                                            onSave={(val) => handleProductUpdate(product.id, 'costAmount', val)}
                                            type="number"
                                            align="right"
                                            className="num text-ui-13 text-tea-text-sec"
                                          />
                                          <SavedPill isVisible={recentlySavedCells.has(`${product.id}-costAmount`)} />
                                          <span className="text-ui-10 text-tea-text-dim">{product.costCurrency || 'USD'}</span>
                                        </div>
                                      </div>
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="text-ui-11 text-tea-text-sec uppercase tracking-[0.06em] shrink-0">Bought</span>
                                        <div className="flex items-center gap-1">
                                          <GhostInput
                                            value={product.quantityPurchased || ''}
                                            onSave={(val) => handleProductUpdate(product.id, 'quantityPurchased', val)}
                                            type="number"
                                            align="right"
                                            className="num text-ui-13 text-tea-text-sec"
                                          />
                                          <SavedPill isVisible={recentlySavedCells.has(`${product.id}-quantityPurchased`)} />
                                          <span className="text-ui-10 text-tea-text-dim">g</span>
                                        </div>
                                      </div>
                                      </>
                                      ) : null}
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="text-ui-11 text-tea-text-sec uppercase tracking-[0.06em] shrink-0">Stock</span>
                                        <div className="flex items-center gap-1">
                                          <GhostInput
                                            value={product.stockGrams}
                                            onSave={(val) => handleProductUpdate(product.id, 'stockGrams', val)}
                                            type="number"
                                            align="right"
                                            className={`num text-ui-13 font-medium ${isLowStock ? 'text-tea-gold' : 'text-tea-text'}`}
                                          />
                                          <SavedPill isVisible={recentlySavedCells.has(`${product.id}-stockGrams`)} />
                                          <span className="text-ui-10 text-tea-text-dim">g</span>
                                        </div>
                                      </div>
                                      {priceMode === 'retail' ? (
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="text-ui-11 text-tea-text-sec uppercase tracking-[0.06em] shrink-0">Retail/g</span>
                                        <div className="flex items-center gap-1">
                                          <GhostInput
                                            value={(product.fixedRetailPriceUSD ?? product.pricePerGramUSD)?.toFixed(2) || ''}
                                            onSave={(val) => handleProductUpdate(product.id, 'fixedRetailPriceUSD', val ? Number(val) : null)}
                                            type="number"
                                            align="right"
                                            className={`num text-ui-13 font-medium ${product.fixedRetailPriceUSD != null ? 'text-tea-gold' : 'text-tea-text'}`}
                                          />
                                          <SavedPill isVisible={recentlySavedCells.has(`${product.id}-fixedRetailPriceUSD`)} />
                                        </div>
                                      </div>
                                      ) : null}
                                    </>
                                  )}
                                  {/* Recheck stock flag + Taste button */}
                                  <div className="col-span-2 flex items-center justify-between gap-2 pt-0.5">
                                    <div className="flex items-center gap-3">
                                      <button
                                        onClick={() => handleProductUpdate(product.id, 'recheckStock', !product.recheckStock)}
                                        className={`flex items-center gap-1.5 text-ui-11 transition-colors ${product.recheckStock ? 'text-tea-gold' : 'text-tea-text-dim hover:text-tea-text-sec'}`}
                                        aria-label={product.recheckStock ? 'Stock flagged for recount — clear flag' : 'Flag stock for recount'}
                                      >
                                        <span className="text-ui-12" aria-hidden="true">{product.recheckStock ? '⚠' : '☐'}</span>
                                        <span>{product.recheckStock ? 'Needs recount' : 'Mark for recount'}</span>
                                      </button>
                                      <span className="w-px h-3 bg-tea-border" />
                                      <button
                                        onClick={() => setTastingEditorProduct(product)}
                                        className="flex items-center gap-1.5 text-ui-11 text-tea-text-dim hover:text-tea-gold transition-colors"
                                      >
                                        <Sparkles size={12} />
                                        <span className="uppercase tracking-[0.06em]">Taste</span>
                                      </button>
                                    </div>
                                    {product.stockVerifiedAt && (
                                      <span className="text-ui-10 text-tea-text-dim">
                                        Verified {new Date(product.stockVerifiedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Tasting — button + notes */}
                                <div className="mt-2 pt-2" style={{ boxShadow: '0 -1px 0 var(--tea-accent-sub)' }}>
                                  {product.tastingNotes && product.tastingNotes.length > 0 ? (
                                    <button
                                      onClick={() => setTastingEditorProduct(product)}
                                      className="w-full text-left group/tasting"
                                    >
                                      <div className="flex flex-wrap gap-1.5">
                                        {product.tastingNotes.map(note => (
                                          <span key={note} className="tag text-ui-11">{note}</span>
                                        ))}
                                      </div>
                                      {product.mood && (
                                        <div className="text-ui-12 text-tea-text-dim italic mt-1.5">{product.mood}</div>
                                      )}
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => setTastingEditorProduct(product)}
                                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs text-tea-text-dim hover:text-tea-gold hover:bg-tea-gold/5 transition-colors active:scale-[0.98]"
                                    >
                                      <Sparkles size={14} />
                                      <span>Add tasting notes</span>
                                    </button>
                                  )}
                                </div>

                                {/* Toggle actions — star, public, archive */}
                                <div className="flex items-center gap-1 mt-2 pt-2" style={{ boxShadow: '0 -1px 0 var(--tea-accent-sub)' }}>
                                    <div className="flex flex-col items-center gap-0.5">
                                      <button
                                          onClick={() => handleProductUpdate(product.id, 'isFeatured', !product.isFeatured)}
                                          className={`tap-target w-10 h-10 flex items-center justify-center rounded-xl transition-colors ${product.isFeatured ? 'text-tea-gold bg-tea-gold/10' : 'text-tea-text-dim hover:text-tea-text-sec hover:bg-tea-surface/50'}`}
                                          aria-label={product.isFeatured ? 'Unfeature' : 'Feature'}
                                      >
                                          <Star size={16} className={product.isFeatured ? "fill-tea-gold" : ""} />
                                      </button>
                                      {isFeaturedButHidden(product) && <span className="font-body italic text-ui-10 text-tea-text-sec leading-none">hidden</span>}
                                    </div>
                                    <button
                                        onClick={() => handleProductUpdate(product.id, 'isPublic', !product.isPublic)}
                                        className={`tap-target w-10 h-10 flex items-center justify-center rounded-xl transition-colors ${product.isPublic ? 'text-tea-text-sec bg-tea-surface/30' : 'text-tea-text-dim hover:text-tea-text-sec hover:bg-tea-surface/50'}`}
                                        aria-label={product.isPublic ? 'Make private' : 'Make public'}
                                    >
                                        {product.isPublic ? <Eye size={16} /> : <EyeOff size={16} />}
                                    </button>
                                    <button
                                        onClick={() => {
                                          const newStatus = product.status === 'Archived' ? 'Active' : 'Archived';
                                          handleProductUpdate(product.id, 'status', newStatus);
                                        }}
                                        className={`tap-target w-10 h-10 flex items-center justify-center rounded-xl transition-colors ${product.status === 'Archived' ? 'text-tea-gold bg-tea-gold/10' : 'text-tea-text-dim hover:text-tea-text-sec hover:bg-tea-surface/50'}`}
                                        aria-label={product.status === 'Archived' ? 'Unarchive' : 'Archive'}
                                    >
                                        <Archive size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleRestock(product)}
                                        className="tap-target w-10 h-10 flex items-center justify-center rounded-xl transition-colors text-tea-text-dim hover:text-tea-gold hover:bg-tea-gold/10"
                                        aria-label="Restock via Curate"
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
              <div className="flex flex-col items-center text-center max-w-sm mx-auto py-20 px-6">
                <Leaf size={28} strokeWidth={1.25} className="text-tea-text-dim mb-3" />
                <div className="font-display text-ui-17 text-tea-text">Nothing here yet</div>
                <p className="text-ui-13 text-tea-text-sec leading-relaxed mt-2">No products match the current filter.</p>
              </div>
            )}
        </div>}

        {/* DESKTOP TABLE — canonical §20 inventory table from /design/system:
            bordered card containing top strip → headers → rows → bottom strip. */}
        {!isMobile && filterType !== 'Pending' && !glossaryMode && <div ref={tableWrapperRef} className="relative w-full max-w-7xl mx-auto px-3 md:px-4 lg:px-6">
          <div className="bg-tea-surface border border-tea-border rounded-xl overflow-hidden">

          {/* Top strip — canonical: stock-history link + active-view label (left) + item counter (right). */}
          {processedProducts.length > 0 && (
            <div className="flex items-center justify-between gap-3 px-4 py-2 border-b border-tea-border">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  onClick={() => {
                    const target = panelProduct ?? processedProducts[0];
                    if (target) setStockHistoryProduct({ id: target.id, name: target.givenName || target.productName });
                  }}
                  className="text-ui-11 uppercase tracking-caps font-sans text-tea-text-sec hover:text-tea-text transition-colors inline-flex items-center gap-1.5 shrink-0"
                >
                  <History size={12} aria-hidden="true" /> View stock history
                </button>
                {VIEW_FILTER_LABELS[filterType] && (() => {
                  const activeView = [...(savedViews.length > 0 ? savedViews : (inventoryCategory === 'teaware' ? DEFAULT_TEAWARE_VIEWS : DEFAULT_TEA_VIEWS))].find(v => v.id === activeViewId);
                  const IconComp = activeView?.icon ? VIEW_ICON_MAP[activeView.icon] : null;
                  return (
                    <span className="inline-flex items-center gap-1.5 label-caps text-tea-text-dim truncate">
                      <span className="text-tea-text-dim">·</span>
                      {IconComp && <IconComp size={12} className="text-tea-text-dim shrink-0" />}
                      <span className="truncate">{VIEW_FILTER_LABELS[filterType]}</span>
                    </span>
                  );
                })()}
              </div>
              <span className="label-caps text-tea-text-dim tabular-nums shrink-0">{processedProducts.length} items</span>
            </div>
          )}

          {/* --- GROUPED VIEW --- */}
          {groupedProducts ? (
            <div>
              {/* Table header (sticky) — canonical font-serif uppercase tracking-display */}
              <table className="w-full table-fixed border-collapse">
                <colgroup>
                  {visibleCols.map(col => <col key={col.key} className={col.defaultWidth} />)}
                </colgroup>
                <thead className="sticky top-0 z-sticky bg-tea-bg/95 backdrop-blur-sm">
                  <tr>
                    {visibleCols.map(col => (
                      <SortHeader key={col.key} colKey={col.key as keyof Product} label={col.label} />
                    ))}
                  </tr>
                </thead>
              </table>

              {/* Grouped sections */}
              {Object.entries(groupedProducts).map(([groupKey, { items, totalStock, totalRetail }]) => {
                const isCollapsed = collapsedGroups.has(groupKey);
                return (
                  <div key={groupKey}>
                    <button
                      onClick={() => setCollapsedGroups(prev => {
                        const next = new Set(prev);
                        if (next.has(groupKey)) next.delete(groupKey); else next.add(groupKey);
                        return next;
                      })}
                      className="w-full flex items-center gap-3 px-5 py-2.5 bg-tea-bg/60 border-b border-tea-border hover:bg-tea-accent-sub transition-colors text-left"
                    >
                      {isCollapsed ? <ChevronRight size={14} className="text-tea-text-sec" /> : <ChevronDown size={14} className="text-tea-text-sec" />}
                      <span className="font-display text-ui-15 text-tea-text">{groupKey}</span>
                      <span className="label-caps text-tea-text-dim">{items.length} items</span>
                      <span className="font-serif text-ui-13 text-tea-text-sec tabular-nums ml-auto">{totalStock}g</span>
                      <span className="font-serif text-ui-13 text-tea-text-sec tabular-nums">${fmtNum(totalRetail)}</span>
                    </button>
                    {!isCollapsed && (
                      <table className="w-full table-fixed border-collapse">
                        <colgroup>
                          {splitView ? (
                            splitViewCols.map(col => <col key={col.key} className={splitColWidth(col.key)} />)
                          ) : (
                            visibleCols.map(col => <col key={col.key} className={col.defaultWidth} />)
                          )}
                        </colgroup>
                        <tbody>
                          {items.map((product) => {
                            const globalIdx = productIndexMap.get(product.id) ?? 0;
                            return (
                              <React.Fragment key={product.id}>
                                <InventoryRow
                                  product={product}
                                  globalIdx={globalIdx}
                                  isSelected={selectedIds.has(product.id)}
                                  focusedCol={focusedCell?.row === globalIdx ? (focusedCell.col ?? null) : null}
                                  isEditMode={isEditMode}
                                  visibleCols={visibleCols}
                                  splitViewCols={splitViewCols}
                                  splitView={splitView}
                                  rowHeight={effectiveRowHeight}
                                  isPanelOpen={panelProduct?.id === product.id}
                                  isDropdownOpen={rowDropdownId === product.id}
                                  onRowClick={stableRowClick}
                                  onLongPressSelect={stableLongPressSelect}
                                  onProductUpdate={handleProductUpdate}
                                  onSelectionAwareUpdate={handleSelectionAwareUpdate}
                                  onOpenPanel={stableOpenPanel}
                                  onToggleDropdown={stableToggleDropdown}
                                  onStockHistory={stableStockHistory}
                                  onRestock={handleRestock}
                                  onDeleteRequest={(p) => { setDeleteTarget({ id: p.id, name: p.givenName || p.productName }); setDeleteInput(''); }}
                                  showToast={showToast}
                                  navigate={navigate}
                                />
                              </React.Fragment>
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
                    {splitView ? (
                      splitViewCols.map(col => <col key={col.key} className={splitColWidth(col.key)} />)
                    ) : (
                      visibleCols.map(col => <col key={col.key} className={col.defaultWidth} />)
                    )}
                </colgroup>

                {/* Canonical header — auto-aligned: numerics right, others left. */}
                <thead className="sticky top-0 z-sticky bg-tea-bg/95 backdrop-blur-sm">
                    <tr>
                        {splitView ? (
                          splitViewCols.map(col => (
                            <SortHeader key={col.key} colKey={col.key as keyof Product} label={col.label} />
                          ))
                        ) : (
                          visibleCols.map(col => (
                            <SortHeader key={col.key} colKey={col.key as keyof Product} label={col.label} />
                          ))
                        )}
                    </tr>
                </thead>

                <tbody>
                    {processedProducts.map((product, idx) => {
                        const globalIdx = idx;
                        return (
                          <React.Fragment key={product.id}>
                            <InventoryRow
                              product={product}
                              globalIdx={globalIdx}
                              isSelected={selectedIds.has(product.id)}
                              focusedCol={focusedCell?.row === globalIdx ? (focusedCell.col ?? null) : null}
                              isEditMode={isEditMode}
                              visibleCols={visibleCols}
                              splitViewCols={splitViewCols}
                              splitView={splitView}
                              rowHeight={effectiveRowHeight}
                              isPanelOpen={panelProduct?.id === product.id}
                              isDropdownOpen={rowDropdownId === product.id}
                              onRowClick={stableRowClick}
                              onLongPressSelect={stableLongPressSelect}
                              onProductUpdate={handleProductUpdate}
                              onSelectionAwareUpdate={handleSelectionAwareUpdate}
                              onOpenPanel={stableOpenPanel}
                              onToggleDropdown={stableToggleDropdown}
                              onStockHistory={stableStockHistory}
                              onRestock={handleRestock}
                              onDeleteRequest={(p) => { setDeleteTarget({ id: p.id, name: p.givenName || p.productName }); setDeleteInput(''); }}
                              showToast={showToast}
                              navigate={navigate}
                            />
                          </React.Fragment>
                        );
                    })}
                </tbody>
            </table>
          )}

          {/* Canonical bottom strip — counter + (placeholder for) load-more. The data
              source is already virtualized, so we simply restate the total. */}
          {processedProducts.length > 0 && (
            <div className="px-5 py-3 border-t border-tea-border flex items-center justify-between bg-tea-surface">
              <span className="font-serif text-ui-13 text-tea-text-dim tabular-nums">
                {processedProducts.length} of {localProducts.length}
              </span>
              {processedProducts.length < localProducts.length && (
                <span className="text-ui-12 text-tea-text-dim">Refine filters to surface more</span>
              )}
            </div>
          )}

          {processedProducts.length === 0 && (
            <div className="flex flex-col items-center text-center max-w-sm mx-auto py-20 px-6">
              <Leaf size={28} strokeWidth={1.25} className="text-tea-text-dim mb-3" />
              <div className="font-display text-ui-17 text-tea-text">Nothing here yet</div>
              <p className="text-ui-13 text-tea-text-sec leading-relaxed mt-2">No products match the current filter.</p>
            </div>
          )}
          </div>
        </div>}

      </div>

      {/* --- MODALS --- */}
      {showContentLinks && (
        <ContentLinksEditor
          products={products}
          onClose={() => setShowContentLinks(false)}
        />
      )}

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
          const idx = productIndexMap.get(detailsProduct.id) ?? -1;
          if (idx < processedProducts.length - 1) setDetailsProduct(processedProducts[idx + 1]);
        }) : undefined}
        onPrev={detailsProduct ? (() => {
          const idx = productIndexMap.get(detailsProduct.id) ?? -1;
          if (idx > 0) setDetailsProduct(processedProducts[idx - 1]);
        }) : undefined}
      />

      <InventoryConfirmations
        showEnrichConfirm={showEnrichConfirm}
        onCloseEnrichConfirm={() => setShowEnrichConfirm(false)}
        onConfirmEnrich={() => { setShowEnrichConfirm(false); void handleBulkEnrich(); }}
        isEnriching={isEnriching}
        showVerificationResetConfirm={showVerificationResetConfirm}
        onCloseVerificationResetConfirm={() => setShowVerificationResetConfirm(false)}
        onConfirmVerificationReset={handleResetStockVerification}
        verificationStats={verificationStats}
        showResetConfirm={showResetConfirm}
        onCloseResetConfirm={() => setShowResetConfirm(false)}
        resetInput={resetInput}
        onResetInputChange={setResetInput}
        isResetting={isResetting}
        onConfirmDatabaseReset={handleResetDatabase}
        showMaintenanceModal={showMaintenanceModal}
        onCloseMaintenanceModal={() => setShowMaintenanceModal(false)}
        onOpenDatabaseReset={() => { setShowMaintenanceModal(false); setShowResetConfirm(true); }}
        deleteTarget={deleteTarget}
        onCloseDeleteConfirm={() => { setDeleteTarget(null); setDeleteInput(''); }}
        deleteInput={deleteInput}
        onDeleteInputChange={setDeleteInput}
        isDeleting={isDeleting}
        onConfirmDelete={handleConfirmDelete}
      />

      {/* --- ACTION RAIL ---
          The one surface for acting on selected rows. Slides in from the right
          edge; tucks against the left edge of the ProductEditPanel on desktop.
          All handlers reuse the existing bulk business logic. */}
      <InventoryActionRail
        open={railOpen}
        selectedCount={selectedIds.size}
        isSingle={railSingle}
        isBusy={isBulkApplying}
        rightOffset={railRightOffset}
        onEdit={handleRailEdit}
        onPublish={() => handleBulkVisibility(true)}
        onStar={handleBulkFeature}
        onSample={handleSendToSamples}
        onShare={() => setShareToNetworkOpen(true)}
        onInvoice={() => setInvoiceFromInventoryOpen(true)}
        onCollect={() => setAddToCollectionOpen(true)}
        onArchive={handleBulkArchive}
        onClear={() => { setSelectedIds(new Set()); lastSelectedIdxRef.current = null; }}
      />

      {/* --- FEATURE 5: RECORD PANEL (Side Panel) ---
          Renders the shared ProductEditPanel. Admin-specific behavior
          (optimistic local state, derived retail recalc, isFeatured collection
          routing, error revert) is preserved by passing handleProductUpdate
          via onUpdate. */}
      <ProductEditPanel
        product={panelProduct}
        rates={rates}
        onClose={() => setPanelProduct(null)}
        onUpdate={handleProductUpdate}
        products={processedProducts}
        onNavigate={(p) => setPanelProduct(p)}
        filterLabel={filterType !== 'All' ? (VIEW_FILTER_LABELS[filterType] || filterType) : undefined}
        onShowStorePreview={(p) => setDetailsProduct(p)}
        rightOffset={panelRightOffset}
      />

      <InventoryBulkToolbar
        selectedCount={selectedIds.size}
        isEditMode={isEditMode}
        splitView={splitView}
        bulkField={bulkField}
        bulkValue={bulkValue}
        isBulkApplying={isBulkApplying}
        onBulkFieldChange={(field) => { setBulkField(field); setBulkValue(''); }}
        onBulkValueChange={setBulkValue}
        onApply={handleBulkApply}
        onCancel={() => setSelectedIds(new Set())}
      />

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

      <CollectionShareSheet
        open={shareToNetworkOpen}
        productIds={selectedIds.size > 0 ? [...selectedIds] : panelProduct ? [panelProduct.id] : []}
        onClose={() => setShareToNetworkOpen(false)}
        onSuccess={() => {
          // The sheet itself shows the success card with copy/WhatsApp/view-collection
          // actions. We only need to close + clear selection when the user finishes.
          setShareToNetworkOpen(false);
          if (selectedIds.size > 0) {
            setSelectedIds(new Set());
            lastSelectedIdxRef.current = null;
          }
        }}
      />

      <AddToCollectionModal
        open={addToCollectionOpen}
        productIds={selectedIds.size > 0 ? [...selectedIds] : panelProduct ? [panelProduct.id] : []}
        onClose={() => setAddToCollectionOpen(false)}
        onSuccess={({ added, skipped, created }) => {
          setAddToCollectionOpen(false);
          setSelectedIds(new Set());
          lastSelectedIdxRef.current = null;
          const base = created ? 'Collection created' : `Added ${added} item${added !== 1 ? 's' : ''}`;
          showToast(skipped > 0 ? `${base} · ${skipped} already in it` : base, 'success');
        }}
      />

      <QuickInvoiceModal
        isOpen={invoiceFromInventoryOpen}
        onClose={() => setInvoiceFromInventoryOpen(false)}
        onSuccess={() => {
          setInvoiceFromInventoryOpen(false);
          setSelectedIds(new Set());
          lastSelectedIdxRef.current = null;
        }}
        products={localProducts}
        showToast={showToast}
        prefill={{
          items: (() => {
            const ids = selectedIds.size > 0 ? [...selectedIds] : panelProduct ? [panelProduct.id] : [];
            return ids
              .map(id => localProducts.find(p => p.id === id))
              .filter((p): p is Product => !!p)
              .map(p => ({
                name: p.givenName || p.productName,
                productId: p.id,
              }));
          })(),
        }}
      />

    </div>
  );
};
