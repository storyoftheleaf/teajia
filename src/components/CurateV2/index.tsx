import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { mediaUrl } from '../../lib/mediaUrl';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Check, ChevronDown, ChevronUp, FlaskConical, Loader2, Mic, Plus, Search, Square, X } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { entryHasDeliberateInput, useTeaCompassStore } from '../../lib/teaCompassStore';
import { hydrateCompassEntries } from '../../lib/teaCompassSync';
import { syncNotes } from '../../lib/notesSync';
import { useNotesStore } from '../../lib/notesStore';
import { useAppStore } from '../../lib/store';
import { useSampleStore } from '../../samples/sampleStore';
import type { SampleTasting } from '../../samples/types';
import { api, hasToken, type CurateImportDetail, type CurateImportFinalizeResult } from '../../lib/api';
import type { CompassCategory, TeaType } from './types';
import { entryIsSample } from './types';
import { CompassIcon } from './CompassIcon';
import { CaptureCard, type CaptureCardActions } from './CaptureCard';
import { BrowseView } from './BrowseView';
import { LedgerView, OrderScreen } from './LedgerView';
import { useLedgerStore } from '../../lib/ledgerStore';
import { addTeaToDraftOrder } from './orderBuy';
import { useVoiceRecorder } from './useVoiceRecorder';
import { TodayView } from './TodayView';
import { TableList } from './TableList';
import { TeaFace } from './TeaFace';
import { SaidSheet } from './SaidSheet';
import { VendorsView } from './VendorsView';
import { CompareView } from './CompareView';
import { FastTastingSheet } from './FastTastingSheet';
import type { TodayAction } from './curateV2Model';
import { usePlatformPrivilege } from '../../lib/permissions';
import { CompassShareModal } from './CompassShareModal';
import { BatchCaptureRow } from './BatchCaptureRow';
import { CompassEntryDetailPanel } from './CompassEntryDetailPanel';
import { LedgerOverviewPanel } from './LedgerOverviewPanel';
import { ImportPanel } from './import/ImportPanel';
import { LibraryImportsSection, nextLibraryImportFocusId, type LibraryImportFocusRequest } from './LibraryImportsSection';
import { SampleOrderAction } from './SampleOrderAction';
import { CaptureActionFooter } from './CaptureActionFooter';

export type CompassMode = 'today' | 'sourcing' | 'library' | 'vendors' | 'compare' | 'buying';

/** One screen stacked over the tab you are on: a tea's face, its full form, or
 *  an order (then `id` is the order's id, not a tea's). */
interface TeaLayer { id: string; as: 'face' | 'card' | 'order'; scroll?: number }

interface TeaCompassProps {
  onBack?: () => void;
  /** Start directly on the ledger tab */
  initialMode?: CompassMode;
  /** Open a specific entry by ID */
  initialEntryId?: string;
  /** Inventory record that has no linked encounter yet. Creation is explicit. */
  initialDevelopmentProduct?: { id: string; name: string; type?: string };
  /** In sourcing mode, preselect the capture method. */
  initialCaptureOption?: 'tea' | 'teaware';
  initialSampleOrder?: 'open' | 'manage';
  initialSampleSetId?: string;
  onSampleOrderRouteClose?: () => void;
}

// ─── Desktop-only right column placeholder ───────────────────────────────────

const CompassRightEmptyState: React.FC<{
  mode: CompassMode;
  onNewCapture: () => void;
}> = ({ mode, onNewCapture }) => {
  const content = {
    sourcing: { title: 'Ready to capture', body: 'Select a session entry on the left, or start a new one.' },
    library: { title: 'Select an entry', body: 'Choose a tea from your library to view or edit its notes.' },
    buying:  { title: 'Transactions expand inline', body: 'Open a transaction on the left to see its line items.' },
  }[mode];
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[300px] py-20 text-center">
      <CompassIcon className="w-8 h-8 text-tea-gold/20 mb-4" />
      <p className="font-serif text-ui-15 text-tea-text/50 mb-1.5 tracking-wide">{content.title}</p>
      <p className="text-ui-12 text-tea-text-dim max-w-[220px] leading-relaxed mb-6">{content.body}</p>
      {mode !== 'sourcing' && (
        <button
          type="button"
          onClick={onNewCapture}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-tea-gold/40 text-tea-gold text-ui-12 font-semibold hover:bg-tea-gold/10 transition-colors"
          style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.06em' }}
        >
          <Plus size={12} />
          New Entry
        </button>
      )}
    </div>
  );
};

// ─── Main Tea Compass ────────────────────────────────────────────────────

export const TeaCompass: React.FC<TeaCompassProps> = ({ onBack, initialMode, initialEntryId, initialDevelopmentProduct, initialCaptureOption, initialSampleOrder, initialSampleSetId, onSampleOrderRouteClose }) => {
  // Compare needs two teas to set side by side: with fewer, the action is not offered.
  const compareTeaCount = useTeaCompassStore((s) => s.entries.filter((e) => e.category === 'tea' && e.name?.trim()).length);
  const activeEntryId = useTeaCompassStore((s) => s.activeEntryId);
  const setActiveEntry = useTeaCompassStore((s) => s.setActiveEntry);
  const startNewCapture = useTeaCompassStore((s) => s.startNewCapture);
  const startNewCaptureOnTable = useTeaCompassStore((s) => s.startNewCaptureOnTable);
  const startNewTable = useTeaCompassStore((s) => s.startNewTable);
  const discardEntryRaw = useTeaCompassStore((s) => s.discardEntry);
  const commitEntry = useTeaCompassStore((s) => s.commitEntry);
  const discardEntry = useTeaCompassStore((s) => s.discardEntry);
  const updateEntry = useTeaCompassStore((s) => s.updateEntry);
  const getEntry = useTeaCompassStore((s) => s.getEntry);
  const initialEntryExists = useTeaCompassStore((s) => initialEntryId
    ? s.pendingEntries.some((entry) => entry.id === initialEntryId) || s.entries.some((entry) => entry.id === initialEntryId)
    : false);
  const getSessionEntries = useTeaCompassStore((s) => s.getSessionEntries);
  const activeCategory: CompassCategory = useTeaCompassStore((s) => {
    const id = s.activeEntryId;
    if (!id) return 'tea';
    const entry = s.pendingEntries.find((e) => e.id === id) ?? s.entries.find((e) => e.id === id);
    return entry?.category || 'tea';
  });

  const { activeUserId, activeAccountId, activeAccount } = useAppStore();
  const switchDraftAccount = useTeaCompassStore((s) => s.switchDraftAccount);
  const { addNote } = useNotesStore();

  const addSampleTasting = useSampleStore((s) => s.addTasting);
  const samplesList = useSampleStore((s) => s.samples);

  const navigate = useNavigate();
  const queryClient = useQueryClient();


  // Mode: sourcing (editing an entry), library (browse past captures), or buying (ledger).
  // Tasting (the Tasting Journal) is its own surface at /account/journal, not a Compass mode.
  const [mode, setMode] = useState<CompassMode>(initialMode || 'today');
  const [developmentStarted, setDevelopmentStarted] = useState(false);
  /** A tea opens ON TOP of whatever tab you are on, as a stack of screens:
   *  its face, and over that its full form. The tab underneath stays mounted
   *  and lit, so closing the last one leaves you on the same tab, the same
   *  scroll, the same sub-screen. Tapping a tab empties the stack. */
  const [teaStack, setTeaStack] = useState<TeaLayer[]>([]);
  const teaStackRef = useRef<TeaLayer[]>([]);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [vendorOpen, setVendorOpen] = useState<{ id?: string; name: string } | null>(null);
  const [saidFor, setSaidFor] = useState<string | null>(null);
  const topLayer = teaStack.length ? teaStack[teaStack.length - 1] : null;
  const faceOpen = topLayer?.as === 'face';
  const teaOpen = topLayer != null;
  /** Bumped to open the table's vendor picker (a table was just started). */
  const [pickVendorSignal, setPickVendorSignal] = useState(0);
  /** Bumped on every tab tap, so a tab shows its own first screen again. */
  const [tabKey, setTabKey] = useState(0);

  const setStack = useCallback((next: TeaLayer[]) => {
    teaStackRef.current = next;
    setTeaStack(next);
  }, []);
  /** A new tea backed out of with nothing entered leaves nothing behind. */
  const settleLayer = useCallback((layer: TeaLayer, rest: TeaLayer[]) => {
    if (rest.some((l) => l.id === layer.id)) return;
    const st = useTeaCompassStore.getState();
    const pending = st.pendingEntries.find((e) => e.id === layer.id);
    if (pending && !entryHasDeliberateInput(pending)) discardEntryRaw(layer.id);
  }, [discardEntryRaw]);
  /** Put a tea on top: its face, or its full form. */
  const pushTea = useCallback((id: string, as: 'face' | 'card') => {
    const stack = teaStackRef.current;
    const top = stack[stack.length - 1];
    if (top && top.id === id && (top.as === as || top.as === 'card')) return;
    useTeaCompassStore.getState().setActiveEntry(id);
    setStack([...stack, { id, as }]);
  }, [setStack]);
  const closeTopTea = useCallback(() => {
    const stack = teaStackRef.current;
    if (stack.length === 0) return;
    const rest = stack.slice(0, -1);
    settleLayer(stack[stack.length - 1], rest);
    const below = rest[rest.length - 1];
    if (below && below.as !== 'order') useTeaCompassStore.getState().setActiveEntry(below.id);
    setStack(rest);
  }, [setStack, settleLayer]);
  /** Put an order on top: after Buy on a tea, or from a row in Orders. */
  const pushOrder = useCallback((txId: string) => {
    const stack = teaStackRef.current;
    const top = stack[stack.length - 1];
    if (top && top.as === 'order' && top.id === txId) return;
    setStack([...stack, { id: txId, as: 'order' }]);
  }, [setStack]);
  /** The order on top has been merged into another draft: that one takes its place. */
  const switchTopOrder = useCallback((txId: string) => {
    const stack = teaStackRef.current;
    const top = stack[stack.length - 1];
    if (!top || top.as !== 'order') return;
    setStack([...stack.slice(0, -1), { id: txId, as: 'order' }]);
  }, [setStack]);
  const clearTeaStack = useCallback(() => {
    const stack = teaStackRef.current;
    if (stack.length === 0) return;
    [...stack].reverse().forEach((layer, i, all) => settleLayer(layer, all.slice(i + 1)));
    setStack([]);
  }, [setStack, settleLayer]);

  // Account changes always swap the isolated draft bucket. Only Source owns
  // capture-shell creation; opening Library or Ledger must remain read-only.
  useEffect(() => {
    switchDraftAccount(activeAccountId);
  }, [activeAccountId, switchDraftAccount]);

  // Incoming pending shares (not yet accepted into compass)
  const [shareModalOpen, setShareModalOpen] = useState(false);
  // Track dismissed IDs locally for instant UI removal before refetch
  const [dismissedShareIds, setDismissedShareIds] = useState<Set<string>>(new Set());
  // Track which share ID is being acted on for per-card loading state
  const [actingShareId, setActingShareId] = useState<string | null>(null);

  const { data: incomingShares } = useQuery({
    queryKey: ['compass-incoming'],
    queryFn: () => api.compass.getIncoming(),
    enabled: hasToken(),
    refetchInterval: 60_000,
    select: (data: any) => (data?.shares || []) as Array<{
      id: string;
      tea_key: string;
      shared_metadata: any;
      source_user_name?: string;
      source_account_name?: string;
    }>,
  });

  // Visible shares = server list minus optimistically dismissed ones
  const visibleShares = (incomingShares || []).filter(s => !dismissedShareIds.has(s.id));

  const acceptShareMutation = useMutation({
    mutationFn: (shareId: string) => api.compass.acceptShare(shareId),
    onMutate: (shareId) => {
      setActingShareId(shareId);
      // Optimistically remove from UI immediately
      setDismissedShareIds(prev => new Set([...prev, shareId]));
    },
    onSuccess: async () => {
      await hydrateCompassEntries();
      queryClient.invalidateQueries({ queryKey: ['compass-incoming'] });
    },
    onError: (_, shareId) => {
      // Restore if failed
      setDismissedShareIds(prev => { const s = new Set(prev); s.delete(shareId); return s; });
    },
    onSettled: () => setActingShareId(null),
  });

  const declineShareMutation = useMutation({
    mutationFn: (shareId: string) => api.compass.declineShare(shareId),
    onMutate: (shareId) => {
      setActingShareId(shareId);
      setDismissedShareIds(prev => new Set([...prev, shareId]));
    },
    onError: (_, shareId) => {
      setDismissedShareIds(prev => { const s = new Set(prev); s.delete(shareId); return s; });
    },
    onSettled: () => {
      setActingShareId(null);
      queryClient.invalidateQueries({ queryKey: ['compass-incoming'] });
    },
  });

  // Sync mode when the route's ?tab= param changes (e.g. bottom nav Ledger → Compass)
  useEffect(() => {
    setMode(initialMode || 'today');
  }, [initialMode]);

  // Batch entry mode, rapid-fire name + type row for vendor table sessions
  const [batchMode, setBatchMode] = useState(false);
  const [sampleOrderOpen, setSampleOrderOpen] = useState(initialSampleOrder != null);
  const [sampleOrderManaging, setSampleOrderManaging] = useState(initialSampleOrder === 'manage');
  const sampleOrderRequestRef = useRef(`${initialSampleOrder ?? ''}:${initialSampleSetId ?? ''}`);
  useEffect(() => {
    const request = `${initialSampleOrder ?? ''}:${initialSampleSetId ?? ''}`;
    if (request === sampleOrderRequestRef.current) return;
    sampleOrderRequestRef.current = request;
    setSampleOrderOpen(initialSampleOrder != null);
    setSampleOrderManaging(initialSampleOrder === 'manage');
  }, [initialSampleOrder, initialSampleSetId]);
  const [importOpen, setImportOpen] = useState(false);
  const [importDetail, setImportDetail] = useState<CurateImportDetail | null>(null);
  const [importDetails, setImportDetails] = useState<CurateImportDetail[]>([]);
  const [importAccountId, setImportAccountId] = useState<string | null>(null);
  const [importPanelVersion, setImportPanelVersion] = useState(0);
  const [busyLibraryImportId, setBusyLibraryImportId] = useState<string | null>(null);
  const [libraryImportErrors, setLibraryImportErrors] = useState<Record<string, string>>({});
  const [libraryDeleteFocusRequest, setLibraryDeleteFocusRequest] = useState<LibraryImportFocusRequest | null>(null);
  const [importPointerId, setImportPointerId] = useState<string | null>(null);
  const importTriggerRef = useRef<HTMLButtonElement>(null);
  const { data: incompleteImports } = useQuery({
    queryKey: ['curate-imports', 'incomplete', activeAccountId],
    queryFn: () => api.curateImports.listIncomplete(),
    enabled: hasToken() && !!activeAccountId,
  });
  useLayoutEffect(() => {
    setImportOpen(false); setImportDetail(null); setImportDetails([]); setImportAccountId(activeAccountId); setImportPanelVersion(version => version + 1);
    setBusyLibraryImportId(null); setLibraryImportErrors({}); setLibraryDeleteFocusRequest(null);
    importTriggerRef.current = null;
    setImportPointerId(activeAccountId ? localStorage.getItem(`teajia-curate-import:${activeAccountId}`) : null);
  }, [activeAccountId]);
  const { data: pointedImport } = useQuery({
    queryKey: ['curate-import', importPointerId, activeAccountId],
    queryFn: () => api.curateImports.get(importPointerId!),
    enabled: hasToken() && !!activeAccountId && !!importPointerId,
  });
  useEffect(() => {
    if (importAccountId !== activeAccountId) return;
    if (importDetail?.batch.review_state === 'completed' || importDetail?.batch.review_state === 'abandoned') {
      setImportDetails(current => current.filter(detail => detail.batch.id !== importDetail.batch.id));
      if (importPointerId === importDetail.batch.id) setImportPointerId(null);
      setImportDetail(null);
      if (activeAccountId) localStorage.removeItem(`teajia-curate-import:${activeAccountId}`);
      return;
    }
    const imports = (incompleteImports?.imports ?? []).filter(detail => detail.batch.review_state !== 'completed' && detail.batch.review_state !== 'abandoned');
    const selected = importPointerId && pointedImport && pointedImport.batch.review_state !== 'completed' && pointedImport.batch.review_state !== 'abandoned' ? pointedImport : imports[0] ?? null;
    const queried = selected && !imports.some(detail => detail.batch.id === selected.batch.id) ? [selected, ...imports] : imports;
    const activeDetail = importDetail;
    const merged = queried.map(detail => activeDetail?.batch.id === detail.batch.id ? activeDetail : detail);
    setImportDetails(activeDetail && !merged.some(detail => detail.batch.id === activeDetail.batch.id) ? [activeDetail, ...merged] : merged);
  }, [activeAccountId, importAccountId, importDetail, importOpen, importPointerId, incompleteImports, pointedImport]);
  const rememberImportDetail = useCallback((detail: CurateImportDetail) => {
    if (detail.batch.review_state === 'completed' || detail.batch.review_state === 'abandoned') {
      setImportDetails(current => current.filter(candidate => candidate.batch.id !== detail.batch.id));
      if (activeAccountId) {
        queryClient.setQueryData<{ imports: CurateImportDetail[] }>(['curate-imports', 'incomplete', activeAccountId], current => current
          ? { ...current, imports: current.imports.filter(candidate => candidate.batch.id !== detail.batch.id) }
          : current);
        queryClient.setQueryData(['curate-import', detail.batch.id, activeAccountId], detail);
      }
      if (activeAccountId) localStorage.removeItem(`teajia-curate-import:${activeAccountId}`);
      setImportDetail(detail);
      return;
    } else {
      setImportDetails(current => [detail, ...current.filter(candidate => candidate.batch.id !== detail.batch.id)]);
      if (activeAccountId) {
        queryClient.setQueryData<{ imports: CurateImportDetail[] }>(['curate-imports', 'incomplete', activeAccountId], current => current
          ? { ...current, imports: [detail, ...current.imports.filter(candidate => candidate.batch.id !== detail.batch.id)] }
          : { imports: [detail] });
        queryClient.setQueryData(['curate-import', detail.batch.id, activeAccountId], detail);
      }
    }
    setImportDetail(detail);
    if (activeAccountId) {
      localStorage.setItem(`teajia-curate-import:${activeAccountId}`, detail.batch.id);
      setImportPointerId(detail.batch.id);
    }
  }, [activeAccountId, queryClient]);
  const beginNewImport = useCallback(() => {
    setImportDetail(null); setImportPointerId(null); setImportPanelVersion(version => version + 1); setImportOpen(true);
    if (activeAccountId) localStorage.removeItem(`teajia-curate-import:${activeAccountId}`);
  }, [activeAccountId]);
  const beginNewImportFrom = useCallback((trigger: HTMLButtonElement) => {
    importTriggerRef.current = trigger;
    beginNewImport();
  }, [beginNewImport]);

  // Auto-collapse the header on scroll. We hide it when the user scrolls
  // down (engaged with the form) and reveal on scroll up. Threshold + a
  // ref to the scroll container; updates a flag the header reads to apply
  // translate-y. Skipped on lg+ where the header doesn't compete for
  // viewport space the same way.
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastScrollTopRef = useRef(0);
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const SCROLL_DOWN_THRESHOLD = 24;
    const SCROLL_UP_THRESHOLD = 8;
    const onScroll = () => {
      const current = el.scrollTop;
      const last = lastScrollTopRef.current;
      const delta = current - last;
      // Always reveal when at the top.
      if (current < 12) {
        if (headerCollapsed) setHeaderCollapsed(false);
      } else if (delta > SCROLL_DOWN_THRESHOLD && !headerCollapsed) {
        setHeaderCollapsed(true);
      } else if (delta < -SCROLL_UP_THRESHOLD && headerCollapsed) {
        setHeaderCollapsed(false);
      }
      lastScrollTopRef.current = current;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [headerCollapsed]);

  // Open specific entry if initialEntryId is provided
  useEffect(() => {
    if (initialEntryId && initialEntryExists && getEntry(initialEntryId)) {
      // A deep link opens the tea on top of the requested tab (Today by default).
      pushTea(initialEntryId, 'face');
    }
  }, [initialEntryId, initialEntryExists, getEntry, pushTea]);

  useEffect(() => { setDevelopmentStarted(false); }, [initialDevelopmentProduct?.id]);

  const startInventoryDevelopment = useCallback(() => {
    if (!initialDevelopmentProduct) return;
    const category: CompassCategory = initialDevelopmentProduct.type === 'Teaware' ? 'teaware' : 'tea';
    const entryId = startNewCaptureOnTable(category);
    const validTeaTypes: readonly string[] = ['Green', 'White', 'Yellow', 'Oolong', 'Red', 'Dark', 'Sheng', 'Shou', 'Herbal', 'Teaware'];
    const compassType = initialDevelopmentProduct.type && validTeaTypes.includes(initialDevelopmentProduct.type)
      ? initialDevelopmentProduct.type as TeaType
      : undefined;
    updateEntry(entryId, {
      name: initialDevelopmentProduct.name,
      ...(compassType ? { type: compassType } : {}),
      draftProductId: initialDevelopmentProduct.id,
    });
    pushTea(entryId, 'card');
    setDevelopmentStarted(true);
  }, [initialDevelopmentProduct, pushTea, startNewCaptureOnTable, updateEntry]);

  // Subscribe to the active entry itself, not only its id. Desktop action-bar
  // readiness must update while fields are edited inside CaptureCard.
  const activeEntry = useTeaCompassStore((state) => activeEntryId
    ? state.pendingEntries.find((entry) => entry.id === activeEntryId)
      ?? state.entries.find((entry) => entry.id === activeEntryId)
      ?? null
    : null);

  // ── Capture action footer state ─────────────────────────────────────────
  const captureCardActionsRef = useRef<CaptureCardActions | null>(null);
  const [captureBuyExpanded, setCaptureBuyExpanded] = useState(false);
  // Done needs a photo OR a name, the promised saveable minimum.
  const captureDoneReady =
    !!activeEntry && ((activeEntry.name || '').trim().length > 0 || activeEntry.photos.length > 0);

  const handleNewCapture = useCallback((category?: CompassCategory) => {
    pushTea(startNewCaptureOnTable(category || 'tea'), 'card');
  }, [pushTea, startNewCaptureOnTable]);

  const closeImport = useCallback(() => {
    setImportOpen(false);
    setImportDetail(null);
    const returnTarget = importTriggerRef.current;
    window.requestAnimationFrame(() => {
      if (returnTarget?.isConnected && returnTarget.getClientRects().length) returnTarget.focus();
    });
  }, []);

  const handleFinalizedImport = useCallback(async (result: CurateImportFinalizeResult) => {
    const finalizedId = result.batch?.id ?? result.batchId ?? importDetail?.batch.id ?? null;
    localStorage.removeItem(`teajia-curate-import:${activeAccountId}`);
    if (finalizedId) {
      queryClient.setQueryData<{ imports: CurateImportDetail[] }>(['curate-imports', 'incomplete', activeAccountId], current => current
        ? { ...current, imports: current.imports.filter(detail => detail.batch.id !== finalizedId) }
        : current);
    }
    setImportDetails(current => finalizedId ? current.filter(detail => detail.batch.id !== finalizedId) : current);
    setImportDetail(null);
    setImportPointerId(null);
    await queryClient.invalidateQueries({ queryKey: ['curate-imports'] });
  }, [activeAccountId, importDetail, queryClient]);

  const openSavedImport = useCallback((detail: CurateImportDetail, trigger: HTMLButtonElement) => {
    importTriggerRef.current = trigger;
    setImportDetail(detail);
    setImportPanelVersion(version => version + 1);
    setImportOpen(true);
  }, []);

  const deleteSavedImport = useCallback(async (detail: CurateImportDetail) => {
    const accountId = activeAccountId;
    const importId = detail.batch.id;
    const targetImportId = nextLibraryImportFocusId(importDetails, importId);
    if (!accountId) return;

    setBusyLibraryImportId(importId);
    setLibraryImportErrors(current => {
      const next = { ...current };
      delete next[importId];
      return next;
    });

    try {
      await api.curateImports.abandon(importId);
      queryClient.setQueryData<{ imports: CurateImportDetail[] }>(['curate-imports', 'incomplete', accountId], current => current
        ? { ...current, imports: current.imports.filter(candidate => candidate.batch.id !== importId) }
        : current);

      if (useAppStore.getState().activeAccountId !== accountId) return;
      setImportDetails(current => current.filter(candidate => candidate.batch.id !== importId));
      setImportDetail(current => current?.batch.id === importId ? null : current);
      setImportPointerId(current => current === importId ? null : current);
      const storageKey = `teajia-curate-import:${accountId}`;
      if (localStorage.getItem(storageKey) === importId) localStorage.removeItem(storageKey);
      setLibraryDeleteFocusRequest(current => ({ requestId: (current?.requestId ?? 0) + 1, targetImportId }));
      setLibraryImportErrors(current => {
        const next = { ...current };
        delete next[importId];
        return next;
      });
    } catch (error) {
      if (useAppStore.getState().activeAccountId === accountId) {
        setLibraryImportErrors(current => ({
          ...current,
          [importId]: error instanceof Error ? error.message : 'Delete import failed. Try again.',
        }));
      }
    } finally {
      if (useAppStore.getState().activeAccountId === accountId) {
        setBusyLibraryImportId(current => current === importId ? null : current);
      }
    }
  }, [activeAccountId, importDetails, queryClient]);

  /** Open a tea from a list (Teas, Orders, the detail panel) on top of the tab. */
  const handleEditEntry = useCallback((id: string) => pushTea(id, 'face'), [pushTea]);

  /** A tea is saved: every screen of it closes, and you are back where you were. */
  const closeTeaById = useCallback((id: string) => {
    const stack = teaStackRef.current;
    let n = stack.length;
    while (n > 0 && stack[n - 1].id === id) n -= 1;
    const rest = stack.slice(0, n);
    if (rest.length) useTeaCompassStore.getState().setActiveEntry(rest[rest.length - 1].id);
    setStack(rest);
  }, [setStack]);

  const handleCommitEntry = useCallback(() => {
    const top = teaStackRef.current[teaStackRef.current.length - 1];
    const id = top?.id ?? activeEntryId;
    // Capture committed entry info before it's removed from session
    const committed = id ? getEntry(id) : null;

    // If this compass entry is linked to a sample, write tasting data back
    if (committed && entryIsSample(committed) && committed.id && committed.tasting &&
        Object.values(committed.tasting).some((v) => Array.isArray(v) ? v.length > 0 : v != null)) {
      const linkedSample = samplesList.find((s) => s.compassEntryId === committed.id);
      if (linkedSample) {
        const tastingRecord: SampleTasting = {
          id: crypto.randomUUID(),
          tasterId: 'admin',
          tasting: committed.tasting,
          verdict: committed.sampleVerdict || 'neutral',
          wouldBuy: committed.sampleWouldBuy || false,
          personalNote: committed.notes || undefined,
          createdAt: new Date().toISOString(),
        };
        addSampleTasting(linkedSample.id, tastingRecord);
        // addTasting in sampleStore auto-advances status from untasted → tasted

        // The tasting record advances only the explicit sample lifecycle.
        // Verdict remains tasting evidence; it never infers an operational or
        // sourcing status.
      }
    }

    if (id) closeTeaById(id);
    // Straight on to the next tea: the cursor goes to the table's name line.
    window.requestAnimationFrame(() => {
      Array.from(document.querySelectorAll<HTMLInputElement>('input[aria-label="Name the next tea"]'))
        .find((input) => input.offsetParent !== null)?.focus();
    });
  }, [activeEntryId, getEntry, samplesList, addSampleTasting, closeTeaById]);

  const handleDoneClick = useCallback(() => {
    const top = teaStackRef.current[teaStackRef.current.length - 1];
    const id = top?.id ?? activeEntryId;
    if (!id) return;
    commitEntry(id);
    handleCommitEntry();
  }, [activeEntryId, commitEntry, handleCommitEntry]);

  // Remember the screen we switched away from, so the header back arrow can
  // return there (Source → Library → back → Source) instead of exiting Curate.
  const [prevMode, setPrevMode] = useState<CompassMode | null>(null);

  /** A tab tap shows that tab's own first screen: any open tea closes, and a
   *  vendor's card or other sub-screen starts over. */
  const handleSwitchMode = useCallback((newMode: CompassMode) => {
    clearTeaStack();
    setVendorOpen(null);
    setTabKey((k) => k + 1);
    setMode((current) => {
      if (newMode !== current) setPrevMode(current);
      return newMode;
    });
  }, [clearTeaStack]);

  // ── Curate v2 surfaces ────────────────────────────────────────────────
  const [fastTastingId, setFastTastingId] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [talkFor, setTalkFor] = useState<string | null>(null);
  const talkStartPendingRef = useRef(false);

  /** Open one tea on top of the tab you are on. The tab does not change. */
  const openTea = useCallback((entryId: string) => pushTea(entryId, 'face'), [pushTea]);

  const openFullTasting = useCallback((entryId: string) => {
    setFastTastingId(null);
    pushTea(entryId, 'card');
    window.setTimeout(() => captureCardActionsRef.current?.openTasting(), 250);
  }, [pushTea]);

  /** Buy on a tea: it joins its vendor's draft order and the order opens on top. */
  const openBuy = useCallback((entryId: string) => {
    const txId = addTeaToDraftOrder(entryId);
    if (txId) pushOrder(txId);
  }, [pushOrder]);

  const handleTodayAct = useCallback((entryId: string, action: TodayAction) => {
    if (action === 'taste') { setFastTastingId(entryId); return; }
    openTea(entryId);
  }, [openTea]);

  /** "Start a table": the Table tab, with a new table asking whose it is.
   *  A table already open is simply shown; it stays open until a new one is
   *  started from its own header. */
  const startTable = useCallback(() => {
    clearTeaStack();
    setPrevMode('today');
    setMode('sourcing');
    if (!useTeaCompassStore.getState().currentSessionId) {
      startNewTable();
      setPickVendorSignal((n) => n + 1);
    }
  }, [clearTeaStack, startNewTable]);

  // Header back: the top tea closes first; then, if we came from another
  // screen within Curate, go back to it; otherwise exit Curate via onBack.
  const handleHeaderBack = useCallback(() => {
    if (teaStackRef.current.length > 0) { closeTopTea(); return; }
    if (prevMode !== null && prevMode !== mode) {
      const target = prevMode;
      setPrevMode(null);
      setMode(target);
      return;
    }
    onBack?.();
  }, [prevMode, mode, closeTopTea, onBack]);

  // The Run sheet and "New entry" inside the full form move the active tea;
  // the card on top follows it.
  useEffect(() => {
    const stack = teaStackRef.current;
    const top = stack[stack.length - 1];
    if (top?.as === 'card' && activeEntryId && activeEntryId !== top.id && useTeaCompassStore.getState().getEntry(activeEntryId)) {
      setStack([...stack.slice(0, -1), { id: activeEntryId, as: 'card' }]);
    }
  }, [activeEntryId, setStack]);

  // A tea that no longer exists (discarded, deleted) leaves the stack.
  const topIsPending = useTeaCompassStore((s) => !!topLayer && topLayer.as !== 'order' && s.pendingEntries.some((e) => e.id === topLayer.id));
  const topTeaExists = useTeaCompassStore((s) => !topLayer
    || topLayer.as === 'order'
    || s.pendingEntries.some((e) => e.id === topLayer.id)
    || s.entries.some((e) => e.id === topLayer.id));
  const topOrderExists = useLedgerStore((s) => !topLayer || topLayer.as !== 'order' || s.transactions.some((t) => t.id === topLayer.id));
  const topExists = topTeaExists && topOrderExists;
  useEffect(() => {
    if (!topExists) {
      const stack = teaStackRef.current;
      const rest = stack.slice(0, -1);
      const below = rest[rest.length - 1];
      if (below && below.as !== 'order') useTeaCompassStore.getState().setActiveEntry(below.id);
      setStack(rest);
    }
  }, [topExists, setStack]);

  // Compass + notes hydration / debounced push / online-retry all live
  // in `useCompassSync` and `useNotesSync` at the app root in `App.tsx`,
  // alongside `useFavoritesSync` / `useTastingJournalSync` / `useOfflineSync`.
  // Those hooks run while authenticated regardless of whether this view is
  // mounted, so compass + notes data stays fresh across navigation.

  const handleVoiceTranscript = useCallback(
    (text: string, recordingContextKey: string) => {
      const contextPrefix = `curate:${activeUserId ?? 'guest'}:${activeAccountId ?? 'guest'}:`;
      if (!recordingContextKey.startsWith(contextPrefix)) return false;
      const recordedEntryId = recordingContextKey.slice(contextPrefix.length);
      if (!recordedEntryId || recordedEntryId === 'unassigned') return false;
      const entry = getEntry(recordedEntryId);
      addNote({
        accountId: activeAccountId ?? 'guest',
        compassEntryId: recordedEntryId,
        teaKey: entry?.teaKey,
        text,
        sourceType: 'voice',
        authorId: activeAccountId ?? 'guest',
        authorName: activeAccount?.name ?? 'You',
        visibility: 'private',
      });
      syncNotes().catch(() => {});
      return true;
    },
    [getEntry, addNote, activeUserId, activeAccountId, activeAccount]
  );

  const voiceUserId = activeUserId ?? 'guest';
  const voiceContextKey = `curate:${voiceUserId}:${activeAccountId ?? 'guest'}:${activeEntryId ?? 'unassigned'}`;
  const {
    state: voiceState,
    errorMessage: voiceError,
    pendingRecording: pendingVoiceRecording,
    handlePress: handleVoicePress,
    retryPending: retryPendingVoice,
    discardPending: discardPendingVoice,
  } = useVoiceRecorder(handleVoiceTranscript, voiceContextKey, voiceUserId);
  const isPlatformPrivileged = usePlatformPrivilege();

  // Talk about one tea from its row: the recorder files what is said against
  // the tea that is active when recording starts, so make that tea active
  // first and start once it is. Tapping the same row again stops.
  const handleRowTalk = useCallback((entryId: string) => {
    if (voiceState === 'recording') {
      handleVoicePress();
      return;
    }
    if (voiceState === 'transcribing') return;
    setTalkFor(entryId);
    if (activeEntryId === entryId) {
      handleVoicePress();
    } else {
      talkStartPendingRef.current = true;
      setActiveEntry(entryId);
    }
  }, [voiceState, handleVoicePress, activeEntryId, setActiveEntry]);

  useEffect(() => {
    if (!talkStartPendingRef.current || !talkFor || activeEntryId !== talkFor) return;
    talkStartPendingRef.current = false;
    handleVoicePress();
  }, [activeEntryId, talkFor, handleVoicePress]);

  const pendingIncomingCount = visibleShares.length;

  // ?capture=tea|teaware asks for a new tea to be started straight away.
  const capturePromptedRef = useRef(false);
  useEffect(() => {
    if (capturePromptedRef.current || !initialCaptureOption || initialEntryId || initialDevelopmentProduct) return;
    capturePromptedRef.current = true;
    pushTea(startNewCaptureOnTable(initialCaptureOption), 'card');
  }, [initialCaptureOption, initialEntryId, initialDevelopmentProduct, pushTea, startNewCaptureOnTable]);
  // The footer's Buy / Done / Sample sit under the full form of a tea (not teaware).
  const showCaptureActionBar = topLayer?.as === 'card' && activeEntry?.category !== 'teaware';

  // Tab-level search, shared across all tabs; cleared on tab switch
  const [tabSearchQuery, setTabSearchQuery] = useState('');
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);
  const desktopSearchInputRef = useRef<HTMLInputElement>(null);

  // Per-share preview expand state
  const [expandedShareIds, setExpandedShareIds] = useState<Set<string>>(new Set());

  // Desktop tasting: which entry is shown in the right detail panel
  const [tastingSelectedEntryId, setTastingSelectedEntryId] = useState<string | null>(null);
  const [pendingLibraryAcquisitionId, setPendingLibraryAcquisitionId] = useState<string | null>(null);

  const openLibraryAcquisition = useCallback((id: string) => {
    setTastingSelectedEntryId(null);
    setPendingLibraryAcquisitionId(id);
    pushTea(id, 'card');
  }, [pushTea]);

  useEffect(() => {
    if (!teaOpen) setPendingLibraryAcquisitionId(null);
  }, [teaOpen]);

  // Reset search + tasting selection when switching tabs
  useEffect(() => {
    setTabSearchQuery('');
    setTastingSelectedEntryId(null);
  }, [mode]);

  // Tab config
  // Curate v2: five tabs, equal columns, always on one line.
  const tabs: { id: CompassMode; label: string; badge?: number }[] = [
    { id: 'today', label: 'Today' },
    { id: 'sourcing', label: 'Table' },
    { id: 'library', label: 'Teas', badge: pendingIncomingCount > 0 ? pendingIncomingCount : undefined },
    { id: 'vendors', label: 'Vendors' },
    { id: 'buying', label: 'Orders' },
  ];
  const currentTab = tabs.find((t) => t.id === mode);

  // Library, desktop, nothing selected → the list fills the whole pane as a
  // grid (no narrow rail beside an empty detail panel). Selecting an entry
  // collapses back to rail + detail. Only Library has an "empty right pane"
  // state; Source (editor) and Ledger (overview) always fill their pane.
  const libraryGrid = mode === 'library' && !tastingSelectedEntryId;

  return (
    <div className="curate-v2 flex flex-col relative h-full min-h-0 bg-tea-bg">
      {/* ── HEADER (single row prototype) ──
          [back] [Source ▾] [Tea/Teaware/Samples on sourcing] [share/sync]

          Page tabs (Source / Library / Ledger) collapse into a "{screen} ▾"
          chip on the left. Tap it to open a Vaul sheet with the three
          screens to switch between. The Tea / Teaware / Samples sub-tabs
          live INLINE on the same row when sourcing, so the user has one
          horizontal nav surface instead of three stacked rows.

          Auto-collapses on scroll-down (translate-y-full) and reveals on
          scroll-up. Resets to revealed when the user is at the top. */}
      <div
        className={`shrink-0 overflow-hidden bg-tea-bg transition-[max-height,opacity] duration-200 ease-out lg:!max-h-none lg:!opacity-100 ${
          headerCollapsed && !teaOpen ? 'max-h-0 opacity-0' : 'max-h-[160px] opacity-100'
        }`}
        style={{ position: 'relative', zIndex: 5 }}
      >
        {/* Row 1: Screen segmented control (Source / Library / Ledger).
            Always visible, one tap between screens. The capture-type
            sub-tabs (Tea / Teaware / Samples) moved to Row 2 so this row
            stays single-purpose: which screen am I on. */}
        {/* Curate v2, row 1: back, the title, samples and a new tea. */}
        <div className="flex h-12 items-center gap-2 px-2 sm:px-4">
          <button
            type="button"
            onClick={handleHeaderBack}
            className="tap-target flex h-11 w-9 shrink-0 items-center justify-center text-tea-text-sec hover:text-tea-text transition-colors"
            aria-label="Back"
          >
            <ArrowLeft size={18} strokeWidth={1.75} />
          </button>
          <span className="min-w-0 flex-1 truncate font-display text-ui-26 leading-none text-tea-text">Curate</span>
          <SampleOrderAction
              open={sampleOrderOpen}
              managing={sampleOrderManaging}
              initialSetId={initialSampleSetId}
              onOpenChange={setSampleOrderOpen}
              onRequestCloseRoute={initialSampleOrder ? onSampleOrderRouteClose : undefined}
              onManagingChange={setSampleOrderManaging}
              onCaptureTea={() => {
                setSampleOrderOpen(false);
                setSampleOrderManaging(false);
                handleNewCapture('tea');
                window.requestAnimationFrame(() => Array.from(document.querySelectorAll<HTMLInputElement>('input[placeholder^="Tea name"]')).find(input => input.offsetParent !== null)?.focus());
              }}
              onBrowseLibrary={() => {
                setSampleOrderOpen(false);
                setSampleOrderManaging(false);
                handleSwitchMode('library');
              }}
              hideWhenEmpty
            />
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setAddMenuOpen((v) => !v)}
              aria-expanded={addMenuOpen}
              aria-haspopup="menu"
              className="curate-v2-word tap-target flex min-h-11 items-center gap-1 px-1 text-ui-14"
            >
              <span aria-hidden>+</span>
              Tea
            </button>
            {addMenuOpen && (
              <>
                <div className="fixed inset-0 z-[6]" aria-hidden onClick={() => setAddMenuOpen(false)} />
                <div role="menu" className="absolute right-0 top-full z-[7] mt-1 grid w-52 overflow-hidden rounded-[3px] border border-tea-border bg-tea-elevated shadow-lg">
                  {([
                    ['New tea', () => handleNewCapture('tea')],
                    ['New teaware', () => handleNewCapture('teaware')],
                    ['Import a list or invoice', (el: HTMLButtonElement) => beginNewImportFrom(el)],
                    ['Sample list', () => setSampleOrderOpen(true)],
                  ] as Array<[string, (el: HTMLButtonElement) => void]>).map(([label, act]) => (
                    <button key={label} type="button" role="menuitem" onClick={(e) => { setAddMenuOpen(false); act(e.currentTarget); }} className="min-h-12 border-b border-tea-border px-4 text-left font-display text-ui-17 text-tea-text last:border-b-0 hover:text-tea-gold">
                      {label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Row 2: the five screens, equal columns, always one line. */}
        <div className="curate-v2-tabs border-b border-tea-border px-1" role="tablist" aria-label="Screen">
          {tabs.map((tab) => {
            const active = mode === tab.id || (tab.id === 'library' && mode === 'compare');
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => handleSwitchMode(tab.id)}
                className="curate-v2-tab"
              >
                {tab.label}
                {tab.badge != null && <span className="ml-0.5 tabular-nums">({tab.badge})</span>}
              </button>
            );
          })}
        </div>

      </div>

      {/* ── BODY ──
          The tab underneath stays mounted while a tea is open on top of it
          (inert, so it cannot be tapped or focused), which is what keeps its
          scroll and its sub-screen exactly as they were. */}
      <div className="relative flex-1 min-h-0 flex flex-col">
      <div className="flex-1 min-h-0 flex flex-col" inert={teaOpen} style={teaOpen ? { visibility: 'hidden' } : undefined} data-testid="curate-tab-body">
        {mode === 'today' || mode === 'vendors' || mode === 'compare' || mode === 'sourcing' ? (
          // Curate v2's own screens: one scroll area at every width.
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pt-3 pb-nav-gap-lg" style={{ WebkitOverflowScrolling: 'touch' }}>
            <div className="mx-auto w-full max-w-2xl" key={`${mode}-${tabKey}`}>
              {mode === 'today' && (
                <TodayView onStartTable={startTable} onAct={handleTodayAct} onOpenTea={openTea} onOpenVendor={(v) => { setVendorOpen(v); setPrevMode('today'); setMode('vendors'); }} />
              )}
              {mode === 'vendors' && (
                <VendorsView
                  initialVendor={vendorOpen}
                  onCloseVendor={() => setVendorOpen(null)}
                  onOpenTea={openTea}
                  onAddTea={(v) => { const id = startNewCaptureOnTable('tea'); updateEntry(id, { vendorId: v.id, vendorName: v.name }); pushTea(id, 'card'); }}
                  onAddTeaware={(v) => { const id = startNewCaptureOnTable('teaware'); updateEntry(id, { vendorId: v.id, vendorName: v.name }); pushTea(id, 'card'); }}
                />
              )}
              {mode === 'compare' && (
                <CompareView
                  chosen={compareIds}
                  onChosenChange={setCompareIds}
                  onOpenTea={openTea}
                  onBuy={openBuy}
                  onClose={() => { setPrevMode(null); setMode('library'); }}
                />
              )}
              {mode === 'sourcing' && (
                <>
                  {initialDevelopmentProduct && !developmentStarted && (
                    <div className="mb-3 flex flex-wrap items-center gap-3 rounded-md border border-tea-border bg-tea-surface px-3 py-3" role="status">
                      <div className="min-w-0 flex-1">
                        <div className="font-display text-ui-15 text-tea-text">Develop {initialDevelopmentProduct.name} in Curate</div>
                        <div className="text-ui-12 text-tea-text-sec">No encounter is linked yet. Start one deliberately from this inventory record.</div>
                      </div>
                      <button type="button" onClick={startInventoryDevelopment} className="min-h-11 px-3 rounded-md bg-tea-accent-sub text-ui-12 text-tea-text hover:bg-tea-gold/10">
                        Start development
                      </button>
                    </div>
                  )}
                  {/* Curate v2: the open table, and only it. */}
                  <TableList
                    activeEntryId={activeEntryId}
                    onOpen={openTea}
                    onTaste={setFastTastingId}
                    canTalk={isPlatformPrivileged}
                    onTalk={handleRowTalk}
                    talkingEntryId={talkFor}
                    voiceState={voiceState}
                    pickVendorSignal={pickVendorSignal}
                  />
                  {batchMode && <BatchCaptureRow />}
                </>
              )}
            </div>
          </div>
        ) : (<>

        {/* ══════════════════════════════════════════════
            MOBILE PATH, hidden on lg+, original layout
            ══════════════════════════════════════════════ */}
        <div className="flex flex-col flex-1 min-h-0 lg:hidden">

          {/* Search bar */}
          {(
            <div className="shrink-0 flex items-center gap-3 px-4 pt-2.5 pb-1">
              <div className="relative min-w-0 flex-1">
                <input
                  ref={mobileSearchInputRef}
                  type="text"
                  value={tabSearchQuery}
                  onChange={(e) => setTabSearchQuery(e.target.value)}
                  placeholder={
                    mode === 'library'
                      ? 'Search teas'
                      : 'Search orders…'
                  }
                  className="w-full min-h-11 rounded-[3px] border border-tea-border bg-transparent py-2 pl-3 pr-10 font-mono text-ui-16 text-tea-text outline-none placeholder:text-tea-text-dim focus:border-tea-gold transition-colors"
                />
                {tabSearchQuery && (
                  <button
                    type="button"
                    onClick={() => { setTabSearchQuery(''); mobileSearchInputRef.current?.focus(); }}
                    className="tap-target absolute right-2.5 top-1/2 -translate-y-1/2 text-tea-text-sec hover:text-tea-text transition-colors"
                    aria-label="Clear search"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
              {mode === 'library' && compareTeaCount >= 2 && (
                <button type="button" onClick={() => { setPrevMode('library'); setMode('compare'); }} className="curate-v2-word tap-target min-h-11 shrink-0">
                  Compare
                </button>
              )}
            </div>
          )}

          {/* Content area. Capture context actions live in the header cluster;
              Buy, Done, and Sample live in the form footer, so this scroll
              region only needs to clear the BottomTabBar. */}
          <div
            ref={scrollContainerRef}
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pt-3 pb-3"
            role="tabpanel"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            <AnimatePresence mode="wait">
              {mode === 'library' ? (
                <div key="library">
                  {/* Pending incoming shares, require explicit accept/decline */}
                  {visibleShares.length > 0 && (
                    <div className="mb-4 space-y-2">
                      {/* Header row: count + bulk actions */}
                      <div className="flex items-center gap-2 px-0.5">
                        <p className="text-ui-10 uppercase tracking-[0.12em] text-tea-text-dim font-medium flex-1">
                          {visibleShares.length} pending {visibleShares.length === 1 ? 'share' : 'shares'}
                        </p>
                        {visibleShares.length > 1 && (
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => visibleShares.forEach((s) => acceptShareMutation.mutate(s.id))}
                              disabled={acceptShareMutation.isPending || declineShareMutation.isPending}
                              className="text-ui-11 text-tea-gold font-semibold hover:text-tea-gold/80 disabled:opacity-40 transition-colors"
                            >
                              Accept all
                            </button>
                            <span className="text-tea-border text-ui-10">·</span>
                            <button
                              type="button"
                              onClick={() => visibleShares.forEach((s) => declineShareMutation.mutate(s.id))}
                              disabled={acceptShareMutation.isPending || declineShareMutation.isPending}
                              className="text-ui-11 text-tea-text-dim font-medium hover:text-tea-text-sec disabled:opacity-40 transition-colors"
                            >
                              Decline all
                            </button>
                          </div>
                        )}
                      </div>

                      {visibleShares.map((share) => {
                        const meta = share.shared_metadata || {};
                        const from = share.source_user_name || share.source_account_name || 'A taster';
                        const isActing = actingShareId === share.id;
                        const isExpanded = expandedShareIds.has(share.id);
                        const toggleExpanded = () => setExpandedShareIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(share.id)) next.delete(share.id); else next.add(share.id);
                          return next;
                        });
                        return (
                          <div
                            key={share.id}
                            className="rounded-xl bg-tea-surface border border-tea-border px-3 py-2.5 space-y-2"
                          >
                            {/* Card header, always visible */}
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="text-ui-11 text-tea-text-sec mb-0.5">From {from}</p>
                                <p className="text-sm font-medium text-tea-text truncate">
                                  {meta.name || 'Unnamed card'}
                                </p>
                                {(meta.type || meta.year) && (
                                  <p className="text-ui-11 text-tea-text-dim">
                                    {[meta.type, meta.year].filter(Boolean).join(' · ')}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-start gap-2 shrink-0">
                                {meta.photo && (
                                  <img
                                    src={mediaUrl(meta.photo)}
                                    alt={meta.name}
                                    className="w-12 h-12 rounded-md object-cover border border-tea-border"
                                  />
                                )}
                                {/* Preview toggle */}
                                <button
                                  type="button"
                                  onClick={toggleExpanded}
                                  className="mt-0.5 p-1 text-tea-text-dim hover:text-tea-text-sec transition-colors"
                                  aria-label={isExpanded ? 'Collapse preview' : 'Expand preview'}
                                >
                                  {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                </button>
                              </div>
                            </div>

                            {/* Inline preview, expanded accordion */}
                            <AnimatePresence initial={false}>
                              {isExpanded && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  transition={{ duration: 0.18 }}
                                  className="overflow-hidden"
                                >
                                  <div className="pt-1 pb-0.5 border-t border-tea-border space-y-1.5 text-ui-12">
                                    {meta.originRegion && (
                                      <div className="flex gap-2">
                                        <span className="text-tea-text-dim w-14 shrink-0">Origin</span>
                                        <span className="text-tea-text-sec">{meta.originRegion}</span>
                                      </div>
                                    )}
                                    {meta.season && (
                                      <div className="flex gap-2">
                                        <span className="text-tea-text-dim w-14 shrink-0">Season</span>
                                        <span className="text-tea-text-sec">{meta.season}</span>
                                      </div>
                                    )}
                                    {meta.form && (
                                      <div className="flex gap-2">
                                        <span className="text-tea-text-dim w-14 shrink-0">Form</span>
                                        <span className="text-tea-text-sec">{meta.form}</span>
                                      </div>
                                    )}
                                    {meta.teawareCategory && (
                                      <div className="flex gap-2">
                                        <span className="text-tea-text-dim w-14 shrink-0">Category</span>
                                        <span className="text-tea-text-sec">{meta.teawareCategory}</span>
                                      </div>
                                    )}
                                    {meta.material && (
                                      <div className="flex gap-2">
                                        <span className="text-tea-text-dim w-14 shrink-0">Material</span>
                                        <span className="text-tea-text-sec">{meta.material}</span>
                                      </div>
                                    )}
                                    {meta.capacityMl && (
                                      <div className="flex gap-2">
                                        <span className="text-tea-text-dim w-14 shrink-0">Capacity</span>
                                        <span className="text-tea-text-sec">{meta.capacityMl} ml</span>
                                      </div>
                                    )}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>

                            {/* Accept / Decline, always visible */}
                            <div className="flex gap-2">
                              <button
                                type="button"
                                disabled={isActing}
                                onClick={() => acceptShareMutation.mutate(share.id)}
                                className="flex-1 py-1.5 rounded-md bg-tea-gold/10 text-tea-gold text-ui-11 font-semibold uppercase tracking-[0.08em] hover:bg-tea-gold/15 disabled:opacity-50 transition-colors"
                              >
                                {isActing ? '…' : 'Accept'}
                              </button>
                              <button
                                type="button"
                                disabled={isActing}
                                onClick={() => declineShareMutation.mutate(share.id)}
                                className="flex-1 py-1.5 rounded-md bg-tea-surface text-tea-text-dim text-ui-11 font-medium hover:text-tea-text-sec disabled:opacity-50 transition-colors border border-tea-border"
                              >
                                Decline
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <LibraryImportsSection
                    imports={importAccountId === activeAccountId ? importDetails : []}
                    busyImportId={busyLibraryImportId}
                    errorByImportId={libraryImportErrors}
                    focusRequest={libraryDeleteFocusRequest}
                    fallbackFocusRef={mobileSearchInputRef}
                    onOpen={openSavedImport}
                    onDelete={deleteSavedImport}
                  />
                  <BrowseView
                    onEditEntry={handleEditEntry}
                    onNewCapture={handleNewCapture}
                    externalSearchQuery={tabSearchQuery}
                    onAcquireEntry={openLibraryAcquisition}
                    onOpenTea={openTea}
                  />
                </div>
              ) : (
                <div key="buying">
                  <LedgerView
                    embedded
                    onOpenEntry={openTea}
                    onOpenOrder={pushOrder}
                    searchQuery={tabSearchQuery}
                  />
                </div>
              )}
            </AnimatePresence>
          </div>


        </div>
        {/* END MOBILE */}

        {/* ══════════════════════════════════════════════════
            DESKTOP PATH, hidden on mobile, two-column split
            ══════════════════════════════════════════════════ */}
        <div className="hidden lg:flex flex-row flex-1 min-h-0 overflow-hidden">

          {/* ── LEFT COLUMN (list rail), widens at larger breakpoints so the
              cards breathe and the empty detail panel doesn't read as dead
              space on wide monitors. In Library with nothing selected it
              expands to fill the whole pane as a grid (libraryGrid). ── */}
          <div
            className={`flex flex-col overflow-hidden ${
              libraryGrid
                ? 'flex-1 min-w-0'
                : 'w-[264px] shrink-0 border-r border-tea-border'
            }`}
          >

            {/* Search bar (desktop) */}
            <div className="mx-auto flex w-full max-w-2xl shrink-0 items-center gap-3 px-4 pt-2.5 pb-1">
              <div className="relative min-w-0 flex-1">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-tea-text-dim pointer-events-none" />
                <input
                  ref={desktopSearchInputRef}
                  type="text"
                  value={tabSearchQuery}
                  onChange={(e) => setTabSearchQuery(e.target.value)}
                  placeholder={
                    mode === 'library' ? 'Search teas'
                    : 'Search orders…'
                  }
                  className="w-full min-h-11 rounded-[3px] border border-tea-border bg-transparent py-2 pl-9 pr-10 font-mono text-ui-16 text-tea-text outline-none placeholder:text-tea-text-dim focus:border-tea-gold transition-colors"
                />
                {tabSearchQuery && (
                  <button
                    type="button"
                    onClick={() => { setTabSearchQuery(''); }}
                    className="tap-target absolute right-2.5 top-1/2 -translate-y-1/2 text-tea-text-sec hover:text-tea-text transition-colors"
                    aria-label="Clear search"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
              {mode === 'library' && compareTeaCount >= 2 && (
                <button type="button" onClick={() => { setPrevMode('library'); setMode('compare'); }} className="curate-v2-word tap-target min-h-11 shrink-0">
                  Compare
                </button>
              )}
            </div>

            {/* Scrollable left content */}
            <div
              className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pt-3 pb-4"
              style={{ WebkitOverflowScrolling: 'touch', scrollbarGutter: 'stable' }}
            >
              <AnimatePresence mode="wait">

                {/* TASTING LEFT: shares + co-tasting + BrowseView */}
                {mode === 'library' && (
                  <motion.div
                    key="left-tasting"
                    className="mx-auto w-full max-w-2xl"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.2 }}
                  >
                    {/* Pending incoming shares */}
                    {visibleShares.length > 0 && (
                      <div className="mb-4 space-y-2">
                        {/* Header row: count + bulk actions */}
                        <div className="flex items-center gap-2 px-0.5">
                          <p className="text-ui-10 uppercase tracking-[0.12em] text-tea-text-dim font-medium flex-1">
                            {visibleShares.length} pending {visibleShares.length === 1 ? 'share' : 'shares'}
                          </p>
                          {visibleShares.length > 1 && (
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => visibleShares.forEach((s) => acceptShareMutation.mutate(s.id))}
                                disabled={acceptShareMutation.isPending || declineShareMutation.isPending}
                                className="text-ui-11 text-tea-gold font-semibold hover:text-tea-gold/80 disabled:opacity-40 transition-colors"
                              >
                                Accept all
                              </button>
                              <span className="text-tea-border text-ui-10">·</span>
                              <button
                                type="button"
                                onClick={() => visibleShares.forEach((s) => declineShareMutation.mutate(s.id))}
                                disabled={acceptShareMutation.isPending || declineShareMutation.isPending}
                                className="text-ui-11 text-tea-text-dim font-medium hover:text-tea-text-sec disabled:opacity-40 transition-colors"
                              >
                                Decline all
                              </button>
                            </div>
                          )}
                        </div>

                        {visibleShares.map((share) => {
                          const meta = share.shared_metadata || {};
                          const from = share.source_user_name || share.source_account_name || 'A taster';
                          const isActing = actingShareId === share.id;
                          const isExpanded = expandedShareIds.has(share.id);
                          const toggleExpanded = () => setExpandedShareIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(share.id)) next.delete(share.id); else next.add(share.id);
                            return next;
                          });
                          return (
                            <div
                              key={share.id}
                              className="rounded-xl bg-tea-surface border border-tea-border px-3 py-2.5 space-y-2"
                            >
                              {/* Card header, always visible */}
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <p className="text-ui-11 text-tea-text-sec mb-0.5">From {from}</p>
                                  <p className="text-sm font-medium text-tea-text truncate">
                                    {meta.name || 'Unnamed card'}
                                  </p>
                                  {(meta.type || meta.year) && (
                                    <p className="text-ui-11 text-tea-text-dim">
                                      {[meta.type, meta.year].filter(Boolean).join(' · ')}
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-start gap-2 shrink-0">
                                  {meta.photo && (
                                    <img
                                      src={mediaUrl(meta.photo)}
                                      alt={meta.name}
                                      className="w-12 h-12 rounded-md object-cover border border-tea-border"
                                    />
                                  )}
                                  <button
                                    type="button"
                                    onClick={toggleExpanded}
                                    className="mt-0.5 p-1 text-tea-text-dim hover:text-tea-text-sec transition-colors"
                                    aria-label={isExpanded ? 'Collapse preview' : 'Expand preview'}
                                  >
                                    {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                  </button>
                                </div>
                              </div>

                              {/* Inline preview, expanded accordion */}
                              <AnimatePresence initial={false}>
                                {isExpanded && (
                                  <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.18 }}
                                    className="overflow-hidden"
                                  >
                                    <div className="pt-1 pb-0.5 border-t border-tea-border space-y-1.5 text-ui-12">
                                      {meta.originRegion && (
                                        <div className="flex gap-2">
                                          <span className="text-tea-text-dim w-14 shrink-0">Origin</span>
                                          <span className="text-tea-text-sec">{meta.originRegion}</span>
                                        </div>
                                      )}
                                      {meta.season && (
                                        <div className="flex gap-2">
                                          <span className="text-tea-text-dim w-14 shrink-0">Season</span>
                                          <span className="text-tea-text-sec">{meta.season}</span>
                                        </div>
                                      )}
                                      {meta.form && (
                                        <div className="flex gap-2">
                                          <span className="text-tea-text-dim w-14 shrink-0">Form</span>
                                          <span className="text-tea-text-sec">{meta.form}</span>
                                        </div>
                                      )}
                                      {meta.teawareCategory && (
                                        <div className="flex gap-2">
                                          <span className="text-tea-text-dim w-14 shrink-0">Category</span>
                                          <span className="text-tea-text-sec">{meta.teawareCategory}</span>
                                        </div>
                                      )}
                                      {meta.material && (
                                        <div className="flex gap-2">
                                          <span className="text-tea-text-dim w-14 shrink-0">Material</span>
                                          <span className="text-tea-text-sec">{meta.material}</span>
                                        </div>
                                      )}
                                      {meta.capacityMl && (
                                        <div className="flex gap-2">
                                          <span className="text-tea-text-dim w-14 shrink-0">Capacity</span>
                                          <span className="text-tea-text-sec">{meta.capacityMl} ml</span>
                                        </div>
                                      )}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>

                              {/* Accept / Decline, always visible */}
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  disabled={isActing}
                                  onClick={() => acceptShareMutation.mutate(share.id)}
                                  className="flex-1 py-1.5 rounded-md bg-tea-gold/10 text-tea-gold text-ui-11 font-semibold uppercase tracking-[0.08em] hover:bg-tea-gold/15 disabled:opacity-50 transition-colors"
                                >
                                  {isActing ? '…' : 'Accept'}
                                </button>
                                <button
                                  type="button"
                                  disabled={isActing}
                                  onClick={() => declineShareMutation.mutate(share.id)}
                                  className="flex-1 py-1.5 rounded-md bg-tea-surface text-tea-text-dim text-ui-11 font-medium hover:text-tea-text-sec disabled:opacity-50 transition-colors border border-tea-border"
                                >
                                  Decline
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <LibraryImportsSection
                      imports={importAccountId === activeAccountId ? importDetails : []}
                      busyImportId={busyLibraryImportId}
                      errorByImportId={libraryImportErrors}
                      focusRequest={libraryDeleteFocusRequest}
                      fallbackFocusRef={desktopSearchInputRef}
                      onOpen={openSavedImport}
                      onDelete={deleteSavedImport}
                    />
                    <BrowseView
                      onEditEntry={handleEditEntry}
                      onNewCapture={handleNewCapture}
                      externalSearchQuery={tabSearchQuery}
                      onSelectEntry={(id) => setTastingSelectedEntryId(id)}
                      selectedEntryId={tastingSelectedEntryId}
                      gridMode={libraryGrid}
                      onAcquireEntry={openLibraryAcquisition}
                      onOpenTea={openTea}
                    />
                  </motion.div>
                )}

                {/* BUYING LEFT: LedgerView */}
                {mode === 'buying' && (
                  <motion.div
                    key="left-buying"
                    className="mx-auto w-full max-w-2xl"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <LedgerView
                      embedded
                      onOpenEntry={openTea}
                      onOpenOrder={pushOrder}
                      searchQuery={tabSearchQuery}
                    />
                  </motion.div>
                )}

              </AnimatePresence>
            </div>

            {/* Left column desktop FAB footer: Tasting + Buying only */}
            {(
              <div className="shrink-0 border-t border-tea-border px-4 pb-4 pt-2">
                <div className="mx-auto w-full max-w-2xl">
                  <button
                    type="button"
                    onClick={() => handleNewCapture()}
                    className="curate-v2-frame is-tall is-wide uppercase tracking-[0.16em]"
                  >
                    + New entry
                  </button>
                </div>
              </div>
            )}
          </div>
          {/* END LEFT COLUMN */}

          {/* ── RIGHT COLUMN (flex-1), hidden in Library grid mode, where the
              left column owns the full width until an entry is selected. ── */}
          <div className={`flex-col flex-1 min-w-0 overflow-hidden ${libraryGrid ? 'hidden' : 'flex'}`}>

            {/* Right column scrollable content */}
            <div
              className={`flex-1 min-h-0 overscroll-contain ${
                mode === 'library' || mode === 'buying'
                  ? 'overflow-hidden'
                  : 'overflow-y-auto px-4 pt-3 pb-4'
              }`}
              style={{ WebkitOverflowScrolling: 'touch', scrollbarGutter: 'stable' }}
            >
              <AnimatePresence mode="wait">

                {/* TASTING RIGHT: entry detail panel or empty state */}
                {mode === 'library' && (
                  <motion.div
                    key="right-tasting"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="h-full"
                  >
                    {tastingSelectedEntryId ? (
                      <CompassEntryDetailPanel
                        entryId={tastingSelectedEntryId}
                        onEdit={(id) => { handleEditEntry(id); setTastingSelectedEntryId(null); }}
                        onClose={() => setTastingSelectedEntryId(null)}
                        onShare={hasToken() ? (id) => { setActiveEntry(id); setShareModalOpen(true); } : undefined}
                        onAcquire={openLibraryAcquisition}
                      />
                    ) : (
                      <CompassRightEmptyState mode="library" onNewCapture={() => handleNewCapture()} />
                    )}
                  </motion.div>
                )}

                {/* BUYING RIGHT: spending overview panel */}
                {mode === 'buying' && (
                  <motion.div
                    key="right-buying"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="h-full"
                  >
                    <LedgerOverviewPanel />
                  </motion.div>
                )}

              </AnimatePresence>
            </div>

          </div>
          {/* END RIGHT COLUMN */}

        </div>
        {/* END DESKTOP */}
        </>)}

      </div>
      {/* END TAB BODY */}

      {/* ── A TEA, ON TOP of the tab you are on. Back closes it and you are
          exactly where you were; the tab highlight never moved. ── */}
      {topLayer && (
        <div className="absolute inset-0 z-10 flex flex-col bg-tea-surface" data-testid="curate-tea-overlay" data-layer={topLayer.as}>
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pt-3 pb-nav-gap-lg" style={{ WebkitOverflowScrolling: 'touch' }}>
            {topLayer.as === 'order' ? (
              <div className="mx-auto w-full max-w-xl" data-testid="order-screen">
                <OrderScreen key={topLayer.id} txId={topLayer.id} onOpenEntry={openTea} onSwitchOrder={switchTopOrder} />
              </div>
            ) : topLayer.as === 'face' ? (
              <div className="mx-auto w-full max-w-xl">
                <TeaFace
                  key={topLayer.id}
                  entryId={topLayer.id}
                  onEdit={() => pushTea(topLayer.id, 'card')}
                  onBack={closeTopTea}
                  onBuy={openBuy}
                  onOpenSaid={setSaidFor}
                  onTaste={setFastTastingId}
                  onFullTasting={openFullTasting}
                  canTalk={isPlatformPrivileged}
                  onTalk={handleRowTalk}
                  talking={talkFor === topLayer.id && (voiceState === 'recording' || voiceState === 'transcribing')}
                  voiceState={voiceState}
                  onDone={topIsPending ? handleDoneClick : undefined}
                />
              </div>
            ) : (
              <div className="mx-auto w-full max-w-xl">
                {batchMode && <BatchCaptureRow />}
                <CaptureCard
                  entryId={topLayer.id}
                  onSwitchToLedger={() => handleSwitchMode('buying')}
                  onCommit={handleCommitEntry}
                  onShare={hasToken() ? () => setShareModalOpen(true) : undefined}
                  actionRef={captureCardActionsRef}
                  openPurchasePicker={pendingLibraryAcquisitionId === topLayer.id}
                  onBuyExpandedChange={setCaptureBuyExpanded}
                  batchMode={batchMode}
                  onToggleBatchMode={() => setBatchMode((v) => !v)}
                />
                {showCaptureActionBar && (
                  <CaptureActionFooter
                    className="-mx-4 max-lg:hidden lg:mx-0"
                    onBuy={() => captureCardActionsRef.current?.toggleBuy()}
                    onDone={handleDoneClick}
                    onSample={() => captureCardActionsRef.current?.openTasting()}
                    doneEnabled={captureDoneReady}
                    doneTestId="compass-done-desktop"
                    buyExpanded={captureBuyExpanded}
                    purchasePickerId={`capture-purchase-picker-${topLayer.id}`}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      )}
      </div>
      {/* END BODY */}

      {/* Voice error toast, floats just above the bottom bar. */}
      <AnimatePresence>
        {voiceError && (mode === 'sourcing' || teaOpen) && (
          <motion.div
            key="voice-error"
            role="status"
            aria-live="polite"
            aria-atomic="true"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="fixed left-0 right-0 z-20 bottom-nav flex flex-wrap items-center justify-center gap-2 text-ui-11 text-tea-error text-center px-4 py-1.5 border-t border-tea-border bg-tea-bg"
          >
            <span>{voiceError}</span>
            {pendingVoiceRecording && (
              <span className="inline-flex items-center gap-2">
                <button type="button" onClick={() => void retryPendingVoice()} className="tap-target text-tea-text-sec hover:text-tea-text">Retry</button>
                <button type="button" onClick={() => void discardPendingVoice()} className="tap-target text-tea-text-sec hover:text-tea-text">Discard</button>
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <SaidSheet entryId={saidFor} onClose={() => setSaidFor(null)} />
      <FastTastingSheet
        entryId={fastTastingId}
        onOpenChange={(open) => { if (!open) setFastTastingId(null); }}
        onFullTasting={openFullTasting}
      />

      {/* Share modal, global, unchanged */}
      <AnimatePresence>
        {shareModalOpen && activeEntryId && (() => {
          const entry = getEntry(activeEntryId);
          return entry ? (
            <CompassShareModal
              entryId={activeEntryId}
              entryName={entry.name}
              synced={entry.synced}
              onClose={() => setShareModalOpen(false)}
            />
          ) : null;
        })()}
      </AnimatePresence>
      {importOpen && (
        <ImportPanel
          key={importPanelVersion}
          accountId={activeAccountId || 'guest'}
          initialDetail={importDetail}
          onDetailChange={rememberImportDetail}
          onFinalized={handleFinalizedImport}
          onClose={closeImport}
          onNew={beginNewImport}
        />
      )}
    </div>
  );
};

export default TeaCompass;
