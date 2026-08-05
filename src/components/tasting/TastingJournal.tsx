import React, { useState, useMemo } from 'react';
import { Archive, RotateCcw, BookOpen, Calendar, Filter, Search, X, Mic, Share2 } from 'lucide-react';
import { TastingCardModal } from './TastingCard';
import { motion, AnimatePresence } from 'framer-motion';
import Fuse from 'fuse.js';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../lib/store';
import { getTeaColor, getTeaVividColor } from '../../designTokens';
import { TastingProfileStrip } from './TastingProfileStrip';
import { usePlatformPrivilege } from '../../lib/permissions';
import { formatRelativeDate, getDateGroup } from '../TeaCompass/BrowseCard';
import type { CustomerTasting } from '../../types';
import { entryEvent, latestTasting } from '../../lib/tastingAccessors';
import { flattenTastingNotes, resolveTermLabel, resolveTermIcon, LIQUOR_COLORS } from '../../data/tastingTaxonomy';
import { JournalSectionVoiceNote } from './JournalSectionVoiceNote';
import { api } from '../../lib/api';
import { persistTastingJournalEntry } from '../../lib/tastingJournalSync';

interface TastingJournalProps {
  onBack: () => void;
  onOrderTea?: (productId: string) => void;
}

type EventFilter = 'all' | 'event-only' | 'no-events';
type SortMode = 'recent' | 'rating' | 'type';

export const TastingJournal: React.FC<TastingJournalProps> = ({ onBack, onOrderTea }) => {
  const { tastingJournal, updateTasting } = useAppStore();
  const navigate = useNavigate();
  const isPlatformPrivileged = usePlatformPrivilege();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [shareCardEntry, setShareCardEntry] = useState<CustomerTasting | null>(null);
  const [eventFilter, setEventFilter] = useState<EventFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [starredSections, setStarredSections] = useState<Record<string, boolean>>({});
  const [pendingSections, setPendingSections] = useState<Record<string, boolean>>({});
  const [sectionErrors, setSectionErrors] = useState<Record<string, string | null>>({});

  const handleShare = (entry: CustomerTasting) => {
    setShareCardEntry(entry);
  };

  // Pre-derive per-entry event metadata so memoized blocks below can read it cheaply.
  const eventByEntryId = useMemo(() => {
    const m = new Map<string, ReturnType<typeof entryEvent>>();
    for (const e of tastingJournal) m.set(e.id, entryEvent(e));
    return m;
  }, [tastingJournal]);

  const hasEventTastings = useMemo(
    () => tastingJournal.some(e => !!eventByEntryId.get(e.id)?.eventId),
    [tastingJournal, eventByEntryId]
  );

  const uniqueTypes = useMemo(() => {
    const types = [...new Set(tastingJournal.map(e => e.productType).filter(Boolean))];
    return types.length > 1 ? types : [];
  }, [tastingJournal]);

  const stats = useMemo(() => {
    if (tastingJournal.length < 3) return null;
    const ratings = tastingJournal
      .map(e => e.note.tasting.rating ?? e.note.rating ?? 0)
      .filter(r => r > 0);
    const avgRating = ratings.length > 0
      ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)
      : null;
    const typeCounts = new Map<string, number>();
    for (const e of tastingJournal) {
      if (e.productType) typeCounts.set(e.productType, (typeCounts.get(e.productType) || 0) + 1);
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
      { name: 'productName', weight: 2 },
      { name: 'productType', weight: 1 },
      { name: 'note.personalNote', weight: 0.5 },
    ],
    threshold: 0.35,
    includeScore: true,
  }), [tastingJournal]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    return new Set(fuseInstance.search(searchQuery.trim()).map(r => r.item.id));
  }, [searchQuery, fuseInstance]);

  const filteredEntries = useMemo(() => {
    let result = tastingJournal.filter(e => showArchived ? !!e.archived : !e.archived);
    if (searchResults !== null) result = result.filter(e => searchResults.has(e.id));
    if (eventFilter === 'event-only') result = result.filter(e => !!eventByEntryId.get(e.id)?.eventId);
    else if (eventFilter === 'no-events') result = result.filter(e => !eventByEntryId.get(e.id)?.eventId);
    if (typeFilter) result = result.filter(e => e.productType === typeFilter);
    if (sortMode === 'rating') {
      result = [...result].sort((a, b) => {
        const ra = a.note.tasting.rating ?? a.note.rating ?? 0;
        const rb = b.note.tasting.rating ?? b.note.rating ?? 0;
        return rb - ra;
      });
    } else if (sortMode === 'type') {
      result = [...result].sort((a, b) => (a.productType || '').localeCompare(b.productType || ''));
    }
    return result;
  }, [tastingJournal, showArchived, eventFilter, searchResults, typeFilter, sortMode, eventByEntryId]);

  const groupedEntries = useMemo(() => {
    const groups: {
      eventId: string | null;
      eventSlug: string | null;
      eventTitle: string | null;
      date: string | null;
      dateGroup: string | null;
      entries: CustomerTasting[];
    }[] = [];
    const eventMap = new Map<string, typeof groups[number]>();

    for (const entry of filteredEntries) {
      const ev = eventByEntryId.get(entry.id) || {};
      if (ev.eventId) {
        const existing = eventMap.get(ev.eventId);
        if (existing) {
          existing.entries.push(entry);
        } else {
          const group = { eventId: ev.eventId, eventSlug: ev.eventSlug || null, eventTitle: ev.eventTitle || 'Event', date: entry.createdAt, dateGroup: null, entries: [entry] };
          eventMap.set(ev.eventId, group);
          groups.push(group);
        }
      } else if (sortMode === 'recent') {
        const dg = getDateGroup(entry.createdAt);
        const lastGroup = groups[groups.length - 1];
        if (lastGroup && !lastGroup.eventId && lastGroup.dateGroup === dg) {
          lastGroup.entries.push(entry);
        } else {
          groups.push({ eventId: null, eventSlug: null, eventTitle: null, date: entry.createdAt, dateGroup: dg, entries: [entry] });
        }
      } else {
        groups.push({ eventId: null, eventSlug: null, eventTitle: null, date: null, dateGroup: null, entries: [entry] });
      }
    }
    return groups;
  }, [filteredEntries, sortMode, eventByEntryId]);

  const handleArchive = (id: string) => {
    updateTasting(id, { archived: true });
    if (expandedId === id) setExpandedId(null);
  };

  const handleRestore = (id: string) => {
    updateTasting(id, { archived: false });
  };

  const updateSectionText = (entry: CustomerTasting, tastingId: string, text: string) => {
    const tastings = entry.tastings.map(tasting => tasting.id === tastingId
      ? { ...tasting, tasting: { ...tasting.tasting, voiceNote: text } }
      : tasting);
    const latestId = entry.tastings[entry.tastings.length - 1]?.id;
    updateTasting(entry.id, {
      tastings,
      ...(latestId === tastingId ? {
        note: {
          ...entry.note,
          tasting: { ...entry.note.tasting, voiceNote: text },
          personalNote: text || undefined,
          updatedAt: new Date().toISOString(),
        },
      } : {}),
    });
  };

  const changeSectionStar = async (entry: CustomerTasting, tastingId: string, text: string, next: boolean) => {
    const key = `${entry.id}:${tastingId}`;
    const previous = !!starredSections[key];
    setStarredSections(value => ({ ...value, [key]: next }));
    setPendingSections(value => ({ ...value, [key]: true }));
    setSectionErrors(value => ({ ...value, [key]: null }));
    try {
      if (next) {
        const currentEntry = useAppStore.getState().tastingJournal.find(item => item.id === entry.id) ?? entry;
        const tasting = currentEntry.tastings.find(item => item.id === tastingId)?.tasting;
        await persistTastingJournalEntry(currentEntry);
        await api.tastingJournal.starCandidate(currentEntry.id, tastingId, { source_text: text, source_tasting: tasting });
      } else {
        await api.tastingJournal.unstarCandidate(entry.id, tastingId);
      }
    } catch (cause: unknown) {
      setStarredSections(value => ({ ...value, [key]: previous }));
      setSectionErrors(value => ({ ...value, [key]: cause instanceof Error ? cause.message : 'Could not update this private review note.' }));
    } finally {
      setPendingSections(value => ({ ...value, [key]: false }));
    }
  };

  const archivedCount = useMemo(
    () => tastingJournal.filter(e => e.archived).length,
    [tastingJournal]
  );

  return (
    <>
    <AnimatePresence>
      {shareCardEntry && (
        <TastingCardModal
          key="tasting-card-modal"
          entry={shareCardEntry}
          onClose={() => setShareCardEntry(null)}
        />
      )}
    </AnimatePresence>
    <div className="flex flex-col h-full surface-warm">
      {/* Header */}
      <header className="px-4 pt-4 pb-3 border-b border-tea-border">
        <div className="flex items-center gap-2.5 mb-1">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-tea-gold shrink-0">
            <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2zm20 0h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/>
          </svg>
          <h2 className="font-serif text-base font-normal text-tea-text flex-1">Tasting Journal</h2>
          <span className="text-ui-10 text-tea-text-dim tabular-nums">
            {tastingJournal.filter(e => !e.archived).length} {tastingJournal.filter(e => !e.archived).length === 1 ? 'tea' : 'teas'}
          </span>
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
              className="w-full bg-tea-surface/60 text-tea-text text-ui-13 rounded-xl pl-8 pr-8 py-2 outline-none placeholder:text-tea-text-dim focus:ring-1 focus:ring-tea-gold/40"
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
          <div className="text-ui-11 text-tea-text-dim tabular-nums mb-1 px-0.5 font-feature-settings-tnum">
            {stats.count} teas{stats.avgRating && <> · Avg {stats.avgRating}/10</>}{stats.topType && <> · Top: {stats.topType}</>}
          </div>
        )}

        {/* Empty states */}
        {tastingJournal.length === 0 ? (
          <div className="text-center py-20 animate-[fadeIn_0.4s_ease-out]">
            <div className="w-20 h-20 rounded-full bg-tea-gold/8 flex items-center justify-center mx-auto mb-5 shadow-[0_0_30px_var(--tea-accent-sub)]">
              <BookOpen className="w-9 h-9 text-tea-gold/30" />
            </div>
            <h3 className="font-serif text-lg text-tea-text mb-1.5 tracking-wide">No teas yet</h3>
            <p className="text-ui-13 text-tea-text-sec text-center max-w-[240px] mx-auto leading-relaxed font-serif">
              The teas you taste will show up here. Come back to write what you noticed.
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
                <button onClick={() => navigate(`/event/${group.eventSlug || group.eventId}`)} className="flex items-center gap-2 mb-1.5 mt-3 first:mt-0 px-1 group w-full text-left">
                  <Calendar size={12} className="text-tea-gold shrink-0" />
                  <span className="text-ui-11 font-medium text-tea-gold font-serif group-hover:text-tea-gold-lt transition-colors truncate">
                    {group.eventTitle}
                  </span>
                  {group.date && <span className="text-ui-10 text-tea-text-dim shrink-0">{formatRelativeDate(group.date)}</span>}
                  <div className="flex-1 border-b border-tea-border ml-1" />
                </button>
              )}

              {/* Solo date session group header (only when sortMode=recent and 2+ entries same day) */}
              {!group.eventId && group.dateGroup && group.entries.length > 1 && (
                <div className="flex items-center gap-2 mb-1.5 mt-3 first:mt-0 px-1">
                  <Calendar size={12} className="text-tea-text-dim shrink-0" />
                  <span className="text-ui-11 font-medium text-tea-text-dim font-serif">{group.dateGroup}</span>
                  <div className="flex-1 border-b border-tea-border ml-1" />
                </div>
              )}

              {/* Entries */}
              <div className={`space-y-2 ${(group.eventId || (!group.eventId && group.dateGroup && group.entries.length > 1)) ? 'ml-1 pl-3 border-l border-tea-border' : ''}`}>
                {group.entries.map(entry => {
                  const isExpanded = expandedId === entry.id;
                  const noteData = entry.note.tasting;
                  const allNotes = flattenTastingNotes(noteData);
                  const previewNotes = allNotes.slice(0, 3);
                  const typeColor = entry.productType ? getTeaColor(entry.productType) : null;
                  const typeVividColor = entry.productType ? getTeaVividColor(entry.productType) : null;
                  const rating = noteData.rating ?? entry.note.rating ?? 0;
                  const liquorColorTerms = noteData['liquor-color'];
                  const firstColorHex = liquorColorTerms?.[0] ? LIQUOR_COLORS[liquorColorTerms[0]] : null;
                  const ev = eventByEntryId.get(entry.id) || {};
                  const tastingsCount = entry.tastings.length;
                  const latest = latestTasting(entry);

                  return (
                    <div
                      key={entry.id}
                      className="bg-tea-surface/60 rounded-xl overflow-hidden"
                    >
                      {typeColor && (
                        <div style={{ height: 2, background: `linear-gradient(90deg, ${typeColor}cc, ${typeColor}20)` }} />
                      )}
                      {/* Card header */}
                      <button onClick={() => setExpandedId(isExpanded ? null : entry.id)} className="w-full text-left p-3.5 hover:bg-tea-elevated transition-colors">
                        <div className="flex items-start gap-3">
                          {/* Thumbnail: product image → type color swatch → liquor color swatch → BookOpen fallback */}
                          {(() => {
                            const swatch = entry.productImage ? (
                              <img src={entry.productImage} alt="" className="w-11 h-11 rounded-xl object-cover" loading="lazy" />
                            ) : typeVividColor ? (
                              <div className="w-11 h-11 rounded-xl" style={{ backgroundColor: typeVividColor, opacity: 0.75 }} />
                            ) : firstColorHex ? (
                              <div className="w-11 h-11 rounded-xl shadow-inner" style={{ backgroundColor: firstColorHex }} />
                            ) : (
                              <div className="w-11 h-11 rounded-xl bg-tea-surface flex items-center justify-center">
                                <BookOpen size={16} className="text-tea-text-dim" />
                              </div>
                            );
                            const linkable = !!onOrderTea && !!entry.productId;
                            return linkable ? (
                              <button
                                onClick={(e) => { e.stopPropagation(); onOrderTea!(entry.productId); }}
                                aria-label={`Open ${entry.productName}`}
                                className="shrink-0 rounded-xl ring-1 ring-transparent hover:ring-tea-gold/30 transition-[box-shadow,transform] duration-150 active:scale-[0.98]"
                              >
                                {swatch}
                              </button>
                            ) : (
                              <div className="shrink-0">{swatch}</div>
                            );
                          })()}

                          <div className="flex-1 min-w-0">
                            {/* Name row */}
                            <div className="flex items-center gap-2 mb-0.5">
                              {onOrderTea && entry.productId ? (
                                <button
                                  onClick={(e) => { e.stopPropagation(); onOrderTea(entry.productId); }}
                                  className="group/tealink inline-flex items-baseline gap-1 text-sm font-serif text-tea-text hover:text-tea-gold focus-visible:text-tea-gold focus-visible:outline-none transition-colors text-left min-w-0"
                                >
                                  <span className="truncate">{entry.productName}</span>
                                  <span
                                    aria-hidden="true"
                                    className="text-ui-10 text-tea-gold-lt shrink-0 transition-all duration-200 ease-out lg:opacity-0 lg:-translate-x-1 lg:group-hover/tealink:opacity-100 lg:group-hover/tealink:translate-x-0 lg:group-focus-visible/tealink:opacity-100 lg:group-focus-visible/tealink:translate-x-0"
                                    style={{ fontFamily: 'var(--font-display)', fontWeight: 300 }}
                                  >
                                    →
                                  </span>
                                </button>
                              ) : (
                                <span className="text-sm font-serif text-tea-text truncate">{entry.productName}</span>
                              )}
                              {entry.productType && <span className="text-ui-9 text-tea-text-dim shrink-0">{entry.productType}</span>}
                              {noteData.mood && <span className="text-ui-9 text-tea-text-dim/60 italic shrink-0">{noteData.mood}</span>}
                            </div>

                            {/* Impression */}
                            {noteData.overallImpression && (
                              <div className="text-ui-13 text-tea-text-sec font-serif italic leading-snug mb-1.5">
                                &ldquo;{noteData.overallImpression}&rdquo;
                              </div>
                            )}

                            {/* Date + rating + huiGan + tastings count row */}
                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                              <span className="text-ui-10 text-tea-text-dim">{formatRelativeDate(entry.note.updatedAt || entry.createdAt)}</span>
                              {tastingsCount > 1 && (
                                <span className="text-ui-9 text-tea-text-dim/60">{tastingsCount} tastings</span>
                              )}
                              {rating > 0 && (
                                <span className="text-ui-11 font-semibold tabular-nums" style={typeColor ? { color: typeColor } : undefined}>
                                  {rating}/10
                                </span>
                              )}
                              {noteData.huiGan && (
                                <span className="text-ui-10 text-tea-gold font-medium" title="Returning sweetness (回甘)">回甘</span>
                              )}
                              {ev.eventId && (
                                <button onClick={(e) => { e.stopPropagation(); navigate(`/event/${ev.eventSlug || ev.eventId}`); }} className="badge-status badge-status-gold hover:opacity-80 transition-opacity cursor-pointer">
                                  <Calendar size={9} />
                                  {ev.eventTitle || 'Event'}
                                </button>
                              )}
                            </div>

                            {/* Primary notes */}
                            {noteData.primaryNotes && noteData.primaryNotes.length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-1">
                                {noteData.primaryNotes.map(termId => {
                                  const Icon = resolveTermIcon(termId);
                                  return <span key={termId} className="tag"><Icon size={12} />{resolveTermLabel(termId)}</span>;
                                })}
                              </div>
                            )}

                            {/* Preview notes */}
                            <div className="flex flex-wrap gap-1">
                              {previewNotes.filter(t => !noteData.primaryNotes?.includes(t)).slice(0, 3).map(termId => {
                                const Icon = resolveTermIcon(termId);
                                return <span key={termId} className="tag"><Icon size={10} />{resolveTermLabel(termId)}</span>;
                              })}
                              {allNotes.length > 3 && <span className="badge-status text-ui-10">+{allNotes.length - 3}</span>}
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
                              {/* Tasting profile from the synthesized note */}
                              <TastingProfileStrip value={noteData} onRemove={() => {}} variant="cloud" />

                              {/* Quality bar + secondary scores */}
                              {noteData.quality != null && (
                                <div className="flex items-center gap-2 pt-0.5">
                                  <div className="flex-1 h-[3px] rounded-full overflow-hidden bg-tea-elevated">
                                    <div
                                      className="h-full rounded-full"
                                      // Two hex fallbacks behind two variable names the
                                      // palette has never declared (`--color-tea-gold-lt`,
                                      // `--color-tea-gold`), so this bar has always painted
                                      // the fallbacks. It has not even painted those: the
                                      // stray `80` left over from a stripped `#d4ac6680`
                                      // alpha suffix sits outside the `var()` call, which
                                      // makes the whole declaration invalid and drops the
                                      // gradient. Real tokens, valid syntax, same intent.
                                      style={{ width: `${noteData.quality * 10}%`, background: 'linear-gradient(90deg, rgb(var(--tea-gold-lt-rgb) / 0.5), var(--tea-gold))' }}
                                    />
                                  </div>
                                  <span className="text-ui-10 text-tea-text-dim tabular-nums shrink-0">Quality {noteData.quality}</span>
                                </div>
                              )}
                              {(noteData.cleanliness != null || noteData.patience != null) && (
                                <div className="flex items-center gap-2 text-ui-10 text-tea-text-dim tabular-nums px-0.5">
                                  {noteData.cleanliness != null && <span>Cleanliness {noteData.cleanliness}</span>}
                                  {noteData.cleanliness != null && noteData.patience != null && <span>·</span>}
                                  {noteData.patience != null && <span>Patience {noteData.patience}</span>}
                                </div>
                              )}

                              {/* Voice note from the most recent tasting (platform-privileged only) */}
                              {isPlatformPrivileged && latest.tasting.voiceNote?.trim() && (
                                <div className="flex items-start gap-2 px-2 py-2 rounded-md bg-tea-gold/5">
                                  <Mic size={12} className="text-tea-gold shrink-0 mt-0.5" />
                                  <div className="text-ui-11 text-tea-text-sec italic leading-relaxed">
                                    {latest.tasting.voiceNote}
                                  </div>
                                </div>
                              )}

                              <JournalSectionVoiceNote
                                text={latest.tasting.voiceNote || ''}
                                starred={!!starredSections[`${entry.id}:${latest.id}`]}
                                starPending={!!pendingSections[`${entry.id}:${latest.id}`]}
                                error={sectionErrors[`${entry.id}:${latest.id}`]}
                                onTextChange={text => updateSectionText(entry, latest.id, text)}
                                onStarChange={starred => changeSectionStar(entry, latest.id, latest.tasting.voiceNote || '', starred)}
                              />

                              {/* Personal note */}
                              {entry.note.personalNote && (
                                <div className="text-ui-11 text-tea-text-dim italic px-1">
                                  "{entry.note.personalNote}"
                                </div>
                              )}

                              {/* Past tastings timeline. Shown when this tea has been tasted more than once. */}
                              {entry.tastings.length > 1 && (
                                <div className="mt-2 pt-2 border-t border-tea-border space-y-1.5">
                                  <div className="text-ui-10 uppercase tracking-[0.15em] text-tea-text-dim px-1" style={{ fontFamily: 'var(--font-display)' }}>
                                    Past tastings
                                  </div>
                                  {[...entry.tastings].reverse().map(t => (
                                    <div key={t.id} className="px-1 py-1 text-ui-11 leading-snug">
                                      <div className="flex items-baseline gap-2 text-tea-text-sec">
                                        <span className="text-ui-10 text-tea-text-dim">{formatRelativeDate(t.createdAt)}</span>
                                        {t.eventTitle && <span className="text-ui-10 italic text-tea-text-dim">at {t.eventTitle}</span>}
                                      </div>
                                      {t.reason && (
                                        <div className="italic text-tea-text-sec mt-0.5">
                                          "{t.reason}"
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Actions */}
                              <div className="flex border-t border-tea-border mt-1 pt-2">
                                <button
                                  onClick={() => handleShare(entry)}
                                  className="flex flex-1 items-center justify-center gap-1.5 py-1.5 text-ui-11 font-medium text-tea-text-dim hover:text-tea-text transition-colors border-r border-tea-border"
                                >
                                  <Share2 size={11} />
                                  Share card
                                </button>
                                {showArchived ? (
                                  <button
                                    onClick={() => handleRestore(entry.id)}
                                    className="flex flex-1 items-center justify-center gap-1.5 py-1.5 text-ui-11 font-medium text-tea-text-dim hover:text-tea-text transition-colors"
                                  >
                                    <RotateCcw size={11} />
                                    Restore
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleArchive(entry.id)}
                                    className="flex flex-1 items-center justify-center gap-1.5 py-1.5 text-ui-11 font-medium text-tea-text-dim hover:text-tea-text transition-colors"
                                  >
                                    <Archive size={11} />
                                    Archive
                                  </button>
                                )}
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

        {/* Archived entries toggle */}
        {(archivedCount > 0 || showArchived) && (
          <div className="px-4 py-5 flex justify-center">
            <button
              type="button"
              onClick={() => setShowArchived(prev => !prev)}
              className="flex items-center gap-1.5 text-ui-11 text-tea-text-dim hover:text-tea-text-sec transition-colors"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              <Archive size={11} />
              {showArchived
                ? 'Back to journal'
                : `${archivedCount} archived ${archivedCount === 1 ? 'entry' : 'entries'}`}
            </button>
          </div>
        )}
      </div>
    </div>
    </>
  );
};
