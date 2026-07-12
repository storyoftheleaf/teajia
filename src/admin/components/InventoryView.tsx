import React, { useState, useMemo, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { mediaUrl } from '../../lib/mediaUrl';
import { AnchoredMenu } from '../../components/shared/AnchoredMenu';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Loader2, FileSpreadsheet, Plus, Download,
  AlertTriangle, Archive, Pencil, ArrowUpDown, ArrowUp, ArrowDown, Layers, Settings, MoreHorizontal, Check, X as XIcon, Eye, EyeOff, Star, Sparkles, FlaskConical, RefreshCw, ChevronDown, ChevronRight, ChevronLeft, MapPin, Search, Columns, Square, CheckSquare, Leaf, Image as ImageIcon, Globe, Tag, PenLine, User, Receipt, History, PackageCheck
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
  MOBILE_TEA_ALL_ORDER,
  TEA_COLUMN_DEFS,
  VIEW_FILTER_LABELS,
  VIEW_ICON_MAP,
} from './inventory/config';
import type { InventoryCategory, ColDef } from './inventory/types';
import { isFeaturedButHidden } from './inventory/helpers';
import { InventoryRow } from './inventory/InventoryRow';
import { QuickEditInlineRow } from './inventory/QuickEditInlineRow';
import { InventoryActionRail, INVENTORY_ACTION_RAIL_WIDTH } from './inventory/InventoryActionRail';
import { useInventoryProducts } from './inventory/useInventoryProducts';
import { InventoryConfirmations } from './inventory/InventoryConfirmations';
import { InventoryBulkToolbar } from './inventory/InventoryBulkToolbar';
import { IncomingReceiptsPanel } from './inventory/IncomingReceiptsPanel';
import { StockMovementPanel } from './inventory/StockMovementPanel';

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
  onSearchQueryChange?: (query: string) => void;
  onCategoryChange?: (category: 'tea' | 'teaware') => void;
  activeAccountName?: string;
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
  externalShowOptions, onOptionsToggle, onSearchQueryChange, onCategoryChange,
  activeAccountName = '',
}) => {
  const { showToast } = useToast();

  // --- STORE ---
  // useShallow selector: component only re-renders when these specific fields change,
  // not on every unrelated store update (cart, account, etc.)
  const {
    inventoryColumns, toggleInventoryColumn, setInventoryColumns,
    inventoryMobileColWidths, setInventoryMobileColWidth,
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
    inventoryMobileColWidths: s.inventoryMobileColWidths,
    setInventoryMobileColWidth: s.setInventoryMobileColWidth,
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

  // "Carry from network" moved to the sidebar (gated there by the Catalog
  // bundle). The toolbar no longer renders it.

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
  const [mobileSearchExpanded, setMobileSearchExpanded] = useState(false);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);
  const mobileSearchTriggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (mobileSearchExpanded) mobileSearchInputRef.current?.focus();
  }, [mobileSearchExpanded]);
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
      // Default ids are schema-owned: migrate their complete semantics. Custom
      // views remain operator-owned and are never rewritten here.
      [...DEFAULT_TEA_VIEWS, ...DEFAULT_TEAWARE_VIEWS].forEach(def => {
        const existing = savedViews.find(v => v.id === def.id);
        if (!existing) {
          saveView(def);
        } else if (JSON.stringify(existing) !== JSON.stringify(def)) {
          saveView(def);
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

  // Desktop view-tab row: only these filters stay inline; the rest fold into a "More" menu
  // so the row never overflows horizontally. Custom saved views always stay inline.
  const [moreViewsOpen, setMoreViewsOpen] = useState(false);

  // Feature 5: Record Panel
  const [panelProduct, setPanelProduct] = useState<Product | null>(null);
  // Inline quick-edit — opened by a long-press on a row. Holds the id of the one
  // row that is currently expanded; the panel slides down directly under it.
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  // Dismiss the quick-edit the moment you click/tap anywhere outside it. We
  // ignore clicks inside the panel itself (data-quick-edit) and on the row that
  // owns it (the long-press toggle handles its own row), so a normal click
  // elsewhere closes it.
  useEffect(() => {
    if (!expandedRowId) return;
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('[data-quick-edit]')) return;
      if (target.closest(`tr[data-product-id="${expandedRowId}"]`)) return;
      setExpandedRowId(null);
    };
    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => document.removeEventListener('pointerdown', handlePointerDown, true);
  }, [expandedRowId]);
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

  // Mobile column-resize drag state. We track the active drag in a ref (no
  // re-render per pointer move) and write the new width straight to the store,
  // which is the single source `mobileColPxWidth` reads from. On release the
  // width is already persisted (the store is `partialize`d), so it survives
  // reload. Only the header cells carry a handle (see SortHeader); body rows
  // never resize.
  const colResizeRef = useRef<{ key: string; startX: number; startWidth: number; pointerId: number } | null>(null);

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
  const [stockMovement, setStockMovement] = useState<{ product: Product; trigger: HTMLElement | null; initialType?: 'recount' } | null>(null);

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
    visibleCols: allVisibleCols,
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

  // Every visible column is rendered on every screen size. On mobile the table
  // becomes horizontally swipeable (see `mobileHScroll` below) with the Product
  // column pinned, so we no longer drop Origin/Type to fit — the user swipes to
  // reach them instead. Keeping header, colgroup, and rows driven off one list
  // keeps the table from ever desyncing its column count.
  const visibleCols = useMemo(
    () => allVisibleCols,
    [allVisibleCols],
  );

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

  // --- MOBILE HORIZONTAL SWIPE ---
  // On a phone (no panel open) the table is too wide to fit, so instead of
  // hiding columns we let it scroll sideways with the Product column pinned to
  // the left. The user swipes left/right to bring Stock → Retail → Cost →
  // Source into view while the tea's name stays put. Fixed px widths (below)
  // make the table exceed the viewport so the surrounding overflow-auto
  // container scrolls it; `table-fixed` honours the colgroup widths. When the
  // edit panel is open it becomes a full-screen overlay on mobile, so this mode
  // turns off and the compact split columns take over.
  const mobileHScroll = isMobile && !splitView;

  // The inventory table now reads the SAME on phone and desktop: same column
  // order, same left-alignment, same tight spacing, same font size, same
  // fixed-px column widths that hug the data to the left. Desktop keeps only its
  // extra card buffer (gutter + border + rounded corners) and the page-level
  // vertical scroll; it does NOT get the mobile bounded-height scroll box or the
  // pinned first column (those exist only because a phone is narrow). So:
  //   mobileHScroll  → mobile-only structure (bounded scroll box, sticky column)
  //   unifiedLayout  → shared look (order, alignment, tightness, font, px widths)
  const unifiedLayout = !splitView;

  // Per-column pixel widths for the swipeable mobile table. Product is the
  // pinned anchor; numeric columns stay tight; text columns get a little more.
  // Tight by default: every column is sized to hug its content so the data
  // nests hard to the left and reads as a dense block, not a spread. Long text
  // columns (origin, vendor) are allowed to truncate a little rather than
  // reserve width for the longest possible value. The user can drag any column
  // wider; these are just the snug starting widths.
  const MOBILE_COL_PX: Record<string, number> = {
    productName: 158,
    type: 62,
    year: 48,
    originRegion: 96,
    stockGrams: 48,
    verified: 52,
    costAmount: 48,
    costPerGramUSD: 48,
    pricePerGramUSD: 48,
    teawareCategory: 96,
    material: 96,
    capacityMl: 60,
    quantityUnits: 48,
    vendor: 96,
    form: 62,
  };
  // A drag-resized width (persisted in the store) wins over the default; absent
  // keys fall back to MOBILE_COL_PX. Never below MIN so a column can't vanish.
  const MIN_MOBILE_COL_PX = 44;
  const mobileColPxWidth = (key: string) => {
    const stored = inventoryMobileColWidths[key];
    const base = typeof stored === 'number' ? stored : (MOBILE_COL_PX[key] ?? 90);
    return Math.max(MIN_MOBILE_COL_PX, base);
  };

  // Mobile keeps every visible column (swipe to reach them); only the panel's
  // compact split view still trims down, since it shares the screen on desktop.
  //
  // For the mobile All view we also REORDER and inject Source (vendor): the swipe
  // table reads Product (pinned) → Year → Type → Stock → Cost → Source → Origin,
  // the order Adrian wants the eye to meet first. Source isn't in the desktop All
  // view's columns, so we pull its ColDef from TEA_COLUMN_DEFS only here. Desktop
  // and every non-All view keep their natural visibleCols order untouched.
  const renderCols = useMemo(() => {
    if (isMobile && splitView) return splitViewCols;
    if (unifiedLayout && inventoryCategory === 'tea' && filterType === 'All') {
      const byKey = new Map<string, ColDef>(visibleCols.map(c => [c.key, c]));
      // Source (vendor) and Leaf (form) aren't in the desktop All view's columns,
      // so pull their ColDefs from TEA_COLUMN_DEFS to show them on the mobile swipe.
      for (const key of ['vendor', 'form']) {
        const def = TEA_COLUMN_DEFS.find(c => c.key === key);
        if (def) byKey.set(key, def);
      }
      const ordered: ColDef[] = [];
      // Listed keys first, in the requested order (skip any the price-mode
      // toggle has hidden, e.g. Cost when in retail mode).
      for (const key of MOBILE_TEA_ALL_ORDER) {
        const col = byKey.get(key);
        if (col) { ordered.push(col); byKey.delete(key); }
      }
      // Any remaining visible columns keep their natural order after these.
      for (const col of visibleCols) {
        if (byKey.has(col.key)) ordered.push(col);
      }
      return ordered;
    }
    return visibleCols;
  }, [isMobile, splitView, splitViewCols, visibleCols, unifiedLayout, inventoryCategory, filterType]);
  const renderSplitCols = useMemo(
    () => splitViewCols,
    [splitViewCols],
  );

  // Total width the swipeable table needs so it overflows the viewport. Driving
  // both the table's minWidth and the colgroup off the same map keeps the three
  // table render paths (grouped header, grouped body, flat) in lockstep.
  const mobileTableMinWidth = useMemo(
    () => renderCols.reduce((sum, c) => sum + mobileColPxWidth(c.key), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [renderCols, inventoryMobileColWidths],
  );
  // Both phone and desktop now use the fixed-px hug so the data nests left and
  // the columns sit as close together as they do on mobile. (minWidth forces the
  // overflow that the mobile scroll box scrolls; on desktop the card is wider
  // than the sum, so the columns simply sit left with empty space to the right.)
  const mobileTableStyle = unifiedLayout ? { minWidth: mobileTableMinWidth } : undefined;
  const renderColEl = (col: ColDef) =>
    unifiedLayout
      ? <col key={col.key} style={{ width: mobileColPxWidth(col.key) }} />
      : <col key={col.key} className={col.defaultWidth} />;

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

  const stableStockMovement = useCallback((product: Product, trigger: HTMLElement) => {
    setStockHistoryProduct(null);
    setStockMovement({ product, trigger });
  }, []);

  const stableStockRecount = useCallback((product: Product, trigger: HTMLElement) => {
    setStockHistoryProduct(null);
    setStockMovement({ product, trigger, initialType: 'recount' });
  }, []);

  const handleMovementRecorded = useCallback((productId: string, afterBalance: number, unit: 'g' | 'unit', destination?: { id: string; afterBalance: number }) => {
    const updatedStock = unit === 'unit' ? { quantityUnits: afterBalance } : { stockGrams: afterBalance };
    setLocalProducts(prev => prev.map(product => {
      if (product.id === productId) return { ...product, ...updatedStock, stockKnownAt: new Date().toISOString() };
      if (product.id === destination?.id) return { ...product, ...(unit === 'unit' ? { quantityUnits: destination.afterBalance } : { stockGrams: destination.afterBalance }), stockKnownAt: new Date().toISOString() };
      return product;
    }));
    setPanelProduct(prev => prev?.id === productId ? { ...prev, ...updatedStock, stockKnownAt: new Date().toISOString() } : prev);
    setStockMovement(prev => prev?.product.id === productId ? { ...prev, product: { ...prev.product, ...updatedStock, stockKnownAt: new Date().toISOString() } } : prev);
    onRefresh();
  }, [onRefresh, setLocalProducts]);

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

    if (field === 'shownInShop') {
      // Stock spine step 2: the location-owner curation gate has its own
      // owner-tier-gated endpoint, separate from the per-domain product update.
      // Optimistic local state is already applied above.
      setSavingCount(c => c + 1);
      try {
        await api.products.updateShown(id, Boolean(value));
        setLastSavedAt(Date.now());
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
  const SortHeader = ({ colKey, label, align: alignProp, sticky, forceLeft, resizable }: { colKey: keyof Product, label: string, align?: 'left' | 'right' | 'center', sticky?: boolean, forceLeft?: boolean, resizable?: boolean }) => {
      // On the mobile swipe table every column reads left-aligned (Adrian's call:
      // numbers sit under their header, not flush-right across a gap). forceLeft
      // overrides the numeric right-align that desktop still uses.
      const align: 'left' | 'right' | 'center' = forceLeft ? 'left' : (alignProp ?? (RIGHT_ALIGN_KEYS.has(colKey as string) ? 'right' : 'left'));
      const sortIndex = inventorySortConfig.findIndex(s => s.key === colKey);
      const sortEntry = sortIndex >= 0 ? inventorySortConfig[sortIndex] : null;
      const showBadge = inventorySortConfig.length > 1 && sortEntry;
      const ariaSort = sortEntry ? (sortEntry.direction === 'asc' ? 'ascending' : 'descending') : 'none';
      // The pinned Product header sits at the cross of the two sticky axes
      // (top from the sticky thead, left from this), so it needs a solid bg and
      // a z above its sibling header cells. Background matches the surface card
      // (not tea-bg); no divider or shadow so the pinned column blends instead
      // of reading as a separate slab.
      const stickyCls = sticky
        ? 'sticky left-0 z-[21] bg-tea-surface'
        : '';
      return (
        <th
          aria-sort={ariaSort}
          className={`relative font-sans text-ui-10 uppercase tracking-[0.12em] text-tea-text-dim font-medium px-3 py-1 border-b border-tea-border ${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'} ${stickyCls}`}
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
                  {showBadge && (
                    <span
                      className="ml-1 inline-flex items-center justify-center min-w-[14px] h-[14px] px-1 rounded-full bg-tea-readgold/15 text-ui-9 text-tea-readgold font-bold leading-none tabular-nums"
                      title={`Sort priority ${sortIndex + 1} of ${inventorySortConfig.length}`}
                      aria-label={`sort priority ${sortIndex + 1}`}
                    >
                      {sortIndex + 1}
                    </span>
                  )}
                </>
              ) : <ArrowUpDown size={10} className="opacity-0 group-hover:opacity-100 text-tea-text-dim ml-1 transition-opacity" />}
             </span>
          </button>
          {/* Mobile-only drag-to-resize handle on the column's right edge. Pointer
              events cover touch and mouse; stopPropagation keeps a drag off the
              sort button so tapping the label still sorts. The live width is
              written to the store (which mobileColPxWidth reads) and is already
              persisted on release. */}
          {resizable && (
            <span
              role="separator"
              aria-orientation="vertical"
              aria-label={`Resize ${label} column`}
              className="absolute top-0 right-0 h-full w-4 cursor-col-resize touch-none select-none flex items-center justify-center group/resize"
              onClick={(e) => { e.stopPropagation(); }}
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                colResizeRef.current = {
                  key: colKey as string,
                  startX: e.clientX,
                  startWidth: mobileColPxWidth(colKey as string),
                  pointerId: e.pointerId,
                };
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => {
                const drag = colResizeRef.current;
                if (!drag || drag.pointerId !== e.pointerId) return;
                e.stopPropagation();
                const next = Math.max(MIN_MOBILE_COL_PX, drag.startWidth + (e.clientX - drag.startX));
                setInventoryMobileColWidth(drag.key, next);
              }}
              onPointerUp={(e) => {
                if (!colResizeRef.current || colResizeRef.current.pointerId !== e.pointerId) return;
                e.stopPropagation();
                try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* no-op */ }
                colResizeRef.current = null;
              }}
              onPointerCancel={() => { colResizeRef.current = null; }}
            >
              {/* Thin visible grip line, brighter on hover/drag. */}
              <span className="block h-4 w-px bg-tea-border group-hover/resize:bg-tea-gold/50" />
            </span>
          )}
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

  // Long-press toggles the inline quick-edit panel for that one row. The panel
  // renders as an extra full-width row directly under the long-pressed row and
  // slides down (the old expand-under-the-tea feel). Long-pressing the same row
  // again collapses it; only one row is ever expanded at a time. The row's tap
  // still selects.
  const stableLongPressQuickEdit = useCallback((productId: string, _globalIdx: number) => {
    setExpandedRowId(prev => (prev === productId ? null : productId));
  }, []);

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
    navigate(`/admin/compass?sampleOrder=manage&set=${encodeURIComponent(newSet.id)}`);
  };

  if (searchParams.get('incoming') === '1') {
    return <div className="h-full flex flex-col overflow-hidden bg-tea-bg"><IncomingReceiptsPanel onClose={() => { const next = new URLSearchParams(searchParams); next.delete('incoming'); setSearchParams(next); }} /></div>;
  }

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
      className="h-full flex flex-col overflow-hidden bg-tea-bg"
    >
      {/* --- MERGED VIEWS + CONTROLS BAR (mobile) ---
          NOT sticky — this band scrolls UP and away with the list so only the
          column-header row (the table thead, sticky inside its own scroll box)
          stays pinned. Keeping the tabs+controls permanently pinned spent ~90px
          of the first phone screen before any tea was visible; letting it scroll
          reclaims that height. The backdrop-blur is kept for the brief moment it
          overlaps the rail slide-in. */}
      <div className="hidden">
        {/* Shift the whole bar clear of the action rail when it slides in from the
            right, matching the rail's 200ms slide so the tabs/sort row are never
            painted over. Mirrors the desktop toolbar's paddingRight treatment. */}
        <div
          className="flex flex-col border-b border-tea-border transition-[padding-right] duration-200"
          style={{ paddingRight: railOpen ? INVENTORY_ACTION_RAIL_WIDTH : 0 }}
        >
        <div
          className="flex flex-col px-2 pt-1.5 pb-1 gap-1"
        >
          {/* Purpose answers why a holding exists. Operational actions remain a
              separate expandable group so the two questions never blur. */}
          {(() => {
            const defaultOrder = activeDefaultViews.map(v => v.id);
            const unsorted = savedViews.length > 0 ? savedViews.filter(v => inventoryCategory === 'teaware' ? v.id.includes('teaware') : !v.id.includes('teaware')) : activeDefaultViews;
            const views = [...unsorted].sort((a, b) => {
              const ai = defaultOrder.indexOf(a.id);
              const bi = defaultOrder.indexOf(b.id);
              return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
            });
            const purposeFilters = ['All', 'Working', 'Samples', 'Personal'];
            const purposeViews = purposeFilters
              .map(filter => views.find(view => view.filterType === filter))
              .filter((view): view is NonNullable<typeof view> => Boolean(view));
            const purposeIds = new Set(purposeViews.map(view => view.id));
            const attentionViews = views.filter(view => !purposeIds.has(view.id));

            const selectMobileView = (view: typeof views[number]) => {
              setGlossaryMode(false);
              setActiveView(view.id);
              setInventoryColumns(view.columns);
              setInventorySortConfig(view.sortConfig);
              setFilterType(view.filterType);
              setInventoryGroupBy(view.groupBy);
            };

            const viewButton = (view: typeof views[number]) => {
              const filterLabel = VIEW_FILTER_LABELS[view.filterType] || view.filterType;
              return (
                <div key={view.id} className="flex items-center gap-0.5">
                  <button
                    onClick={() => selectMobileView(view)}
                    className={`tap-target relative flex items-center gap-1 px-2 h-9 text-ui-11 uppercase tracking-[0.08em] rounded-md transition-colors ${
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
                    <span>{view.name || filterLabel}</span>
                  </button>
                  {!view.id.startsWith('default-') && (
                    <button
                      type="button"
                      onClick={() => deleteView(view.id)}
                      aria-label={`Delete ${view.name || filterLabel} view`}
                      className="tap-target h-9 w-9 inline-flex items-center justify-center rounded-md text-tea-text-sec hover:text-tea-gold transition-colors"
                    >
                      <XIcon size={9} />
                    </button>
                  )}
                </div>
              );
            };

            return (
              <>
                <div className="text-ui-9 uppercase tracking-[0.12em] text-tea-text-sec px-1">Purpose</div>
                <div role="group" aria-label="Purpose views" className="flex flex-wrap items-center gap-0.5">
                  {purposeViews.map(viewButton)}
                </div>
                {attentionViews.length > 0 && (
                  <div className="border-t border-tea-border pt-1 mt-0.5">
                  <button
                    onClick={() => setViewTabsExpanded(!viewTabsExpanded)}
                    className="tap-target min-h-11 w-full flex items-center justify-between px-1 text-ui-9 uppercase tracking-[0.12em] text-tea-text-sec"
                    aria-label={viewTabsExpanded ? 'Hide needs attention views' : 'Show needs attention views'}
                    aria-expanded={viewTabsExpanded}
                  >
                    <span>Needs attention</span>
                    {viewTabsExpanded ? <XIcon size={13} /> : <Plus size={13} />}
                  </button>
                  {viewTabsExpanded && (
                    <div role="group" aria-label="Needs attention views" className="flex flex-wrap items-center gap-0.5 pb-1">
                      {attentionViews.map(viewButton)}
                    </div>
                  )}
                  </div>
                )}
              </>
            );
          })()}
        </div>

        {/* Row 2: controls — price toggle + group + sort. Text labels sit beside
            each glyph (house rule: text over icon-only); the count moved to the
            stock-history strip so it is stated once. Group/Sort use AnchoredMenu
            so the panels follow their trigger when this (now-scrolling) band
            moves, instead of floating at a fixed viewport offset. */}
        <div className="flex items-center px-2 py-1 gap-1 border-t border-tea-border">
          {inventoryGroupBy && (
            <span className="text-ui-9 uppercase tracking-[0.15em] text-tea-text-dim/60 px-1 mr-1 truncate">
              Grouped
            </span>
          )}
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={() => setPriceMode(priceMode === 'retail' ? 'cost' : 'retail')}
              className="tap-target h-8 px-2 inline-flex items-center gap-1.5 rounded-md transition-colors text-ui-11 uppercase tracking-[0.08em] text-tea-text-sec hover:text-tea-text hover:bg-tea-surface"
              title={`Showing ${priceMode} prices — tap to switch`}
              aria-label={`Showing ${priceMode} prices, switch price mode`}
            >
              {priceMode === 'retail' ? <Tag size={14} /> : <Receipt size={14} />}
              {priceMode === 'retail' ? 'Retail' : 'Cost'}
            </button>
            <AnchoredMenu
              align="right"
              width={176}
              role="listbox"
              open={showMobileGroupBy}
              onOpenChange={(o) => { setShowMobileGroupBy(o); if (o) { setShowMobileSort(false); setShowOptions(false); } }}
              trigger={(props) => (
                <button
                  {...props}
                  className={`tap-target h-8 px-2 inline-flex items-center gap-1.5 rounded-md transition-colors text-ui-11 uppercase tracking-[0.08em] ${showMobileGroupBy || inventoryGroupBy ? 'text-tea-text bg-tea-surface' : 'text-tea-text-dim hover:text-tea-text-sec'}`}
                  aria-label="Group inventory"
                >
                  <Layers size={14} /> Group
                </button>
              )}
            >
              {(close) => GROUPBY_OPTIONS.map(opt => {
                const isActive = (inventoryGroupBy || '') === opt.value;
                return (
                  <button
                    key={opt.value}
                    role="option"
                    aria-selected={isActive}
                    onClick={() => { setInventoryGroupBy(opt.value || null); close(); }}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-ui-13 transition-colors ${isActive ? 'text-tea-gold font-medium' : 'text-tea-text-sec active:bg-tea-bg'}`}
                  >
                    <span>{opt.label}</span>
                    {isActive && <Check size={14} />}
                  </button>
                );
              })}
            </AnchoredMenu>
            <AnchoredMenu
              align="right"
              width={280}
              role="listbox"
              className="px-1 py-2"
              open={showMobileSort}
              onOpenChange={(o) => { setShowMobileSort(o); if (o) { setShowMobileGroupBy(false); setShowOptions(false); } }}
              trigger={(props) => (
                <button
                  {...props}
                  className={`tap-target h-8 px-2 inline-flex items-center gap-1.5 rounded-md transition-colors text-ui-11 uppercase tracking-[0.08em] ${showMobileSort ? 'text-tea-text bg-tea-surface' : 'text-tea-text-dim hover:text-tea-text-sec'}`}
                  aria-label="Sort inventory"
                >
                  <ArrowUpDown size={14} /> Sort
                </button>
              )}
            >
              {(close) => (
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
                        role="option"
                        aria-selected={isActive}
                        onClick={() => {
                          if (isActive) {
                            setInventorySortConfig([{ key: opt.key, direction: current.direction === 'asc' ? 'desc' : 'asc' }]);
                          } else {
                            setInventorySortConfig([{ key: opt.key, direction: 'asc' }]);
                          }
                          close();
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
              )}
            </AnchoredMenu>
          </div>
        </div>
        </div>
      </div>

      {/* Group-by and Sort dropdowns moved INTO the controls row as AnchoredMenu
          (so they track their trigger when the band scrolls). The old detached
          fixed top-[82px] blocks were removed. */}

      {/* --- MOBILE OPTIONS SHEET (outside backdrop-blur container) --- */}
      <div>
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

      {/* --- UNIFIED DESKTOP TOOLBAR (desktop only) ---
          One sticky top bar: [view tabs / More] ...ml-auto... [edit status]
          [Glossary] | [Edit] [+] [Cols] [Group] [Vendor] [overflow].
          Solid background (no backdrop-blur — backdrop-blur caused an invisible-icon
          bug here). z-sticky keeps the bar below the InventoryActionRail (z-drawer).
          The right action cluster carries paddingRight = INVENTORY_ACTION_RAIL_WIDTH
          when railOpen (with a 200ms transition matching the rail's slide-in) so the
          icons shift clear of the rail when a row is selected. */}
      <div className="hidden">
        {(() => {
          const allViews = savedViews.length > 0 ? savedViews.filter(v => inventoryCategory === 'teaware' ? v.id.includes('teaware') : !v.id.includes('teaware')) : activeDefaultViews;
          // Everyday filters stay inline; the rest fold into "More" so the row never overflows.
          // Custom saved views (non-default ids) always stay inline — the operator made them.
          const PRIMARY_FILTERS = new Set(['All', 'Working', 'Samples', 'Personal']);
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
              <span className="text-ui-10 uppercase tracking-[0.1em] text-tea-text-sec mr-1">Purpose</span>
              {inlineViews.map(view => (
                <div key={view.id} className="flex items-center gap-0.5">
                  <button
                    onClick={() => selectView(view)}
                    title={VIEW_FILTER_LABELS[view.filterType] || view.name}
                    aria-label={`Show ${VIEW_FILTER_LABELS[view.filterType] || view.name} view`}
                    aria-pressed={activeViewId === view.id}
                    className={tabClass(view)}
                  >
                    {view.icon && VIEW_ICON_MAP[view.icon] && React.createElement(VIEW_ICON_MAP[view.icon], { size: 13 })}
                    {view.name}
                  </button>
                  {!view.id.startsWith('default-') && (
                    <button
                      type="button"
                      onClick={() => deleteView(view.id)}
                      aria-label={`Delete ${view.name} view`}
                      className="tap-target h-9 w-9 inline-flex items-center justify-center rounded-md text-tea-text-sec hover:text-tea-gold transition-colors"
                    >
                      <XIcon size={10} />
                    </button>
                  )}
                </div>
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
                        <span className="text-ui-10 normal-case tracking-normal text-tea-text-sec">Needs attention</span>
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
        <div
          className="flex items-center gap-3 ml-auto shrink-0 transition-[padding-right] duration-200"
          style={{ paddingRight: railOpen ? INVENTORY_ACTION_RAIL_WIDTH : 0 }}
        >
          {/* Edit-mode save status */}
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
              <span className="label-caps text-tea-text-dim shrink-0 hidden xl:inline">
                CLICK CELLS TO EDIT — CHANGES SAVE AUTOMATICALLY
              </span>
            )
          )}

          {/* Glossary */}
          <div className="flex items-center gap-1 shrink-0">
          {inventoryCategory === 'tea' && (
            <>
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

          {/* Actions cluster (migrated from former second toolbar) */}
          <div className="flex items-center gap-4">
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

                    <button
                      onClick={onAddClick}
                      title="Add new tea"
                      aria-label="Add new tea"
                      className="tap-target inline-flex items-center justify-center w-8 h-8 rounded-xl bg-tea-gold text-tea-bg hover:bg-tea-gold/90 active:bg-tea-gold/80 transition-colors"
                    >
                        <Plus size={16} />
                    </button>

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
                      width={208}
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
                          {/* The list scrolls on its own with a right gutter so the
                              scrollbar never paints over the vendor names (the clip
                              bug). max-h is on this inner list, not the whole panel. */}
                          <div className="max-h-56 overflow-y-auto custom-scrollbar pr-0.5">
                            {[...new Set(localProducts.map(p => p.vendor).filter(Boolean))].sort().map(vendor => (
                              <button
                                key={vendor}
                                role="menuitem"
                                onClick={() => { setSearchParams({ vendor: vendor! }); close(); }}
                                title={vendor!}
                                className={`w-full px-3 py-1.5 text-left text-xs hover:bg-tea-bg transition-colors truncate ${vendorFilter === vendor ? 'text-tea-gold' : 'text-tea-text-sec'}`}
                              >
                                {vendor}
                              </button>
                            ))}
                          </div>
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

      {/* --- SCROLL CONTAINER ---
          The right margin (room for the action rail / edit panel) lives HERE,
          on the scrolling table only — not on the outer container — so the
          sticky toolbar above keeps its full width and its right-side action
          cluster never slides under the rail when a row is selected. */}
      <div
        ref={scrollContainerRef}
        data-testid="inventory-scroll"
        className="flex-1 overflow-auto custom-scrollbar bg-tea-bg pt-0 md:pt-3 pb-nav-gap transition-all duration-300"
        style={{ marginRight: contentRightMargin }}
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
                        <img src={mediaUrl(product.imageUrl)} alt={product.productName} className="w-full h-full object-cover transition-transform duration-300" loading="lazy" />
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

        {/* INVENTORY TABLE — canonical §20 inventory table from /design/system:
            bordered card containing top strip → headers → rows → bottom strip.
            Renders at all widths now; on mobile, long-press a row to select and open
            the right-edge InventoryActionRail (same as desktop). */}
        {/* On a phone this data-heavy table goes edge-to-edge: no side gutter, no
            card border, no rounding (those only chrome a narrow column on a small
            screen and steal width). Desktop keeps the bordered card. */}
        {filterType !== 'Pending' && !glossaryMode && <div ref={tableWrapperRef} className="relative w-full max-w-7xl mx-auto px-0 md:px-4 lg:px-6">
          <div className="bg-tea-surface border-y md:border border-tea-border md:rounded-xl overflow-hidden md:overflow-visible">

          {/* On mobile this wrapper owns BOTH scroll axes: a bounded height plus
              overflow-auto makes it the vertical scroller too, so the table's
              `sticky top-0` thead pins to THIS box (not the distant page scroller,
              which clips it). The same box anchors the `sticky left-0` Product
              column, so both axes resolve here and the header row stays visible
              while the list scrolls. Desktop is an inert pass-through div. */}
          <div
            className={mobileHScroll ? 'overflow-auto overscroll-contain custom-scrollbar' : ''}
            style={mobileHScroll ? {
              // Fill from just under the sticky toolbar down to the bottom edge,
              // so the list runs the full screen. The floating bottom nav sits
              // OVER this box, so the inner table adds pb-nav clearance (below) to
              // let the last rows scroll out from behind it.
              maxHeight: 'calc(100dvh - 100px)',
            } : undefined}
          >
          <div className="bg-tea-bg">
            <div
              data-testid="inventory-primary-row"
              data-inventory-header-row
              className="static flex h-10 w-full max-w-full items-center gap-0 px-0.5 md:px-4 border-b border-tea-border text-ui-8 md:text-ui-10 uppercase tracking-normal md:tracking-[0.06em] whitespace-nowrap overflow-hidden"
            >
              <button type="button" aria-pressed={inventoryCategory === 'tea'} onClick={() => onCategoryChange?.('tea')} className={`tap-target px-1 ${inventoryCategory === 'tea' ? 'text-tea-gold font-medium' : 'text-tea-text-sec'}`}>Tea</button>
              <button type="button" aria-pressed={inventoryCategory === 'teaware'} onClick={() => onCategoryChange?.('teaware')} className={`tap-target px-1 ${inventoryCategory === 'teaware' ? 'text-tea-gold font-medium' : 'text-tea-text-sec'}`}>Wares</button>
              {mobileSearchExpanded ? (
                <div className="flex flex-1 min-w-0 items-center gap-1 px-1">
                  <Search size={12} className="shrink-0 text-tea-text-sec" aria-hidden="true" />
                  <input
                    ref={mobileSearchInputRef}
                    value={searchQuery}
                    onChange={(event) => onSearchQueryChange?.(event.target.value)}
                    onKeyDown={(event) => { if (event.key === 'Escape' || event.key === 'Enter') { setMobileSearchExpanded(false); requestAnimationFrame(() => mobileSearchTriggerRef.current?.focus()); } }}
                    aria-label={inventoryCategory === 'tea' ? 'Search tea or source' : 'Search teaware'}
                    placeholder={inventoryCategory === 'tea' ? 'Search tea or source…' : 'Search teaware…'}
                    className="min-w-0 flex-1 bg-transparent text-ui-12 normal-case tracking-normal text-tea-text outline-none placeholder:text-tea-text-dim"
                  />
                  <button type="button" onClick={() => { setMobileSearchExpanded(false); requestAnimationFrame(() => mobileSearchTriggerRef.current?.focus()); }} aria-label="Close inventory search" className="tap-target text-tea-text-sec hover:text-tea-text"><XIcon size={12} /></button>
                </div>
              ) : (
                <>
                  <button ref={mobileSearchTriggerRef} type="button" onClick={() => setMobileSearchExpanded(true)} aria-label="Search inventory" className="tap-target px-1 text-tea-text-sec hover:text-tea-text"><Search size={13} /></button>
                  <button type="button" onClick={() => { const next = new URLSearchParams(searchParams); next.set('incoming', '1'); setSearchParams(next); }} className="tap-target px-1 text-tea-text-sec hover:text-tea-text">Incoming</button>
                  <button type="button" onClick={() => setPriceMode(priceMode === 'retail' ? 'cost' : 'retail')} aria-label={`Showing ${priceMode} prices, switch price mode`} className="tap-target px-1 text-tea-text-sec hover:text-tea-text">{priceMode === 'retail' ? 'Retail' : 'Cost'}</button>
                  <AnchoredMenu align="right" width={160} open={showMobileGroupBy} onOpenChange={setShowMobileGroupBy} trigger={(props) => <button {...props} className="tap-target px-1 text-tea-text-sec hover:text-tea-text" aria-label="Group inventory">Group</button>}>
                    {(close) => GROUPBY_OPTIONS.map(opt => <button key={opt.value} role="menuitem" onClick={() => { setInventoryGroupBy(opt.value || null); close(); }} className={`w-full px-3 py-2 text-left text-ui-12 ${inventoryGroupBy === opt.value ? 'text-tea-gold' : 'text-tea-text-sec'}`}>{opt.label}</button>)}
                  </AnchoredMenu>
                  <AnchoredMenu align="right" width={176} open={showMobileSort} onOpenChange={setShowMobileSort} trigger={(props) => <button {...props} className="tap-target px-1 text-tea-text-sec hover:text-tea-text" aria-label="Sort inventory">Sort</button>}>
                    {(close) => ([['productName', 'Name'], ['stockGrams', 'Stock'], ['pricePerGramUSD', 'Price'], ['year', 'Year']] as const).map(([key, label]) => <button key={key} role="menuitem" onClick={() => { setInventorySortConfig([{ key, direction: 'asc' }]); close(); }} className="w-full px-3 py-2 text-left text-ui-12 text-tea-text-sec">{label}</button>)}
                  </AnchoredMenu>
                  <span className="inline-flex shrink-0 items-center gap-0.5 px-0.5 text-tea-text-sec normal-case tracking-normal" title={activeAccountName}><MapPin size={11} className="shrink-0" /><span>{activeAccountName.replace(/^Teajia\s+/i, '') || 'Bali'}</span></span>
                  <select value={currency} onChange={(event) => setCurrency(event.target.value as typeof currency)} aria-label="Select currency" className="tap-target w-7 md:w-12 shrink-0 appearance-none bg-transparent px-0 text-ui-8 md:text-ui-10 text-tea-text-sec outline-none">{rates.map(rate => <option key={rate.currency} value={rate.currency}>{rate.currency}</option>)}</select>
                  {(vendorFilter || batchFilter) && <button type="button" onClick={() => setSearchParams({})} aria-label="Clear inventory context" className="tap-target max-w-12 truncate px-0.5 normal-case tracking-normal text-tea-gold">{vendorFilter || activeBatch?.label || 'Batch'} ×</button>}
                  <div className="hidden md:flex items-center gap-1 ml-auto">
                    <button type="button" onClick={() => setGlossaryMode(!glossaryMode)} aria-pressed={glossaryMode} className="tap-target px-2 text-tea-text-sec hover:text-tea-text">Glossary</button>
                    <button type="button" onClick={() => setIsEditMode(!isEditMode)} aria-pressed={isEditMode} className="tap-target px-2 text-tea-text-sec hover:text-tea-text">{isEditMode ? 'Done' : 'Edit'}</button>
                    <button type="button" onClick={onAddClick} aria-label="Add new tea" className="tap-target px-2 text-tea-text-sec hover:text-tea-text">Add</button>
                    <AnchoredMenu align="right" width={176} open={showColumnsPopover} onOpenChange={setShowColumnsPopover} trigger={(props) => <button {...props} className="tap-target px-2 text-tea-text-sec hover:text-tea-text" aria-label="Show or hide columns">Cols</button>}>
                      {() => activeColumnDefs.map(col => <label key={col.key} role="menuitem" className="flex items-center gap-2 px-3 py-2 text-ui-11 text-tea-text-sec"><input type="checkbox" checked={inventoryColumns.includes(col.key)} onChange={() => !('alwaysVisible' in col && col.alwaysVisible) && toggleInventoryColumn(col.key)} disabled={'alwaysVisible' in col && col.alwaysVisible} className="accent-tea-gold" />{col.label}</label>)}
                    </AnchoredMenu>
                    <AnchoredMenu align="right" width={208} open={showVendorDropdown} onOpenChange={setShowVendorDropdown} trigger={(props) => <button {...props} className="tap-target px-2 text-tea-text-sec hover:text-tea-text" aria-label="Filter by vendor">Vendor</button>}>
                      {(close) => <><button role="menuitem" onClick={() => { setSearchParams({}); close(); }} className="w-full px-3 py-2 text-left text-ui-11 text-tea-text-sec">All vendors</button>{[...new Set(localProducts.map(p => p.vendor).filter(Boolean))].sort().map(vendor => <button key={vendor} role="menuitem" onClick={() => { setSearchParams({ vendor: vendor! }); close(); }} className="w-full px-3 py-2 text-left text-ui-11 text-tea-text-sec">{vendor}</button>)}</>}
                    </AnchoredMenu>
                  </div>
                  <button type="button" onClick={() => setShowOptions(!showOptions)} aria-label="Open inventory actions" aria-expanded={showOptions} className="tap-target px-0.5 text-tea-text-sec hover:text-tea-text"><MoreHorizontal size={14} /></button>
                </>
              )}
            </div>

            {(() => {
              const allViews = savedViews.length > 0 ? savedViews.filter(v => inventoryCategory === 'teaware' ? v.id.includes('teaware') : !v.id.includes('teaware')) : activeDefaultViews;
              const purposeNames = ['All', 'Working', 'Samples', 'Personal'];
              const purposeViews = purposeNames.map(name => allViews.find(view => view.filterType === name)).filter((view): view is NonNullable<typeof view> => Boolean(view));
              const purposeIds = new Set(purposeViews.map(view => view.id));
              const attentionViews = allViews.filter(view => !purposeIds.has(view.id));
              const selectView = (view: typeof allViews[number]) => { setGlossaryMode(false); setActiveView(view.id); setInventoryColumns(view.columns); setInventorySortConfig(view.sortConfig); setFilterType(view.filterType); setInventoryGroupBy(view.groupBy); };
              return (
                <div data-testid="inventory-purpose-row" data-inventory-header-row className="static flex h-10 w-full max-w-full items-center gap-0 px-0.5 md:px-4 border-b border-tea-border whitespace-nowrap text-ui-9 md:text-ui-10 uppercase tracking-normal md:tracking-[0.06em] overflow-hidden">
                  <span className="px-1 text-tea-text-dim">Purpose</span>
                  {purposeViews.map(view => <button key={view.id} type="button" onClick={() => selectView(view)} aria-pressed={activeViewId === view.id} className={`tap-target relative px-1.5 ${activeViewId === view.id ? 'text-tea-gold after:absolute after:inset-x-1 after:bottom-1 after:h-px after:bg-tea-gold' : 'text-tea-text-sec hover:text-tea-text'}`}>{view.name || VIEW_FILTER_LABELS[view.filterType] || view.filterType}</button>)}
                  <button type="button" onClick={() => setViewTabsExpanded(!viewTabsExpanded)} aria-expanded={viewTabsExpanded} className="tap-target ml-auto inline-flex items-center gap-0.5 px-1 text-tea-text-sec hover:text-tea-text"><span>Needs attention</span><Plus size={10} /></button>
                  {viewTabsExpanded && attentionViews.length > 0 && <div role="menu" className="absolute right-1 top-20 z-popover w-44 rounded-md border border-tea-border bg-tea-elevated py-1 shadow-xl">{attentionViews.map(view => <button key={view.id} role="menuitem" onClick={() => { selectView(view); setViewTabsExpanded(false); }} className="block w-full px-3 py-2 text-left text-ui-11 text-tea-text-sec hover:bg-tea-accent-sub">{view.name || VIEW_FILTER_LABELS[view.filterType] || view.filterType}</button>)}</div>}
                </div>
              );
            })()}
          </div>
          {/* Top strip — the orienting line: which view + how many (left), with
              stock-history demoted to a quiet trailing link (right) rather than a
              loud leading verb. It lives INSIDE the scroll box (above the table)
              so it scrolls UP and away as the list scrolls, leaving only the
              column header row pinned — this is the single statement of "what am
              I looking at," so the count is not repeated in the controls band. */}
          {processedProducts.length > 0 && (
            <div className="hidden">
              <div className="flex items-baseline gap-2 min-w-0">
                {(() => {
                  const activeView = [...(savedViews.length > 0 ? savedViews : (inventoryCategory === 'teaware' ? DEFAULT_TEAWARE_VIEWS : DEFAULT_TEA_VIEWS))].find(v => v.id === activeViewId);
                  const IconComp = activeView?.icon ? VIEW_ICON_MAP[activeView.icon] : null;
                  const label = VIEW_FILTER_LABELS[filterType] || filterType;
                  return (
                    <span className="inline-flex items-center gap-1.5 label-caps text-tea-text-sec truncate">
                      {IconComp && <IconComp size={12} className="text-tea-text-sec shrink-0" />}
                      <span className="truncate">{label}</span>
                    </span>
                  );
                })()}
                <span className="label-caps text-tea-text-dim tabular-nums shrink-0">
                  · {processedProducts.length} items
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const target = panelProduct ?? processedProducts[0];
                  if (target) setStockHistoryProduct({ id: target.id, name: target.givenName || target.productName });
                }}
                className="text-ui-10 tracking-caps font-sans text-tea-text-dim hover:text-tea-text-sec transition-colors inline-flex items-center gap-1 shrink-0"
              >
                <History size={11} aria-hidden="true" /> Stock history
              </button>
            </div>
          )}
          {/* --- GROUPED VIEW --- */}
          {groupedProducts ? (
            <div>
              {/* Table header (sticky) — canonical font-serif uppercase tracking-display */}
              <table className={`w-full table-fixed border-collapse ${unifiedLayout ? 'inv-tight' : ''}`} style={mobileTableStyle}>
                <colgroup>
                  {renderCols.map(renderColEl)}
                </colgroup>
                <thead data-testid="inventory-column-row" data-inventory-header-row className="sticky top-0 z-sticky bg-tea-surface/95 md:bg-tea-bg/95 backdrop-blur-sm">
                  <tr>
                    {renderCols.map((col, i) => (
                      <SortHeader key={col.key} colKey={col.key as keyof Product} label={col.label} sticky={mobileHScroll && i === 0} forceLeft={unifiedLayout} resizable={mobileHScroll} />
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
                      className={`w-full flex items-center gap-3 px-5 py-2.5 bg-tea-bg/60 border-b border-tea-border hover:bg-tea-accent-sub transition-colors text-left ${mobileHScroll ? 'sticky left-0' : ''}`}
                    >
                      {isCollapsed ? <ChevronRight size={14} className="text-tea-text-sec" /> : <ChevronDown size={14} className="text-tea-text-sec" />}
                      <span className="font-display text-ui-15 text-tea-text">{groupKey}</span>
                      <span className="label-caps text-tea-text-dim">{items.length} items</span>
                      <span className="font-serif text-ui-13 text-tea-text-sec tabular-nums ml-auto">{totalStock}g</span>
                      <span className="font-serif text-ui-13 text-tea-text-sec tabular-nums">${fmtNum(totalRetail)}</span>
                    </button>
                    {!isCollapsed && (
                      <table className={`w-full table-fixed border-collapse ${unifiedLayout ? 'inv-tight' : ''}`} style={mobileTableStyle}>
                        <colgroup>
                          {splitView ? (
                            renderSplitCols.map(col => <col key={col.key} className={splitColWidth(col.key)} />)
                          ) : (
                            renderCols.map(renderColEl)
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
                                  visibleCols={renderCols}
                                  splitViewCols={renderSplitCols}
                                  splitView={splitView}
                                  stickyFirstCol={mobileHScroll}
                                  alignLeft={unifiedLayout}
                                  rowHeight={effectiveRowHeight}
                                  isPanelOpen={panelProduct?.id === product.id}
                                  isDropdownOpen={rowDropdownId === product.id}
                                  onRowClick={stableRowClick}
                                  onLongPressSelect={stableLongPressSelect}
                                  onLongPressQuickEdit={stableLongPressQuickEdit}
                                  onProductUpdate={handleProductUpdate}
                                  onSelectionAwareUpdate={handleSelectionAwareUpdate}
                                  onOpenPanel={stableOpenPanel}
                                  onToggleDropdown={stableToggleDropdown}
                                  onStockHistory={stableStockHistory}
                                  onStockMovement={stableStockMovement}
                                  onRestock={handleRestock}
                                  onDeleteRequest={(p) => { setDeleteTarget({ id: p.id, name: p.givenName || p.productName }); setDeleteInput(''); }}
                                  showToast={showToast}
                                  navigate={navigate}
                                />
                                {expandedRowId === product.id && (
                                  <QuickEditInlineRow
                                    product={product}
                                    expanded
                                    cols={(splitView ? renderSplitCols : renderCols).map(c => ({ key: c.key, width: splitView ? splitColWidth(c.key) : c.defaultWidth }))}
                                    colSpan={(splitView ? renderSplitCols : renderCols).length}
                                    onUpdate={handleProductUpdate}
                                    onTasting={(p) => { setTastingEditorProduct(p); setExpandedRowId(null); }}
                                    onFullEdit={(p) => { setPanelProduct(p); setExpandedRowId(null); }}
                                    rates={rates}
                                    onClose={() => setExpandedRowId(null)}
                                    onStockMovement={stableStockRecount}
                                  />
                                )}
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
            <table className={`w-full table-fixed border-collapse ${unifiedLayout ? 'inv-tight' : ''}`} style={mobileTableStyle}>
                <colgroup>
                    {splitView ? (
                      renderSplitCols.map(col => <col key={col.key} className={splitColWidth(col.key)} />)
                    ) : (
                      renderCols.map(renderColEl)
                    )}
                </colgroup>

                {/* Canonical header — auto-aligned: numerics right, others left. */}
                <thead data-testid="inventory-column-row" data-inventory-header-row className="sticky top-0 z-sticky bg-tea-surface/95 md:bg-tea-bg/95 backdrop-blur-sm">
                    <tr>
                        {splitView ? (
                          renderSplitCols.map(col => (
                            <SortHeader key={col.key} colKey={col.key as keyof Product} label={col.label} />
                          ))
                        ) : (
                          renderCols.map((col, i) => (
                            <SortHeader key={col.key} colKey={col.key as keyof Product} label={col.label} sticky={mobileHScroll && i === 0} forceLeft={unifiedLayout} resizable={mobileHScroll} />
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
                              visibleCols={renderCols}
                              splitViewCols={renderSplitCols}
                              splitView={splitView}
                              stickyFirstCol={mobileHScroll}
                              alignLeft={unifiedLayout}
                              rowHeight={effectiveRowHeight}
                              isPanelOpen={panelProduct?.id === product.id}
                              isDropdownOpen={rowDropdownId === product.id}
                              onRowClick={stableRowClick}
                              onLongPressSelect={stableLongPressSelect}
                              onLongPressQuickEdit={stableLongPressQuickEdit}
                              onProductUpdate={handleProductUpdate}
                              onSelectionAwareUpdate={handleSelectionAwareUpdate}
                              onOpenPanel={stableOpenPanel}
                              onToggleDropdown={stableToggleDropdown}
                              onStockHistory={stableStockHistory}
                              onStockMovement={stableStockMovement}
                              onRestock={handleRestock}
                              onDeleteRequest={(p) => { setDeleteTarget({ id: p.id, name: p.givenName || p.productName }); setDeleteInput(''); }}
                              showToast={showToast}
                              navigate={navigate}
                            />
                            {expandedRowId === product.id && (
                              <QuickEditInlineRow
                                product={product}
                                expanded
                                cols={(splitView ? renderSplitCols : renderCols).map(c => ({ key: c.key, width: splitView ? splitColWidth(c.key) : c.defaultWidth }))}
                                colSpan={(splitView ? renderSplitCols : renderCols).length}
                                onUpdate={handleProductUpdate}
                                onTasting={(p) => { setTastingEditorProduct(p); setExpandedRowId(null); }}
                                onFullEdit={(p) => { setPanelProduct(p); setExpandedRowId(null); }}
                                rates={rates}
                                onClose={() => setExpandedRowId(null)}
                                onStockMovement={stableStockRecount}
                              />
                            )}
                          </React.Fragment>
                        );
                    })}
                </tbody>
            </table>
          )}

          {/* Canonical bottom strip — counter + (placeholder for) load-more. The data
              source is already virtualized, so we simply restate the total. Lives
              INSIDE the scroll box so it travels with the list. */}
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

          {/* Mobile: the bottom nav floats OVER this box, so add its clearance
              inside the scroller — the last rows scroll out from behind the nav
              instead of being trapped underneath it. Resets to 0 on desktop. */}
          {mobileHScroll && <div className="pb-nav-gap" aria-hidden="true" />}
          </div>

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
        onOpenStockMovement={stableStockMovement}
        rightOffset={panelRightOffset}
      />

      {stockMovement && (
        <StockMovementPanel
          product={stockMovement.product}
          products={localProducts}
          trigger={stockMovement.trigger}
          onClose={() => setStockMovement(null)}
          onRecorded={(after, unit, destination) => handleMovementRecorded(stockMovement.product.id, after, unit, destination)}
          initialMovementType={stockMovement.initialType}
        />
      )}

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
