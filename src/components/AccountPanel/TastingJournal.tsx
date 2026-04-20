import React, { useState, useMemo } from 'react';
import { Trash2, ExternalLink, BookOpen, Calendar, Filter, Search, X, Mic, PenLine, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Fuse from 'fuse.js';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../lib/store';
import { getTeaColor } from '../../designTokens';
import { TastingProfileStrip } from '../tasting/TastingProfileStrip';
import { usePlatformPrivilege } from '../../lib/permissions';
import { formatRelativeDate, getDateGroup } from '../TeaCompass/BrowseCard';
import type { CustomerTasting } from '../../types';
import { flattenTastingNotes, resolveTermLabel, resolveTermIcon, LIQUOR_COLORS } from '../../data/tastingTaxonomy';

// ── Feature 6: Quick Note entry bar ─────────────────────────────────────────

interface QuickNoteBarProps {
  onSave: (text: string) => void;
}

const QuickNoteBar: React.FC<QuickNoteBarProps> = ({ onSave }) => {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');

  const handleSave = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSave(trimmed);
    setText('');
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 w-full text-left px-4 py-3 text-xs text-tea-text-dim hover:text-tea-text-sec hover:bg-tea-surface/40 rounded-lg transition-colors"
      >
        <PenLine size={13} className="text-tea-text-dim" />
        Quick note…
      </button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="px-4 py-3 bg-tea-surface/60 rounded-lg space-y-2"
    >
      <textarea
        autoFocus
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSave(); }
          if (e.key === 'Escape') { setOpen(false); setText(''); }
        }}
        placeholder="Write a quick tea note…"
        rows={3}
        className="w-full bg-transparent text-sm text-tea-text placeholder:text-tea-text-dim outline-none resize-none"
      />
      <div className="flex items-center gap-2 justify-end">
        <button
          type="button"
          onClick={() => { setOpen(false); setText(''); }}
          className="text-xs text-tea-text-dim hover:text-tea-text transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!text.trim()}
          className="flex items-center gap-1.5 text-xs bg-tea-gold text-tea-bg px-3 py-1.5 rounded-md hover:bg-tea-gold-lt transition-colors disabled:opacity-40"
        >
          <Plus size={11} /> Save note
        </button>
      </div>
    </motion.div>
  );
};

// ── End Feature 6 ────────────────────────────────────────────────────────────

interface TastingJournalProps {
  onBack: () => void;
  onOrderTea?: (teaId: string) => void;
}

type EventFilter = 'all' | 'event-only' | 'no-events';
type SortMode = 'recent' | 'rating' | 'type';

export const TastingJournal: React.FC<TastingJournalProps> = ({ onBack, onOrderTea }) => {
  const { tastingJournal, removeTasting, addTasting } = useAppStore();
  const navigate = useNavigate();

  // Feature 6: Create a quick-note journal entry
  const handleQuickNote = (text: string) => {
    const entry: CustomerTasting = {
      id: crypto.randomUUID(),
      teaId: 'quick-note',
      teaName: 'Quick note',
      teaType: '',
      tasting: { notes: [text] },
      sourceType: 'product',
      synced: false,
      createdAt: new Date().toISOString(),
    };
    addTasting(entry);
  };
  const isPlatformPrivileged = usePlatformPrivilege();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [eventFilter, setEventFilter] = useState<EventFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  const hasEventTastings = useMemo(() => tastingJournal.some(e => !!e.eventId), [tastingJournal]);

  const uniqueTypes = useMemo(() => {
    const types = [...new Set(tastingJournal.map(e => e.teaType).filter(Boolean))];
    return types.length > 1 ? types : [];
  }, [tastingJournal]);

  // tastingCountByTeaId: total number of tastings per teaId
  const tastingCountByTeaId = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of tastingJournal) {
      counts.set(e.teaId, (counts.get(e.teaId) || 0) + 1);
    }
    return counts;
  }, [tastingJournal]);

  // tastingOrdinal: for each entry id, what ordinal tasting is it for its tea (1st, 2nd, etc.)
  // tastingJournal is newest-first so we iterate reverse for chronological numbering
  const tastingOrdinal = useMemo(() => {
    const ordinals = new Map<string, number>();
    const running = new Map<string, number>();
    for (const e of [...tastingJournal].reverse()) {
      const n = (running.get(e.teaId) || 0) + 1;
      running.set(e.teaId, n);
      ordinals.set(e.id, n);
    }
    return ordinals;
  }, [tastingJournal]);

  const stats = useMemo(() => {
    if (tastingJournal.length < 3) return null;
    const ratings = tastingJournal
      .map(e => e.tasting.rating ?? e.rating ?? 0)
      .filter(r => r > 0);
    const avgRating = ratings.length > 0
      ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)
      : null;
    const typeCounts = new Map<string, number>();
    for (const e of tastingJournal) {
      if (e.teaType) typeCounts.set(e.teaType, (typeCounts.get(e.teaType) || 0) + 1);
    }
    let topType: string | null = null;
    let topCount = 0;
    for (const [t, c] of typeCounts) {
      if (c > topCount) { topType = t; topCount = c; }
    }
    return { count: tastingJournal.length, avgRating, topType };
  }, [tastingJournal]);

  const filterOptions = useMemo<[EventFilter, string][]>(() => {
    const opts: [EventFilter, string][] = [['all', 'All']];
    if (hasEventTastings) opts.push(['event-only', 'Events']);
    opts.push(['no-events', 'Solo']);
    return opts;
  }, [hasEventTastings]);

  const fuseInstance = useMemo(() => new Fuse(tastingJournal, {
    keys: [
      { name: 'teaName', weight: 2 },
      { name: 'teaType', weight: 1 },
      { name: 'personalNote', weight: 0.5 },
    ],
    threshold: 0.35,
    includeScore: true,
  }), [tastingJournal]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    return new Set(fuseInstance.search(searchQuery.trim()).map(r => r.item.id));
  }, [searchQuery, fuseInstance]);

  const filteredEntries = useMemo(() => {
    let result = tastingJournal;
    if (searchResults !== null) result = result.filter(e => searchResults.has(e.id));
    if (eventFilter === 'event-only') result = result.filter(e => !!e.eventId);
    else if (eventFilter === 'no-events') result = result.filter(e => !e.eventId);
    if (typeFilter) result = result.filter(e => e.teaType === typeFilter);
    if (sortMode === 'rating') {
      result = [...result].sort((a, b) => {
        const ra = a.tasting.rating ?? a.rating ?? 0;
        const rb = b.tasting.rating ?? b.rating ?? 0;
        return rb - ra;
      });
    } else if (sortMode === 'type') {
      result = [...result].sort((a, b) => (a.teaType || '').localeCompare(b.teaType || ''));
    }
    return result;
  }, [tastingJournal, eventFilter, searchResults, typeFilter, sortMode]);

  // Group type adds dateGroup for session grouping
  const groupedEntries = useMemo(() => {
    const groups: {
      eventId: string | null;
      eventTitle: string | null;
      date: string | null;
      dateGroup: string | null;
      entries: CustomerTasting[];
    }[] = [];
    const eventMap = new Map<string, typeof groups[number]>();

    for (const entry of filteredEntries) {
      if (entry.eventId) {
        const existing = eventMap.get(entry.eventId);
        if (existing) {
          existing.entries.push(entry);
        } else {
          const group = { eventId: entry.eventId, eventTitle: entry.eventTitle || 'Event', date: entry.createdAt, dateGroup: null, entries: [entry] };
          eventMap.set(entry.eventId, group);
          groups.push(group);
        }
      } else if (sortMode === 'recent') {
        const dg = getDateGroup(entry.createdAt);
        const lastGroup = groups[groups.length - 1];
        if (lastGroup && !lastGroup.eventId && lastGroup.dateGroup === dg) {
          lastGroup.entries.push(entry);
        } else {
          groups.push({ eventId: null, eventTitle: null, date: entry.createdAt, dateGroup: dg, entries: [entry] });
        }
      } else {
        groups.push({ eventId: null, eventTitle: null, date: null, dateGroup: null, entries: [entry] });
      }
    }
    return groups;
  }, [filteredEntries, sortMode]);

  const handleDelete = (id: string) => {
    if (confirmDelete === id) {
      removeTasting(id);
      setConfirmDelete(null);
      if (expandedId === id) setExpandedId(null);
    } else {
      setConfirmDelete(id);
      setTimeout(() => setConfirmDelete(null), 5000);
    }
  };

  return (
    <div className="flex flex-col h-full surface-warm">
      {/* Header */}
      <header className="px-4 pt-4 pb-3 border-b border-tea-border">
        <div className="flex items-center gap-2.5 mb-1">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-tea-gold shrink-0">
            <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2zm20 0h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/>
          </svg>
          <h2 className="font-serif text-base font-normal text-tea-text flex-1">Tasting Journal</h2>
          <span className="text-[10px] text-tea-text-dim tabular-nums">
            {tastingJournal.length} {tastingJournal.length === 1 ? 'entry' : 'entries'}
          </span>
        </div>
        {/* Quick note entry */}
        <div className="mt-2">
          <QuickNoteBar onSave={handleQuickNote} />
        </div>
      </header>

      {tastingJournal.length > 0 && (
        <div className="px-4 pt-3 space-y-2">
          {/* Search bar */}
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-tea-text-dim pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search teas, notes…"
              className="w-full bg-tea-surface/60 text-tea-text text-[13px] rounded-lg pl-8 pr-8 py-2 outline-none placeholder:text-tea-text-dim focus:ring-1 focus:ring-tea-gold/40"
            />
            {searchQuery && (
              <button type="button" onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-tea-text-dim hover:text-tea-text-sec transition-colors">
                <X size={13} />
              </button>
            )}
          </div>

          {/* Sort pills */}
          <div className="flex items-center gap-1">
            {(['recent', 'rating', 'type'] as const).map(mode => (
              <button key={mode} onClick={() => setSortMode(mode)} className={sortMode === mode ? 'pill-active' : 'pill'}>
                {mode === 'recent' ? 'Recent' : mode === 'rating' ? 'Rating' : 'Type'}
              </button>
            ))}
          </div>

          {/* Event filter + type filter */}
          <div className="flex items-center gap-1.5 flex-wrap pb-2 border-b border-tea-border">
            <Filter size={11} className="text-tea-text-dim shrink-0" />
            <div className="flex gap-1 flex-wrap">
              {filterOptions.map(([value, label]) => (
                <button key={value} onClick={() => setEventFilter(value)} className={eventFilter === value ? 'pill-active' : 'pill'}>
                  {label}
                </button>
              ))}
              {uniqueTypes.map(t => (
                <button key={t} onClick={() => setTypeFilter(typeFilter === t ? null : t)} className={typeFilter === t ? 'pill-active' : 'pill'}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto px-4 py-3 space-y-2">
        {/* Stats row */}
        {stats && (
          <div className="text-[11px] text-tea-text-dim tabular-nums mb-2 px-0.5">
            {stats.count} teas
            {stats.avgRating && <> · Avg {stats.avgRating}/10</>}
            {stats.topType && <> · Top: {stats.topType}</>}
          </div>
        )}

        {/* Empty states */}
        {tastingJournal.length === 0 ? (
          <div className="text-center py-20 animate-[fadeIn_0.4s_ease-out]">
            <div className="w-20 h-20 rounded-full bg-tea-gold/8 flex items-center justify-center mx-auto mb-5 shadow-[0_0_30px_rgba(184,146,78,0.08)]">
              <BookOpen className="w-9 h-9 text-tea-gold/30" />
            </div>
            <h3 className="font-serif text-lg text-tea-text mb-1.5 tracking-wide">No tastings yet</h3>
            <p className="text-[13px] text-tea-text-sec text-center max-w-[240px] mx-auto leading-relaxed font-serif">
              Every cup leaves a trace.
            </p>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="text-center py-12">
            <Filter size={24} className="mx-auto text-tea-text-dim/30 mb-3" />
            <div className="text-sm text-tea-text-dim">No matching tastings</div>
            <div className="text-xs text-tea-text-dim/60 mt-1">Try a different filter or search</div>
          </div>
        ) : (
          groupedEntries.map((group, gi) => (
            <div key={group.eventId || `solo-${gi}`}>
              {/* Event group header */}
              {group.eventId && group.entries.length > 0 && (
                <button onClick={() => navigate(`/events/${group.eventId}`)} className="flex items-center gap-2 mb-1.5 mt-3 first:mt-0 px-1 group w-full text-left">
                  <Calendar size={12} className="text-tea-gold shrink-0" />
                  <span className="text-[11px] font-medium text-tea-gold font-serif group-hover:text-tea-gold-lt transition-colors truncate">
                    {group.eventTitle}
                  </span>
                  {group.date && <span className="text-[10px] text-tea-text-dim shrink-0">{formatRelativeDate(group.date)}</span>}
                  <div className="flex-1 border-b border-tea-border ml-1" />
                </button>
              )}

              {/* Solo date session group header (only when sortMode=recent and 2+ entries same day) */}
              {!group.eventId && group.dateGroup && group.entries.length > 1 && (
                <div className="flex items-center gap-2 mb-1.5 mt-3 first:mt-0 px-1">
                  <Calendar size={12} className="text-tea-text-dim shrink-0" />
                  <span className="text-[11px] font-medium text-tea-text-dim font-serif">{group.dateGroup}</span>
                  <div className="flex-1 border-b border-tea-border ml-1" />
                </div>
              )}

              {/* Entries */}
              <div className={`space-y-2 ${(group.eventId || (!group.eventId && group.dateGroup && group.entries.length > 1)) ? 'ml-1 pl-3 border-l border-tea-border' : ''}`}>
                {group.entries.map(entry => {
                  const isExpanded = expandedId === entry.id;
                  const allNotes = flattenTastingNotes(entry.tasting);
                  const previewNotes = allNotes.slice(0, 3);
                  const typeColor = entry.teaType ? getTeaColor(entry.teaType) : null;
                  const rating = entry.tasting.rating ?? entry.rating ?? 0;
                  const liquorColorTerms = entry.tasting['liquor-color'];
                  const firstColorHex = liquorColorTerms?.[0] ? LIQUOR_COLORS[liquorColorTerms[0]] : null;
                  const totalForTea = tastingCountByTeaId.get(entry.teaId) || 1;
                  const ordinal = tastingOrdinal.get(entry.id) || 1;
                  const ordSuffix = ordinal === 1 ? 'st' : ordinal === 2 ? 'nd' : ordinal === 3 ? 'rd' : 'th';

                  return (
                    <div
                      key={entry.id}
                      className="bg-tea-surface/40 rounded-lg overflow-hidden"
                      style={typeColor ? { borderLeft: `2.5px solid color-mix(in srgb, ${typeColor} 25%, transparent)` } : undefined}
                    >
                      {/* Card header */}
                      <button onClick={() => setExpandedId(isExpanded ? null : entry.id)} className="w-full text-left p-3.5 hover:bg-tea-elevated transition-colors">
                        <div className="flex items-start gap-3">
                          {/* Thumbnail: product image → liquor color swatch → BookOpen fallback */}
                          {(() => {
                            const swatch = entry.teaImage ? (
                              <img src={entry.teaImage} alt="" className="w-11 h-11 rounded-lg object-cover" />
                            ) : firstColorHex ? (
                              <div className="w-11 h-11 rounded-lg shadow-inner" style={{ backgroundColor: firstColorHex }} />
                            ) : (
                              <div className="w-11 h-11 rounded-lg bg-tea-surface flex items-center justify-center">
                                <BookOpen size={16} className="text-tea-text-dim" />
                              </div>
                            );
                            return onOrderTea ? (
                              <button onClick={(e) => { e.stopPropagation(); onOrderTea(entry.teaId); }} className="shrink-0">{swatch}</button>
                            ) : (
                              <div className="shrink-0">{swatch}</div>
                            );
                          })()}

                          <div className="flex-1 min-w-0">
                            {/* Name row */}
                            <div className="flex items-center gap-2 mb-0.5">
                              {onOrderTea ? (
                                <button onClick={(e) => { e.stopPropagation(); onOrderTea(entry.teaId); }} className="text-sm font-serif text-tea-text hover:text-tea-accent truncate transition-colors text-left">
                                  {entry.teaName}
                                </button>
                              ) : (
                                <span className="text-sm font-serif text-tea-text truncate">{entry.teaName}</span>
                              )}
                              {entry.teaType && <span className="text-[9px] text-tea-text-dim shrink-0">{entry.teaType}</span>}
                              {entry.tasting.mood && <span className="text-[9px] text-tea-text-dim/60 italic shrink-0">{entry.tasting.mood}</span>}
                            </div>

                            {/* Impression — the "one-word" felt signature */}
                            {entry.tasting.overallImpression && (
                              <div className="text-[13px] text-tea-text-sec font-serif italic leading-snug mb-1">
                                {entry.tasting.overallImpression}
                              </div>
                            )}

                            {/* Date + rating + huiGan + ordinal row */}
                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                              <span className="text-[10px] text-tea-text-dim">{formatRelativeDate(entry.createdAt)}</span>
                              {totalForTea > 1 && (
                                <span className="text-[9px] text-tea-text-dim/60">{ordinal}{ordSuffix} tasting</span>
                              )}
                              {rating > 0 && (
                                <span className="text-[11px] font-semibold tabular-nums" style={typeColor ? { color: typeColor } : undefined}>
                                  {rating}/10
                                </span>
                              )}
                              {entry.tasting.huiGan && (
                                <span className="text-[10px] text-tea-gold font-medium" title="Returning sweetness (回甘)">回甘</span>
                              )}
                              {entry.eventId && (
                                <button onClick={(e) => { e.stopPropagation(); navigate(`/events/${entry.eventId}`); }} className="badge-status badge-status-gold hover:opacity-80 transition-opacity cursor-pointer">
                                  <Calendar size={9} />
                                  {entry.eventTitle || 'Event'}
                                </button>
                              )}
                            </div>

                            {/* Primary notes */}
                            {entry.tasting.primaryNotes && entry.tasting.primaryNotes.length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-1">
                                {entry.tasting.primaryNotes.map(termId => {
                                  const Icon = resolveTermIcon(termId);
                                  return <span key={termId} className="tag"><Icon size={12} />{resolveTermLabel(termId)}</span>;
                                })}
                              </div>
                            )}

                            {/* Preview notes */}
                            <div className="flex flex-wrap gap-1">
                              {previewNotes.filter(t => !entry.tasting.primaryNotes?.includes(t)).slice(0, 3).map(termId => {
                                const Icon = resolveTermIcon(termId);
                                return <span key={termId} className="tag"><Icon size={10} />{resolveTermLabel(termId)}</span>;
                              })}
                              {allNotes.length > 3 && <span className="badge-status text-[10px]">+{allNotes.length - 3}</span>}
                            </div>
                          </div>
                        </div>
                      </button>

                      {/* Expanded detail */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="px-3.5 pb-3.5 border-t border-tea-border pt-3 space-y-2">
                              {/* Tasting profile */}
                              <TastingProfileStrip value={entry.tasting} onRemove={() => {}} />

                              {/* Capture scores: quality / cleanliness / patience */}
                              {(entry.tasting.quality != null || entry.tasting.cleanliness != null || entry.tasting.patience != null) && (
                                <div className="flex items-center gap-2 text-[11px] text-tea-text-dim tabular-nums px-1">
                                  {entry.tasting.quality != null && <span>Quality {entry.tasting.quality}</span>}
                                  {entry.tasting.quality != null && (entry.tasting.cleanliness != null || entry.tasting.patience != null) && <span>·</span>}
                                  {entry.tasting.cleanliness != null && <span>Cleanliness {entry.tasting.cleanliness}</span>}
                                  {entry.tasting.cleanliness != null && entry.tasting.patience != null && <span>·</span>}
                                  {entry.tasting.patience != null && <span>Patience {entry.tasting.patience}</span>}
                                </div>
                              )}

                              {/* Voice note — PLATFORM PRIVILEGED ONLY */}
                              {isPlatformPrivileged && entry.tasting.voiceNote?.trim() && (
                                <div className="flex items-start gap-2 px-2 py-2 rounded-md bg-tea-gold/5">
                                  <Mic size={12} className="text-tea-gold shrink-0 mt-0.5" />
                                  <div className="text-[11px] text-tea-text-sec italic leading-relaxed">
                                    {entry.tasting.voiceNote}
                                  </div>
                                </div>
                              )}

                              {/* Personal note */}
                              {entry.personalNote && (
                                <div className="text-[11px] text-tea-text-dim italic px-1">
                                  "{entry.personalNote}"
                                </div>
                              )}

                              {/* Actions */}
                              <div className="flex items-center gap-2 pt-1">
                                {onOrderTea && (
                                  <button onClick={() => onOrderTea(entry.teaId)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-tea-gold/10 text-tea-gold hover:bg-tea-gold/20 transition-colors">
                                    <ExternalLink size={12} />
                                    Find this tea
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDelete(entry.id)}
                                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${confirmDelete === entry.id ? 'bg-red-500/15 text-red-400' : 'text-tea-text-dim hover:text-tea-text hover:bg-tea-elevated'}`}
                                >
                                  <Trash2 size={12} />
                                  {confirmDelete === entry.id ? 'Confirm' : 'Delete'}
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
