import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Upload, FileSpreadsheet, Image as ImageIcon, Loader2, X, Check,
  AlertTriangle, ChevronDown, ChevronRight, Trash2, Tag, Store,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Papa from 'papaparse';
import { api } from '../../lib/api';
import { useToast } from '../components/Toast';
import { BatchPicker } from '../components/BatchPicker';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import {
  TARGET_FIELDS, type ColumnMapping, type StagedItem,
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
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
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

  const removeSource = useCallback((id: string) => {
    setSources((prev) => prev.filter((s) => s.id !== id));
    setItems((prev) => prev.filter((i) => i.sourceId !== id));
  }, []);

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
      for (let i = 0; i < products.length; i += chunk) {
        await api.products.bulkCreate(products.slice(i, i + chunk), batchId ?? undefined);
      }
      // Optional purchase/expense record per spreadsheet source that has order data.
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
              unit_price_usd: l.costAmount,
              currency: l.costCurrency,
              ...l.order,
            }))),
            display_currency: lines.find((l) => l.costCurrency !== 'UNK')?.costCurrency || 'USD',
            status: 'received',
            notes: `Imported from ${src.name}`,
          }).catch(() => null);
        }
      }
      showToast(`Added ${products.length} item${products.length !== 1 ? 's' : ''}`, 'success');
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
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
      onDrop={onDrop}
    >
      {/* Header */}
      <div className="px-4 md:px-6 pt-4 pb-3 border-b border-tea-border flex-shrink-0">
        <h1 className={`${TYPOGRAPHY_CLASSES.h2} text-tea-text`}>Intake Workspace</h1>
        <p className="text-ui-13 text-tea-text-sec mt-0.5">
          Drop spreadsheets, Excel, or item photos. Map columns once, triage for-sale vs personal, then add to inventory.
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-auto pb-nav-gap">
        <div className="px-4 md:px-6 py-4 space-y-4">
          {/* Dropzone */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={`w-full border-2 border-dashed rounded-xl p-6 flex flex-col items-center gap-2 transition-colors ${
              isDragging ? 'border-tea-gold bg-tea-accent-sub' : 'border-tea-border hover:border-tea-text-sec bg-tea-bg'
            }`}
          >
            <Upload size={28} strokeWidth={1.25} className="text-tea-text-sec" />
            <span className="text-ui-13 text-tea-text">
              Drag files here, paste a screenshot, or <span className="text-tea-gold">browse</span>
            </span>
            <span className="text-ui-11 text-tea-text-dim">CSV · Excel · images — many at once</span>
            <input
              ref={fileInputRef} type="file" multiple accept=".csv,.xlsx,.xls,image/*"
              className="hidden"
              onChange={(e) => { if (e.target.files) handleFiles(e.target.files); e.target.value = ''; }}
            />
          </button>

          {/* Sources */}
          {sources.map((src) => (
            <SourceCard
              key={src.id}
              src={src}
              itemCount={items.filter((i) => i.sourceId === src.id).length}
              onRemove={() => removeSource(src.id)}
              onToggleExpand={() => setSources((prev) => prev.map((s) => (s.id === src.id && s.kind === 'sheet' ? { ...s, expanded: !s.expanded } : s)))}
              onRemap={remapSource}
              onSetPersonal={setSourcePersonal}
            />
          ))}

          {/* Items table */}
          {items.length > 0 && (
            <ItemsTable items={items} onUpdate={updateItem} />
          )}
        </div>
      </div>

      {/* Footer */}
      {hasContent && (
        <div className="flex-shrink-0 border-t border-tea-border bg-tea-surface px-4 md:px-6 py-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="flex items-center gap-3 text-ui-12">
              <span className="text-tea-text">{counts.total} item{counts.total !== 1 ? 's' : ''}</span>
              <span className="text-tea-text-sec">{counts.forSale} for sale · {counts.personal} personal</span>
              {counts.review > 0 && <span className="text-tea-gold">{counts.review} need review</span>}
            </div>
            <div className="min-w-[180px]"><BatchPicker value={batchId} onChange={setBatchId} /></div>
            <label className="flex items-center gap-1.5 text-ui-11 text-tea-text-sec cursor-pointer">
              <input type="checkbox" checked={savePurchaseRecord} onChange={(e) => setSavePurchaseRecord(e.target.checked)} className="accent-tea-gold" />
              Save purchase record
            </label>
            <button
              type="button"
              onClick={commit}
              disabled={committing || counts.total === 0}
              className="ml-auto pill-active text-ui-12 px-4 py-1.5 inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              {committing ? <><Loader2 size={13} className="animate-spin" /> Adding…</> : <><Check size={13} /> Add {counts.total} to inventory</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Source card (with column mapping for sheets) ──────────────────────────────
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
      <div className="border border-tea-border rounded-xl px-4 py-2.5 flex items-center gap-3 bg-tea-surface">
        <ImageIcon size={16} className="text-tea-text-sec flex-shrink-0" />
        <span className="text-ui-13 text-tea-text truncate flex-1">{src.name}</span>
        {src.status === 'extracting' && <span className="text-ui-11 text-tea-text-sec inline-flex items-center gap-1"><Loader2 size={11} className="animate-spin" /> Reading…</span>}
        {src.status === 'error' && <span className="text-ui-11 text-tea-gold inline-flex items-center gap-1"><AlertTriangle size={11} /> Failed</span>}
        {src.status === 'ready' && <span className="text-ui-11 text-tea-text-sec">1 item</span>}
        <button type="button" onClick={onRemove} className="tap-target text-tea-text-sec hover:text-tea-text" aria-label="Remove"><Trash2 size={14} /></button>
      </div>
    );
  }
  return (
    <div className="border border-tea-border rounded-xl bg-tea-surface overflow-hidden">
      <div className="px-4 py-2.5 flex items-center gap-3">
        <button type="button" onClick={onToggleExpand} className="tap-target text-tea-text-sec hover:text-tea-text">
          {src.expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        <FileSpreadsheet size={16} className="text-tea-text-sec flex-shrink-0" />
        <span className="text-ui-13 text-tea-text truncate flex-1">{src.name}</span>
        <span className="text-ui-11 text-tea-text-sec">{itemCount} rows</span>
        <button
          type="button"
          onClick={() => onSetPersonal(src, !src.defaultPersonal)}
          className={`tap-target text-ui-10 px-2 py-1 rounded inline-flex items-center gap-1 ${src.defaultPersonal ? 'text-tea-gold bg-tea-gold/10' : 'text-tea-text-sec hover:text-tea-text'}`}
          title="Default destination for this file"
        >
          <Tag size={11} /> {src.defaultPersonal ? 'All personal' : 'All for sale'}
        </button>
        <button type="button" onClick={onRemove} className="tap-target text-tea-text-sec hover:text-tea-text" aria-label="Remove"><Trash2 size={14} /></button>
      </div>
      {src.expanded && (
        <div className="px-4 pb-3 pt-1 border-t border-tea-border">
          <p className="text-ui-10 text-tea-text-dim uppercase tracking-wider mb-2">Map columns</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {src.headers.map((h) => (
              <div key={h} className="flex flex-col gap-1">
                <div className="flex items-baseline gap-1.5 min-w-0">
                  <span className="text-ui-12 text-tea-text truncate" title={h}>{h}</span>
                  <span className="text-ui-10 text-tea-text-dim truncate italic">{String(src.sampleRows[0]?.[h] ?? '').slice(0, 18)}</span>
                </div>
                <select
                  value={src.mapping[h] || ''}
                  onChange={(e) => onRemap(src, h, e.target.value)}
                  className="text-ui-11 bg-tea-bg border border-tea-border rounded px-2 py-1 text-tea-text focus:border-tea-gold outline-none"
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
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Items table ───────────────────────────────────────────────────────────────
const ItemsTable: React.FC<{ items: StagedItem[]; onUpdate: (id: string, patch: Partial<StagedItem>) => void }> = ({ items, onUpdate }) => (
  <div className="border border-tea-border rounded-xl overflow-hidden">
    <div className="px-4 py-2 border-b border-tea-border bg-tea-bg">
      <span className="text-ui-10 text-tea-text-dim uppercase tracking-wider">Review &amp; triage</span>
    </div>
    <div className="divide-y divide-tea-border">
      {items.map((it) => {
        const ready = isReadyItem(it);
        return (
          <div key={it.id} className={`flex items-center gap-3 px-4 py-2 ${it.include ? '' : 'opacity-40'}`}>
            <input type="checkbox" checked={it.include} onChange={(e) => onUpdate(it.id, { include: e.target.checked })} className="accent-tea-gold flex-shrink-0" aria-label="Include" />
            {it.imageUrl
              ? <img src={it.imageUrl} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0 bg-tea-bg" />
              : <div className="w-8 h-8 rounded bg-tea-bg border border-tea-border flex items-center justify-center flex-shrink-0"><Store size={12} className="text-tea-text-dim" /></div>}
            <input
              value={it.givenName}
              onChange={(e) => onUpdate(it.id, { givenName: e.target.value })}
              placeholder="Unnamed"
              className="flex-1 min-w-0 bg-transparent text-ui-13 text-tea-text border-b border-transparent focus:border-tea-gold outline-none py-0.5"
            />
            <span className="text-ui-10 text-tea-text-sec w-16 truncate hidden sm:block">{it.type}</span>
            <span className="text-ui-10 text-tea-text-sec w-20 truncate hidden md:block">{it.vendor}</span>
            <span className="text-ui-10 font-mono text-tea-text-sec w-20 text-right hidden sm:block">
              {it.costAmount > 0 ? `${it.costAmount} ${it.costCurrency}` : ''}
            </span>
            <button
              type="button"
              onClick={() => onUpdate(it.id, { isPersonal: !it.isPersonal })}
              className={`tap-target text-ui-10 px-2 py-1 rounded whitespace-nowrap ${it.isPersonal ? 'text-tea-gold bg-tea-gold/10' : 'text-tea-text-sec hover:text-tea-text'}`}
            >
              {it.isPersonal ? 'Personal' : 'For sale'}
            </button>
            <span className={`text-ui-9 font-mono px-1.5 py-0.5 rounded w-12 text-center flex-shrink-0 ${ready ? 'text-tea-text bg-tea-text/10' : 'text-tea-text-sec bg-tea-text-sec/10'}`}>
              {ready ? 'ACTIVE' : 'DRAFT'}
            </span>
          </div>
        );
      })}
    </div>
  </div>
);

export default IntakeWorkspace;
