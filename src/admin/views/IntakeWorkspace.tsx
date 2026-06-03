import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Upload, FileSpreadsheet, Image as ImageIcon, Loader2, Check,
  AlertTriangle, ChevronDown, ChevronRight, Trash2, Tag, Store,
  Sparkles, Layers, ArrowRight, Inbox, Receipt,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Papa from 'papaparse';
import { api } from '../../lib/api';
import { useToast } from '../components/Toast';
import { BatchPicker } from '../components/BatchPicker';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import {
  TARGET_FIELDS, TARGET_BY_KEY, type ColumnMapping, type StagedItem,
  autoMap, loadRememberedMapping, rememberMapping, rowToStaged,
  stagedToProduct, isReadyItem, extractedToStaged,
} from '../lib/intakeMapping';

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

export const IntakeWorkspace: React.FC<{ onRefresh?: () => void }> = ({ onRefresh }) => {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [sources, setSources] = useState<Source[]>([]);
  const [items, setItems] = useState<StagedItem[]>([]);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [committing, setCommitting] = useState(false);
  const [savePurchaseRecord, setSavePurchaseRecord] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const dragDepth = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Item helpers ───────────────────────────────────────────────────────────
  const replaceSourceItems = useCallback((sourceId: string, next: StagedItem[]) => {
    setItems((prev) => [...prev.filter((i) => i.sourceId !== sourceId), ...next]);
  }, []);

  const updateItem = useCallback((id: string, patch: Partial<StagedItem>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }, []);

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
    } else if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
      try {
        const XLSX = await import('xlsx');
        const wb = XLSX.read(await file.arrayBuffer());
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });
        ingestSheet(file.name, rows);
      } catch {
        showToast(`Could not read ${file.name}`, 'error');
      }
    } else if (file.type.startsWith('image/')) {
      const src: ImageSource = { id: nextId(), kind: 'image', name: file.name, status: 'extracting' };
      setSources((prev) => [...prev, src]);
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
  }, [ingestSheet, replaceSourceItems, showToast]);

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

  // ── Commit ───────────────────────────────────────────────────────────────────
  const commit = useCallback(async () => {
    if (included.length === 0 || committing) return;
    setCommitting(true);
    try {
      const products = included.map(stagedToProduct);
      const chunk = 50;
      let inserted = 0;
      let skipped = 0;
      for (let i = 0; i < products.length; i += chunk) {
        const res: any = await api.products.bulkCreate(products.slice(i, i + chunk), batchId ?? undefined);
        inserted += res?.inserted ?? products.slice(i, i + chunk).length;
        skipped += res?.skipped ?? 0;
      }
      if (savePurchaseRecord) {
        for (const src of sources) {
          if (src.kind !== 'sheet') continue;
          const lines = included.filter((i) => i.sourceId === src.id);
          const withOrder = lines.filter((l) => Object.keys(l.order).length > 0);
          if (withOrder.length === 0) continue;
          const vendorName = lines.find((l) => l.vendor)?.vendor || src.name.replace(/\.[^.]+$/, '');
          await api.purchaseOrders.create({
            vendor_name: vendorName,
            items_json: JSON.stringify(lines.map((l) => ({
              product_name: l.givenName || l.productName,
              quantity_grams: l.quantityPurchased || l.stockGrams,
              unit_price: l.costAmount,
              currency: l.costCurrency,
              ...l.order,
            }))),
            display_currency: lines.find((l) => l.costCurrency !== 'UNK')?.costCurrency || 'USD',
            status: 'received',
            notes: `Imported from ${src.name}`,
          }).catch(() => null);
        }
      }
      showToast(
        `Added ${inserted} item${inserted !== 1 ? 's' : ''} as drafts${skipped > 0 ? ` · ${skipped} duplicate${skipped !== 1 ? 's' : ''} skipped` : ''}`,
        'success',
      );
      onRefresh?.();
      setSources([]); setItems([]);
      navigate('/admin/capture');
    } catch (e: any) {
      showToast(`Import failed: ${e?.message || 'error'}`, 'error');
    } finally {
      setCommitting(false);
    }
  }, [included, committing, batchId, savePurchaseRecord, sources, showToast, onRefresh, navigate]);

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
            <span className="text-ui-12 text-tea-text-sec">Spreadsheets, Excel & photos</span>
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
            Load any spreadsheet, Excel file, or item photo. Map columns once, triage what's for
            sale versus your own records, and add it all to inventory.
          </p>
        </div>
        {hasContent && (
          <div className="hidden sm:flex items-center gap-5 flex-shrink-0 pt-1">
            <Stat value={counts.forSale} label="For sale" />
            <span className="w-px h-8 bg-tea-border" aria-hidden />
            <Stat value={counts.personal} label="Personal" tone="gold" />
            {counts.review > 0 && (
              <>
                <span className="w-px h-8 bg-tea-border" aria-hidden />
                <Stat value={counts.review} label="Review" tone="gold" />
              </>
            )}
          </div>
        )}
      </header>

      <div className="divider-warm mx-4 md:mx-7 flex-shrink-0" />

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-auto pb-nav-gap">
        <div className="px-4 md:px-7 py-5">
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
                <ItemsTable items={items} onUpdate={updateItem} sourceName={sourceName} />
              )}
            </div>
          )}

          <input
            ref={fileInputRef} type="file" multiple accept=".csv,.xlsx,.xls,image/*"
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
      Drop a spreadsheet of an order, an Excel export, or a photo of an item — paste a screenshot
      too. Anything you load is staged for review before it touches inventory.
    </p>
    <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-tea-gold text-tea-bg text-ui-13 font-semibold">
      Browse files
    </span>
    <div className="flex items-center gap-2 mt-6">
      <FormatChip icon={<FileSpreadsheet size={12} />} label="CSV" />
      <FormatChip icon={<FileSpreadsheet size={12} />} label="Excel" />
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
      <div className="px-4 py-3 flex items-center gap-3">
        <button type="button" onClick={onToggleExpand} className="tap-target text-tea-text-sec hover:text-tea-text flex-shrink-0">
          {src.expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        <div className="w-9 h-9 rounded-md bg-tea-gold/10 flex items-center justify-center flex-shrink-0">
          <FileSpreadsheet size={16} className="text-tea-gold" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-ui-13 text-tea-text truncate">{src.name}</p>
          <p className="text-ui-11 text-tea-text-dim">
            {itemCount} rows · {mappedItem} item field{mappedItem !== 1 ? 's' : ''}
            {mappedOrder > 0 && ` · ${mappedOrder} order`}
          </p>
        </div>
        <Segmented
          value={src.defaultPersonal ? 'personal' : 'sale'}
          onChange={(v) => onSetPersonal(src, v === 'personal')}
          options={[{ value: 'sale', label: 'For sale' }, { value: 'personal', label: 'Personal' }]}
        />
        <button type="button" onClick={onRemove} className="tap-target text-tea-text-sec hover:text-tea-text flex-shrink-0" aria-label="Remove"><Trash2 size={15} /></button>
      </div>

      {src.expanded && (
        <div className="px-4 pb-4 pt-1">
          <div className="flex items-center gap-2 mb-3">
            <Tag size={12} className="text-tea-text-dim" />
            <span className="label-caps text-tea-text-dim">Map columns</span>
            <span className="text-ui-10 text-tea-text-dim">— remembered for files shaped like this</span>
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
                    <option value="">— Ignore —</option>
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

// ─── Items table ─────────────────────────────────────────────────────────────────
const ItemsTable: React.FC<{
  items: StagedItem[];
  onUpdate: (id: string, patch: Partial<StagedItem>) => void;
  sourceName: (id: string) => string;
}> = ({ items, onUpdate, sourceName }) => {
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
                className={`group px-4 py-2 flex items-center gap-3 border-b border-tea-border last:border-0 transition-colors hover:bg-tea-gold/[0.03] ${it.include ? '' : 'opacity-45'}`}
              >
                <button type="button" onClick={() => onUpdate(it.id, { include: !it.include })} className="tap-target flex-shrink-0" aria-label="Include">
                  <span className={`w-4 h-4 rounded flex items-center justify-center border ${it.include ? 'bg-tea-gold border-tea-gold' : 'border-tea-border'}`}>
                    {it.include && <Check size={11} className="text-tea-bg" />}
                  </span>
                </button>

                {it.imageUrl
                  ? <img src={it.imageUrl} alt="" className="w-9 h-9 rounded-md object-cover flex-shrink-0 bg-tea-bg" />
                  : <div className="w-9 h-9 rounded-md bg-tea-bg border border-tea-border flex items-center justify-center flex-shrink-0"><Store size={13} className="text-tea-text-dim" /></div>}

                <div className="flex-1 min-w-0">
                  <input
                    value={it.givenName}
                    onChange={(e) => onUpdate(it.id, { givenName: e.target.value })}
                    placeholder="Unnamed item"
                    className="w-full bg-transparent text-ui-13 text-tea-text border-b border-transparent focus:border-tea-gold outline-none py-0.5"
                  />
                  <div className="flex items-center gap-2 mt-0.5 text-ui-10 text-tea-text-dim">
                    <span className="truncate">{it.type}</span>
                    {it.vendor && <><span className="opacity-40">·</span><span className="truncate max-w-[140px]">{it.vendor}</span></>}
                    {it.costAmount > 0 && <><span className="opacity-40">·</span><span className="font-mono">{it.costAmount} {it.costCurrency}</span></>}
                    {it.needsReview && <><span className="opacity-40">·</span><span className="text-tea-gold inline-flex items-center gap-0.5"><Sparkles size={9} /> review</span></>}
                  </div>
                </div>

                <div className="hidden md:block">
                  <Segmented
                    size="sm"
                    value={it.isPersonal ? 'personal' : 'sale'}
                    onChange={(v) => onUpdate(it.id, { isPersonal: v === 'personal' })}
                    options={[{ value: 'sale', label: 'Sale' }, { value: 'personal', label: 'Personal' }]}
                  />
                </div>
                {/* compact toggle on mobile */}
                <button
                  type="button"
                  onClick={() => onUpdate(it.id, { isPersonal: !it.isPersonal })}
                  className={`md:hidden tap-target text-ui-10 px-2 py-1 rounded ${it.isPersonal ? 'text-tea-gold bg-tea-gold/10' : 'text-tea-text-sec'}`}
                >
                  {it.isPersonal ? 'Personal' : 'Sale'}
                </button>

                <span
                  className={`badge-status ${ready ? 'badge-status-default' : 'badge-status-muted'} w-16 justify-center flex-shrink-0`}
                  title={ready ? 'Has name, type, cost & stock — one click to activate in Capture' : 'Missing info — stays a draft until completed'}
                >
                  {ready ? 'Ready' : 'Review'}
                </span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

export default IntakeWorkspace;
