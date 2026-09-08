import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Upload, FileSpreadsheet, Image as ImageIcon, Loader2, Check,
  AlertTriangle, ChevronDown, ChevronRight, Trash2, Tag, Store,
  Sparkles, Layers, ArrowRight, Inbox, Receipt, Truck, RotateCw,
  MessageCircle,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Papa from 'papaparse';
import { api } from '../../lib/api';
import type { CurateImportDetail } from '../../lib/api';
import { useToast } from '../components/Toast';
import { BatchPicker } from '../components/BatchPicker';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import {
  TARGET_FIELDS, TARGET_BY_KEY, type ColumnMapping, type StagedItem,
  autoMap, loadRememberedMapping, rememberMapping, rowToStaged,
  stagedToProduct, isReadyItem, extractedToStaged,
} from '../lib/intakeMapping';
import { enteredCostCell } from '../productUpdatePayload';
import { plainCostWords } from '../../lib/costRefusalWords';
import { assertSupportedIntakeFile, readXlsxIntakeFile } from '../lib/xlsxIntake';
import { IntakeChatSheet, type ChatAnswer } from '../components/IntakeChatSheet';

interface SheetSource {
  id: string;
  kind: 'sheet';
  name: string;
  headers: string[];
  rawRows: Record<string, any>[];
  sampleRows: Record<string, any>[];
  mapping: ColumnMapping;
  defaultPersonal: boolean;
  expanded: boolean;
}
interface ImageSource {
  id: string;
  kind: 'image';
  name: string;
  status: 'extracting' | 'ready' | 'error';
  error?: string;
}
type Source = SheetSource | ImageSource;

let uid = 0;
const nextId = () => `src-${Date.now()}-${uid++}`;

type Rate = { currency: string; rateToUSD: number };

const CURRENCIES = ['USD', 'NT', 'Yuan', 'HKD', 'JPY', 'MYR', 'IDR', 'AUD'];

export const IntakeWorkspace: React.FC<{ onRefresh?: () => void; rates?: Rate[] }> = ({ onRefresh, rates = [] }) => {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const importId = searchParams.get('importId');

  const [sources, setSources] = useState<Source[]>([]);
  const [items, setItems] = useState<StagedItem[]>([]);
  // Intake batch (BatchPicker), separate concept from the curate-import draft (importId).
  const [batchId, setBatchId] = useState<string | null>(null);
  const [committing, setCommitting] = useState(false);
  const [savePurchaseRecord, setSavePurchaseRecord] = useState(true);
  const [shippingTotal, setShippingTotal] = useState<number>(0);
  const [shippingCurrency, setShippingCurrency] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [incompleteImports, setIncompleteImports] = useState<CurateImportDetail[]>([]);
  const dragDepth = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const createAttempted = useRef(false);
  const hydratedForImport = useRef<string | null>(null);

  // Ensure a server-side curate-import draft exists: create one when the URL
  // has no ?importId=, then reflect it back into the URL so a reload finds it.
  useEffect(() => {
    if (importId || createAttempted.current) return;
    createAttempted.current = true;
    let cancelled = false;
    (async () => {
      try {
        const detail = await api.curateImports.create({ title: 'Intake', source_kind: 'paste' });
        if (cancelled) return;
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          next.set('importId', detail.batch.id);
          return next;
        }, { replace: true });
      } catch {
        // Non-fatal, the workspace still functions locally; allow a later retry.
        createAttempted.current = false;
      }
    })();
    return () => { cancelled = true; };
  }, [importId, setSearchParams]);

  // Hydrate local staging from the server draft the first time we land on an id.
  // Local edits are the source of truth once staged, so we never overwrite
  // non-empty staging.
  useEffect(() => {
    if (!importId || hydratedForImport.current === importId) return;
    hydratedForImport.current = importId;
    let cancelled = false;
    (async () => {
      try {
        const detail = await api.curateImports.get(importId);
        if (cancelled) return;
        hydrateFromDetail(detail);
      } catch {
        /* non-fatal, batch may not exist yet (freshly created) */
      }
    })();
    return () => { cancelled = true; };
  }, [importId]);

  // Load the resume list so the user can jump between incomplete drafts across
  // devices / tabs.
  const refreshIncomplete = useCallback(async () => {
    try {
      const res = await api.curateImports.listIncomplete();
      setIncompleteImports(res.imports || []);
    } catch { /* non-fatal */ }
  }, []);
  useEffect(() => { void refreshIncomplete(); }, [refreshIncomplete, importId]);

  const hydrateFromDetail = useCallback((detail: CurateImportDetail) => {
    setSources((prev) => {
      if (prev.length) return prev;
      const hydrated: Source[] = [];
      for (const s of detail.sources) {
        if (s.kind === 'photo' || s.kind === 'file') {
          const meta = (s.metadata || {}) as Record<string, unknown>;
          const name = String(meta.filename || meta.name || s.r2_object_key || s.kind);
          hydrated.push({ id: s.id, kind: 'image', name, status: 'ready' });
        }
      }
      return hydrated;
    });
    setItems((prev) => {
      if (prev.length) return prev;
      const hydrated: StagedItem[] = [];
      for (const it of detail.items) {
        const parsed = (it.parsed_data || {}) as Record<string, unknown>;
        const name = it.name || String(parsed.englishName || parsed.originalName || 'Unnamed');
        const sourceId = it.source_id || '';
        if (!sourceId) continue;
        hydrated.push({
          id: it.id, sourceId, givenName: name,
          chineseName: String(parsed.chineseName || ''), productName: '',
          type: 'Misc', form: null, year: '',
          originCountry: '', originRegion: '', vendor: '',
          // Null, not 0: a resumed import has not been told a price yet, and 0
          // would say every one of its teas was free.
          costAmount: null, costCurrency: 'UNK',
          stockGrams: 0, quantityPurchased: 0, quantityUnits: 0, teawareCategory: '',
          sizeEstimate: 0, description: '', imageUrl: '',
          isPersonal: false, needsReview: true, include: true, order: {},
        });
      }
      return hydrated;
    });
  }, []);

  const resumeImport = useCallback((id: string) => {
    if (id === importId) return;
    hydratedForImport.current = null;
    setSources([]); setItems([]);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('importId', id);
      return next;
    }, { replace: true });
  }, [importId, setSearchParams]);

  const clearAll = useCallback(() => { setSources([]); setItems([]); }, []);

  // ── Item helpers ───────────────────────────────────────────────────────────
  const replaceSourceItems = useCallback((sourceId: string, next: StagedItem[]) => {
    setItems((prev) => [...prev.filter((i) => i.sourceId !== sourceId), ...next]);
  }, []);

  const updateItem = useCallback((id: string, patch: Partial<StagedItem>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }, []);

  // ── In-flow "Ask about this tea" chat sheet (THEN-T2) ─────────────────────
  // Held here (not in ItemsTable) so an open sheet survives item re-renders and
  // so the answer can flow back into the staged item via updateItem.
  const [chatItemId, setChatItemId] = useState<string | null>(null);
  const chatItem = useMemo(
    () => (chatItemId ? items.find((i) => i.id === chatItemId) : null) || null,
    [chatItemId, items],
  );
  const handleChatAnswer = useCallback((answer: ChatAnswer) => {
    if (!chatItemId) return;
    if (answer.kind !== 'value' || answer.value == null) return;
    const patch: Partial<StagedItem> = {};
    switch (answer.field) {
      case 'vendor':          patch.vendor = String(answer.value); break;
      case 'origin_country':  patch.originCountry = String(answer.value); break;
      // `Number(x) || 0` here answered "I do not know" with "it was free". An
      // answer of 0 is kept, because a gift is a real tea.
      case 'price_paid':      patch.costAmount = enteredCostCell(answer.value); break;
      case 'cost_currency':   patch.costCurrency = String(answer.value); break;
      case 'weight_grams':    patch.stockGrams = Number(answer.value) || 0; break;
      // pack_count, purchase_date, purchase_location and shipping_mode have no
      // direct StagedItem field; they still persist on the server (parsed_data).
      default: break;
    }
    if (Object.keys(patch).length) updateItem(chatItemId, patch);
  }, [chatItemId, updateItem]);

  // ── Parsing ──────────────────────────────────────────────────────────────
  const ingestSheet = useCallback((name: string, rows: Record<string, any>[]) => {
    const clean = rows.filter((r) => Object.values(r).some((v) => v != null && String(v).trim() !== ''));
    if (clean.length === 0) {
      showToast(`${name}: no rows found`, 'error');
      return;
    }
    const headers = Object.keys(clean[0]);
    const mapping = loadRememberedMapping(headers) || autoMap(headers);
    const src: SheetSource = {
      id: nextId(), kind: 'sheet', name, headers, rawRows: clean,
      sampleRows: clean.slice(0, 3), mapping, defaultPersonal: false, expanded: true,
    };
    setSources((prev) => [...prev, src]);
    replaceSourceItems(src.id, clean.map((r, i) => rowToStaged(r, mapping, src.id, i, false)));
  }, [replaceSourceItems, showToast]);

  const parseFile = useCallback(async (file: File) => {
    const lower = file.name.toLowerCase();
    if (lower.endsWith('.csv')) {
      Papa.parse(file, {
        header: true, skipEmptyLines: 'greedy',
        complete: (res: any) => ingestSheet(file.name, res.data),
        error: () => showToast(`Could not parse ${file.name}`, 'error'),
      });
    } else if (lower.endsWith('.xlsx')) {
      try {
        const rows = await readXlsxIntakeFile(file);
        ingestSheet(file.name, rows);
      } catch (error) {
        showToast(error instanceof Error ? `${file.name}: ${error.message}` : `Could not read ${file.name}`, 'error');
      }
    } else if (lower.endsWith('.xls')) {
      try { assertSupportedIntakeFile(file.name); } catch (error) {
        showToast(error instanceof Error ? error.message : `Unsupported file: ${file.name}`, 'error');
      }
    } else if (file.type.startsWith('image/')) {
      const src: ImageSource = { id: nextId(), kind: 'image', name: file.name, status: 'extracting' };
      setSources((prev) => [...prev, src]);
      // Best-effort mirror to the server draft so the source is durably attached
      // to the batch (visible on resume). Failure is silent, extraction below
      // still runs and remains the display path.
      if (importId) {
        const clientEvidenceId = (typeof crypto !== 'undefined' && 'randomUUID' in crypto) ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
        api.curateImports.uploadEvidence(importId, file, clientEvidenceId).catch(() => null);
      }
      try {
        const [imageUrl, result] = await Promise.all([
          api.uploadImage(file).catch(() => ''),
          api.extractFromImage(file).catch(() => null),
        ]);
        if (!result) throw new Error('extract failed');
        replaceSourceItems(src.id, [extractedToStaged(result as Record<string, any>, imageUrl || '', src.id, false)]);
        setSources((prev) => prev.map((s) => (s.id === src.id ? { ...s, status: 'ready' } : s)));
      } catch {
        setSources((prev) => prev.map((s) => (s.id === src.id ? { ...s, status: 'error', error: 'Extraction failed' } : s)));
        showToast(`Could not read ${file.name}`, 'error');
      }
    } else {
      showToast(`Unsupported file: ${file.name}`, 'error');
    }
  }, [ingestSheet, replaceSourceItems, showToast, importId]);

  const handleFiles = useCallback((files: FileList | File[]) => {
    Array.from(files).forEach((f) => { void parseFile(f); });
  }, [parseFile]);

  // ── Drop + paste ───────────────────────────────────────────────────────────
  const onDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault(); dragDepth.current += 1; setIsDragging(true);
  }, []);
  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault(); dragDepth.current -= 1; if (dragDepth.current <= 0) setIsDragging(false);
  }, []);
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); dragDepth.current = 0; setIsDragging(false);
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const onPaste = useCallback((e: React.ClipboardEvent) => {
    const imgs = Array.from(e.clipboardData.items)
      .filter((it) => it.type.startsWith('image/'))
      .map((it) => it.getAsFile())
      .filter((f): f is File => !!f);
    if (imgs.length) handleFiles(imgs);
  }, [handleFiles]);

  // ── Mapping editor ─────────────────────────────────────────────────────────
  const remapSource = useCallback((src: SheetSource, header: string, target: string) => {
    const mapping = { ...src.mapping, [header]: target };
    setSources((prev) => prev.map((s) => (s.id === src.id && s.kind === 'sheet' ? { ...s, mapping } : s)));
    replaceSourceItems(src.id, src.rawRows.map((r, i) => rowToStaged(r, mapping, src.id, i, src.defaultPersonal)));
    rememberMapping(src.headers, mapping);
  }, [replaceSourceItems]);

  const setSourcePersonal = useCallback((src: SheetSource, val: boolean) => {
    setSources((prev) => prev.map((s) => (s.id === src.id && s.kind === 'sheet' ? { ...s, defaultPersonal: val } : s)));
    setItems((prev) => prev.map((i) => (i.sourceId === src.id ? { ...i, isPersonal: val } : i)));
  }, []);

  const toggleExpand = useCallback((id: string) => {
    setSources((prev) => prev.map((s) => (s.id === id && s.kind === 'sheet' ? { ...s, expanded: !s.expanded } : s)));
  }, []);

  const removeSource = useCallback((id: string) => {
    setSources((prev) => prev.filter((s) => s.id !== id));
    setItems((prev) => prev.filter((i) => i.sourceId !== id));
  }, []);

  const sourceName = useCallback((id: string) => sources.find((s) => s.id === id)?.name ?? '', [sources]);

  // ── Counts ──────────────────────────────────────────────────────────────────
  const included = useMemo(() => items.filter((i) => i.include), [items]);
  const counts = useMemo(() => ({
    total: included.length,
    forSale: included.filter((i) => !i.isPersonal).length,
    personal: included.filter((i) => i.isPersonal).length,
    review: included.filter((i) => i.needsReview || !isReadyItem(i)).length,
  }), [included]);

  // ── Shipping proration ──────────────────────────────────────────────────────
  // Spread one total shipping cost across the included items by estimated size:
  // each item's share = shippingTotal × (its size ÷ total size).
  const rateFor = useCallback((cur: string) => rates.find((r) => r.currency === cur)?.rateToUSD || 1, [rates]);
  const convert = useCallback((amt: number, from: string, to: string) => (amt / rateFor(from)) * rateFor(to), [rateFor]);
  const dominantCurrency = useMemo(() => {
    const t: Record<string, number> = {};
    included.forEach((i) => { if (i.costCurrency !== 'UNK') t[i.costCurrency] = (t[i.costCurrency] || 0) + 1; });
    return Object.entries(t).sort((a, b) => b[1] - a[1])[0]?.[0] || 'USD';
  }, [included]);
  const shipCur = shippingCurrency || dominantCurrency;
  const totalSize = useMemo(() => included.reduce((s, i) => s + (i.sizeEstimate || 0), 0), [included]);
  // shipping share for an item, expressed in the shipping currency (for display)
  const shareShip = useCallback((it: StagedItem) => (
    shippingTotal > 0 && totalSize > 0 ? (shippingTotal * (it.sizeEstimate || 0)) / totalSize : 0
  ), [shippingTotal, totalSize]);

  // ── Commit ───────────────────────────────────────────────────────────────────
  const commit = useCallback(async () => {
    if (included.length === 0 || committing) return;
    setCommitting(true);
    try {
      const products = included.map((it) =>
        stagedToProduct(it, convert(shareShip(it), shipCur, it.costCurrency === 'UNK' ? shipCur : it.costCurrency)),
      );
      const chunk = 50;
      let inserted = 0;
      let skipped = 0;
      /* Not every skip is a duplicate any more: a line whose sheet named no
         price is refused by name, so the reasons are collected and shown
         instead of being counted as something they are not. */
      const skipReasons = new Set<string>();
      for (let i = 0; i < products.length; i += chunk) {
        const res: any = await api.products.bulkCreate(products.slice(i, i + chunk), batchId ?? undefined);
        inserted += res?.inserted ?? products.slice(i, i + chunk).length;
        skipped += res?.skipped ?? 0;
        for (const row of res?.results ?? []) {
          /* In words, not in column names. The server answers the two doors in
             its own vocabulary, `cost_amount` and a `(missing: amount)` marker,
             which is the right contract between two pieces of code and the
             wrong sentence to put in front of Adrian: it hands him the bug
             report instead of the thing to do next. `plainCostWords` reads that
             marker, because which half is missing is a fact only the server
             has, and says it the way the Add Product form says it. */
          if (row?.status === 'skipped' && row?.reason) skipReasons.add(plainCostWords(String(row.reason)));
        }
      }
      if (savePurchaseRecord) {
        // One purchase record per vendor/store, an order sheet routinely spans
        // many stores, so a single PO per file would lump them together wrongly.
        const rateFor = (cur: string) => rates.find((r) => r.currency === cur)?.rateToUSD || 1;
        const groups = new Map<string, StagedItem[]>();
        for (const it of included) {
          const key = it.vendor.trim() || sourceName(it.sourceId).replace(/\.[^.]+$/, '') || 'Unknown vendor';
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key)!.push(it);
        }
        for (const [vendor, lines] of groups) {
          // nothing to record if there's neither cost nor logistics
          if (!lines.some((l) => (l.costAmount ?? 0) > 0 || Object.keys(l.order).length > 0)) continue;
          const totalUSD = lines.reduce((sum, l) => {
            const qty = l.quantityPurchased || l.quantityUnits || l.stockGrams || 1;
            // A line with no recorded price adds nothing to the order total,
            // which is what not knowing costs.
            return sum + ((l.costAmount ?? 0) * qty) / rateFor(l.costCurrency);
          }, 0);
          // dominant non-UNK currency for display
          const tally: Record<string, number> = {};
          lines.forEach((l) => { if (l.costCurrency !== 'UNK') tally[l.costCurrency] = (tally[l.costCurrency] || 0) + 1; });
          const display = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0] || 'USD';
          const files = Array.from(new Set(lines.map((l) => sourceName(l.sourceId)))).filter(Boolean).join(', ');
          await api.purchaseOrders.create({
            vendor_name: vendor,
            items_json: JSON.stringify(lines.map((l) => ({
              product_name: l.givenName || l.productName,
              quantity: l.quantityPurchased || l.quantityUnits || l.stockGrams,
              unit_price: l.costAmount,
              currency: l.costCurrency,
              ...l.order,
            }))),
            total_usd: Math.round(totalUSD * 100) / 100,
            display_currency: display,
            status: 'received',
            notes: `Intake${files ? ` from ${files}` : ''}${batchId ? ` · batch ${batchId}` : ''}`,
          }).catch(() => null);
        }
      }
      /* The count, then what to do about it. A toast that only counts skips
         leaves the operator to guess which lines and why, and "duplicate" was
         the guess it used to make for every one of them. */
      const skipNote = skipped > 0
        ? ` · ${skipped} not added.${skipReasons.size > 0 ? ` ${[...skipReasons].join(' ')}` : ''}`
        : '';
      showToast(
        `Added ${inserted} item${inserted !== 1 ? 's' : ''} as drafts${skipNote}`,
        skipped > 0 ? 'error' : 'success',
      );
      onRefresh?.();
      // Close the server draft so it leaves the resume list; failure is silent
      // because the products landed regardless.
      if (importId) await api.curateImports.abandon(importId).catch(() => null);
      setSources([]); setItems([]);
      navigate('/admin/capture');
    } catch (e: any) {
      showToast(`Import failed: ${e?.message || 'error'}`, 'error');
    } finally {
      setCommitting(false);
    }
  }, [included, committing, batchId, savePurchaseRecord, rates, sourceName, convert, shareShip, shipCur, showToast, onRefresh, navigate, importId]);

  const hasContent = sources.length > 0;

  return (
    <div
      className="h-full flex flex-col overflow-hidden relative"
      onPaste={onPaste}
      onDragEnter={onDragEnter}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-modal pointer-events-none flex items-center justify-center p-6">
          <div className="absolute inset-3 rounded-xl border-2 border-dashed border-tea-gold bg-tea-bg/80 backdrop-blur-sm" />
          <div className="relative flex flex-col items-center gap-2 text-tea-text">
            <Inbox size={40} strokeWidth={1.25} className="text-tea-gold" />
            <span className={`${TYPOGRAPHY_CLASSES.h3} text-tea-text`}>Drop to load</span>
            <span className="text-ui-12 text-tea-text-sec">CSV, .xlsx & photos</span>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="px-4 md:px-7 pt-5 pb-4 flex items-start justify-between gap-4 flex-shrink-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Layers size={15} className="text-tea-gold" />
            <span className="label-caps text-tea-text-dim">Inventory intake</span>
          </div>
          <h1 className={`${TYPOGRAPHY_CLASSES.h2} text-tea-text`}>Intake Workspace</h1>
          <p className="text-ui-13 text-tea-text-sec mt-1 max-w-xl">
            Load a CSV or .xlsx spreadsheet, or an item photo. Map columns once, then sort each item
            into your <span className="text-tea-text">Shop</span> list (available for sale) or your{' '}
            <span className="text-tea-text">Personal</span> list (your own purchases).
          </p>
        </div>
        {hasContent && (
          <div className="flex items-center gap-5 flex-shrink-0 pt-1">
            <div className="hidden sm:flex items-center gap-5">
              <Stat value={counts.forSale} label="Shop" />
              <span className="w-px h-8 bg-tea-border" aria-hidden />
              <Stat value={counts.personal} label="Personal" tone="gold" />
              {counts.review > 0 && (
                <>
                  <span className="w-px h-8 bg-tea-border" aria-hidden />
                  <Stat value={counts.review} label="Review" tone="gold" />
                </>
              )}
              <span className="w-px h-8 bg-tea-border" aria-hidden />
            </div>
            <button
              type="button"
              onClick={clearAll}
              className="tap-target inline-flex items-center gap-1.5 text-ui-11 text-tea-text-sec hover:text-tea-text transition-colors"
              title="Remove everything staged"
            >
              <Trash2 size={13} /> Clear all
            </button>
          </div>
        )}
      </header>

      <div className="divider-warm mx-4 md:mx-7 flex-shrink-0" />

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-auto pb-nav-gap">
        <div className="px-4 md:px-7 py-5 space-y-4">
          <ResumePicker
            imports={incompleteImports}
            currentImportId={importId}
            onResume={resumeImport}
          />
          {!hasContent ? (
            <HeroDropzone onBrowse={() => fileInputRef.current?.click()} dragging={isDragging} />
          ) : (
            <div className="space-y-4">
              <SlimAdd onBrowse={() => fileInputRef.current?.click()} dragging={isDragging} />
              <div className="space-y-3">
                {sources.map((src) => (
                  <SourceCard
                    key={src.id}
                    src={src}
                    itemCount={items.filter((i) => i.sourceId === src.id).length}
                    onRemove={() => removeSource(src.id)}
                    onToggleExpand={() => toggleExpand(src.id)}
                    onRemap={remapSource}
                    onSetPersonal={setSourcePersonal}
                  />
                ))}
              </div>
              {items.length > 0 && (
                <>
                  <ShippingSplit
                    total={shippingTotal}
                    onTotal={setShippingTotal}
                    currency={shipCur}
                    onCurrency={setShippingCurrency}
                    itemCount={counts.total}
                    totalSize={totalSize}
                  />
                  <ItemsTable
                    items={items}
                    onUpdate={updateItem}
                    onAsk={setChatItemId}
                    sourceName={sourceName}
                    shippingActive={shippingTotal > 0}
                    shipCur={shipCur}
                    shareShip={shareShip}
                  />
                </>
              )}
            </div>
          )}

          <input
            ref={fileInputRef} type="file" multiple accept=".csv,.xlsx,image/*"
            className="hidden"
            onChange={(e) => { if (e.target.files) handleFiles(e.target.files); e.target.value = ''; }}
          />
        </div>
      </div>

      {/* Footer action bar */}
      {hasContent && (
        <div className="flex-shrink-0 glass-panel border-t border-tea-border px-4 md:px-7 pt-3 pb-nav-gap">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <div className="flex items-baseline gap-1.5">
              <span className="text-ui-20 font-display text-tea-text leading-none">{counts.total}</span>
              <span className="text-ui-12 text-tea-text-sec">ready to add</span>
            </div>
            <div className="hidden md:block w-px h-7 bg-tea-border" aria-hidden />
            <div className="min-w-[170px]"><BatchPicker value={batchId} onChange={setBatchId} /></div>
            <button
              type="button"
              onClick={() => setSavePurchaseRecord((v) => !v)}
              className="inline-flex items-center gap-2 text-ui-12 text-tea-text-sec hover:text-tea-text transition-colors tap-target"
              aria-pressed={savePurchaseRecord}
            >
              <span className={`relative w-8 h-[18px] rounded-full transition-colors ${savePurchaseRecord ? 'bg-tea-gold' : 'bg-tea-border'}`}>
                <span className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-tea-bg transition-all ${savePurchaseRecord ? 'left-[16px]' : 'left-[2px]'}`} />
              </span>
              <span className="inline-flex items-center gap-1"><Receipt size={12} /> Purchase record</span>
            </button>
            <button
              type="button"
              onClick={commit}
              disabled={committing || counts.total === 0}
              className="ml-auto pill-active text-ui-13 px-5 py-2 inline-flex items-center gap-2 disabled:opacity-50"
            >
              {committing
                ? <><Loader2 size={14} className="animate-spin" /> Adding…</>
                : <><Check size={14} /> Add {counts.total} to inventory <ArrowRight size={13} /></>}
            </button>
          </div>
        </div>
      )}

      {chatItem && importId && (
        <IntakeChatSheet
          importId={importId}
          itemId={chatItem.id}
          itemLabel={chatItem.givenName || chatItem.productName || 'Unnamed item'}
          onClose={() => setChatItemId(null)}
          onAnswered={handleChatAnswer}
        />
      )}
    </div>
  );
};

// ─── Stat ──────────────────────────────────────────────────────────────────────
const Stat: React.FC<{ value: number; label: string; tone?: 'text' | 'gold' }> = ({ value, label, tone = 'text' }) => (
  <div className="flex flex-col items-end leading-none">
    <span className={`text-ui-26 font-display ${tone === 'gold' ? 'text-tea-gold' : 'text-tea-text'}`}>{value}</span>
    <span className="label-caps text-tea-text-dim mt-1">{label}</span>
  </div>
);

// ─── Hero dropzone (empty state) ────────────────────────────────────────────────
const HeroDropzone: React.FC<{ onBrowse: () => void; dragging: boolean }> = ({ onBrowse, dragging }) => (
  <button
    type="button"
    onClick={onBrowse}
    className={`w-full rounded-xl border-2 border-dashed transition-colors py-16 px-6 flex flex-col items-center text-center ${
      dragging ? 'border-tea-gold bg-tea-accent-sub' : 'border-tea-border hover:border-tea-text-sec admin-card'
    }`}
  >
    <div className="relative mb-5">
      <div className="w-16 h-16 rounded-xl bg-tea-gold/10 flex items-center justify-center">
        <Upload size={30} strokeWidth={1.25} className="text-tea-gold" />
      </div>
      <div className="absolute -right-3 -bottom-2 w-8 h-8 rounded-md bg-tea-elevated border border-tea-border flex items-center justify-center">
        <Sparkles size={13} className="text-tea-gold" />
      </div>
    </div>
    <h2 className={`${TYPOGRAPHY_CLASSES.h3} text-tea-text mb-1.5`}>Drag your files in</h2>
    <p className="text-ui-13 text-tea-text-sec max-w-sm mb-5">
      Drop a CSV or .xlsx export, or a photo of an item. Paste a screenshot
      too. Anything you load is staged for review before it touches inventory.
    </p>
    <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md cta-solid text-ui-13 font-semibold">
      Browse files
    </span>
    <div className="flex items-center gap-2 mt-6">
      <FormatChip icon={<FileSpreadsheet size={12} />} label="CSV" />
      <FormatChip icon={<FileSpreadsheet size={12} />} label=".xlsx" />
      <FormatChip icon={<ImageIcon size={12} />} label="Photos" />
    </div>
  </button>
);

const FormatChip: React.FC<{ icon: React.ReactNode; label: string }> = ({ icon, label }) => (
  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-tea-elevated border border-tea-border text-ui-11 text-tea-text-sec">
    {icon} {label}
  </span>
);

// ─── Slim add strip (when content exists) ────────────────────────────────────────
const SlimAdd: React.FC<{ onBrowse: () => void; dragging: boolean }> = ({ onBrowse, dragging }) => (
  <button
    type="button"
    onClick={onBrowse}
    className={`w-full rounded-xl border border-dashed transition-colors py-3 px-4 flex items-center justify-center gap-2 text-ui-12 ${
      dragging ? 'border-tea-gold bg-tea-accent-sub text-tea-text' : 'border-tea-border hover:border-tea-text-sec text-tea-text-sec hover:text-tea-text'
    }`}
  >
    <Upload size={14} /> Drag in more files, paste a screenshot, or <span className="text-tea-gold">browse</span>
  </button>
);

// ─── Source card ────────────────────────────────────────────────────────────────
const SourceCard: React.FC<{
  src: Source;
  itemCount: number;
  onRemove: () => void;
  onToggleExpand: () => void;
  onRemap: (src: SheetSource, header: string, target: string) => void;
  onSetPersonal: (src: SheetSource, val: boolean) => void;
}> = ({ src, itemCount, onRemove, onToggleExpand, onRemap, onSetPersonal }) => {
  if (src.kind === 'image') {
    return (
      <div className="admin-card px-4 py-3 flex items-center gap-3">
        <div className="w-9 h-9 rounded-md bg-tea-gold/10 flex items-center justify-center flex-shrink-0">
          <ImageIcon size={16} className="text-tea-gold" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-ui-13 text-tea-text truncate">{src.name}</p>
          <p className="text-ui-11 text-tea-text-dim">
            {src.status === 'extracting' && 'Reading the photo…'}
            {src.status === 'ready' && 'Details extracted · 1 item'}
            {src.status === 'error' && 'Could not read this image'}
          </p>
        </div>
        {src.status === 'extracting' && <Loader2 size={15} className="animate-spin text-tea-gold flex-shrink-0" />}
        {src.status === 'ready' && <span className="badge-status badge-status-gold flex-shrink-0"><Sparkles size={10} /> AI</span>}
        {src.status === 'error' && <AlertTriangle size={15} className="text-tea-gold flex-shrink-0" />}
        <button type="button" onClick={onRemove} className="tap-target text-tea-text-sec hover:text-tea-text flex-shrink-0" aria-label="Remove"><Trash2 size={15} /></button>
      </div>
    );
  }

  const mappedItem = src.headers.filter((h) => TARGET_BY_KEY[src.mapping[h]]?.group === 'item').length;
  const mappedOrder = src.headers.filter((h) => TARGET_BY_KEY[src.mapping[h]]?.group === 'order').length;

  return (
    <div className="admin-card overflow-hidden">
      <div className="px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <button type="button" onClick={onToggleExpand} className="tap-target text-tea-text-sec hover:text-tea-text flex-shrink-0">
          {src.expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        <div className="w-9 h-9 rounded-md bg-tea-gold/10 flex items-center justify-center flex-shrink-0">
          <FileSpreadsheet size={16} className="text-tea-gold" />
        </div>
        <div className="min-w-0 flex-1 basis-[50%]">
          <p className="text-ui-13 text-tea-text truncate">{src.name}</p>
          <p className="text-ui-11 text-tea-text-dim truncate">
            {itemCount} rows · {mappedItem} item field{mappedItem !== 1 ? 's' : ''}
            {mappedOrder > 0 && ` · ${mappedOrder} order`}
          </p>
        </div>
        <div className="flex items-center gap-2 ml-auto flex-shrink-0">
          <Segmented
            value={src.defaultPersonal ? 'personal' : 'sale'}
            onChange={(v) => onSetPersonal(src, v === 'personal')}
            options={[{ value: 'sale', label: 'Shop' }, { value: 'personal', label: 'Personal' }]}
          />
          <button type="button" onClick={onRemove} className="tap-target text-tea-text-sec hover:text-tea-text" aria-label="Remove"><Trash2 size={15} /></button>
        </div>
      </div>

      {src.expanded && (
        <div className="px-4 pb-4 pt-1">
          <div className="flex items-center gap-2 mb-3">
            <Tag size={12} className="text-tea-text-dim" />
            <span className="label-caps text-tea-text-dim">Map columns</span>
            <span className="text-ui-10 text-tea-text-dim">(remembered for files shaped like this)</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {src.headers.map((h) => {
              const group = TARGET_BY_KEY[src.mapping[h]]?.group;
              const dot = group === 'item' ? 'bg-tea-gold' : group === 'order' ? 'bg-tea-text-sec' : 'bg-tea-border';
              return (
                <div key={h} className="inset-panel p-2.5 flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} aria-hidden />
                    <span className="text-ui-12 text-tea-text truncate font-medium" title={h}>{h}</span>
                  </div>
                  <span className="text-ui-10 text-tea-text-dim truncate italic pl-3.5">
                    {String(src.sampleRows[0]?.[h] ?? '').slice(0, 22) || '—'}
                  </span>
                  <select
                    value={src.mapping[h] || ''}
                    onChange={(e) => onRemap(src, h, e.target.value)}
                    className="admin-input text-ui-11 px-2 py-1.5 mt-0.5"
                  >
                    <option value="">Ignore</option>
                    <optgroup label="Item">
                      {TARGET_FIELDS.filter((f) => f.group === 'item').map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                    </optgroup>
                    <optgroup label="Order / logistics">
                      {TARGET_FIELDS.filter((f) => f.group === 'order').map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                    </optgroup>
                  </select>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Segmented two-option control ────────────────────────────────────────────────
const Segmented: React.FC<{
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  size?: 'sm' | 'md';
}> = ({ value, onChange, options, size = 'md' }) => (
  <div className="inline-flex p-0.5 rounded-md bg-tea-bg border border-tea-border flex-shrink-0">
    {options.map((o) => {
      const on = o.value === value;
      return (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={on}
          className={`tap-target rounded-md transition-colors ${size === 'sm' ? 'px-2 py-1 text-ui-10' : 'px-2.5 py-1 text-ui-11'} ${
            on ? 'bg-tea-gold/15 text-tea-text' : 'text-tea-text-sec hover:text-tea-text'
          }`}
        >
          {o.label}
        </button>
      );
    })}
  </div>
);

// ─── Split shipping bar ──────────────────────────────────────────────────────────
const ShippingSplit: React.FC<{
  total: number;
  onTotal: (n: number) => void;
  currency: string;
  onCurrency: (c: string) => void;
  itemCount: number;
  totalSize: number;
}> = ({ total, onTotal, currency, onCurrency, itemCount, totalSize }) => (
  <div className="admin-card px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
    <div className="flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-md bg-tea-gold/10 flex items-center justify-center flex-shrink-0">
        <Truck size={15} className="text-tea-gold" />
      </div>
      <div className="min-w-0">
        <p className="text-ui-12 text-tea-text">Split shipping</p>
        <p className="text-ui-10 text-tea-text-dim">Spread across {itemCount} item{itemCount !== 1 ? 's' : ''} by estimated size</p>
      </div>
    </div>
    <div className="flex items-center gap-2 ml-auto flex-shrink-0">
      <input
        type="number" min="0" inputMode="decimal" value={total || ''} placeholder="Total"
        onChange={(e) => onTotal(parseFloat(e.target.value) || 0)}
        className="admin-input text-ui-13 px-2.5 py-1.5 w-24 text-right"
      />
      <select value={currency} onChange={(e) => onCurrency(e.target.value)} className="admin-input text-ui-12 px-2 py-1.5">
        {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
    </div>
    {total > 0 && (
      <p className="text-ui-10 text-tea-text-dim basis-full">
        Total size {Math.round(totalSize).toLocaleString()} · sizes are auto-estimated per item (edit any you know) · each share folds into landed cost
      </p>
    )}
  </div>
);

// ─── Items table ─────────────────────────────────────────────────────────────────
const ItemsTable: React.FC<{
  items: StagedItem[];
  onUpdate: (id: string, patch: Partial<StagedItem>) => void;
  onAsk: (id: string) => void;
  sourceName: (id: string) => string;
  shippingActive: boolean;
  shipCur: string;
  shareShip: (it: StagedItem) => number;
}> = ({ items, onUpdate, onAsk, sourceName, shippingActive, shipCur, shareShip }) => {
  const allOn = items.every((i) => i.include);
  const toggleAll = () => items.forEach((i) => onUpdate(i.id, { include: !allOn }));

  // group rows by source for structure
  const groups = useMemo(() => {
    const map = new Map<string, StagedItem[]>();
    for (const it of items) {
      if (!map.has(it.sourceId)) map.set(it.sourceId, []);
      map.get(it.sourceId)!.push(it);
    }
    return Array.from(map.entries());
  }, [items]);

  return (
    <div className="admin-card overflow-hidden">
      {/* header strip */}
      <div className="px-4 py-2.5 flex items-center gap-3 border-b border-tea-border bg-tea-bg/40">
        <button type="button" onClick={toggleAll} className="tap-target flex-shrink-0" aria-label="Toggle all">
          <span className={`w-4 h-4 rounded flex items-center justify-center border ${allOn ? 'bg-tea-gold border-tea-gold' : 'border-tea-border'}`}>
            {allOn && <Check size={11} className="text-tea-bg" />}
          </span>
        </button>
        <span className="label-caps text-tea-text-dim flex-1">Review &amp; triage</span>
        <span className="label-caps text-tea-text-dim hidden md:block w-32 text-right">Destination</span>
        <span className="label-caps text-tea-text-dim w-14 text-right">Status</span>
      </div>

      {groups.map(([sid, rows]) => (
        <div key={sid}>
          {groups.length > 1 && (
            <div className="px-4 py-1.5 bg-tea-bg/20 flex items-center gap-2">
              <FileSpreadsheet size={11} className="text-tea-text-dim" />
              <span className="text-ui-10 text-tea-text-dim truncate">{sourceName(sid)}</span>
            </div>
          )}
          {rows.map((it) => {
            const ready = isReadyItem(it);
            return (
              <div
                key={it.id}
                className={`group px-4 py-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-tea-border last:border-0 transition-colors hover:bg-tea-gold/[0.03] ${it.include ? '' : 'opacity-45'}`}
              >
                <button type="button" onClick={() => onUpdate(it.id, { include: !it.include })} className="tap-target flex-shrink-0" aria-label="Include">
                  <span className={`w-4 h-4 rounded flex items-center justify-center border ${it.include ? 'bg-tea-gold border-tea-gold' : 'border-tea-border'}`}>
                    {it.include && <Check size={11} className="text-tea-bg" />}
                  </span>
                </button>

                {it.imageUrl
                  ? <img src={it.imageUrl} alt="" className="w-9 h-9 rounded-md object-cover flex-shrink-0 bg-tea-bg" />
                  : <div className="w-9 h-9 rounded-md bg-tea-bg border border-tea-border flex items-center justify-center flex-shrink-0"><Store size={13} className="text-tea-text-dim" /></div>}

                <div className="flex-1 min-w-0 basis-[45%]">
                  <input
                    value={it.givenName}
                    onChange={(e) => onUpdate(it.id, { givenName: e.target.value })}
                    placeholder="Unnamed item"
                    className="w-full bg-transparent text-ui-13 text-tea-text border-b border-transparent focus:border-tea-gold outline-none py-0.5"
                  />
                  <div className="flex items-center gap-2 mt-0.5 text-ui-10 text-tea-text-dim">
                    <span className="truncate">{it.type}</span>
                    {it.vendor && <><span className="opacity-40">·</span><span className="truncate max-w-[140px]">{it.vendor}</span></>}
                    {(it.costAmount ?? 0) > 0 && <><span className="opacity-40">·</span><span className="font-mono">{it.costAmount} {it.costCurrency}</span></>}
                    {shippingActive && (
                      <>
                        <span className="opacity-40">·</span>
                        <span className="inline-flex items-center gap-1" title="Auto-estimated from this item's type, edit if you know its real size">
                          <span>size</span>
                          <input
                            type="number" min="0" value={it.sizeEstimate || ''} placeholder="0"
                            onChange={(e) => onUpdate(it.id, { sizeEstimate: parseFloat(e.target.value) || 0 })}
                            className="w-12 bg-transparent border-b border-tea-border focus:border-tea-gold outline-none text-ui-10 text-tea-text-sec text-right"
                            aria-label="Estimated size"
                          />
                        </span>
                        <span className="opacity-40">·</span>
                        <span className="text-tea-gold">+{shareShip(it).toFixed(2)} {shipCur} ship</span>
                      </>
                    )}
                    {it.needsReview && <><span className="opacity-40">·</span><span className="text-tea-gold inline-flex items-center gap-0.5"><Sparkles size={9} /> review</span></>}
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-auto flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => onAsk(it.id)}
                    className="tap-target inline-flex items-center gap-1 text-ui-11 text-tea-text-sec hover:text-tea-text transition-colors"
                    title="Ask about this tea"
                    aria-label="Ask about this tea"
                  >
                    <MessageCircle size={12} />
                    <span className="hidden md:inline">Ask</span>
                  </button>
                  <Segmented
                    size="sm"
                    value={it.isPersonal ? 'personal' : 'sale'}
                    onChange={(v) => onUpdate(it.id, { isPersonal: v === 'personal' })}
                    options={[{ value: 'sale', label: 'Shop' }, { value: 'personal', label: 'Personal' }]}
                  />
                  <span
                    className={`badge-status ${ready ? 'badge-status-default' : 'badge-status-muted'} w-16 justify-center flex-shrink-0`}
                    title={ready ? 'Has name, type, cost & stock: one click to activate in Capture' : 'Missing info: stays a draft until completed'}
                  >
                    {ready ? 'Ready' : 'Review'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

// ─── Resume picker ───────────────────────────────────────────────────────────
// Server drafts other than the current one that are still open, so the operator
// can pick up a batch started on another device or tab.
const ResumePicker: React.FC<{
  imports: CurateImportDetail[];
  currentImportId: string | null;
  onResume: (id: string) => void;
}> = ({ imports, currentImportId, onResume }) => {
  const others = imports.filter((d) => d.batch.id !== currentImportId);
  if (others.length === 0) return null;
  return (
    <div className="admin-card px-4 py-3">
      <div className="flex items-center gap-2 mb-2">
        <RotateCw size={12} className="text-tea-gold" />
        <span className="label-caps text-tea-text-dim">Resume incomplete intake</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {others.map((detail) => {
          const label = detail.batch.title?.trim() || 'Untitled draft';
          const count = detail.items.length + detail.sources.length;
          return (
            <button
              key={detail.batch.id}
              type="button"
              onClick={() => onResume(detail.batch.id)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-tea-elevated border border-tea-border hover:border-tea-text-sec text-ui-12 text-tea-text-sec hover:text-tea-text transition-colors tap-target"
              title={`Resume "${label}"`}
            >
              <span className="truncate max-w-[200px]">{label}</span>
              <span className="text-ui-10 text-tea-text-dim">
                {count} item{count !== 1 ? 's' : ''}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default IntakeWorkspace;
