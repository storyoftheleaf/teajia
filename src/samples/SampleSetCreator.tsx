import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Printer, Trash2, Edit3, Package, Leaf, X, ChevronDown, ChevronUp, ArrowLeft, Archive, Info, Compass, ShoppingBag, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSampleStore } from './sampleStore';
import { createEmptySample, createEmptySampleSet, SAMPLE_GRAM_PRESETS, SAMPLE_STATUS_CONFIG } from './types';
import { SampleLabelSheet } from './SampleLabelSheet';
import type { TeaSample, SampleSet, SampleSetPurpose, SampleStatus } from './types';
import type { TeaType, TeaCompassEntry } from '../components/TeaCompass/types';
import { TEA_TYPES, createEmptyEntry, compassEntryToProductDraft, generateTeaKey } from '../components/TeaCompass/types';
import { useTeaCompassStore } from '../lib/teaCompassStore';
import { useNotesStore } from '../lib/notesStore';
import { AutocompleteInput } from '../components/TeaCompass/AutocompleteInput';
import { buildVarietyDataMap, getTeaVarietyNames, getTeaVarietySuggestions } from '../data/teaVarieties';
import { useCustomers, useProducts } from '../admin/hooks/useAdminData';
import { api } from '../lib/api';

const PURPOSE_OPTIONS: { value: SampleSetPurpose; label: string }[] = [
  { value: 'sourcing', label: 'Sourcing' },
  { value: 'customer-gifted', label: 'Gifted' },
  { value: 'event', label: 'Event' },
];

const PURPOSE_LABEL: Record<string, string> = {
  sourcing: 'Sourcing',
  'customer-gifted': 'Gifted',
  event: 'Event',
  panel: 'Panel',
};

const TYPE_SHORT: Record<string, string> = {
  Green: 'GRN',
  White: 'WHT',
  Yellow: 'YLW',
  Oolong: 'OOL',
  Red: 'RED',
  Dark: 'DRK',
  Sheng: 'SHG',
  Shou: 'SHU',
  Herbal: 'HRB',
};

// ── Quick-Add Sheet ────────────────────────────────────────────────────

interface QuickAddSheetProps {
  setId: string;
  sourceName?: string;
  sourceId?: string;
  onClose: () => void;
}

function QuickAddSheet({ setId, sourceName, sourceId, onClose }: QuickAddSheetProps) {
  const { addSample, updateSampleSet, getSampleSet } = useSampleStore();
  const addCompassEntry = useTeaCompassStore((s) => s.addEntry);

  const [name, setName] = useState('');
  const [chineseName, setChineseName] = useState<string | undefined>(undefined);
  const [type, setType] = useState<TeaType | undefined>(undefined);
  const [year, setYear] = useState('');
  const [grams, setGrams] = useState(10);
  const [region, setRegion] = useState('');
  const [addedFeedback, setAddedFeedback] = useState(false);

  const teaType = type && type !== 'Teaware' ? type as Exclude<TeaType, 'Teaware'> : undefined;
  const varietySuggestions = useMemo(() => getTeaVarietySuggestions(teaType), [teaType]);
  const varietyNameMap = useMemo(() => buildVarietyDataMap(teaType), [teaType]);
  const hintSuggestions = useMemo(() => getTeaVarietyNames(teaType).slice(0, 8), [teaType]);

  const { data: allProducts = [] } = useProducts();

  const currentTeaKey = useMemo(() => {
    if (!name.trim()) return null;
    return generateTeaKey({ name: name.trim(), type, year: year ? parseInt(year, 10) : undefined, originRegion: region.trim() || undefined });
  }, [name, type, year, region]);

  const duplicateProduct = useMemo(() =>
    currentTeaKey ? allProducts.find((p: any) => p.teaKey === currentTeaKey && p.status !== 'Archived') : null,
    [currentTeaKey, allProducts]
  );

  const handleVarietySelect = useCallback((data: { type?: string; originRegion?: string; chineseName?: string }) => {
    if (data.type && !type) setType(data.type as TeaType);
    if (data.originRegion && !region.trim()) setRegion(data.originRegion);
    if (data.chineseName) setChineseName(data.chineseName);
  }, [type, region]);

  const handleAdd = useCallback(() => {
    const trimmed = name.trim();
    if (!trimmed) return;

    const sample = createEmptySample(setId, {
      sourceName,
      sourceId,
      type,
    });
    sample.name = trimmed;
    sample.chineseName = chineseName;
    sample.year = year ? parseInt(year, 10) : undefined;
    sample.grams = grams;
    sample.originRegion = region.trim() || undefined;
    sample.teaKey = generateTeaKey({ name: trimmed, type, year: year ? parseInt(year, 10) : undefined, originRegion: region.trim() || undefined });

    const compassEntry = createEmptyEntry('tea', {
      vendorName: sourceName,
      vendorId: sourceId,
    });
    compassEntry.name = trimmed;
    compassEntry.chineseName = chineseName;
    compassEntry.type = type;
    compassEntry.year = year ? parseInt(year, 10) : undefined;
    compassEntry.originRegion = region.trim() || undefined;
    compassEntry.isSample = true;
    compassEntry.sampleSetId = setId;
    compassEntry.sampleGrams = grams;
    compassEntry.teaKey = sample.teaKey;

    sample.compassEntryId = compassEntry.id;

    addSample(sample);
    addCompassEntry(compassEntry);

    const set = getSampleSet(setId);
    if (set) {
      updateSampleSet(setId, {
        sampleIds: [...set.sampleIds, sample.id],
      });
    }

    setName('');
    setChineseName(undefined);
    setYear('');
    setRegion('');
    setAddedFeedback(true);
    setTimeout(() => setAddedFeedback(false), 1200);
  }, [name, type, year, grams, region, chineseName, setId, sourceName, sourceId, addSample, updateSampleSet, getSampleSet, addCompassEntry]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  const inputCls = "w-full bg-tea-surface/60 text-tea-text rounded-lg px-3 py-2.5 text-sm border border-tea-border focus:border-tea-gold/40 outline-none placeholder:text-tea-text-dim";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="w-full max-w-lg bg-tea-surface rounded-t-xl"
        style={{ maxHeight: 'calc(100dvh - 60px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3"
             style={{ borderBottom: '1px solid var(--tea-accent-sub)' }}>
          <span className="text-sm font-semibold text-tea-text">Add Sample</span>
          <div className="flex items-center gap-2">
            <AnimatePresence>
              {addedFeedback && (
                <motion.span
                  initial={{ opacity: 0, x: 4 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-[11px] text-tea-gold"
                >
                  Added ✓
                </motion.span>
              )}
            </AnimatePresence>
            <button onClick={onClose} className="nav-control nav-control-close">
              <X size={14} />
            </button>
          </div>
        </div>

        <div className="px-4 pt-3 pb-4 space-y-3">
          {/* Name — outside any overflow container so autocomplete dropdown isn't clipped */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-tea-text-dim block mb-1.5">
              Tea Name <span className="text-tea-text-dim normal-case tracking-normal">— required</span>
            </label>
            <AutocompleteInput
              value={name}
              onChange={setName}
              suggestions={varietySuggestions}
              itemData={varietyNameMap}
              hintSuggestions={hintSuggestions}
              onSelect={handleVarietySelect}
              placeholder="e.g. Tie Guan Yin, Da Hong Pao…"
              className={inputCls}
            />
            {duplicateProduct && (
              <div className="text-[11px] text-tea-gold mt-1.5 flex items-center gap-1.5">
                <span>Already in stock:</span>
                <span className="font-medium">{(duplicateProduct as any).givenName || (duplicateProduct as any).productName}</span>
                {(duplicateProduct as any).stockGrams > 0 && (
                  <span className="text-tea-text-dim num">({(duplicateProduct as any).stockGrams}g)</span>
                )}
              </div>
            )}
          </div>

          {/* Type + Year on one row */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-tea-text-dim block mb-1.5">Type</label>
              <select
                value={type || ''}
                onChange={(e) => setType((e.target.value as TeaType) || undefined)}
                className={inputCls + ' appearance-none cursor-pointer'}
                style={{ color: type ? 'var(--tea-text)' : 'var(--tea-text-dim)' }}
              >
                <option value="">— select —</option>
                {TEA_TYPES.filter(t => t !== 'Teaware').map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-tea-text-dim block mb-1.5">Year</label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g. 2023"
                className={inputCls + ' num'}
              />
            </div>
          </div>

          {/* Region */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-tea-text-dim block mb-1.5">Region</label>
            <input
              type="text"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. Wuyi, Phoenix Mountain…"
              className={inputCls}
            />
          </div>

          {/* Grams */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-tea-text-dim block mb-1.5">Grams</label>
            <div className="flex flex-wrap gap-1 items-center">
              {SAMPLE_GRAM_PRESETS.map((g) => (
                <button
                  key={g}
                  className={`pill num ${grams === g ? 'pill-active' : ''}`}
                  onClick={() => setGrams(g)}
                >
                  {g}g
                </button>
              ))}
              <input
                type="number"
                min="1"
                max="500"
                value={SAMPLE_GRAM_PRESETS.includes(grams) ? '' : grams}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (!isNaN(v) && v > 0) setGrams(v);
                }}
                placeholder="custom"
                className="w-20 bg-tea-surface/60 text-tea-text rounded-lg px-2 py-1 text-xs num
                           border border-tea-border focus:border-tea-gold/40 outline-none
                           placeholder:text-tea-text-dim"
              />
            </div>
          </div>
        </div>

        {/* Add button */}
        <div className="px-4 pb-5 pt-1">
          <button
            onClick={handleAdd}
            disabled={!name.trim()}
            className="w-full pill pill-active flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold disabled:opacity-30 disabled:cursor-default"
          >
            <Plus size={14} />
            Add Sample
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Sample Card (compact row) ──────────────────────────────────────────

interface SampleCardProps {
  sample: TeaSample;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: SampleStatus) => void;
  onTaste?: (compassEntryId: string) => void;
  onGraduate?: (sample: TeaSample) => void;
  bulkMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
  noteCount?: number;
}

function SampleCard({ sample, onEdit, onDelete, onStatusChange, onTaste, onGraduate, bulkMode, isSelected, onToggleSelect, noteCount }: SampleCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const statusCfg = SAMPLE_STATUS_CONFIG[sample.status];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100 }}
      transition={{ duration: 0.2 }}
      className={`flex items-center gap-2 px-3 py-2 bg-tea-surface rounded mb-1.5 ${sample.status === 'untasted' ? 'opacity-60' : ''}`}
    >
      {bulkMode && (
        <button
          onClick={() => onToggleSelect?.(sample.id)}
          className="shrink-0 w-5 h-5 rounded-full border border-tea-border flex items-center justify-center"
          style={isSelected ? { background: 'var(--tea-gold)', borderColor: 'var(--tea-gold)' } : {}}
        >
          {isSelected && <span className="text-tea-bg text-[10px]">✓</span>}
        </button>
      )}

      <span className="badge-status badge-status-gold text-[10px] shrink-0 w-8 text-center">
        {sample.type ? TYPE_SHORT[sample.type] || sample.type.slice(0, 3).toUpperCase() : '---'}
      </span>

      <div className="flex-1 min-w-0">
        <div className="text-sm text-tea-text truncate">{sample.name || 'Unnamed'}</div>
        <div className="flex items-center gap-2 text-[11px] text-tea-text-dim">
          {sample.year && <span className="num">{sample.year}</span>}
          <span className="num">{sample.grams}g</span>
          {sample.originRegion && <span className="truncate">{sample.originRegion}</span>}
        </div>
        {sample.tastings && sample.tastings.length > 0 && (
          <div className="text-[10px] text-tea-gold">
            {sample.tastings.length} tasting{sample.tastings.length !== 1 ? 's' : ''}
          </div>
        )}
        {noteCount != null && noteCount > 0 && (
          <div className="text-[10px] text-tea-text-dim">
            {noteCount} note{noteCount !== 1 ? 's' : ''}
          </div>
        )}
        {sample.notes && (
          <div className="text-[10px] text-tea-text-dim truncate mt-0.5 italic">
            {sample.notes.slice(0, 60)}{sample.notes.length > 60 ? '…' : ''}
          </div>
        )}
      </div>

      <button
        onClick={() => {
          const order: SampleStatus[] = ['untasted', 'tasted', 'favorite', 'ordering', 'ordered', 'passed'];
          const idx = order.indexOf(sample.status);
          const next = order[(idx + 1) % order.length];
          onStatusChange(sample.id, next);
        }}
        className={`badge-status text-[10px] shrink-0 cursor-pointer hover:opacity-80 transition-opacity ${statusCfg.color}`}
        title="Click to change status"
      >
        {statusCfg.label}
      </button>

      <button
        onClick={() => onEdit(sample.id)}
        className="p-1 text-tea-text-dim hover:text-tea-text transition-colors"
      >
        <Edit3 size={14} />
      </button>

      {sample.compassEntryId && (
        <button
          onClick={() => onTaste?.(sample.compassEntryId!)}
          className="p-1 text-tea-text-dim hover:text-tea-gold transition-colors"
          title="Open in Tea Compass to taste"
        >
          <Compass size={14} />
        </button>
      )}

      {(sample.status === 'favorite' || sample.status === 'ordering') && !sample.productId && (
        <button
          onClick={() => onGraduate?.(sample)}
          className="p-1 text-tea-text-dim hover:text-tea-gold-lt transition-colors"
          title="Graduate to inventory"
        >
          <ShoppingBag size={14} />
        </button>
      )}
      {sample.productId && (
        <span className="text-[9px] text-tea-gold shrink-0 px-1">In stock</span>
      )}

      {confirmDelete ? (
        <div className="flex items-center gap-1">
          <button
            onClick={() => onDelete(sample.id)}
            className="p-1 text-red-400 hover:text-red-300 transition-colors"
          >
            <Trash2 size={14} />
          </button>
          <button
            onClick={() => setConfirmDelete(false)}
            className="p-1 text-tea-text-dim hover:text-tea-text transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirmDelete(true)}
          className="p-1 text-tea-text-dim hover:text-red-400 transition-colors"
        >
          <Trash2 size={14} />
        </button>
      )}
    </motion.div>
  );
}

// ── Batch Card ─────────────────────────────────────────────────────────

interface BatchCardProps {
  sampleSet: SampleSet;
  tastedCount: number;
  totalCount: number;
  favoriteCount: number;
  graduatedCount: number;
  passedCount: number;
  onClick: () => void;
}

function BatchCard({ sampleSet, tastedCount, totalCount, favoriteCount, graduatedCount, passedCount, onClick }: BatchCardProps) {
  const purposeLabel = PURPOSE_LABEL[sampleSet.purpose] ?? sampleSet.purpose;
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-tea-surface rounded-lg px-4 py-3 hover:bg-tea-elevated active:scale-[0.99] transition-all"
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-tea-text truncate">
            {sampleSet.name || 'Untitled Batch'}
          </div>
          {sampleSet.sourceName && (
            <div className="text-[11px] text-tea-text-dim truncate mt-0.5">{sampleSet.sourceName}</div>
          )}
        </div>
        <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-tea-accent-sub text-tea-gold">
          {purposeLabel}
        </span>
      </div>
      <div className="text-[11px] text-tea-text-sec mt-1.5">
        <span className="num">{tastedCount}</span> / <span className="num">{totalCount}</span> tasted
      </div>
      {(favoriteCount > 0 || graduatedCount > 0 || passedCount > 0) && (
        <div className="flex items-center gap-3 mt-1">
          {favoriteCount > 0 && (
            <span className="text-[10px] text-tea-text-dim num">{favoriteCount} fav</span>
          )}
          {graduatedCount > 0 && (
            <span className="text-[10px] text-tea-gold num">{graduatedCount} in stock</span>
          )}
          {passedCount > 0 && (
            <span className="text-[10px] text-tea-text-dim num">{passedCount} passed</span>
          )}
        </div>
      )}
    </button>
  );
}

// ── Compass Import Modal ───────────────────────────────────────────────

interface CompassImportModalProps {
  setId: string;
  onClose: () => void;
  defaultVendorId?: string;
  defaultVendorName?: string;
}

function CompassImportModal({ setId, onClose, defaultVendorId, defaultVendorName }: CompassImportModalProps) {
  const compassEntries = useTeaCompassStore((s) => s.entries);
  const { importFromCompass, getSamplesForSet } = useSampleStore();
  const existingCompassIds = new Set(
    getSamplesForSet(setId).map(s => s.compassEntryId).filter(Boolean)
  );

  const [vendorOnly, setVendorOnly] = useState(!!defaultVendorId);

  const candidates = compassEntries.filter(
    e => e.category === 'tea' &&
         !existingCompassIds.has(e.id) &&
         (!vendorOnly || !defaultVendorId ||
          e.vendorId === defaultVendorId ||
          e.vendorName?.toLowerCase() === defaultVendorName?.toLowerCase())
  );

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');

  const filtered = candidates.filter(e =>
    !query.trim() || e.name.toLowerCase().includes(query.toLowerCase())
  );

  const handleImport = () => {
    const toImport = candidates.filter(e => selected.has(e.id));
    importFromCompass(toImport.map(e => ({
      id: e.id,
      name: e.name,
      chineseName: e.chineseName,
      type: e.type,
      year: e.year,
      originRegion: e.originRegion,
      grams: e.sampleGrams || 10,
      vendorId: e.vendorId,
      vendorName: e.vendorName,
      teaKey: e.teaKey,
    })), setId);
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="w-full max-w-lg bg-tea-surface rounded-t-xl p-4"
        style={{ maxHeight: 'calc(100dvh - 60px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-tea-text">Import from Compass</h3>
          <div className="flex items-center gap-2">
            {defaultVendorId && (
              <button
                onClick={() => setVendorOnly(!vendorOnly)}
                className={`pill text-[10px] ${vendorOnly ? 'pill-active' : ''}`}
              >
                {vendorOnly ? 'From this vendor' : 'All entries'}
              </button>
            )}
            <button onClick={onClose} className="nav-control nav-control-close"><X size={14} /></button>
          </div>
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search..."
          className="w-full bg-tea-bg text-tea-text rounded px-3 py-1.5 text-sm mb-3
                     placeholder:text-tea-text-dim focus:outline-none focus:ring-1 focus:ring-tea-gold/30"
        />
        <div className="overflow-y-auto mb-3" style={{ maxHeight: '40vh' }}>
          {filtered.length === 0 ? (
            <p className="text-sm text-tea-text-dim text-center py-4">No compass entries to import</p>
          ) : (
            filtered.map((e) => (
              <label key={e.id} className="flex items-center gap-3 px-2 py-2 rounded cursor-pointer hover:bg-tea-bg transition-colors">
                <input
                  type="checkbox"
                  checked={selected.has(e.id)}
                  onChange={() => setSelected(prev => {
                    const next = new Set(prev);
                    next.has(e.id) ? next.delete(e.id) : next.add(e.id);
                    return next;
                  })}
                  className="accent-[var(--tea-gold)]"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-tea-text truncate">{e.name || 'Unnamed'}</div>
                  <div className="text-[10px] text-tea-text-dim">
                    {[e.type, e.year, e.originRegion].filter(Boolean).join(' · ')}
                  </div>
                </div>
                {e.isSample && <span className="text-[9px] text-tea-gold shrink-0">Sample</span>}
              </label>
            ))
          )}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-tea-text-dim">{selected.size} selected</span>
          <button
            onClick={handleImport}
            disabled={selected.size === 0}
            className="pill pill-active disabled:opacity-30"
          >
            Import {selected.size > 0 ? selected.size : ''} samples
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────

export default function SampleSetCreator() {
  const {
    sampleSets,
    samples,
    addSampleSet,
    updateSampleSet,
    removeSample,
    getSamplesForSet,
    removeSampleSet,
    updateSampleStatus,
    bulkUpdateStatus,
    archiveSampleSet,
    updateSample,
    importFromCompass,
  } = useSampleStore();

  const navigate = useNavigate();
  const { data: allCustomers = [] } = useCustomers();
  const vendors = allCustomers.filter(c => c.tags?.includes('vendor'));
  const compassEntries = useTeaCompassStore((s) => s.entries);
  const updateCompassEntry = useTeaCompassStore((s) => s.updateEntry);

  const notes = useNotesStore((s) => s.notes);
  const compassNoteCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    notes.filter(n => n.compassEntryId && !n.deleted).forEach(n => {
      map[n.compassEntryId!] = (map[n.compassEntryId!] || 0) + 1;
    });
    return map;
  }, [notes]);

  const [activeSetId, setActiveSetId] = useState<string | null>(
    sampleSets.filter(s => !s.archived).length > 0 ? sampleSets.filter(s => !s.archived)[0].id : null
  );
  const [editingSampleId, setEditingSampleId] = useState<string | null>(null);
  const [showLabels, setShowLabels] = useState(false);
  const [statusFilter, setStatusFilter] = useState<SampleStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [view, setView] = useState<'batches' | 'batch' | 'all'>('batches');
  const [showCompassImport, setShowCompassImport] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [batchDetailsOpen, setBatchDetailsOpen] = useState(false);
  const [vendorSearchOpen, setVendorSearchOpen] = useState(false);
  const [vendorQuery, setVendorQuery] = useState('');
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [customerQuery, setCustomerQuery] = useState('');
  const [ledgerPromptName, setLedgerPromptName] = useState<string | null>(null);

  const visibleSets = sampleSets.filter(s => !s.archived);
  const activeSet = visibleSets.find((s) => s.id === activeSetId);
  const activeSamples = activeSetId ? getSamplesForSet(activeSetId) : [];

  useEffect(() => {
    setStatusFilter('all');
    setSearchQuery('');
  }, [activeSetId]);

  useEffect(() => {
    if (!activeSetId && visibleSets.length > 0) {
      setActiveSetId(visibleSets[0].id);
    }
  }, [visibleSets.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredSamples = (statusFilter === 'all' ? activeSamples : activeSamples.filter(s => s.status === statusFilter))
    .filter(s => !searchQuery.trim() || s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.originRegion?.toLowerCase().includes(searchQuery.toLowerCase()));

  const allSamples = samples;
  const allFilteredSamples = (statusFilter === 'all' ? allSamples : allSamples.filter(s => s.status === statusFilter))
    .filter(s => !searchQuery.trim() || s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.originRegion?.toLowerCase().includes(searchQuery.toLowerCase()));

  const batchComplete = useMemo(() =>
    activeSamples.length > 0 && activeSamples.every(s => s.status !== 'untasted'),
    [activeSamples]
  );

  const statusCounts = useMemo(() => ({
    untasted: activeSamples.filter(s => s.status === 'untasted').length,
    tasted: activeSamples.filter(s => s.status === 'tasted').length,
    favorite: activeSamples.filter(s => s.status === 'favorite').length,
    ordering: activeSamples.filter(s => s.status === 'ordering' || s.status === 'ordered').length,
    passed: activeSamples.filter(s => s.status === 'passed').length,
    graduated: activeSamples.filter(s => s.productId).length,
  }), [activeSamples]);

  const handleNewSet = useCallback(() => {
    const newSet = createEmptySampleSet({ purpose: 'sourcing' });
    addSampleSet(newSet);
    setActiveSetId(newSet.id);
    setView('batch');
    setBatchDetailsOpen(true);
  }, [addSampleSet]);

  const handleDeleteSet = useCallback(
    (id: string) => {
      removeSampleSet(id);
      if (activeSetId === id) {
        setActiveSetId(visibleSets.length > 1 ? visibleSets.find((s) => s.id !== id)?.id ?? null : null);
      }
    },
    [activeSetId, visibleSets, removeSampleSet]
  );

  const handleDeleteSample = useCallback(
    (id: string) => {
      removeSample(id);
    },
    [removeSample]
  );

  const handleTaste = useCallback((compassEntryId: string) => {
    navigate(`/admin/compass?entry=${compassEntryId}`);
  }, [navigate]);

  const handleGraduate = useCallback(async (sample: TeaSample) => {
    if (!window.confirm(`Graduate "${sample.name}" to inventory? This creates a draft product.`)) return;
    try {
      const compassEntry = sample.compassEntryId
        ? compassEntries.find(e => e.id === sample.compassEntryId)
        : null;

      const payload = compassEntry
        ? compassEntryToProductDraft(compassEntry)
        : {
            given_name: sample.name,
            chinese_name: sample.chineseName || '',
            product_name: sample.name,
            type: sample.type || 'Misc',
            year: sample.year || null,
            origin_region: sample.originRegion || '',
            vendor: sample.sourceName || '',
            status: 'Draft',
            is_public: false,
            is_personal: false,
            can_reorder: true,
            stock_grams: 0,
            cost_amount: 0,
            cost_currency: 'NT',
            source_compass_entry_id: sample.compassEntryId || null,
            tea_key: sample.teaKey || null,
          };

      const result = await api.products.create(payload);
      if (result?.id) {
        updateSample(sample.id, { productId: result.id, status: 'ordered' });
        if (sample.compassEntryId) {
          updateCompassEntry(sample.compassEntryId, {
            status: 'incoming' as any,
            draftProductId: result.id,
          });
        }
      }
    } catch (err) {
      alert('Failed to create product. Try again.');
    }
  }, [compassEntries, updateSample, updateCompassEntry]);

  const handleStatusChange = useCallback((sampleId: string, status: SampleStatus) => {
    updateSampleStatus(sampleId, status);
    const sample = samples.find(s => s.id === sampleId);
    if (sample?.compassEntryId) {
      const compassStatusMap: Record<SampleStatus, string> = {
        untasted: 'noted',
        tasted: 'noted',
        favorite: 'want',
        ordering: 'buying',
        ordered: 'incoming',
        passed: 'pass',
      };
      updateCompassEntry(sample.compassEntryId, { status: compassStatusMap[status] as any });
    }
    if (status === 'ordered') {
      const s = samples.find(x => x.id === sampleId);
      if (s) setLedgerPromptName(s.name);
    }
  }, [updateSampleStatus, samples, updateCompassEntry]);

  useEffect(() => {
    if (sampleSets.length === 0) {
      handleNewSet();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleBulkSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ── Screen 1: Batch List ─────────────────────────────────────────────

  const renderBatchList = () => (
    <div className="min-h-screen bg-tea-bg text-tea-text">
      <div className="flex items-center justify-between px-4 pt-4 pb-3"
        style={{ borderBottom: '1px solid var(--tea-accent-sub)' }}>
        <div className="flex items-center gap-2">
          <Package size={20} className="text-tea-gold" />
          <h1 className="text-lg font-semibold text-tea-text">Samples</h1>
          <span className="text-[11px] text-tea-text-dim num ml-1">{visibleSets.length} batch{visibleSets.length !== 1 ? 'es' : ''}</span>
          <button
            onClick={() => { setView('all'); setStatusFilter('all'); setSearchQuery(''); }}
            className="text-[11px] text-tea-gold hover:opacity-80 transition-opacity ml-0.5"
          >
            · All →
          </button>
        </div>
        <button onClick={handleNewSet} className="pill pill-active flex items-center gap-1">
          <Plus size={12} />
          New Batch
        </button>
      </div>

      {ledgerPromptName && (
        <div className="flex items-center gap-3 px-4 py-2.5 text-sm"
             style={{ background: 'color-mix(in srgb, var(--tea-gold) 6%, var(--tea-bg))', borderBottom: '1px solid var(--tea-accent-sub)' }}>
          <span className="flex-1 text-[12px] text-tea-text-sec truncate">
            <span className="text-tea-text font-medium">{ledgerPromptName}</span> marked as ordered
          </span>
          <button
            onClick={() => { navigate('/admin/compass?tab=buying'); setLedgerPromptName(null); }}
            className="pill pill-active text-[11px] shrink-0"
          >
            Open Ledger
          </button>
          <button onClick={() => setLedgerPromptName(null)} className="text-tea-text-dim hover:text-tea-text">
            <X size={14} />
          </button>
        </div>
      )}

      <div className="px-4 pt-4 pb-24">
        {visibleSets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-tea-text-dim">
            <Leaf size={32} className="mb-3 opacity-30" />
            <p className="text-sm">No batches yet. Tap + New Batch to start sourcing.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {visibleSets.map((ss) => {
              const setsamples = getSamplesForSet(ss.id);
              const total = setsamples.length;
              const tasted = setsamples.filter(s => s.status !== 'untasted').length;
              const fav = setsamples.filter(s => s.status === 'favorite').length;
              const graduated = setsamples.filter(s => s.productId).length;
              const passed = setsamples.filter(s => s.status === 'passed').length;
              return (
                <BatchCard
                  key={ss.id}
                  sampleSet={ss}
                  tastedCount={tasted}
                  totalCount={total}
                  favoriteCount={fav}
                  graduatedCount={graduated}
                  passedCount={passed}
                  onClick={() => { setActiveSetId(ss.id); setView('batch'); }}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  // ── Screen 2: Batch Detail ───────────────────────────────────────────

  const renderBatchDetail = () => {
    if (!activeSet) {
      return (
        <div className="min-h-screen bg-tea-bg text-tea-text flex flex-col items-center justify-center text-tea-text-dim">
          <Leaf size={32} className="mb-3 opacity-30" />
          <p className="text-sm">Select or create a batch</p>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-tea-bg text-tea-text">
        {/* Top bar */}
        <div className="flex items-center gap-2 px-3 pt-3 pb-2 shrink-0"
          style={{ borderBottom: '1px solid var(--tea-accent-sub)' }}>
          <button
            onClick={() => setView('batches')}
            className="p-1 -ml-1 text-tea-text-sec hover:text-tea-text transition-colors"
            aria-label="Back to batches"
          >
            <ArrowLeft size={20} />
          </button>

          {/* Inline-editable batch name */}
          <input
            type="text"
            value={activeSet.name}
            onChange={(e) => updateSampleSet(activeSet.id, { name: e.target.value })}
            placeholder="Batch name..."
            className="flex-1 min-w-0 bg-transparent text-tea-text text-sm font-medium
                       placeholder:text-tea-text-dim focus:outline-none"
          />

          {/* Action buttons */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setShowLabels(true)}
              className="nav-control nav-control-sm"
              title="Print labels"
            >
              <Printer size={15} />
            </button>
            <button
              onClick={() => setShowCompassImport(true)}
              className="nav-control nav-control-sm"
              title="Import from Compass"
            >
              <Download size={15} />
            </button>
            <button
              onClick={() => { setBulkMode(!bulkMode); setSelectedIds(new Set()); }}
              className={`pill text-[10px] ${bulkMode ? 'pill-active' : ''}`}
            >
              {bulkMode ? 'Cancel' : 'Select'}
            </button>
            <button
              onClick={() => {
                if (window.confirm('Archive this batch? It will be hidden from the active list.')) {
                  archiveSampleSet(activeSet.id);
                  const next = visibleSets.find(s => s.id !== activeSet.id && !s.archived);
                  setActiveSetId(next?.id ?? null);
                  setView('batches');
                }
              }}
              className="nav-control nav-control-sm"
              title="Archive batch"
            >
              <Archive size={15} />
            </button>
            <button
              onClick={() => {
                if (window.confirm(`Delete "${activeSet.name || 'this batch'}"? This will permanently delete all ${activeSamples.length} sample${activeSamples.length !== 1 ? 's' : ''} and their tasting records.`)) {
                  handleDeleteSet(activeSet.id);
                  setView('batches');
                }
              }}
              className="nav-control nav-control-sm"
              title="Delete batch"
              style={{ color: 'var(--tea-text-dim)' }}
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>

        {ledgerPromptName && (
          <div className="flex items-center gap-3 px-4 py-2.5 text-sm"
               style={{ background: 'color-mix(in srgb, var(--tea-gold) 6%, var(--tea-bg))', borderBottom: '1px solid var(--tea-accent-sub)' }}>
            <span className="flex-1 text-[12px] text-tea-text-sec truncate">
              <span className="text-tea-text font-medium">{ledgerPromptName}</span> marked as ordered
            </span>
            <button
              onClick={() => { navigate('/admin/compass?tab=buying'); setLedgerPromptName(null); }}
              className="pill pill-active text-[11px] shrink-0"
            >
              Open Ledger
            </button>
            <button onClick={() => setLedgerPromptName(null)} className="text-tea-text-dim hover:text-tea-text">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Batch details collapsible */}
        <div style={{ borderBottom: '1px solid var(--tea-accent-sub)' }}>
          <button
            onClick={() => setBatchDetailsOpen(!batchDetailsOpen)}
            className="w-full flex items-center justify-between px-4 py-2 text-[11px] text-tea-text-dim hover:text-tea-text transition-colors"
          >
            <span>Batch details</span>
            {batchDetailsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          <AnimatePresence>
            {batchDetailsOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-3 space-y-3">
                  {/* Purpose pills */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] uppercase tracking-wider text-tea-text-dim">Purpose</span>
                    {PURPOSE_OPTIONS.map((p) => (
                      <button
                        key={p.value}
                        className={`pill ${activeSet.purpose === p.value ? 'pill-active' : ''}`}
                        onClick={() => updateSampleSet(activeSet.id, { purpose: p.value })}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  {/* Source with vendor autocomplete */}
                  <div className="flex items-center gap-2 relative">
                    <span className="text-[10px] uppercase tracking-wider text-tea-text-dim shrink-0">Source</span>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={activeSet.sourceName || ''}
                        onChange={(e) => {
                          updateSampleSet(activeSet.id, { sourceName: e.target.value, sourceId: undefined });
                          setVendorQuery(e.target.value);
                          setVendorSearchOpen(true);
                        }}
                        onFocus={() => setVendorSearchOpen(true)}
                        onBlur={() => setTimeout(() => setVendorSearchOpen(false), 150)}
                        placeholder="Vendor / origin..."
                        className="w-full bg-tea-surface text-tea-text rounded px-2 py-1.5 text-sm
                                   placeholder:text-tea-text-dim focus:outline-none focus:ring-1 focus:ring-tea-gold/30"
                      />
                      {activeSet.sourceId && (
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-tea-gold">✓ linked</span>
                      )}
                      {vendorSearchOpen && (
                        <div className="absolute top-full left-0 right-0 z-50 bg-tea-elevated rounded shadow-lg mt-0.5 max-h-40 overflow-y-auto"
                             style={{ border: '1px solid var(--tea-border)' }}>
                          {vendors
                            .filter(v => !vendorQuery.trim() || v.name.toLowerCase().includes(vendorQuery.toLowerCase()))
                            .slice(0, 8)
                            .map(v => (
                              <button
                                key={v.id}
                                className="w-full text-left px-3 py-2 text-sm text-tea-text hover:bg-tea-surface transition-colors"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  updateSampleSet(activeSet.id, { sourceName: v.name, sourceId: v.id });
                                  setVendorSearchOpen(false);
                                  setVendorQuery('');
                                }}
                              >
                                <div>{v.name}</div>
                                {v.company && <div className="text-[10px] text-tea-text-dim">{v.company}</div>}
                              </button>
                            ))
                          }
                          {vendorQuery && !vendors.find(v => v.name.toLowerCase() === vendorQuery.toLowerCase()) && (
                            <div className="px-3 py-2 text-[11px] text-tea-text-dim italic">Type to search or enter a new source</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Vendor contact links */}
                  {(() => {
                    const linkedVendor = vendors.find((v: any) => v.id === activeSet.sourceId);
                    if (!linkedVendor || (!linkedVendor.whatsapp && !linkedVendor.phone && !linkedVendor.email)) return null;
                    return (
                      <div className="flex flex-wrap gap-3">
                        {linkedVendor.whatsapp && (
                          <a
                            href={`https://wa.me/${String(linkedVendor.whatsapp).replace(/\D/g, '')}`}
                            target="_blank" rel="noopener noreferrer"
                            className="text-[10px] text-tea-gold hover:opacity-80 transition-opacity"
                          >
                            WhatsApp
                          </a>
                        )}
                        {linkedVendor.phone && (
                          <a href={`tel:${linkedVendor.phone}`} className="text-[10px] text-tea-text-sec hover:text-tea-text transition-colors">
                            {linkedVendor.phone}
                          </a>
                        )}
                        {linkedVendor.email && (
                          <a href={`mailto:${linkedVendor.email}`} className="text-[10px] text-tea-text-sec hover:text-tea-text transition-colors">
                            {linkedVendor.email}
                          </a>
                        )}
                      </div>
                    );
                  })()}

                  {/* Customer picker — customer-gifted only */}
                  {activeSet.purpose === 'customer-gifted' && (
                    <div className="flex items-center gap-2 relative">
                      <span className="text-[10px] uppercase tracking-wider text-tea-text-dim shrink-0">Customer</span>
                      <div className="flex-1 relative">
                        <input
                          type="text"
                          value={activeSet.customerName || ''}
                          onChange={(e) => {
                            updateSampleSet(activeSet.id, { customerName: e.target.value, customerId: undefined });
                            setCustomerQuery(e.target.value);
                            setCustomerSearchOpen(true);
                          }}
                          onFocus={() => setCustomerSearchOpen(true)}
                          onBlur={() => setTimeout(() => setCustomerSearchOpen(false), 150)}
                          placeholder="Select customer..."
                          className="w-full bg-tea-surface text-tea-text rounded px-2 py-1.5 text-sm
                                     placeholder:text-tea-text-dim focus:outline-none focus:ring-1 focus:ring-tea-gold/30"
                        />
                        {activeSet.customerId && (
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-tea-gold">✓ linked</span>
                        )}
                        {customerSearchOpen && (
                          <div className="absolute top-full left-0 right-0 z-50 bg-tea-elevated rounded shadow-lg mt-0.5 max-h-40 overflow-y-auto"
                               style={{ border: '1px solid var(--tea-border)' }}>
                            {allCustomers
                              .filter(c => !c.tags?.includes('vendor'))
                              .filter(c => !customerQuery.trim() || c.name.toLowerCase().includes(customerQuery.toLowerCase()))
                              .slice(0, 8)
                              .map(c => (
                                <button
                                  key={c.id}
                                  className="w-full text-left px-3 py-2 text-sm text-tea-text hover:bg-tea-surface transition-colors"
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    updateSampleSet(activeSet.id, { customerName: c.name, customerId: c.id });
                                    setCustomerSearchOpen(false);
                                    setCustomerQuery('');
                                  }}
                                >
                                  <div>{c.name}</div>
                                  {c.company && <div className="text-[10px] text-tea-text-dim">{c.company}</div>}
                                </button>
                              ))
                            }
                            {customerQuery && !allCustomers.find(c => c.name.toLowerCase() === customerQuery.toLowerCase()) && (
                              <div className="px-3 py-2 text-[11px] text-tea-text-dim italic">Type to search or enter a name</div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  <textarea
                    value={activeSet.notes || ''}
                    onChange={(e) => updateSampleSet(activeSet.id, { notes: e.target.value })}
                    placeholder="Notes..."
                    rows={2}
                    className="w-full bg-tea-surface text-tea-text rounded px-2 py-1.5 text-sm
                               placeholder:text-tea-text-dim focus:outline-none focus:ring-1 focus:ring-tea-gold/30 resize-none"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Completion stats bar */}
        {activeSamples.length > 0 && (
          <div
            className={`px-4 py-2 flex flex-wrap items-center gap-x-3 gap-y-1`}
            style={batchComplete ? { background: 'color-mix(in srgb, var(--tea-gold) 8%, var(--tea-surface))' } : { borderBottom: '1px solid var(--tea-accent-sub)' }}
          >
            {batchComplete && (
              <span className="text-[10px] uppercase tracking-wider text-tea-gold font-medium w-full">Batch complete</span>
            )}
            {[
              { label: 'untasted', count: statusCounts.untasted },
              { label: 'tasted', count: statusCounts.tasted },
              { label: 'favorite', count: statusCounts.favorite },
              { label: 'to order', count: statusCounts.ordering },
              { label: 'passed', count: statusCounts.passed },
              { label: 'graduated', count: statusCounts.graduated },
            ].map(({ label, count }) => (
              <span
                key={label}
                className={`text-[11px] num ${count > 0 ? 'text-tea-gold' : 'text-tea-text-dim'}`}
              >
                {count} {label}
              </span>
            ))}
          </div>
        )}

        {/* Scrollable content */}
        <div className="px-4 pt-3 pb-[100px]">
          {/* Search */}
          <div className="mb-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search samples..."
              className="w-full bg-tea-surface text-tea-text rounded px-3 py-1.5 text-sm
                         placeholder:text-tea-text-dim focus:outline-none focus:ring-1 focus:ring-tea-gold/30"
            />
          </div>

          {/* Status filter pills */}
          <div className="flex flex-wrap gap-1 mb-3">
            {(['all', 'untasted', 'tasted', 'favorite', 'ordering', 'ordered', 'passed'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`pill text-[10px] ${statusFilter === s ? 'pill-active' : ''}`}
              >
                {s === 'all' ? 'All' : SAMPLE_STATUS_CONFIG[s].label}
              </button>
            ))}
          </div>

          {/* Sample list */}
          <div className="inset-panel p-2 min-h-[120px]">
            {filteredSamples.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-tea-text-dim">
                <Leaf size={24} className="mb-2 opacity-40" />
                <p className="text-sm">{activeSamples.length === 0 ? 'No samples yet' : 'No samples match'}</p>
                {activeSamples.length === 0 && <p className="text-xs mt-1">Tap + to add your first sample</p>}
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {filteredSamples.map((sample) => (
                  <SampleCard
                    key={sample.id}
                    sample={sample}
                    onEdit={setEditingSampleId}
                    onDelete={handleDeleteSample}
                    onStatusChange={handleStatusChange}
                    onTaste={handleTaste}
                    onGraduate={handleGraduate}
                    bulkMode={bulkMode}
                    isSelected={selectedIds.has(sample.id)}
                    onToggleSelect={toggleBulkSelect}
                    noteCount={sample.compassEntryId ? (compassNoteCountMap[sample.compassEntryId] || 0) : 0}
                  />
                ))}
              </AnimatePresence>
            )}
          </div>
        </div>

        {/* FAB */}
        <button
          onClick={() => setShowQuickAdd(true)}
          className="fixed right-4 z-40 w-12 h-12 rounded-full flex items-center justify-center
                     bg-tea-gold/20 text-tea-gold active:scale-95 transition-transform shadow-lg
                     lg:bottom-5"
          style={{
            bottom: 'calc(44px + env(safe-area-inset-bottom, 0px) + 12px)',
          }}
          aria-label="Add sample"
        >
          <Plus size={22} />
        </button>
      </div>
    );
  };

  // ── Screen 3: All Samples ────────────────────────────────────────────

  const renderAllSamples = () => (
    <div className="min-h-screen bg-tea-bg text-tea-text">
      <div className="flex items-center gap-2 px-3 pt-3 pb-2"
        style={{ borderBottom: '1px solid var(--tea-accent-sub)' }}>
        <button
          onClick={() => setView('batches')}
          className="p-1 -ml-1 text-tea-text-sec hover:text-tea-text transition-colors"
          aria-label="Back to batches"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-sm font-semibold text-tea-text">
          All Samples <span className="text-tea-text-dim num">· {allSamples.length}</span>
        </h1>
      </div>

      <div className="px-4 pt-3 pb-24">
        {/* Search */}
        <div className="mb-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search samples..."
            className="w-full bg-tea-surface text-tea-text rounded px-3 py-1.5 text-sm
                       placeholder:text-tea-text-dim focus:outline-none focus:ring-1 focus:ring-tea-gold/30"
          />
        </div>

        {/* Status filter */}
        <div className="flex flex-wrap gap-1 mb-3">
          {(['all', 'untasted', 'tasted', 'favorite', 'ordering', 'ordered', 'passed'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`pill text-[10px] ${statusFilter === s ? 'pill-active' : ''}`}
            >
              {s === 'all' ? 'All' : SAMPLE_STATUS_CONFIG[s].label}
            </button>
          ))}
        </div>

        <div className="inset-panel p-2 min-h-[120px]">
          {allFilteredSamples.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-tea-text-dim">
              <Leaf size={24} className="mb-2 opacity-40" />
              <p className="text-sm">No samples match</p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {allFilteredSamples.map((sample) => (
                <SampleCard
                  key={sample.id}
                  sample={sample}
                  onEdit={setEditingSampleId}
                  onDelete={handleDeleteSample}
                  onStatusChange={handleStatusChange}
                  onTaste={handleTaste}
                  onGraduate={handleGraduate}
                  bulkMode={bulkMode}
                  isSelected={selectedIds.has(sample.id)}
                  onToggleSelect={toggleBulkSelect}
                  noteCount={sample.compassEntryId ? (compassNoteCountMap[sample.compassEntryId] || 0) : 0}
                />
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );

  // ── Root render ──────────────────────────────────────────────────────

  return (
    <>
      {view === 'batches' && renderBatchList()}
      {view === 'batch' && renderBatchDetail()}
      {view === 'all' && renderAllSamples()}

      {/* Bulk action bar */}
      {bulkMode && selectedIds.size > 0 && (
        <div className="fixed bottom-[44px] lg:bottom-0 left-0 right-0 z-50 bg-tea-elevated px-4 py-3 flex items-center gap-3"
          style={{ borderTop: '1px solid var(--tea-accent-sub)' }}>
          <span className="text-sm text-tea-text flex-1">{selectedIds.size} selected</span>
          {(['tasted', 'favorite', 'ordering', 'passed'] as SampleStatus[]).map(s => (
            <button
              key={s}
              onClick={() => {
                bulkUpdateStatus(Array.from(selectedIds), s);
                setSelectedIds(new Set());
                setBulkMode(false);
              }}
              className="pill text-[11px]"
            >
              → {SAMPLE_STATUS_CONFIG[s].label}
            </button>
          ))}
        </div>
      )}

      {/* Quick-Add Sheet */}
      <AnimatePresence>
        {showQuickAdd && activeSet && (
          <QuickAddSheet
            setId={activeSet.id}
            sourceName={activeSet.sourceName}
            sourceId={activeSet.sourceId}
            onClose={() => setShowQuickAdd(false)}
          />
        )}
      </AnimatePresence>

      {/* Inline Edit Modal */}
      <AnimatePresence>
        {editingSampleId && (
          <SampleEditModal
            sampleId={editingSampleId}
            onClose={() => setEditingSampleId(null)}
          />
        )}
      </AnimatePresence>

      {/* Compass Import Modal */}
      <AnimatePresence>
        {showCompassImport && activeSet && (
          <CompassImportModal
            setId={activeSet.id}
            onClose={() => setShowCompassImport(false)}
            defaultVendorId={activeSet.sourceId}
            defaultVendorName={activeSet.sourceName}
          />
        )}
      </AnimatePresence>

      {/* Label Sheet */}
      {showLabels && activeSet && (
        <div className="fixed inset-0 z-50 bg-tea-bg overflow-auto">
          <div className="sticky top-0 z-10 bg-tea-bg/95 backdrop-blur-sm px-4 py-3 flex items-center gap-2 border-b border-tea-border">
            <button onClick={() => setShowLabels(false)} className="p-1 -ml-1 text-tea-text-sec hover:text-tea-text transition-colors" aria-label="Back to sample set">
              <ArrowLeft size={20} />
            </button>
            <span className="text-sm font-medium text-tea-text">Print Labels</span>
          </div>
          <SampleLabelSheet samples={activeSamples} showSetName={activeSet.name} />
        </div>
      )}
    </>
  );
}

// ── Inline Edit Modal ──────────────────────────────────────────────────

function SampleEditModal({ sampleId, onClose }: { sampleId: string; onClose: () => void }) {
  const { getSample, updateSample } = useSampleStore();
  const sample = getSample(sampleId);

  const editTeaType = sample?.type && sample.type !== 'Teaware'
    ? sample.type as Exclude<TeaType, 'Teaware'>
    : undefined;
  const editVarietySuggestions = useMemo(() => getTeaVarietySuggestions(editTeaType), [editTeaType]);
  const editVarietyNameMap = useMemo(() => buildVarietyDataMap(editTeaType), [editTeaType]);
  const editHintSuggestions = useMemo(() => getTeaVarietyNames(editTeaType).slice(0, 8), [editTeaType]);

  const handleEditVarietySelect = useCallback(
    (data: { type?: string; originRegion?: string; chineseName?: string }) => {
      if (!sample) return;
      const updates: Partial<typeof sample> = {};
      if (data.type && !sample.type) updates.type = data.type as TeaType;
      if (data.originRegion && !sample.originRegion) updates.originRegion = data.originRegion;
      if (data.chineseName && !sample.chineseName) updates.chineseName = data.chineseName;
      if (Object.keys(updates).length > 0) updateSample(sampleId, updates);
    },
    [sample, sampleId, updateSample]
  );

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  if (!sample) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="w-full max-w-lg bg-tea-surface rounded-t-xl p-4"
        style={{ maxHeight: 'calc(100dvh - 44px - env(safe-area-inset-bottom, 0px) - 60px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-tea-text">Edit Sample</h3>
          <button onClick={onClose} className="nav-control nav-control-close">
            <X size={14} />
          </button>
        </div>

        <div className="space-y-3 overflow-y-auto" style={{ maxHeight: '60vh' }}>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-tea-text-dim block mb-1">Name</label>
            <AutocompleteInput
              value={sample.name}
              onChange={(val) => updateSample(sampleId, { name: val })}
              suggestions={editVarietySuggestions}
              itemData={editVarietyNameMap}
              hintSuggestions={editHintSuggestions}
              onSelect={handleEditVarietySelect}
              className="w-full bg-tea-bg text-tea-text rounded px-2 py-1.5 text-sm
                         focus:outline-none focus:ring-1 focus:ring-tea-gold/30"
            />
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider text-tea-text-dim block mb-1">Chinese Name</label>
            <input
              type="text"
              value={sample.chineseName || ''}
              onChange={(e) => updateSample(sampleId, { chineseName: e.target.value || undefined })}
              className="w-full bg-tea-bg text-tea-text rounded px-2 py-1.5 text-sm
                         focus:outline-none focus:ring-1 focus:ring-tea-gold/30"
            />
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider text-tea-text-dim block mb-1">Type</label>
            <div className="flex flex-wrap gap-1">
              {TEA_TYPES.map((t) => (
                <button
                  key={t}
                  className={`pill ${sample.type === t ? 'pill-active' : ''}`}
                  onClick={() => updateSample(sampleId, { type: sample.type === t ? undefined : t })}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-[10px] uppercase tracking-wider text-tea-text-dim block mb-1">Year</label>
              <input
                type="number"
                value={sample.year || ''}
                onChange={(e) => updateSample(sampleId, { year: e.target.value ? parseInt(e.target.value, 10) : undefined })}
                className="w-full bg-tea-bg text-tea-text rounded px-2 py-1.5 text-sm num
                           focus:outline-none focus:ring-1 focus:ring-tea-gold/30"
              />
            </div>
            <div className="flex-1">
              <label className="text-[10px] uppercase tracking-wider text-tea-text-dim block mb-1">Grams</label>
              <div className="flex flex-wrap gap-1">
                {SAMPLE_GRAM_PRESETS.map((g) => (
                  <button
                    key={g}
                    className={`pill num ${sample.grams === g ? 'pill-active' : ''}`}
                    onClick={() => updateSample(sampleId, { grams: g })}
                  >
                    {g}
                  </button>
                ))}
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={SAMPLE_GRAM_PRESETS.includes(sample.grams) ? '' : sample.grams}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (!isNaN(v) && v > 0) updateSample(sampleId, { grams: v });
                  }}
                  placeholder="custom g"
                  className="w-20 bg-tea-bg text-tea-text rounded px-2 py-1 text-xs num
                             placeholder:text-tea-text-dim focus:outline-none focus:ring-1 focus:ring-tea-gold/30"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider text-tea-text-dim block mb-1">Region</label>
            <input
              type="text"
              value={sample.originRegion || ''}
              onChange={(e) => updateSample(sampleId, { originRegion: e.target.value || undefined })}
              className="w-full bg-tea-bg text-tea-text rounded px-2 py-1.5 text-sm
                         focus:outline-none focus:ring-1 focus:ring-tea-gold/30"
            />
          </div>

          <div>
            <div className="flex items-center gap-1 mb-1">
              <label className="text-[10px] uppercase tracking-wider text-tea-text-dim">Status</label>
              <div className="group relative">
                <Info size={11} className="text-tea-text-dim cursor-help" />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-52 bg-tea-elevated text-tea-text-sec text-[10px] rounded p-2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10 leading-relaxed">
                  Untasted → Tasted → Favorite / To Order → Ordered → Passed
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              {(Object.keys(SAMPLE_STATUS_CONFIG) as Array<keyof typeof SAMPLE_STATUS_CONFIG>).map((status) => {
                const cfg = SAMPLE_STATUS_CONFIG[status];
                return (
                  <button
                    key={status}
                    className={`pill ${sample.status === status ? 'pill-active' : ''}`}
                    onClick={() => updateSample(sampleId, { status })}
                  >
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider text-tea-text-dim block mb-1">Notes</label>
            <textarea
              value={sample.notes || ''}
              onChange={(e) => updateSample(sampleId, { notes: e.target.value || undefined })}
              rows={3}
              className="w-full bg-tea-bg text-tea-text rounded px-2 py-1.5 text-sm resize-none
                         focus:outline-none focus:ring-1 focus:ring-tea-gold/30"
            />
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
