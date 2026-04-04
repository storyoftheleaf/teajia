import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Printer, Share2, Trash2, Edit3, Package, Leaf, X, ChevronRight, ChevronDown, ArrowLeft } from 'lucide-react';
import { useSampleStore } from './sampleStore';
import { createEmptySample, createEmptySampleSet, SAMPLE_GRAM_PRESETS, SAMPLE_STATUS_CONFIG } from './types';
import { SampleLabelSheet } from './SampleLabelSheet';
import type { TeaSample, SampleSet, SampleSetPurpose } from './types';
import type { TeaType } from '../components/TeaCompass/types';
import { TEA_TYPES, createEmptyEntry } from '../components/TeaCompass/types';
import { useTeaCompassStore } from '../lib/teaCompassStore';

const PURPOSE_OPTIONS: { value: SampleSetPurpose; label: string }[] = [
  { value: 'sourcing', label: 'Sourcing' },
  { value: 'customer-gifted', label: 'Gifted' },
  { value: 'event', label: 'Event' },
];

// Compact type abbreviations for mobile display
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

// ── Quick-Add Bar ──────────────────────────────────────────────────────

interface QuickAddBarProps {
  setId: string;
  sourceName?: string;
  sourceId?: string;
}

function QuickAddBar({ setId, sourceName, sourceId }: QuickAddBarProps) {
  const { addSample, updateSampleSet, getSampleSet } = useSampleStore();
  const addCompassEntry = useTeaCompassStore((s) => s.addEntry);
  const nameRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [type, setType] = useState<TeaType | undefined>(undefined);
  const [year, setYear] = useState('');
  const [grams, setGrams] = useState(10);
  const [region, setRegion] = useState('');
  const [showTypeRow, setShowTypeRow] = useState(false);

  const handleAdd = useCallback(() => {
    const trimmed = name.trim();
    if (!trimmed) return;

    const sample = createEmptySample(setId, {
      sourceName,
      sourceId,
      type,
    });
    sample.name = trimmed;
    sample.year = year ? parseInt(year, 10) : undefined;
    sample.grams = grams;
    sample.originRegion = region.trim() || undefined;

    addSample(sample);

    // Also create a compass entry (tea category, isSample flag) so samples appear in Tea Compass Browse
    const compassEntry = createEmptyEntry('tea', {
      vendorName: sourceName,
      vendorId: sourceId,
    });
    compassEntry.name = trimmed;
    compassEntry.type = type;
    compassEntry.year = year ? parseInt(year, 10) : undefined;
    compassEntry.originRegion = region.trim() || undefined;
    compassEntry.isSample = true;
    compassEntry.sampleSetId = setId;
    compassEntry.sampleGrams = grams;
    addCompassEntry(compassEntry);

    // Add sample id to the set
    const set = getSampleSet(setId);
    if (set) {
      updateSampleSet(setId, {
        sampleIds: [...set.sampleIds, sample.id],
      });
    }

    // Reset fields, keep type sticky for batch entry
    setName('');
    setYear('');
    setRegion('');
    // grams and type stay — usually same for a batch
    setTimeout(() => nameRef.current?.focus(), 50);
  }, [name, type, year, grams, region, setId, sourceName, sourceId, addSample, updateSampleSet, getSampleSet, addCompassEntry]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div className="fixed left-0 right-0 bottom-[44px] lg:bottom-0 bg-tea-surface z-40"
      style={{ boxShadow: '0 -2px 12px color-mix(in srgb, var(--tea-text) 20%, transparent)' }}>
      {/* Type selector row — toggled */}
      <AnimatePresence>
        {showTypeRow && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="flex gap-1 px-3 py-2 overflow-x-auto scrollbar-hide">
              {TEA_TYPES.map((t) => (
                <button
                  key={t}
                  className={`pill whitespace-nowrap ${type === t ? 'pill-active' : ''}`}
                  onClick={() => {
                    setType(type === t ? undefined : t);
                    setShowTypeRow(false);
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main input row */}
      <div className="flex items-center gap-2 px-3 py-2">
        {/* Type toggle button */}
        <button
          className={`pill shrink-0 ${type ? 'pill-active' : ''}`}
          onClick={() => setShowTypeRow(!showTypeRow)}
        >
          {type ? TYPE_SHORT[type] || type : 'Type'}
        </button>

        {/* Name input */}
        <input
          ref={nameRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Tea name..."
          className="flex-1 min-w-0 bg-tea-bg text-tea-text rounded px-2 py-1.5 text-sm
                     placeholder:text-tea-text-dim focus:outline-none focus:ring-1 focus:ring-tea-gold/30"
          autoComplete="off"
        />

        {/* Year input */}
        <input
          type="number"
          value={year}
          onChange={(e) => setYear(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Yr"
          className="w-14 bg-tea-bg text-tea-text rounded px-2 py-1.5 text-sm text-center num
                     placeholder:text-tea-text-dim focus:outline-none focus:ring-1 focus:ring-tea-gold/30"
        />

        {/* Add button */}
        <button
          onClick={handleAdd}
          disabled={!name.trim()}
          className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center
                     bg-tea-gold/20 text-tea-gold disabled:opacity-30 disabled:cursor-default
                     active:scale-95 transition-transform"
        >
          <Plus size={18} />
        </button>
      </div>

      {/* Grams presets row */}
      <div className="flex items-center gap-1 px-3 pb-1 overflow-x-auto scrollbar-hide">
        <span className="text-[10px] uppercase tracking-wider text-tea-text-dim mr-1 shrink-0">g</span>
        {SAMPLE_GRAM_PRESETS.map((g) => (
          <button
            key={g}
            className={`pill num ${grams === g ? 'pill-active' : ''}`}
            onClick={() => setGrams(g)}
          >
            {g}
          </button>
        ))}
      </div>

      {/* Region row */}
      <div className="flex items-center gap-2 px-3 pb-2">
        <span className="text-[10px] uppercase tracking-wider text-tea-text-dim shrink-0">Region</span>
        <input
          type="text"
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. Wuyi, Yixing..."
          className="flex-1 bg-tea-bg text-tea-text rounded px-2 py-1.5 text-sm
                     placeholder:text-tea-text-dim focus:outline-none focus:ring-1 focus:ring-tea-gold/30"
        />
      </div>
    </div>
  );
}

// ── Sample Card (compact row) ──────────────────────────────────────────

interface SampleCardProps {
  sample: TeaSample;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

function SampleCard({ sample, onEdit, onDelete }: SampleCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const statusCfg = SAMPLE_STATUS_CONFIG[sample.status];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100 }}
      transition={{ duration: 0.2 }}
      className="flex items-center gap-2 px-3 py-2 bg-tea-surface rounded mb-1.5"
    >
      {/* Type badge */}
      <span className={`badge-status badge-status-gold text-[10px] shrink-0 w-8 text-center`}>
        {sample.type ? TYPE_SHORT[sample.type] || sample.type.slice(0, 3).toUpperCase() : '---'}
      </span>

      {/* Name + details */}
      <div className="flex-1 min-w-0">
        <div className="text-sm text-tea-text truncate">{sample.name || 'Unnamed'}</div>
        <div className="flex items-center gap-2 text-[11px] text-tea-text-dim">
          {sample.year && <span className="num">{sample.year}</span>}
          <span className="num">{sample.grams}g</span>
          {sample.originRegion && <span className="truncate">{sample.originRegion}</span>}
        </div>
      </div>

      {/* Status */}
      <span className={`badge-status text-[10px] shrink-0 ${statusCfg.color}`}>
        {statusCfg.label}
      </span>

      {/* Actions */}
      <button
        onClick={() => onEdit(sample.id)}
        className="p-1 text-tea-text-dim hover:text-tea-text transition-colors"
      >
        <Edit3 size={14} />
      </button>

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

// ── Set List Item ──────────────────────────────────────────────────────

interface SetListItemProps {
  sampleSet: SampleSet;
  sampleCount: number;
  isActive: boolean;
  onClick: () => void;
}

function SetListItem({ sampleSet, sampleCount, isActive, onClick }: SetListItemProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 rounded mb-1 transition-colors ${
        isActive
          ? 'bg-tea-gold/10 text-tea-gold'
          : 'bg-tea-surface text-tea-text hover:bg-tea-surface/80'
      }`}
    >
      <div className="flex items-center gap-2">
        {isActive ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span className="text-sm font-medium truncate flex-1">
          {sampleSet.name || 'Untitled Set'}
        </span>
        <span className="text-[11px] text-tea-text-dim num">{sampleCount}</span>
      </div>
      {sampleSet.sourceName && (
        <div className="text-[11px] text-tea-text-dim ml-5 truncate">{sampleSet.sourceName}</div>
      )}
    </button>
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
  } = useSampleStore();

  const [activeSetId, setActiveSetId] = useState<string | null>(
    sampleSets.length > 0 ? sampleSets[0].id : null
  );
  const [editingSampleId, setEditingSampleId] = useState<string | null>(null);
  const [showLabels, setShowLabels] = useState(false);

  const activeSet = sampleSets.find((s) => s.id === activeSetId);
  const activeSamples = activeSetId ? getSamplesForSet(activeSetId) : [];

  // Create new set
  const handleNewSet = useCallback(() => {
    const newSet = createEmptySampleSet({ purpose: 'sourcing' });
    addSampleSet(newSet);
    setActiveSetId(newSet.id);
  }, [addSampleSet]);

  // Delete set
  const handleDeleteSet = useCallback(
    (id: string) => {
      removeSampleSet(id);
      if (activeSetId === id) {
        setActiveSetId(sampleSets.length > 1 ? sampleSets.find((s) => s.id !== id)?.id ?? null : null);
      }
    },
    [activeSetId, sampleSets, removeSampleSet]
  );

  // Delete sample
  const handleDeleteSample = useCallback(
    (id: string) => {
      removeSample(id);
    },
    [removeSample]
  );

  // Auto-create first set if none exist
  useEffect(() => {
    if (sampleSets.length === 0) {
      handleNewSet();
    }
  }, []);

  return (
    <div className="min-h-screen bg-tea-bg text-tea-text pb-[180px]">
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Package size={20} className="text-tea-gold" />
            <h1 className="text-lg font-semibold text-tea-text">Sample Sets</h1>
          </div>
          <button
            onClick={handleNewSet}
            className="pill pill-active flex items-center gap-1"
          >
            <Plus size={12} />
            New Set
          </button>
        </div>

        {/* Set list — horizontal scroll on mobile */}
        {sampleSets.length > 1 && (
          <div className="flex gap-1 overflow-x-auto scrollbar-hide pb-2 -mx-1 px-1">
            {sampleSets.map((ss) => {
              const count = getSamplesForSet(ss.id).length;
              return (
                <SetListItem
                  key={ss.id}
                  sampleSet={ss}
                  sampleCount={count}
                  isActive={ss.id === activeSetId}
                  onClick={() => setActiveSetId(ss.id)}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Active Set Editor */}
      {activeSet && (
        <div className="px-4">
          {/* Set name */}
          <input
            type="text"
            value={activeSet.name}
            onChange={(e) => updateSampleSet(activeSet.id, { name: e.target.value })}
            placeholder="Set name (e.g. March 2026 — Wuyi trip)"
            className="w-full bg-transparent text-tea-text text-base font-medium mb-2
                       placeholder:text-tea-text-dim focus:outline-none
                       pb-1"
            style={{ borderBottom: '1px solid var(--tea-accent-sub)' }}
          />

          {/* Purpose pills */}
          <div className="flex items-center gap-1 mb-2">
            <span className="text-[10px] uppercase tracking-wider text-tea-text-dim mr-1">Purpose</span>
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

          {/* Source input */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] uppercase tracking-wider text-tea-text-dim shrink-0">Source</span>
            <input
              type="text"
              value={activeSet.sourceName || ''}
              onChange={(e) => updateSampleSet(activeSet.id, { sourceName: e.target.value })}
              placeholder="Vendor / origin..."
              className="flex-1 bg-tea-surface text-tea-text rounded px-2 py-1.5 text-sm
                         placeholder:text-tea-text-dim focus:outline-none focus:ring-1 focus:ring-tea-gold/30"
            />
          </div>

          {/* Notes */}
          <textarea
            value={activeSet.notes || ''}
            onChange={(e) => updateSampleSet(activeSet.id, { notes: e.target.value })}
            placeholder="Notes..."
            rows={2}
            className="w-full bg-tea-surface text-tea-text rounded px-2 py-1.5 text-sm mb-3
                       placeholder:text-tea-text-dim focus:outline-none focus:ring-1 focus:ring-tea-gold/30
                       resize-none"
          />

          {/* Actions bar */}
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 text-[11px] text-tea-text-sec">
              <span className="num">{activeSamples.length}</span> sample{activeSamples.length !== 1 ? 's' : ''}
            </div>
            <button className="pill flex items-center gap-1" onClick={() => setShowLabels(true)}>
              <Printer size={12} />
              Print Labels
            </button>
            <button className="pill flex items-center gap-1" onClick={() => alert('Sharing coming soon')}>
              <Share2 size={12} />
              Share
            </button>
            <button
              onClick={() => {
                if (window.confirm('Delete this entire set and all its samples?')) {
                  handleDeleteSet(activeSet.id);
                }
              }}
              className="pill text-red-400 hover:text-red-300"
            >
              <Trash2 size={12} />
            </button>
          </div>

          {/* Sample list */}
          <div className="inset-panel p-2 min-h-[120px]">
            {activeSamples.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-tea-text-dim">
                <Leaf size={24} className="mb-2 opacity-40" />
                <p className="text-sm">No samples yet</p>
                <p className="text-xs mt-1">Use the quick-add bar below</p>
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {activeSamples.map((sample) => (
                  <SampleCard
                    key={sample.id}
                    sample={sample}
                    onEdit={setEditingSampleId}
                    onDelete={handleDeleteSample}
                  />
                ))}
              </AnimatePresence>
            )}
          </div>
        </div>
      )}

      {/* Quick-Add Bar (sticky bottom) */}
      {activeSet && (
        <QuickAddBar
          setId={activeSet.id}
          sourceName={activeSet.sourceName}
          sourceId={activeSet.sourceId}
        />
      )}

      {/* Inline Edit Modal */}
      <AnimatePresence>
        {editingSampleId && (
          <SampleEditModal
            sampleId={editingSampleId}
            onClose={() => setEditingSampleId(null)}
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
          <SampleLabelSheet samples={activeSamples} setName={activeSet.name} />
        </div>
      )}
    </div>
  );
}

// ── Inline Edit Modal ──────────────────────────────────────────────────

function SampleEditModal({ sampleId, onClose }: { sampleId: string; onClose: () => void }) {
  const { getSample, updateSample } = useSampleStore();
  const sample = getSample(sampleId);

  // Escape key to close
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
        {/* Modal header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-tea-text">Edit Sample</h3>
          <button onClick={onClose} className="nav-control nav-control-close">
            <X size={14} />
          </button>
        </div>

        {/* Edit fields */}
        <div className="space-y-3 overflow-y-auto" style={{ maxHeight: '60vh' }}>
          {/* Name */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-tea-text-dim block mb-1">Name</label>
            <input
              type="text"
              value={sample.name}
              onChange={(e) => updateSample(sampleId, { name: e.target.value })}
              className="w-full bg-tea-bg text-tea-text rounded px-2 py-1.5 text-sm
                         focus:outline-none focus:ring-1 focus:ring-tea-gold/30"
            />
          </div>

          {/* Chinese name */}
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

          {/* Type pills */}
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

          {/* Year + Grams row */}
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
              </div>
            </div>
          </div>

          {/* Region */}
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

          {/* Status pills */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-tea-text-dim block mb-1">Status</label>
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

          {/* Notes */}
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
