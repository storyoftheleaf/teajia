import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  X as XIcon, ChevronLeft, ChevronRight, ChevronDown, QrCode, Eye, EyeOff, Star, Sparkles,
  FlaskConical, RefreshCw, User, Pencil, Plus, Loader2, Check, Globe, Receipt, BookOpen,
  Camera, Upload, Crop, Download, MoreHorizontal, Trash2, Wand2, Mic, Square,
} from 'lucide-react';
import { api } from '../../lib/api';
import { SquareCropModal } from '../../components/shared/SquareCropModal';
import { useAppStore } from '../store';
import type { Product, ExchangeRate, Currency } from '../types';
import { calculatePricing } from '../utils';
import { useCustomers } from '../hooks/useAdminData';
import { useToast } from './Toast';
import { TastingEditorModal } from './TastingEditorModal';
import { QrCodeModal } from './QrCodeModal';
import { ProductCollectionsSection } from './collections/ProductCollectionsSection';
import { AutocompleteInput } from '../../components/TeaCompass/AutocompleteInput';
import { buildVarietyDataMap, getTeaVarietySuggestions } from '../../data/teaVarieties';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import { getThemeColor } from '../themeUtils';
import {
  flattenTastingNotes,
  resolveTermLabel,
  LIQUOR_COLORS,
  TASTING_CATEGORY_ORDER,
  SECTION_ICONS,
} from '../../data/tastingTaxonomy';

/* ------------------------------------------------------------------ */
/* Shared inline-edit sub-components                                   */
/* ------------------------------------------------------------------ */

type FieldVariant = 'ghost' | 'bordered';

const GHOST_TEXTAREA_BASE = 'w-full bg-transparent border border-dashed border-tea-accent-sub focus:border-solid focus:border-tea-accent-sub focus:bg-tea-gold/[0.06] rounded-md py-1.5 px-2 outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg transition-all resize-none text-xs leading-relaxed whitespace-pre-line placeholder-tea-text-dim min-h-[80px] overflow-hidden';
// Bordered variant uses the admin neutral palette: dark recessed bg, ghost border, gold focus accent.
const BORDERED_TEXTAREA_BASE = 'admin-input w-full py-2 px-3 resize-none text-ui-14 leading-relaxed whitespace-pre-line min-h-[88px]';

export const GhostTextarea = ({
  value, onSave, className = '', placeholder = '', rows = 3, ariaLabel, variant = 'ghost',
}: {
  value: string;
  onSave: (val: string) => void;
  className?: string;
  placeholder?: string;
  rows?: number;
  ariaLabel?: string;
  variant?: FieldVariant;
}) => {
  const [localValue, setLocalValue] = useState(value);
  const [justSaved, setJustSaved] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { setLocalValue(value); }, [value]);
  const handleBlur = () => {
    if (localValue !== value) {
      onSave(localValue);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 600);
    }
  };
  useEffect(() => {
    const el = textareaRef.current;
    if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }
  }, [localValue]);
  const base = variant === 'bordered' ? BORDERED_TEXTAREA_BASE : GHOST_TEXTAREA_BASE;
  return (
    <textarea
      ref={textareaRef}
      aria-label={ariaLabel}
      value={localValue || ''}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={handleBlur}
      placeholder={placeholder}
      rows={rows}
      autoComplete="off"
      autoCorrect="off"
      spellCheck={false}
      data-1p-ignore
      data-lpignore="true"
      className={`${base} ${justSaved ? '!text-tea-gold' : ''} ${className}`}
    />
  );
};

const GHOST_INPUT_BASE = 'w-full bg-transparent border-0 border-b-0 hover:border-b hover:border-tea-accent-sub focus:border-b focus:border-tea-gold/40 focus:bg-tea-gold/[0.03] rounded-none py-1 px-0 outline-none focus-visible:ring-0 transition-colors placeholder-tea-text-dim/60 leading-none';
// Both BORDERED_INPUT and BORDERED_SELECT must compute to the SAME box height:
//   2*8px py + 14px font * 1.25 leading + 2px border = 35.5px. Don't change one
//   without changing the other.
const BORDERED_INPUT_BASE = 'admin-input w-full h-9 py-2 px-3 text-ui-14 leading-tight';

export const GhostInput = ({
  value, onSave, type = 'text', align = 'left', className = '', placeholder = '', inputMode, id, ariaLabel, variant = 'ghost',
}: {
  value: string | number;
  onSave: (val: any) => void;
  type?: 'text' | 'number';
  align?: 'left' | 'right';
  className?: string;
  placeholder?: string;
  inputMode?: string;
  id?: string;
  ariaLabel?: string;
  variant?: FieldVariant;
}) => {
  const [localValue, setLocalValue] = useState(value);
  useEffect(() => { setLocalValue(value); }, [value]);
  const [justSaved, setJustSaved] = useState(false);
  const handleBlur = () => {
    if (localValue != value) {
      onSave(localValue);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 600);
    }
  };
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') e.currentTarget.blur();
  };
  const base = variant === 'bordered' ? BORDERED_INPUT_BASE : GHOST_INPUT_BASE;
  return (
    <input
      id={id}
      aria-label={ariaLabel}
      type={type}
      value={localValue || ''}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      inputMode={inputMode || (type === 'number' ? 'decimal' : undefined) as any}
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
      data-1p-ignore
      data-lpignore="true"
      className={`${base} text-${align} ${justSaved ? '!text-tea-gold' : ''} ${className}`}
    />
  );
};

export const GhostAutocompleteInput = ({
  value, onSave, suggestions, itemData, onAutoFill, className = '', placeholder = '', variant = 'ghost',
}: {
  value: string;
  onSave: (val: string) => void;
  suggestions: string[];
  itemData?: Record<string, any>;
  onAutoFill?: (data: any) => void;
  className?: string;
  placeholder?: string;
  variant?: FieldVariant;
}) => {
  const [localValue, setLocalValue] = useState(value);
  const localValueRef = useRef(value);
  const [justSaved, setJustSaved] = useState(false);
  useEffect(() => {
    setLocalValue(value);
    localValueRef.current = value;
  }, [value]);
  const save = useCallback((val: string) => {
    if (val !== value) {
      onSave(val);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 600);
    }
  }, [value, onSave]);
  const handleChange = (val: string) => { localValueRef.current = val; setLocalValue(val); };
  const handleSelect = (data: any) => { save(localValueRef.current); onAutoFill?.(data); };
  const base = variant === 'bordered' ? BORDERED_INPUT_BASE : GHOST_INPUT_BASE;
  return (
    <div
      className="flex-1 min-w-0"
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) save(localValueRef.current); }}
    >
      <AutocompleteInput
        value={localValue}
        onChange={handleChange}
        suggestions={suggestions}
        itemData={itemData}
        onSelect={handleSelect}
        placeholder={placeholder}
        className={`${base} text-left ${justSaved ? '!text-tea-gold' : ''} ${className}`}
      />
    </div>
  );
};

const GHOST_SELECT_BASE = 'w-full bg-transparent border-0 border-b-0 hover:border-b hover:border-tea-accent-sub focus:border-b focus:border-tea-gold/40 focus:bg-tea-gold/[0.03] rounded-none py-1 px-0 pr-4 outline-none focus-visible:ring-0 transition-colors text-left appearance-none cursor-pointer leading-none';
// h-9 + leading-tight = same height as BORDERED_INPUT_BASE.
const BORDERED_SELECT_BASE = 'admin-input w-full h-9 py-2 pl-2.5 pr-6 text-ui-14 leading-tight text-left appearance-none cursor-pointer';

export const GhostSelect = ({ value, onSave, options, className = '', ariaLabel, variant = 'ghost' }: {
  value: string; onSave: (val: string) => void; options: string[]; className?: string; ariaLabel?: string; variant?: FieldVariant;
}) => {
  const base = variant === 'bordered' ? BORDERED_SELECT_BASE : GHOST_SELECT_BASE;
  const chevronPos = variant === 'bordered' ? 'right-2' : 'right-0';
  return (
    <div className="relative flex-1">
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onSave(e.target.value)}
        className={`${base} ${className}`}
      >
        {options.map(opt => (
          <option key={opt} value={opt} className="bg-tea-surface text-tea-text">{opt}</option>
        ))}
      </select>
      <ChevronDown size={variant === 'bordered' ? 12 : 10} aria-hidden="true" className={`absolute ${chevronPos} top-1/2 -translate-y-1/2 text-tea-text-dim/70 pointer-events-none`} />
    </div>
  );
};

export const VendorPicker = ({ value, onChange, productId, className }: {
  value: string; onChange: (name: string) => void; productId?: string; className?: string;
}) => {
  const { data: customers = [], refetch: refetchCustomers } = useCustomers();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const vendors = useMemo(
    () => customers.filter(c => c.tags?.includes('vendor')).map(c => c.name).sort((a, b) => a.localeCompare(b)),
    [customers]
  );
  const allOptions = useMemo(() => {
    const set = new Set(vendors);
    if (value && !set.has(value)) set.add(value);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [vendors, value]);
  const filtered = useMemo(() => {
    if (!query) return allOptions;
    const q = query.toLowerCase();
    return allOptions.filter(v => v.toLowerCase().includes(q));
  }, [allOptions, query]);

  useEffect(() => { setQuery(value); }, [value]);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const isNew = query.trim() && !vendors.some(v => v.toLowerCase() === query.trim().toLowerCase());

  const handleSelectVendor = async (name: string) => {
    onChange(name);
    setOpen(false);
    if (!name) return;
    let vendorCustomer = customers.find(c => c.name.toLowerCase() === name.toLowerCase());
    if (!vendorCustomer) {
      try {
        const created = await api.customers.create({ name, tags: ['vendor'] });
        refetchCustomers();
        if (productId && created?.id) await api.customers.linkProduct(created.id, productId);
        return;
      } catch (err) { console.error('Failed to create vendor customer:', err); return; }
    }
    if (!vendorCustomer.tags?.includes('vendor')) {
      try {
        await api.customers.update(vendorCustomer.id, { tags: [...(vendorCustomer.tags || []), 'vendor'] });
        refetchCustomers();
      } catch (err) { console.error('Failed to add vendor tag:', err); }
    }
    if (productId && vendorCustomer.id) {
      try { await api.customers.linkProduct(vendorCustomer.id, productId); } catch { /* link may exist */ }
    }
  };

  return (
    <div ref={wrapperRef} className="relative flex-1">
      <input
        type="text"
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => { setTimeout(() => handleSelectVendor(query.trim()), 150); }}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSelectVendor(query.trim()); } }}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        data-1p-ignore
        data-lpignore="true"
        className={className}
        placeholder="Type or pick a source..."
      />
      {open && (filtered.length > 0 || (query.trim() && isNew)) && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-tea-surface border border-tea-accent-sub rounded-xl shadow-lg max-h-48 overflow-y-auto">
          {isNew && query.trim() && (
            <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => handleSelectVendor(query.trim())}
              className="w-full text-left px-3 py-2 text-xs text-tea-gold hover:bg-tea-bg transition-colors border-b border-tea-accent-sub">
              + Add "{query.trim()}" as new source
            </button>
          )}
          {filtered.map(v => (
            <button key={v} type="button" onMouseDown={e => e.preventDefault()} onClick={() => { setQuery(v); handleSelectVendor(v); }}
              className={`w-full text-left px-3 py-2 text-xs hover:bg-tea-bg transition-colors ${v === value ? 'text-tea-gold font-medium' : 'text-tea-text'}`}>
              {v}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export const CollapsibleSection = ({ title, description, defaultOpen = true, mobileDefault, children }: {
  title: string; description?: string; defaultOpen?: boolean; mobileDefault?: boolean; children: React.ReactNode;
}) => {
  const [open, setOpen] = useState(() => {
    if (mobileDefault !== undefined && typeof window !== 'undefined' && !window.matchMedia('(min-width: 768px)').matches) {
      return mobileDefault;
    }
    return defaultOpen;
  });
  return (
    <div className="admin-card mx-3 mb-3 overflow-hidden">
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="w-full flex items-start justify-between gap-3 px-4 py-3.5 group text-left">
        <div className="min-w-0">
          <span className="block font-sans text-ui-14 font-medium text-admin-text leading-[1.35]">{title}</span>
          {description && (
            <span className="block text-ui-13 text-admin-text-sec leading-[1.5] mt-1">{description}</span>
          )}
        </div>
        <ChevronRight size={14} aria-hidden="true" className={`mt-1 shrink-0 text-admin-text-dim transition-transform duration-200 group-hover:text-admin-text-sec ${open ? 'rotate-90' : ''}`} />
      </button>
      <div className="grid transition-[grid-template-rows] duration-200 ease-out" style={{ gridTemplateRows: open ? '1fr' : '0fr' }}>
        <div className="overflow-hidden">
          <div className="px-4 pb-4 pt-1 border-t border-admin-border">{children}</div>
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Field primitives for the Quick Entry block                          */
/* ------------------------------------------------------------------ */

/** Labeled cell in a multi-column quick-entry row. Caps label above input. */
export const FieldCell = ({ label, labelAdornment, children }: {
  label: string;
  labelAdornment?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <label className="flex flex-col gap-1.5 min-w-0">
    <span className="text-ui-11 text-admin-text-dim uppercase tracking-[0.08em] flex items-center gap-1 leading-none">
      {label}
      {labelAdornment}
    </span>
    <div className="flex items-center min-w-0">{children}</div>
  </label>
);

/** Multi-column row of FieldCells. cols=2 -> 2-up; cols=3 -> 3-up. */
export const FieldGrid = ({ cols, children }: { cols: 2 | 3; children: React.ReactNode }) => (
  <div className={`mt-4 grid gap-x-3 gap-y-4 ${cols === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
    {children}
  </div>
);

/** Single full-width labeled row. */
export const FieldRowFull = ({ label, labelAdornment, children }: {
  label: string;
  labelAdornment?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <div className="mt-4 flex flex-col gap-1.5">
    <span className="text-ui-11 text-admin-text-dim uppercase tracking-[0.08em] flex items-center gap-1.5 leading-none">
      {label}
      {labelAdornment}
    </span>
    <div className="flex items-center min-w-0">{children}</div>
  </div>
);

/** Hairline divider between logical sub-groups in Quick Entry. */
export const FieldGroupDivider = () => (
  <div className="mt-5 mb-1 border-t border-admin-border" />
);

/* ------------------------------------------------------------------ */
/* Tasting notes editor — listed inside the Story & background section */
/* ------------------------------------------------------------------ */

/** Inline microphone button. Mirrors the standalone VoiceRecorder logic
 *  but renders as a compact inline pill so it can sit alongside an
 *  "Add note" button instead of as a fixed floating action button. */
const InlineMicButton: React.FC<{ onTranscript: (text: string) => void }> = ({ onTranscript }) => {
  const [state, setState] = useState<'idle' | 'recording' | 'transcribing'>('idle');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const mountedRef = useRef(true);
  useEffect(() => () => {
    mountedRef.current = false;
    streamRef.current?.getTracks().forEach(t => t.stop());
  }, []);

  const pickMime = () => {
    if (typeof MediaRecorder === 'undefined') return 'audio/mp4';
    for (const m of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/wav']) {
      if (MediaRecorder.isTypeSupported(m)) return m;
    }
    return 'audio/mp4';
  };

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mountedRef.current) { stream.getTracks().forEach(t => t.stop()); return; }
      streamRef.current = stream;
      const mime = pickMime();
      const rec = new MediaRecorder(stream, { mimeType: mime });
      recorderRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        const blob = new Blob(chunksRef.current, { type: mime });
        chunksRef.current = [];
        if (blob.size < 100) { if (mountedRef.current) setState('idle'); return; }
        if (mountedRef.current) setState('transcribing');
        try {
          const result = await api.transcribeAudio(blob);
          if (!mountedRef.current) return;
          if (result.text && result.text.trim()) onTranscript(result.text.trim());
        } catch { /* silent */ }
        finally { if (mountedRef.current) setState('idle'); }
      };
      rec.start(250);
      setState('recording');
    } catch {
      setState('idle');
    }
  };
  const stop = () => recorderRef.current?.stop();

  const recording = state === 'recording';
  const transcribing = state === 'transcribing';

  return (
    <button
      type="button"
      onClick={recording ? stop : start}
      disabled={transcribing}
      aria-label={recording ? 'Stop recording' : transcribing ? 'Transcribing' : 'Record voice note'}
      className={`admin-pill ${recording ? 'admin-pill-on' : ''}`}
    >
      {recording ? <Square size={10} fill="currentColor" /> : transcribing ? <Loader2 size={10} className="animate-spin" /> : <Mic size={10} />}
      {recording ? 'Stop' : transcribing ? 'Transcribing' : 'Record'}
    </button>
  );
};

/** One row in the notes list — textarea with inline save on blur + delete. */
const TastingNoteRow: React.FC<{
  value: string;
  onSave: (text: string) => void;
  onDelete: () => void;
  autoFocus?: boolean;
}> = ({ value, onSave, onDelete, autoFocus }) => {
  const [local, setLocal] = useState(value);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => setLocal(value), [value]);
  useEffect(() => {
    const el = ref.current;
    if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }
  }, [local]);
  useEffect(() => { if (autoFocus) ref.current?.focus(); }, [autoFocus]);
  return (
    <div className="flex items-start gap-2">
      <textarea
        ref={ref}
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => { if (local !== value) onSave(local); }}
        rows={1}
        placeholder="Note…"
        className="admin-input flex-1 py-1.5 px-2.5 text-ui-13 leading-[1.45] resize-none min-h-0"
      />
      <button
        type="button"
        onClick={onDelete}
        aria-label="Delete note"
        title="Delete note"
        className="shrink-0 p-1 mt-0.5 text-admin-text-dim hover:text-admin-text rounded-md transition-colors"
      >
        <XIcon size={13} />
      </button>
    </div>
  );
};

const TastingNotesEditor: React.FC<{
  product: Product;
  onUpdate?: (id: string, field: keyof Product, value: any) => void | Promise<void>;
  onOpenFullEditor: () => void;
}> = ({ product, onUpdate, onOpenFullEditor }) => {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [autoFocusIdx, setAutoFocusIdx] = useState<number | null>(null);

  // Normalize current notes to {text} entries so editing has stable shape.
  const tasting = (product as any).tasting as Record<string, any> | null | undefined;
  const sourceNotes: any[] = useMemo(() => (
    Array.isArray(tasting?.notes) ? tasting!.notes : []
  ), [tasting]);

  // Hoist any legacy single voiceNote into the notes array so the editor
  // can manage it uniformly — saved out via the same pipeline.
  const initialDisplay = useMemo(() => {
    const arr = sourceNotes.map((n: any) => typeof n === 'string' ? { text: n } : { ...n, text: n?.text ?? '' });
    const legacy = typeof tasting?.voiceNote === 'string' && tasting.voiceNote.trim() ? tasting.voiceNote.trim() : null;
    if (legacy && !arr.some((n: any) => n.text === legacy)) arr.push({ text: legacy });
    return arr;
  }, [sourceNotes, tasting]);

  const writeNotes = useCallback(async (nextNotes: any[]) => {
    const nextTasting = { ...(tasting || {}), notes: nextNotes };
    // Optimistic: patch local query cache so the panel reflects immediately.
    queryClient.setQueriesData<Product[]>(
      { predicate: q => Array.isArray(q.queryKey) && q.queryKey[0] === 'products' && q.queryKey[1] !== 'public' },
      (old) => old?.map(p => p.id === product.id ? { ...p, tasting: nextTasting as any } : p),
    );
    try {
      await api.products.updateByDomain(product.id, { tasting: nextTasting });
      if (onUpdate) await onUpdate(product.id, 'tasting' as any, nextTasting);
    } catch (err: any) {
      showToast(`Failed to save note: ${err?.message || 'unknown error'}`, 'error');
    }
  }, [tasting, product.id, queryClient, onUpdate, showToast]);

  const onChangeAt = (i: number, text: string) => {
    const next = [...initialDisplay];
    next[i] = { ...next[i], text };
    writeNotes(next);
  };
  const onDeleteAt = (i: number) => writeNotes(initialDisplay.filter((_, idx) => idx !== i));
  const onAddBlank = () => {
    writeNotes([...initialDisplay, { text: '' }]);
    setAutoFocusIdx(initialDisplay.length);
  };
  const onTranscribed = (text: string) => {
    writeNotes([...initialDisplay, { text }]);
  };

  return (
    <div className="rounded-md border border-admin-border bg-admin-input-bg/40 px-3 py-2.5 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-ui-11 text-admin-text-dim uppercase tracking-[0.06em]">Tasting notes</span>
        <button
          type="button"
          onClick={onOpenFullEditor}
          className="text-ui-11 text-admin-text-sec hover:text-admin-text transition-colors"
          title="Open the full tasting profile editor"
        >
          Full editor ›
        </button>
      </div>

      {product.mood && (
        <p className="text-ui-12 text-admin-text-sec">{product.mood}</p>
      )}

      {initialDisplay.length === 0 ? (
        <p className="text-ui-12 text-admin-text-dim leading-[1.5]">No notes yet. Add one below or tap the mic to record.</p>
      ) : (
        <div className="space-y-1.5">
          {initialDisplay.map((n, i) => (
            <TastingNoteRow
              key={i}
              value={n.text}
              onSave={(text) => onChangeAt(i, text)}
              onDelete={() => onDeleteAt(i)}
              autoFocus={autoFocusIdx === i}
            />
          ))}
        </div>
      )}

      <div className="flex items-center gap-1.5 pt-1">
        <button
          type="button"
          onClick={onAddBlank}
          className="admin-pill"
          aria-label="Add note"
        >
          <Plus size={10} /> Add note
        </button>
        <InlineMicButton onTranscript={onTranscribed} />
      </div>
    </div>
  );
};

// Slot index → stable R2 slot key the worker uses for in-place writes.
const SLOT_KEYS = ['main', '1', '2'] as const;
type SlotKey = typeof SLOT_KEYS[number];

export const ImageManager = ({ product, onUpdate }: {
  product: Product; onUpdate: (field: keyof Product, value: any) => void;
}) => {
  const [uploadingSlot, setUploadingSlot] = useState<number | null>(null);
  const [justUploadedSlot, setJustUploadedSlot] = useState<number | null>(null);
  const [enhancingSlot, setEnhancingSlot] = useState<number | null>(null);
  const [cropper, setCropper] = useState<{ source: File | string; slotIndex: number } | null>(null);
  const [openMenu, setOpenMenu] = useState<number | null>(null);
  const { showToast } = useToast();
  const account = useAppStore((s) => s.activeAccount);
  const hasOpenAIKey = Boolean((account as any)?.has_openai_key);

  const images = [product.imageUrl || '', ...(product.additionalImages || [])].slice(0, 3);
  while (images.length < 3) images.push('');

  const writeSlot = (slotIndex: number, url: string) => {
    if (slotIndex === 0) {
      onUpdate('imageUrl', url);
    } else {
      const additional = [...(product.additionalImages || [])];
      additional[slotIndex - 1] = url;
      onUpdate('additionalImages' as keyof Product, additional);
    }
  };

  const uploadCroppedBlob = async (blob: Blob, slotIndex: number) => {
    setUploadingSlot(slotIndex);
    try {
      const url = await api.uploadImage(blob, {
        productId: product.id,
        slot: SLOT_KEYS[slotIndex],
        filename: `${SLOT_KEYS[slotIndex]}.jpg`,
      });
      writeSlot(slotIndex, url);
      setJustUploadedSlot(slotIndex);
      setTimeout(() => setJustUploadedSlot(null), 1200);
    } catch (err: any) {
      showToast(`Upload failed: ${err.message}`, 'error');
      throw err;
    } finally {
      setUploadingSlot(null);
    }
  };

  // Open a hidden file input. `useCamera` switches to the rear camera on
  // mobile via the `capture` attribute; on desktop browsers it's ignored
  // and the standard file picker opens.
  const pickFile = (slotIndex: number, useCamera: boolean) => {
    setOpenMenu(null);
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (useCamera) input.setAttribute('capture', 'environment');
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (file) setCropper({ source: file, slotIndex });
    };
    document.body.appendChild(input);
    input.click();
    input.remove();
  };

  const recrop = (slotIndex: number) => {
    setOpenMenu(null);
    const url = images[slotIndex];
    if (!url) return;
    setCropper({ source: url, slotIndex });
  };

  const downloadImage = async (slotIndex: number) => {
    setOpenMenu(null);
    const url = images[slotIndex];
    if (!url) return;
    try {
      const res = await fetch(url, { mode: 'cors', cache: 'no-cache' });
      if (!res.ok) throw new Error(`Failed to download (${res.status})`);
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      const safeName = (product.productName || 'product').replace(/[^a-zA-Z0-9-_]+/g, '-').toLowerCase();
      a.download = `${safeName}-${SLOT_KEYS[slotIndex]}.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch (err: any) {
      showToast(`Download failed: ${err.message}`, 'error');
    }
  };

  const handleRemove = (slotIndex: number) => {
    setOpenMenu(null);
    if (slotIndex === 0) onUpdate('imageUrl', '');
    else {
      const additional = [...(product.additionalImages || [])];
      additional.splice(slotIndex - 1, 1);
      onUpdate('additionalImages' as keyof Product, additional);
    }
  };

  const handleEnhance = async (slotIndex: number) => {
    setOpenMenu(null);
    if (!hasOpenAIKey) {
      showToast('Add an OpenAI API key in Account Settings → Integrations to enable AI enhance.', 'error');
      return;
    }
    setEnhancingSlot(slotIndex);
    try {
      const res = await api.products.enhanceImage(product.id, SLOT_KEYS[slotIndex]);
      if (res?.url) {
        writeSlot(slotIndex, res.url);
        setJustUploadedSlot(slotIndex);
        setTimeout(() => setJustUploadedSlot(null), 1200);
      }
    } catch (err: any) {
      showToast(`AI enhance failed: ${err.message}`, 'error');
    } finally {
      setEnhancingSlot(null);
    }
  };

  const slotLabels = ['Primary', 'Second', 'Third'];
  return (
    <>
      <div className="flex gap-2">
        {images.map((img, i) => (
          <div key={i} className="flex-1 aspect-square relative group">
            {img ? (
              <>
                <img src={img} alt={slotLabels[i]} className="w-full h-full object-cover rounded-md" loading="lazy" />
                <span aria-hidden="true" className="absolute top-1 left-1 w-4 h-4 rounded-full bg-tea-bg/80 text-tea-text-dim text-ui-10 font-serif tabular-nums flex items-center justify-center">{i + 1}</span>

                {justUploadedSlot === i ? (
                  <div className="absolute inset-0 rounded-md bg-tea-bg/70 flex items-center justify-center pointer-events-none">
                    <Check size={20} className="text-tea-gold" aria-hidden="true" />
                  </div>
                ) : enhancingSlot === i || uploadingSlot === i ? (
                  <div className="absolute inset-0 rounded-md bg-tea-bg/70 flex items-center justify-center pointer-events-none">
                    <Loader2 size={18} className="text-tea-gold animate-spin" aria-hidden="true" />
                  </div>
                ) : (
                  <>
                    {/* Action menu trigger — always visible top-right so it works on touch */}
                    <button
                      onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === i ? null : i); }}
                      aria-label={`Image actions for ${slotLabels[i].toLowerCase()}`}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-tea-bg/85 border border-tea-border flex items-center justify-center text-tea-text-sec hover:text-tea-text tap-target"
                    >
                      <MoreHorizontal size={12} />
                    </button>

                    {openMenu === i && (
                      <>
                        {/* Click-away overlay */}
                        <button
                          aria-label="Close menu"
                          onClick={() => setOpenMenu(null)}
                          className="fixed inset-0 z-10 cursor-default"
                        />
                        <div
                          role="menu"
                          className="absolute top-8 right-1 z-20 min-w-[150px] bg-tea-bg border border-tea-border rounded-md shadow-lg py-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <SlotMenuItem icon={Crop} label="Re-crop" onClick={() => recrop(i)} />
                          <SlotMenuItem icon={Upload} label="Replace" onClick={() => pickFile(i, false)} />
                          <SlotMenuItem icon={Camera} label="Take photo" onClick={() => pickFile(i, true)} />
                          <SlotMenuItem icon={Download} label="Download" onClick={() => downloadImage(i)} />
                          <SlotMenuItem
                            icon={Wand2}
                            label="AI enhance"
                            onClick={() => handleEnhance(i)}
                            disabled={!hasOpenAIKey}
                            hint={hasOpenAIKey ? undefined : 'Add OpenAI key'}
                          />
                          <div className="my-1 border-t border-tea-border" />
                          <SlotMenuItem icon={Trash2} label="Remove" onClick={() => handleRemove(i)} destructive />
                        </div>
                      </>
                    )}
                  </>
                )}
              </>
            ) : (
              <button
                onClick={() => pickFile(i, false)}
                disabled={uploadingSlot !== null}
                aria-label={`Add ${slotLabels[i].toLowerCase()} image`}
                className="w-full h-full rounded-md bg-admin-input hover:bg-admin-elevated transition-colors flex flex-col items-center justify-center gap-1.5 cursor-pointer group"
              >
                {uploadingSlot === i ? (
                  <Loader2 size={16} className="text-admin-text-dim animate-spin" aria-hidden="true" />
                ) : (
                  <>
                    <Plus size={14} className="text-admin-text-dim group-hover:text-admin-text-sec transition-colors" aria-hidden="true" />
                    <span className="text-ui-10 text-admin-text-dim group-hover:text-admin-text-sec uppercase tracking-[0.06em] transition-colors">{slotLabels[i]}</span>
                  </>
                )}
              </button>
            )}
          </div>
        ))}
      </div>

      <SquareCropModal
        isOpen={cropper !== null}
        source={cropper?.source ?? null}
        title={cropper ? `Crop ${slotLabels[cropper.slotIndex].toLowerCase()} photo` : 'Crop photo'}
        onClose={() => setCropper(null)}
        onConfirm={async (blob) => {
          if (!cropper) return;
          await uploadCroppedBlob(blob, cropper.slotIndex);
          setCropper(null);
        }}
      />
    </>
  );
};

const SlotMenuItem = ({
  icon: Icon, label, onClick, destructive, disabled, hint,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  onClick: () => void;
  destructive?: boolean;
  disabled?: boolean;
  hint?: string;
}) => (
  <button
    role="menuitem"
    onClick={onClick}
    disabled={disabled}
    title={hint}
    className={`w-full flex items-center gap-2 px-3 py-1.5 text-ui-12 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed ${
      destructive
        ? 'text-tea-text-sec hover:text-tea-text hover:bg-tea-elevated'
        : 'text-tea-text hover:bg-tea-gold/[0.06]'
    }`}
  >
    <Icon size={13} className={destructive ? 'text-tea-text-sec' : 'text-tea-text-sec'} />
    <span className="flex-1">{label}</span>
    {hint && <span className="text-ui-10 text-tea-text-dim">{hint}</span>}
  </button>
);

/* ------------------------------------------------------------------ */
/* Field → DB column mapping (shared between panel and inventory)      */
/* ------------------------------------------------------------------ */

export function buildProductUpdatePayload(field: keyof Product, value: any): Record<string, any> | null {
  switch (field) {
    case 'stockGrams': return { stock_grams: Number(value) };
    case 'costAmount': return { cost_amount: Number(value) };
    case 'pricePerGramUSD': return { fixed_retail_price_usd: Number(value) };
    case 'productName': return { product_name: value };
    case 'originRegion': return { origin_region: value };
    case 'year': return { year: Number(value) };
    case 'isFeatured': return { is_featured: value };
    case 'isPublic': return { is_public: value };
    case 'showWisdom': return { show_wisdom: value };
    case 'recheckStock': return { recheck_stock: value ? 1 : 0 };
    case 'stockVerifiedAt': return { stock_verified_at: value };
    case 'material': return { material: value };
    case 'capacityMl': return { capacity_ml: Number(value) };
    case 'teawareCategory': return { teaware_category: value };
    case 'quantityUnits': return { quantity_units: Number(value) };
    case 'experience': return { experience: value };
    case 'description': return { description: value };
    case 'mood': return { mood: value };
    case 'moodTags': return { mood_tags: JSON.stringify(value || []) };
    case 'flavorTags': return { flavor_tags: JSON.stringify(value || []) };
    case 'tastingNotes': return { tasting_notes: JSON.stringify(value) };
    case 'lore': return { lore: value };
    case 'givenName': return { given_name: value };
    case 'chineseName': return { chinese_name: value };
    case 'form': return { form: value };
    case 'originCountry': return { origin_country: value };
    case 'vendor': return { vendor: value };
    case 'type': return { type: value };
    case 'status': return { status: value };
    case 'imageUrl': return { image_url: value };
    case 'processingNotes': return { processing_notes: value };
    case 'terroir': return { terroir: value };
    case 'isPersonal': return { is_personal: value ? 1 : 0 };
    case 'canReorder': return { can_reorder: value ? 1 : 0 };
    case 'isCurated': return { is_curated: value ? 1 : 0 };
    case 'isSample': return { is_sample: value ? 1 : 0 };
    case 'isCustomWisdom': return { is_custom_wisdom: value ? 1 : 0 };
    case 'fixedRetailPriceUSD': return { fixed_retail_price_usd: value ? Number(value) : null };
    case 'shippingRatePerKg': return { shipping_rate_per_kg: Number(value) };
    case 'quantityPurchased': return { quantity_purchased: Number(value) };
    case 'lowStockThreshold': return { low_stock_threshold: Number(value) };
    case 'costCurrency': return { cost_currency: value };
    case 'additionalImages': return { additional_images: JSON.stringify(value || []) };
    default: return null;
  }
}

/* ------------------------------------------------------------------ */
/* ProductEditPanel — the inventory sidebar, now reusable              */
/* ------------------------------------------------------------------ */

export interface ProductEditPanelProps {
  /** The product being edited. When null, the panel is closed. */
  product: Product | null;
  /** Exchange rates for pricing calculations. */
  rates: ExchangeRate[];
  /** Called when the user closes the panel (X button, Esc, backdrop). */
  onClose: () => void;
  /**
   * Called when the user edits a field. The parent is responsible for:
   *   - persisting the change (or let the panel do it if this returns nothing)
   *   - updating the `product` prop so the panel reflects the change
   * If unset, the panel will call api.products.update directly.
   */
  onUpdate?: (id: string, field: keyof Product, value: any) => void | Promise<void>;
  /**
   * Optional list of other products — used for:
   *   - prev/next navigation (pass products in desired order)
   *   - name-autocomplete suggestions
   */
  products?: Product[];
  /** When navigating via prev/next, called with the new product. */
  onNavigate?: (product: Product) => void;
  /** Label for filter context shown in header (e.g. "Needs Attention"). */
  filterLabel?: string;
}

const STATUS_COLORS: Record<string, string> = {
  Active: 'var(--admin-text)',
  Draft: 'var(--admin-text-dim)',
  Archived: 'var(--admin-text-sec)',
  'Sold Out': 'var(--tea-error)',
};

const ProductEditPanelImpl: React.FC<ProductEditPanelProps> = ({
  product,
  rates,
  onClose,
  onUpdate,
  products = [],
  onNavigate,
  filterLabel,
}) => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const compassEntries = useTeaCompassStore((s) => s.entries);

  // Local state for modals mounted inside the panel
  const [tastingEditorProduct, setTastingEditorProduct] = useState<Product | null>(null);
  const [qrProduct, setQrProduct] = useState<Product | null>(null);
  const [breakdownOpen, setBreakdownOpen] = useState(false);

  // Events & tasting aggregate
  const [productEvents, setProductEvents] = useState<any[]>([]);
  const [productEventsLoading, setProductEventsLoading] = useState(false);
  const [productTastingAgg, setProductTastingAgg] = useState<{
    avgRating: number; totalNotes: number; favoriteCount: number; impressions: string[];
  } | null>(null);

  // Compute prev/next from products array
  const { productIndex, totalCount, prevProduct, nextProduct } = useMemo(() => {
    if (!product || products.length === 0) {
      return { productIndex: -1, totalCount: products.length, prevProduct: null, nextProduct: null };
    }
    const idx = products.findIndex(p => p.id === product.id);
    return {
      productIndex: idx,
      totalCount: products.length,
      prevProduct: idx > 0 ? products[idx - 1] : null,
      nextProduct: idx >= 0 && idx < products.length - 1 ? products[idx + 1] : null,
    };
  }, [product, products]);

  // Autocomplete data
  const nameSuggestions = useMemo(() => {
    if (!product) return [];
    const varieties = getTeaVarietySuggestions(product.type as any);
    const otherNames = products.filter(p => p.id !== product.id && p.productName).map(p => p.productName);
    return [...new Set([...varieties, ...otherNames])];
  }, [product, products]);

  const nameItemData = useMemo(() => {
    if (!product) return {};
    const varietyMap = buildVarietyDataMap(product.type as any);
    const productMap: Record<string, any> = {};
    for (const p of products) if (p.productName && !productMap[p.productName]) productMap[p.productName] = p;
    return { ...varietyMap, ...productMap };
  }, [product, products]);

  // Default onUpdate if parent didn't supply one — persist directly
  const handleUpdate = useCallback(async (id: string, field: keyof Product, value: any) => {
    if (onUpdate) { await onUpdate(id, field, value); return; }
    const payload = buildProductUpdatePayload(field, value);
    if (!payload) return;
    try { await api.products.updateByDomain(id, payload); }
    catch (err: any) { showToast(`Update failed: ${err.message}`, 'error'); }
  }, [onUpdate, showToast]);

  // Fetch events / tasting aggregate when product changes
  useEffect(() => {
    if (!product) {
      setProductEvents([]);
      setProductTastingAgg(null);
      return;
    }
    let cancelled = false;
    const loadTastings = async (events: Array<{ id: string }>, productName: string) => {
      try {
        interface TastingNoteRow {
          teaName?: string; rating?: number; isFavorite?: boolean; is_favorite?: boolean; impression?: string;
        }
        const allNotes: TastingNoteRow[] = [];
        for (const event of events.slice(0, 5)) {
          try {
            const notes = await api.events.getTastingNotes(event.id);
            const rawList = Array.isArray(notes) ? notes : (notes as { tasting_notes?: TastingNoteRow[] }).tasting_notes ?? [];
            const productNotes = (rawList as TastingNoteRow[]).filter(n =>
              n.teaName && n.teaName.toLowerCase().includes(productName.toLowerCase())
            );
            allNotes.push(...productNotes);
          } catch { /* skip */ }
        }
        if (!cancelled && allNotes.length > 0) {
          const ratings = allNotes.filter(n => n.rating).map(n => n.rating as number);
          setProductTastingAgg({
            avgRating: ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0,
            totalNotes: allNotes.length,
            favoriteCount: allNotes.filter(n => n.isFavorite || n.is_favorite).length,
            impressions: allNotes.filter(n => n.impression).map(n => n.impression as string).slice(0, 5),
          });
        }
      } catch { /* silent */ }
    };
    const load = async () => {
      setProductEventsLoading(true);
      setProductTastingAgg(null);
      try {
        const data = await api.products.getEvents(product.id);
        const events = Array.isArray(data) ? data : ((data as { events?: Array<{ id: string }> }).events ?? []);
        if (!cancelled) {
          setProductEvents(events);
          if (events.length > 0) loadTastings(events, product.givenName || product.productName || '');
        }
      } catch { if (!cancelled) setProductEvents([]); }
      finally { if (!cancelled) setProductEventsLoading(false); }
    };
    load();
    return () => { cancelled = true; };
  }, [product?.id]);

  // Keyboard nav
  useEffect(() => {
    if (!product) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); e.preventDefault(); }
      else if (e.key === 'ArrowLeft' && prevProduct && onNavigate) {
        onNavigate(prevProduct); e.preventDefault();
      } else if (e.key === 'ArrowRight' && nextProduct && onNavigate) {
        onNavigate(nextProduct); e.preventDefault();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [product, prevProduct, nextProduct, onNavigate, onClose]);

  // Focus management: trap tab inside the panel, set initial focus, return on close.
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const restoreFocusToRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!product) return;
    // Remember the element to return focus to after close
    restoreFocusToRef.current = (document.activeElement as HTMLElement) ?? null;
    // Move focus into the panel on open
    const t = setTimeout(() => closeButtonRef.current?.focus(), 50);
    return () => {
      clearTimeout(t);
      // Return focus on unmount/close
      const el = restoreFocusToRef.current;
      if (el && typeof el.focus === 'function') el.focus();
    };
  }, [product?.id]);
  // Tab key trap
  useEffect(() => {
    if (!product) return;
    const node = panelRef.current;
    if (!node) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const focusables = node.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement;
      if (e.shiftKey && active === first) { last.focus(); e.preventDefault(); }
      else if (!e.shiftKey && active === last) { first.focus(); e.preventDefault(); }
    };
    node.addEventListener('keydown', onKeyDown);
    return () => node.removeEventListener('keydown', onKeyDown);
  }, [product?.id]);

  const titleId = product ? `panel-title-${product.id}` : undefined;

  // Memoize pricing calc — only recompute when relevant fields change
  const pricingCalc = useMemo(() => {
    if (!product) return null;
    return calculatePricing(
      product.costAmount || 0,
      product.shippingRatePerKg || 13,
      product.quantityPurchased || 0,
      (product.costCurrency || 'USD') as Currency,
      rates,
      product.type === 'Teaware'
    );
  }, [
    product?.costAmount,
    product?.shippingRatePerKg,
    product?.quantityPurchased,
    product?.costCurrency,
    product?.type,
    rates,
  ]);

  // Memoize tasting flatten — only recompute when product.tasting changes
  const flattenedTastingCount = useMemo(() => {
    const tasting = (product as any)?.tasting;
    return tasting ? flattenTastingNotes(tasting).length : 0;
  }, [(product as any)?.tasting]);

  const statusColor = product ? (STATUS_COLORS[product.status] || 'var(--admin-text-sec)') : 'var(--admin-text-sec)';
  const inventoryCategory: 'tea' | 'teaware' = product?.type === 'Teaware' ? 'teaware' : 'tea';

  return (
    <>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-hidden={!product}
        style={{ backgroundColor: 'var(--admin-bg)', willChange: 'transform' }}
        className={`fixed inset-0 bottom-[calc(52px+env(safe-area-inset-bottom))] md:inset-auto md:right-0 md:top-0 md:bottom-0 md:w-[360px] lg:w-[420px] xl:w-[440px] z-30 flex flex-col panel-sidebar transition-transform duration-300 ease-out ${product ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {product && (<>
          {/* Header — Row 1: Nav. Sits on the panel bg with a single hairline border. */}
          <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5 border-b border-admin-border">
            <button
              ref={closeButtonRef}
              onClick={onClose}
              aria-label="Close product panel"
              title="Close (Esc)"
              className="p-2 -ml-0.5 text-admin-text-sec hover:text-admin-text transition-colors rounded-md hover:bg-admin-elevated"
            >
              <XIcon size={17} aria-hidden="true" />
            </button>
            <div className="flex flex-col items-center gap-0">
              <span className="font-mono text-ui-11 text-admin-text-sec tabular-nums leading-none">
                {productIndex >= 0 ? `${productIndex + 1} / ${totalCount}` : ''}
              </span>
              {filterLabel && (
                <span className="text-ui-10 text-admin-text-dim uppercase tracking-[0.06em] leading-none mt-1">
                  {filterLabel}
                </span>
              )}
            </div>
            <div className="flex items-center gap-0">
              <button
                onClick={() => prevProduct && onNavigate?.(prevProduct)}
                aria-label="Previous product"
                title="Previous (←)"
                className="p-2 text-admin-text-sec hover:text-admin-text transition-colors rounded-md hover:bg-admin-elevated disabled:opacity-30"
                disabled={!prevProduct || !onNavigate}
              ><ChevronLeft size={17} aria-hidden="true" /></button>
              <button
                onClick={() => nextProduct && onNavigate?.(nextProduct)}
                aria-label="Next product"
                title="Next (→)"
                className="p-2 text-admin-text-sec hover:text-admin-text transition-colors rounded-md hover:bg-admin-elevated disabled:opacity-30"
                disabled={!nextProduct || !onNavigate}
              ><ChevronRight size={17} aria-hidden="true" /></button>
            </div>
          </div>

          {/* Keyboard hint bar — quiet, single-line */}
          {onNavigate && (
            <div className="hidden md:flex items-center justify-center gap-3 px-4 py-1.5 border-b border-admin-border">
              <span className="text-ui-10 text-admin-text-dim uppercase tracking-[0.06em]">Esc close</span>
              <span className="text-ui-10 text-admin-text-faint">·</span>
              <span className="text-ui-10 text-admin-text-dim uppercase tracking-[0.06em]">← → navigate</span>
            </div>
          )}

          {/* Scrollable content. Identity card lives here too — scrolls with
              everything else instead of staying fixed under the nav row. */}
          <div className="flex-1 overflow-y-auto custom-scrollbar pt-3 pb-nav-gap">
            {/* Identity card. Neutral admin surface; the type color signal
                lives as a 2px left bar so the rest of the card is calm. */}
            <div className="px-3 pb-3">
              <div
                className="admin-card relative pl-4 pr-3 py-3 flex items-start justify-between gap-3"
                style={{ boxShadow: `inset 2px 0 0 ${getThemeColor(product.type)}, inset 0 1px 0 rgba(255,255,255,0.04), 0 1px 2px rgba(0,0,0,0.3)` }}
              >
                <div className="min-w-0 flex-1">
                  <h3 id={titleId} className="font-sans text-ui-17 font-medium text-admin-text leading-[1.25] tracking-[-0.005em]" title={product.productName}>{product.productName}</h3>
                  {product.givenName && <div className="text-ui-13 text-admin-text-sec leading-tight mt-1">{product.givenName}</div>}
                  <div className="flex items-center flex-wrap gap-x-1.5 gap-y-0.5 mt-1.5">
                    <span className="text-ui-12 text-admin-text-sec">{product.type}</span>
                    {product.year && <span className="text-ui-12 text-admin-text-dim font-mono tabular-nums">· {product.year}</span>}
                    {product.originRegion && <span className="text-ui-12 text-admin-text-dim">· {product.originRegion}</span>}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <div className="relative">
                    <label className="sr-only" htmlFor={`panel-status-${product.id}`}>Product status</label>
                    <select
                      id={`panel-status-${product.id}`}
                      value={product.status}
                      onChange={e => handleUpdate(product.id, 'status', e.target.value)}
                      className="admin-input text-ui-11 uppercase tracking-[0.08em] pl-2.5 pr-6 py-1.5 cursor-pointer appearance-none"
                      style={{ color: statusColor }}
                    >
                      {['Active', 'Draft', 'Archived', 'Sold Out'].map(s => <option key={s} value={s} className="bg-admin-surface text-admin-text">{s}</option>)}
                    </select>
                    <ChevronDown size={11} className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-admin-text-dim" aria-hidden="true" />
                  </div>
                  <button onClick={() => setQrProduct(product)} aria-label="Generate QR code" title="Generate QR Code" className="inline-flex items-center gap-1 text-ui-11 text-admin-text-sec hover:text-admin-text transition-colors rounded px-1 py-0.5">
                    <QrCode size={12} aria-hidden="true" /> QR
                  </button>
                </div>
              </div>
            </div>

            {/* Visibility / promotion / classification toggles.
                  Lives directly under the identity card — these get toggled
                  daily and shouldn't be hidden in a collapsible. Single flex-wrap
                  row, no per-row caps labels (Visible / Promote / Classify) — the
                  pill icons + names speak for themselves. Ordered by frequency
                  of use: visibility → promotion → classification. */}
            <div className="px-3 pb-3 flex flex-wrap gap-1.5">
              <button onClick={() => handleUpdate(product.id, 'isPublic', !product.isPublic)} className={`admin-pill ${product.isPublic ? 'admin-pill-on' : ''}`} title={product.isPublic ? 'Visible in shop — click to hide' : 'Hidden — click to show in shop'}>
                {product.isPublic ? <Eye size={10} /> : <EyeOff size={10} />} In Shop
              </button>
              <button onClick={() => handleUpdate(product.id, 'isFeatured', !product.isFeatured)} className={`admin-pill ${product.isFeatured ? 'admin-pill-on' : ''}`} title="Starred — promoted on collection pages">
                <Star size={10} className={product.isFeatured ? 'fill-current' : ''} /> Starred
              </button>
              <button onClick={() => handleUpdate(product.id, 'isCurated', !product.isCurated)} className={`admin-pill ${product.isCurated ? 'admin-pill-on' : ''}`} title="Top Pick — featured on the storefront">
                <Sparkles size={10} /> Top Pick
              </button>
              <button onClick={() => handleUpdate(product.id, 'isSample', !product.isSample)} className={`admin-pill ${product.isSample ? 'admin-pill-on' : ''}`} title="Sample-size offering">
                <FlaskConical size={10} /> Sample
              </button>
              <button onClick={() => handleUpdate(product.id, 'canReorder', !product.canReorder)} className={`admin-pill ${product.canReorder ? 'admin-pill-on' : ''}`} title="Restockable when sold out">
                <RefreshCw size={10} /> Restockable
              </button>
              <button onClick={() => handleUpdate(product.id, 'isPersonal', !product.isPersonal)} className={`admin-pill ${product.isPersonal ? 'admin-pill-on' : ''}`} title="Personal stock — not for sale">
                <User size={10} /> Mine
              </button>
            </div>

            {/* 1. QUICK ENTRY. Required fields grouped on one bordered card.
                  Identity, origin, vendor, pricing, stock all live here so a
                  product can be entered top-to-bottom without expanding sections.
                  Visibility/promotion toggles moved out — they live in the
                  always-visible bar above this card. */}
            <div className="admin-card mx-3 mb-3 px-4 pt-4 pb-4">
              <div className="flex items-baseline justify-between mb-4 pb-2.5 border-b border-admin-border">
                <span className="font-sans text-ui-14 font-medium text-admin-text leading-[1.35]">Quick entry</span>
                <span className="text-ui-10 text-admin-text-dim uppercase tracking-[0.06em]">Auto-saves</span>
              </div>
              <div>

              {/* Name (full row, autocomplete + autofill) */}
              <FieldRowFull label="Name">
                <GhostAutocompleteInput
                  variant="bordered"
                  value={product.productName}
                  onSave={(val) => handleUpdate(product.id, 'productName', val)}
                  suggestions={nameSuggestions}
                  itemData={nameItemData}
                  onAutoFill={(data) => {
                    const type = data.type || data.product_type;
                    const region = data.originRegion || data.origin_region;
                    const year = data.year;
                    const chineseName = data.chineseName || data.chinese_name;
                    if (type && !product.type) handleUpdate(product.id, 'type', type);
                    if (region && !product.originRegion) handleUpdate(product.id, 'originRegion', region);
                    if (year && !product.year) handleUpdate(product.id, 'year', year);
                    if (chineseName && !product.chineseName) handleUpdate(product.id, 'chineseName', chineseName);
                  }}
                />
              </FieldRowFull>

              <FieldGrid cols={2}>
                <FieldCell label="Given">
                  <GhostInput variant="bordered" value={product.givenName || ''} onSave={(val) => handleUpdate(product.id, 'givenName', val)} />
                </FieldCell>
                <FieldCell label="中文">
                  <GhostInput variant="bordered" value={product.chineseName || ''} onSave={(val) => handleUpdate(product.id, 'chineseName', val)} />
                </FieldCell>
              </FieldGrid>

              <FieldGrid cols={3}>
                {inventoryCategory === 'teaware' ? (
                  <>
                    <FieldCell label="Category">
                      <GhostInput variant="bordered" value={product.teawareCategory || ''} onSave={(val) => handleUpdate(product.id, 'teawareCategory', val)} />
                    </FieldCell>
                    <FieldCell label="Material">
                      <GhostInput variant="bordered" value={product.material || ''} onSave={(val) => handleUpdate(product.id, 'material', val)} />
                    </FieldCell>
                  </>
                ) : (
                  <>
                    <FieldCell label="Type">
                      <GhostSelect variant="bordered" ariaLabel="Type" value={product.type} onSave={(val) => handleUpdate(product.id, 'type', val)} options={['Green', 'Yellow', 'White', 'Oolong', 'Red', 'Dark', 'Sheng', 'Shou', 'Herbal', 'Misc']} />
                    </FieldCell>
                    <FieldCell label="Form">
                      <GhostSelect variant="bordered" ariaLabel="Form" value={product.form || ''} onSave={(val) => handleUpdate(product.id, 'form', val)} options={['Loose Leaf', 'Cake', 'Tuo', 'Brick', 'Rolled', 'Ball', 'Powder', 'Bag', 'Other']} />
                    </FieldCell>
                  </>
                )}
                <FieldCell label="Year">
                  <GhostInput variant="bordered" value={product.year || ''} onSave={(val) => handleUpdate(product.id, 'year', val)} type="number" className="tabular-nums" />
                </FieldCell>
              </FieldGrid>

              <FieldGroupDivider />

              <FieldGrid cols={2}>
                <FieldCell label="Country">
                  <GhostInput variant="bordered" value={product.originCountry || ''} onSave={(val) => handleUpdate(product.id, 'originCountry', val)} />
                </FieldCell>
                <FieldCell label="Region">
                  <GhostInput variant="bordered" value={product.originRegion || ''} onSave={(val) => handleUpdate(product.id, 'originRegion', val)} />
                </FieldCell>
              </FieldGrid>

              {/* Vendor row. Profile link sits trailing-right for clean label edge. */}
              <div className="mt-4 flex flex-col gap-1.5">
                <div className="flex items-center justify-between leading-none">
                  <span className="text-ui-11 text-admin-text-dim uppercase tracking-[0.06em]">Vendor</span>
                  {product.vendor && (
                    <button
                      onClick={() => navigate(`/admin/people?tab=sources&search=${encodeURIComponent(product.vendor || '')}`)}
                      className="flex items-center gap-0.5 text-ui-11 text-admin-text-sec hover:text-admin-text uppercase tracking-[0.06em] transition-colors"
                      title="View vendor profile"
                    >
                      Profile <ChevronRight size={11} aria-hidden="true" />
                    </button>
                  )}
                </div>
                <VendorPicker
                  value={product.vendor || ''}
                  productId={product.id}
                  onChange={(val) => handleUpdate(product.id, 'vendor', val)}
                  className="admin-input w-full h-9 py-2 px-3 text-ui-14 leading-tight"
                />
              </div>

              <FieldGroupDivider />

              {/* Pricing inputs. Cost gets full-width row so currency + amount have room.
                  Batch and shipping rate paired below. Calculated retail readout follows. */}
              {inventoryCategory === 'teaware' ? (
                <FieldGrid cols={2}>
                  <FieldCell label="Cost">
                    <GhostInput variant="bordered" value={product.costAmount} onSave={(val) => handleUpdate(product.id, 'costAmount', val)} type="number" className="tabular-nums" />
                  </FieldCell>
                  <FieldCell label="Retail / $">
                    <GhostInput variant="bordered" value={product.pricePerGramUSD} onSave={(val) => handleUpdate(product.id, 'pricePerGramUSD', val)} type="number" className="tabular-nums" />
                  </FieldCell>
                </FieldGrid>
              ) : (
                <>
                  <FieldRowFull label="Cost">
                    <div className="flex items-center gap-2 w-full">
                      <label className="relative shrink-0 cursor-pointer w-[88px]">
                        <select
                          value={product.costCurrency || 'USD'}
                          onChange={(e) => handleUpdate(product.id, 'costCurrency', e.target.value)}
                          className="admin-input w-full h-9 py-2 pl-2.5 pr-6 text-ui-14 uppercase tracking-[0.06em] leading-tight cursor-pointer appearance-none"
                          aria-label="Cost currency"
                        >
                          {['USD', 'NT', 'Yuan', 'IDR', 'JPY', 'MYR', 'HKD'].map(c => (
                            <option key={c} value={c} className="bg-admin-surface text-admin-text">{c === 'Yuan' ? 'CNY' : c}</option>
                          ))}
                        </select>
                        <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-admin-text-dim/70 pointer-events-none" />
                      </label>
                      <GhostInput variant="bordered" value={product.costAmount} onSave={(val) => handleUpdate(product.id, 'costAmount', val)} type="number" className="tabular-nums flex-1 min-w-0" />
                    </div>
                  </FieldRowFull>
                  <FieldGrid cols={2}>
                    <FieldCell label="Batch g">
                      <GhostInput variant="bordered" value={product.quantityPurchased || 0} onSave={(val) => handleUpdate(product.id, 'quantityPurchased', val)} type="number" className="tabular-nums" />
                    </FieldCell>
                    <FieldCell label="Ship $/kg">
                      <GhostInput variant="bordered" value={product.shippingRatePerKg || 13} onSave={(val) => handleUpdate(product.id, 'shippingRatePerKg', val)} type="number" className="tabular-nums" />
                    </FieldCell>
                  </FieldGrid>
                  {pricingCalc && pricingCalc.suggestedRetailUSD > 0 && (() => {
                    const calc = pricingCalc;
                    const hasOverride = product.fixedRetailPriceUSD != null;
                    const overrideBelowCost = hasOverride && product.fixedRetailPriceUSD! < calc.trueCostUSD;
                    return (
                      <div className="mt-4 rounded-md bg-admin-input border border-admin-border overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setBreakdownOpen(!breakdownOpen)}
                          aria-expanded={breakdownOpen}
                          aria-label={breakdownOpen ? 'Collapse pricing details' : 'Expand pricing details'}
                          className="w-full flex items-baseline justify-between gap-3 px-3 py-2.5 hover:bg-admin-elevated transition-colors group"
                        >
                          <span className="text-ui-11 text-admin-text-dim uppercase tracking-[0.08em]">Suggested retail</span>
                          <span className="flex items-baseline gap-2">
                            <span className="font-mono text-ui-14 text-admin-text tabular-nums leading-none">
                              ${calc.suggestedRetailUSD.toFixed(2)}
                              <span className="text-ui-11 text-admin-text-dim ml-1">/g</span>
                            </span>
                            <ChevronDown size={12} aria-hidden="true" className={`text-admin-text-dim group-hover:text-admin-text-sec transition-transform duration-150 ${breakdownOpen ? 'rotate-180' : ''}`} />
                          </span>
                        </button>
                        <div className="grid transition-[grid-template-rows] duration-200 ease-out" style={{ gridTemplateRows: breakdownOpen ? '1fr' : '0fr' }}>
                          <div className="overflow-hidden">
                            <div className="px-3 pb-3 pt-1 border-t border-admin-border space-y-3">
                              {/* Override price */}
                              <div className="flex flex-col gap-1.5 pt-2">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-ui-11 text-admin-text-dim uppercase tracking-[0.06em]">Override</span>
                                  {overrideBelowCost && (
                                    <span className="text-ui-11 text-tea-error" title="Below true cost">Below cost</span>
                                  )}
                                </div>
                                <GhostInput
                                  variant="bordered"
                                  value={product.fixedRetailPriceUSD ?? ''}
                                  placeholder={calc.suggestedRetailUSD.toFixed(2)}
                                  onSave={(val) => handleUpdate(product.id, 'fixedRetailPriceUSD', val === '' || val === null ? null : Number(val))}
                                  type="number"
                                  align="right"
                                  className={`tabular-nums ${hasOverride ? 'font-medium' : ''}`}
                                />
                              </div>
                              {/* Breakdown */}
                              <div className="space-y-2 pt-2 border-t border-admin-border">
                                <div className="flex justify-between text-ui-12"><span className="text-admin-text-sec">Source cost/g</span><span className="text-admin-text tabular-nums">{calc.costPerGramSource.toFixed(3)} {product.costCurrency || 'USD'}</span></div>
                                <div className="flex justify-between text-ui-12"><span className="text-admin-text-sec">Exchange rate</span><span className="text-admin-text tabular-nums">{calc.rateUsed}</span></div>
                                <div className="flex justify-between text-ui-12"><span className="text-admin-text-sec">True cost (USD)</span><span className="text-admin-text tabular-nums font-semibold">${calc.trueCostUSD.toFixed(3)}/g</span></div>
                                <div className="flex justify-between text-ui-12"><span className="text-admin-text-sec">3× markup</span><span className="text-admin-text tabular-nums font-medium">${calc.suggestedRetailUSD.toFixed(2)}/g</span></div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}

              {/* Stock. State label + colored value preserved. */}
              {inventoryCategory === 'teaware' ? (
                <FieldGrid cols={2}>
                  <FieldCell label="Units">
                    <GhostInput variant="bordered" value={product.quantityUnits || ''} onSave={(val) => handleUpdate(product.id, 'quantityUnits', val)} type="number" className="tabular-nums" />
                  </FieldCell>
                  <FieldCell label="Capacity ml">
                    <GhostInput variant="bordered" value={product.capacityMl || ''} onSave={(val) => handleUpdate(product.id, 'capacityMl', val)} type="number" className="tabular-nums" />
                  </FieldCell>
                </FieldGrid>
              ) : (() => {
                const stock = product.stockGrams;
                const threshold = product.lowStockThreshold || 0;
                const isLow = threshold > 0 && stock <= threshold;
                const isOut = stock === 0;
                const stateLabel = isOut ? 'Empty' : isLow ? 'Low' : 'OK';
                const stateColor = isOut ? 'text-tea-error' : isLow ? 'text-admin-text' : 'text-admin-text-dim';
                return (
                  <FieldGrid cols={2}>
                    <FieldCell
                      label="Stock g"
                      labelAdornment={
                        <span aria-label={`Stock state: ${stateLabel}`} className={`text-ui-11 uppercase tracking-[0.06em] ${stateColor}`}>
                          · {stateLabel}
                        </span>
                      }
                    >
                      <GhostInput variant="bordered" value={stock} onSave={(val) => handleUpdate(product.id, 'stockGrams', val)} type="number" className={`tabular-nums ${isOut ? '!text-tea-error' : ''}`} />
                    </FieldCell>
                    <FieldCell label="Low alert g">
                      <GhostInput variant="bordered" value={threshold} onSave={(val) => handleUpdate(product.id, 'lowStockThreshold', val)} type="number" className="tabular-nums" />
                    </FieldCell>
                  </FieldGrid>
                );
              })()}

              {/* Visibility / promote / classify pills moved to the consolidated
                  "Placement" section below — colocated with collections and outbound
                  links since they all answer "where does this product appear?" */}
              </div>
            </div>

            {/* 2. Images — flat, no section header */}
            <div className="px-3 mb-3">
              <ImageManager product={product} onUpdate={(field, value) => handleUpdate(product.id, field, value)} />
            </div>

            {/* 3. Tasting Profile. Tap to open the editor modal. Card matches the
                  collapsible section styling so the panel reads as one rhythm. */}
            <button
              onClick={() => setTastingEditorProduct(product)}
              aria-label={flattenedTastingCount > 0 ? `Edit tasting profile (${flattenedTastingCount} notes)` : 'Add tasting profile'}
              className="admin-card admin-card-interactive w-[calc(100%-1.5rem)] mx-3 mb-3 px-4 py-3.5 flex items-center justify-between gap-3 group text-left"
            >
              <span className="min-w-0 flex flex-col">
                <span className="block font-sans text-ui-14 font-medium text-admin-text leading-[1.35]">Tasting profile</span>
                {flattenedTastingCount > 0 && product.mood && (
                  <span className="block text-ui-12 text-admin-text-sec truncate mt-1">{product.mood}</span>
                )}
              </span>
              <span className="flex items-center gap-2.5 shrink-0">
                {flattenedTastingCount > 0 ? (
                  <span className="font-mono text-ui-11 text-admin-text-dim tabular-nums">{flattenedTastingCount} notes</span>
                ) : (
                  <span className="text-ui-10 text-admin-text-dim uppercase tracking-[0.08em]">Add notes</span>
                )}
                <ChevronRight size={14} aria-hidden="true" className="text-admin-text-dim group-hover:text-admin-text-sec transition-colors" />
              </span>
            </button>

            {/* Pricing details and Stock details have been folded out:
                  - Pricing override + cost breakdown live inside the Suggested
                    retail click-to-expand inside Quick entry above.
                  - Stock history opens via the row's stock-grams cell (floating
                    StockLedgerPanel).
                  - Flag-for-recount lives at the row level (warning icon and
                    expandable detail panel). */}

            {/* Experience section removed. The freeform 'experience' field, mood
                chips, and flavor chips are all captured through the Tasting
                profile editor (TastingSession) — opened via the Tasting profile
                button above the collapsibles. */}

            {/* 7. Story & Background */}
            <CollapsibleSection title="Story & background" description="Personal voice, terroir, processing, and lore." defaultOpen={false}>
              <div className="space-y-5">
                {/* Inline tasting-notes editor. Lists every voice / written note
                    captured in the tasting session, allows editing each in place,
                    deletion, adding a new written note, and recording a new voice
                    note (mic → backend transcription). Changes write back to
                    product.tasting.notes globally so they appear everywhere the
                    tasting profile is read. */}
                <TastingNotesEditor
                  product={product}
                  onUpdate={onUpdate}
                  onOpenFullEditor={() => setTastingEditorProduct(product)}
                />

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-ui-11 text-admin-text-dim uppercase tracking-[0.06em]">Introduction</span>
                    <span className="text-ui-11 text-admin-text-dim">Personal voice</span>
                  </div>
                  <GhostTextarea variant="bordered" ariaLabel="Introduction" value={product.description || ''} placeholder="Your personal introduction to this tea..." rows={4} onSave={(val) => handleUpdate(product.id, 'description', val)} className="" />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-ui-11 text-admin-text-dim uppercase tracking-[0.06em]">Terroir</span>
                    <span className="text-ui-11 text-admin-text-dim">Soil, altitude, climate</span>
                  </div>
                  <GhostTextarea variant="bordered" ariaLabel="Terroir" value={product.terroir || ''} placeholder="Where this tea grew and why it matters..." rows={3} onSave={(val) => handleUpdate(product.id, 'terroir', val)} className="" />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-ui-11 text-admin-text-dim uppercase tracking-[0.06em]">Processing</span>
                    <span className="text-ui-11 text-admin-text-dim">Craft & method</span>
                  </div>
                  <GhostTextarea variant="bordered" ariaLabel="Processing notes" value={product.processingNotes || ''} placeholder="How this tea was made..." rows={3} onSave={(val) => handleUpdate(product.id, 'processingNotes', val)} className="" />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-ui-11 text-admin-text-dim uppercase tracking-[0.06em]">Lore & history</span>
                    {product.isCustomWisdom
                      ? <span className="flex items-center gap-1 text-ui-11 text-admin-text-sec"><Pencil size={10} /> hand-edited</span>
                      : <span className="text-ui-11 text-admin-text-dim">AI generated</span>}
                  </div>
                  <GhostTextarea
                    variant="bordered"
                    ariaLabel="Lore and history"
                    value={product.lore || ''}
                    placeholder="History, story, or lore..."
                    rows={3}
                    onSave={(val) => {
                      handleUpdate(product.id, 'lore', val);
                      if (!product.isCustomWisdom) handleUpdate(product.id, 'isCustomWisdom', true);
                    }}
                    className=""
                  />
                </div>
              </div>
            </CollapsibleSection>

            {/* Placement. Toggles moved OUT of this section to the always-visible
                bar under the identity card. What stays here is what's actually
                occasional: the collections this product belongs to and the
                outbound links (encounter, orders, full story page). */}
            <CollapsibleSection title="Placement" description="Collections and outbound links." defaultOpen={false}>
              {/* Collections — curated bundles this product is in. */}
              <div>
                <div className="text-ui-11 text-admin-text-dim uppercase tracking-[0.06em] mb-2">Collections</div>
                {product?.id && <ProductCollectionsSection productId={product.id} />}
              </div>

              {/* Outbound links — same divider-list pattern as before. */}
              <div className="mt-5 pt-4 border-t border-admin-border">
                <div className="text-ui-11 text-admin-text-dim uppercase tracking-[0.06em] mb-1">Links</div>
                <div className="divide-y divide-admin-border border-y border-admin-border">
                  {(() => {
                    const compassEntryId = product.sourceCompassEntryId;
                    const compassEntry = compassEntryId
                      ? compassEntries.find(e => e.id === compassEntryId)
                      : compassEntries.find(e => e.draftProductId === product.id);
                    if (!compassEntry && !compassEntryId) return null;
                    const linkId = compassEntry?.id || compassEntryId!;
                    return (
                      <button onClick={() => navigate(`/admin/compass?tab=buying&entry=${encodeURIComponent(linkId)}`)} className="w-full flex items-center justify-between gap-3 py-3 text-ui-13 text-admin-text-sec hover:text-admin-text transition-colors group">
                        <span className="flex items-center gap-2 min-w-0">
                          <Globe size={12} className="text-admin-text-dim group-hover:text-admin-text-sec shrink-0" />
                          <span className="truncate">
                            Encounter <span className="text-admin-text-dim">·</span> {compassEntry?.vendorName || 'Entry'}
                            {compassEntry && <span className="text-admin-text-dim"> · {new Date(compassEntry.createdAt).toLocaleDateString()}</span>}
                          </span>
                        </span>
                        <ChevronRight size={12} className="text-admin-text-dim shrink-0" />
                      </button>
                    );
                  })()}
                  <button onClick={() => navigate(`/admin/activity?tab=orders&search=${encodeURIComponent(product.givenName || product.productName)}`)} className="w-full flex items-center justify-between gap-3 py-3 text-ui-13 text-admin-text-sec hover:text-admin-text transition-colors group">
                    <span className="flex items-center gap-2">
                      <Receipt size={12} className="text-admin-text-dim group-hover:text-admin-text-sec" />
                      Order history
                    </span>
                    <ChevronRight size={12} className="text-admin-text-dim" />
                  </button>
                  <button onClick={() => navigate(`/admin/products/${product.id}/story`)} className="w-full flex items-center justify-between gap-3 py-3 text-ui-13 text-admin-text-sec hover:text-admin-text transition-colors group">
                    <span className="flex items-center gap-2">
                      <BookOpen size={12} className="text-admin-text-dim group-hover:text-admin-text-sec" />
                      Full story page
                    </span>
                    <ChevronRight size={12} className="text-admin-text-dim" />
                  </button>
                </div>
              </div>
            </CollapsibleSection>

            {/* 8. Events */}
            <CollapsibleSection title="Events" description="Tasting aggregate, guest impressions, and the events this tea appeared at." defaultOpen={false}>
              {productEventsLoading ? (
                <div className="flex items-center gap-2 py-2 text-ui-12 text-admin-text-sec">
                  <Loader2 size={12} className="animate-spin" />
                  <span>Loading events…</span>
                </div>
              ) : productEvents.length === 0 ? (
                <p className="text-ui-12 text-admin-text-sec py-1">Not featured at any events yet.</p>
              ) : (
                <>
                  {productTastingAgg && productTastingAgg.totalNotes > 0 && (
                    <div className="mb-4 rounded-md bg-admin-input border border-admin-border overflow-hidden">
                      <div className="flex items-center gap-4 px-4 py-3 border-b border-admin-border">
                        <div className="flex items-baseline gap-1">
                          <span className="font-sans text-ui-20 font-medium text-admin-text leading-none tabular-nums">{productTastingAgg.avgRating.toFixed(1)}</span>
                          <span className="font-mono text-ui-11 text-admin-text-dim">/5</span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-ui-12 text-admin-text-sec">
                            {productTastingAgg.totalNotes} tasting {productTastingAgg.totalNotes === 1 ? 'note' : 'notes'}
                          </span>
                          {productTastingAgg.favoriteCount > 0 && (
                            <span className="text-ui-12 text-admin-text-dim">
                              {productTastingAgg.favoriteCount} {productTastingAgg.favoriteCount === 1 ? 'guest favorited' : 'guests favorited'}
                            </span>
                          )}
                        </div>
                      </div>
                      {productTastingAgg.impressions.length > 0 && (
                        <div className="px-4 py-3 space-y-2.5">
                          <div className="text-ui-10 text-admin-text-dim uppercase tracking-[0.08em]">Guest impressions</div>
                          {productTastingAgg.impressions.map((imp, i) => (
                            <p key={i} className="text-ui-13 text-admin-text leading-[1.55]">"{imp}"</p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="text-ui-10 text-admin-text-dim uppercase tracking-[0.08em] mb-2">Appeared at</div>
                  <div className="divide-y divide-admin-border border-y border-admin-border">
                    {productEvents.map((event: any) => (
                      <div key={event.id} className="flex items-center justify-between gap-3 py-2.5">
                        <span className="text-ui-13 text-admin-text truncate">{event.name || event.title || 'Event'}</span>
                        {(event.date || event.event_date) && (
                          <span className="font-mono text-ui-11 text-admin-text-dim shrink-0 tabular-nums">
                            {new Date(event.date || event.event_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CollapsibleSection>

            {/* Collections moved into the Placement section above. */}

            <div className="pb-16" />
          </div>
        </>)}
      </div>

      {/* Mobile backdrop */}
      {product && <div className="fixed inset-0 bottom-[calc(52px+env(safe-area-inset-bottom))] z-20 md:hidden" style={{ backgroundColor: 'rgba(14,14,16,0.7)' }} onClick={onClose} />}

      {/* Tasting editor modal */}
      {tastingEditorProduct && (
        <TastingEditorModal
          product={tastingEditorProduct}
          onClose={() => setTastingEditorProduct(null)}
          onSaved={(p, tastingData, derivedMood) => {
            // Persist the tasting + mood via our update handler
            handleUpdate(p.id, 'tasting' as any, tastingData);
            if (derivedMood) handleUpdate(p.id, 'mood', derivedMood);
          }}
        />
      )}

      {/* QR code modal */}
      <QrCodeModal isOpen={!!qrProduct} onClose={() => setQrProduct(null)} product={qrProduct} />
    </>
  );
};

export const ProductEditPanel = React.memo(ProductEditPanelImpl);
