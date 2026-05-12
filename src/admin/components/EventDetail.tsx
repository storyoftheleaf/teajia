import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Check, Lock, Edit3, Loader2, Users, Clock, MapPin, Share2, Bell, Star, Upload, MoreHorizontal, X, ChevronDown, Save, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useEvent, useAttendees } from '../hooks/useEventData';
import { useToast } from './Toast';
import { EventForm } from './EventForm';
import { AttendeeTable } from './AttendeeTable';
import { TeaMenuEditor } from './TeaMenuEditor';
import { NotificationPanel } from './NotificationPanel';
import { PostSessionEditor } from './PostSessionEditor';
import { ApprovalCard } from './ApprovalCard';
import { BriefingCardsEditor } from './BriefingCardsEditor';
import { ReminderTimeline } from './ReminderTimeline';
import { ShareSheet } from './ShareSheet';
import { EventStatus, BriefingCard, TastingNote, Venue } from '../../types/events';
import { VenueManager } from './VenueManager';
import { STATUS_PILL_BASE, STATUS_PILL_VARIANTS, type StatusPillVariant } from '../constants';

const statusToVariant = (status: EventStatus): StatusPillVariant => {
  switch (status) {
    case 'active': return 'active';
    case 'archived': return 'archived';
    case 'completed': return 'success';
    case 'closed': return 'archived';
    case 'draft':
    default: return 'draft';
  }
};

type TabKey = 'requests' | 'attendees' | 'briefing' | 'tea-menu' | 'tasting-notes' | 'reminders' | 'notifications' | 'post-session' | 'venue' | 'interest';

// ── Feature 1: Promote event tasting note to tea review ──────────────────────

type VisibilityOption = 'private' | 'account' | 'network';

interface TastingNotesTabProps {
  notes: TastingNote[];
  eventId: string;
}

const TastingNotesTab: React.FC<TastingNotesTabProps> = ({ notes }) => {
  const { showToast } = useToast();
  const [promoting, setPromoting] = useState<string | null>(null);
  const [promoted, setPromoted] = useState<Set<string>>(new Set());
  const [confirmNote, setConfirmNote] = useState<TastingNote | null>(null);
  const [selectedVisibility, setSelectedVisibility] = useState<VisibilityOption>('account');
  const [batchPromoting, setBatchPromoting] = useState(false);

  if (notes.length === 0) {
    return (
      <div className="text-center py-12 text-tea-text-sec text-sm">
        <Star className="mx-auto mb-3 text-tea-text-dim" size={24} />
        <p>No tasting notes yet</p>
        <p className="text-xs text-tea-text-dim mt-1">Notes from guests appear here after they submit post-session feedback.</p>
      </div>
    );
  }

  const handlePromoteAll = async () => {
    const unpublished = notes.filter(n => !promoted.has(n.id) && !!n.teaName);
    if (unpublished.length === 0) return;
    setBatchPromoting(true);
    let successCount = 0;
    let failureCount = 0;
    for (const note of unpublished) {
      try {
        const teaKey = note.teaName!.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-');
        await api.teaReviews.create({ tea_key: teaKey, visibility: 'account', rating: note.rating, notes: note.impression, status: 'submitted' });
        setPromoted(prev => new Set(prev).add(note.id));
        successCount++;
      } catch {
        failureCount++;
      }
    }
    setBatchPromoting(false);
    if (successCount > 0) showToast(`Published ${successCount} review${successCount > 1 ? 's' : ''}`, 'success');
    if (failureCount > 0) showToast(`${failureCount} attendee${failureCount > 1 ? 's' : ''} could not be promoted`, 'error');
    else if (successCount === 0) showToast('Failed to publish reviews', 'error');
  };

  const handlePromote = async (note: TastingNote, visibility: VisibilityOption) => {
    if (!note.teaName) {
      showToast('This note has no associated tea — cannot promote', 'error');
      return;
    }
    setPromoting(note.id);
    try {
      const teaKey = note.teaName
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .replace(/-+/g, '-');
      await api.teaReviews.create({
        tea_key: teaKey,
        visibility,
        rating: note.rating,
        notes: note.impression,
        status: 'submitted',
      });
      setPromoted(prev => new Set(prev).add(note.id));
      showToast('Published as tea review', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to publish';
      showToast(msg, 'error');
    } finally {
      setPromoting(null);
      setConfirmNote(null);
    }
  };

  return (
    <div className="space-y-3 max-w-2xl">
      {(() => {
        const unpublishedCount = notes.filter(n => !promoted.has(n.id) && !!n.teaName).length;
        return unpublishedCount > 1 ? (
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs text-tea-text-dim">{unpublishedCount} publishable notes</span>
            <button
              type="button"
              onClick={handlePromoteAll}
              disabled={batchPromoting}
              className="flex items-center gap-1.5 text-xs text-tea-text-sec hover:text-tea-gold transition-colors disabled:opacity-40"
            >
              {batchPromoting ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
              Publish all as reviews
            </button>
          </div>
        ) : null;
      })()}
      {notes.map(note => {
        const isDone = promoted.has(note.id);
        return (
          <div
            key={note.id}
            className="py-4 border-b border-tea-border flex items-start gap-3"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-xs font-medium text-tea-text">{note.attendeeName || 'Guest'}</span>
                {note.teaName && (
                  <span className="text-ui-10 text-tea-text-dim">· {note.teaName}</span>
                )}
                {note.rating != null && (
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star
                        key={i}
                        size={11}
                        className={i < note.rating! ? 'text-tea-gold' : 'text-tea-text-dim/30'}
                        fill={i < note.rating! ? 'currentColor' : 'none'}
                      />
                    ))}
                  </div>
                )}
                {note.isFavorite && (
                  <span className="text-ui-9 text-tea-gold/70 uppercase tracking-[0.1em]">Favorite</span>
                )}
              </div>
              {note.impression && (
                <p className="text-xs text-tea-text-sec italic leading-relaxed">{note.impression}</p>
              )}
            </div>

            {/* Promote action */}
            <div className="shrink-0">
              {isDone ? (
                <span className="flex items-center gap-1 text-ui-10 text-tea-gold">
                  <Check size={10} /> Published
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmNote(note)}
                  disabled={promoting === note.id || !note.teaName}
                  title={!note.teaName ? 'No tea linked — cannot publish' : 'Publish as tea review'}
                  className="flex items-center gap-1 text-ui-10 text-tea-text-sec hover:text-tea-gold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {promoting === note.id
                    ? <Loader2 size={10} className="animate-spin" />
                    : <Upload size={10} />
                  }
                  Publish as review
                </button>
              )}
            </div>
          </div>
        );
      })}

      {/* Visibility confirmation modal */}
      <AnimatePresence>
        {confirmNote && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-modal flex items-center justify-center p-4"
          >
            <button type="button" aria-hidden onClick={() => setConfirmNote(null)} className="absolute inset-0 bg-tea-bg/70 backdrop-blur-[2px]" />
            <motion.div
              initial={{ scale: 0.95, y: 8 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 8 }}
              className="relative bg-tea-surface border border-tea-border rounded-xl shadow-2xl w-full max-w-sm"
            >
              <button
                onClick={() => setConfirmNote(null)}
                aria-label="Close"
                className="absolute top-4 right-4 text-tea-text-sec hover:text-tea-text transition-colors rounded-md p-1.5 tap-target"
              >
                <X size={16} />
              </button>
              <div className="px-6 pt-6 pb-3">
                <h3 className="h3 text-tea-text">Publish as tea review</h3>
                <p className="text-ui-13 text-tea-text-sec mt-1">
                  This will create a tea review from {confirmNote.attendeeName || 'Guest'}'s note
                  {confirmNote.teaName ? ` for ${confirmNote.teaName}` : ''}.
                </p>
              </div>

              <div className="px-6 pb-4 space-y-2">
                {(['private', 'account', 'network'] as VisibilityOption[]).map(v => (
                  <label key={v} className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="radio"
                      name="visibility"
                      value={v}
                      checked={selectedVisibility === v}
                      onChange={() => setSelectedVisibility(v)}
                      className="accent-tea-gold"
                    />
                    <span className="text-ui-13 text-tea-text capitalize">{v}</span>
                    <span className="text-ui-11 text-tea-text-dim">
                      {v === 'private' ? '(only you)' : v === 'account' ? '(your store only)' : '(visible across network)'}
                    </span>
                  </label>
                ))}
              </div>

              <div className="flex justify-between gap-2 px-6 py-4 border-t border-tea-border">
                <button
                  type="button"
                  onClick={() => setConfirmNote(null)}
                  className="px-2 py-1 text-xs text-tea-text-sec hover:text-tea-text transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handlePromote(confirmNote, selectedVisibility)}
                  disabled={!!promoting}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {promoting ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                  Publish
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ── End Feature 1 ────────────────────────────────────────────────────────────

function formatEventDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) +
      ' at ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  } catch {
    return dateStr;
  }
}

export const EventDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { data: event, isLoading, refetch: refetchEvent } = useEvent(id!);
  const { data: attendees = [], refetch: refetchAttendees } = useAttendees(id!);

  const [convertingInterest, setConvertingInterest] = useState(false);
  const { data: interestData, refetch: refetchInterest } = useQuery<{ signups: any[] }>({
    queryKey: ['event-interest', id],
    queryFn: () => api.events.getInterestSignups(id!),
    enabled: !!id,
    staleTime: 30_000,
  });
  const interestSignups = interestData?.signups ?? [];

  const handleConvertInterest = async () => {
    setConvertingInterest(true);
    try {
      const result: any = await api.events.convertInterestToRsvp(id!);
      showToast(`${result.converted ?? 0} signup${result.converted === 1 ? '' : 's'} converted to RSVPs`, 'success');
      refetchInterest();
      refetchAttendees();
    } catch (err: any) {
      showToast(err.message || 'Failed to convert', 'error');
    } finally {
      setConvertingInterest(false);
    }
  };

  const [searchParams, setSearchParams] = useSearchParams();
  const VALID_TABS: TabKey[] = ['requests', 'attendees', 'tasting-notes', 'briefing', 'tea-menu', 'reminders', 'notifications', 'post-session', 'venue', 'interest'];
  const rawTab = searchParams.get('tab') as TabKey;
  const activeTab: TabKey = VALID_TABS.includes(rawTab) ? rawTab : 'requests';
  const setActiveTab = (key: TabKey) => { setSearchParams(params => { params.set('tab', key); return params; }, { replace: true }); setOverflowOpen(false); };
  const [overflowOpen, setOverflowOpen] = useState(false);
  const overflowRef = useRef<HTMLDivElement>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [closingRsvp, setClosingRsvp] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [savingBriefing, setSavingBriefing] = useState(false);
  const [briefingCards, setBriefingCards] = useState<BriefingCard[] | null>(null);

  // Venue tab state
  const [venues, setVenues] = useState<Venue[]>([]);
  const [selectedVenueId, setSelectedVenueId] = useState('');
  const [selectedSpaceIds, setSelectedSpaceIds] = useState<string[]>([]);
  const [savingVenue, setSavingVenue] = useState(false);
  const [isVenueManagerOpen, setIsVenueManagerOpen] = useState(false);
  const loadVenues = () => { api.venues.list().then(setVenues).catch(() => { showToast('Could not load venues', 'error'); }); };

  const { data: tastingNotes = [] } = useQuery<TastingNote[]>({
    queryKey: ['event-tasting-notes', id],
    queryFn: () => api.events.getTastingNotes(id!),
    enabled: !!id,
  });

  useEffect(() => {
    if (event && briefingCards === null) {
      setBriefingCards(event.briefingCards ?? []);
    }
  }, [event?.id]);

  useEffect(() => {
    loadVenues();
  }, []);

  useEffect(() => {
    if (event) {
      setSelectedVenueId(event.venueId ?? '');
      setSelectedSpaceIds(event.activeSpaceIds ?? []);
    }
  }, [event?.id]);

  useEffect(() => {
    if (!overflowOpen) return;
    const handler = (e: MouseEvent) => {
      if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) {
        setOverflowOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [overflowOpen]);

  if (isLoading || !event) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-tea-text-sec" size={24} />
      </div>
    );
  }

  const localBriefingCards = briefingCards ?? event.briefingCards ?? [];

  const confirmedCount = attendees.filter(a => a.status === 'confirmed').length;
  const waitlistCount = attendees.filter(a => a.status === 'waitlist').length;
  const requestedCount = attendees.filter(a => a.status === 'requested').length;

  const selectedVenueObj = venues.find(v => v.id === selectedVenueId);

  const handleSaveVenue = async () => {
    setSavingVenue(true);
    try {
      await api.events.update(event.id, {
        venue_id: selectedVenueId || null,
        active_space_ids: selectedSpaceIds.length > 0 ? JSON.stringify(selectedSpaceIds) : null,
        location_name: selectedVenueObj?.name || null,
        address_text: selectedVenueObj?.address || null,
        map_link: selectedVenueObj?.mapLink || null,
        area_hint: selectedVenueObj?.areaHint || null,
      });
      showToast('Venue saved', 'success');
      refetchEvent();
    } catch (err: any) {
      showToast(err.message || 'Failed to save venue', 'error');
    } finally {
      setSavingVenue(false);
    }
  };

  const handleSaveBriefing = async () => {
    setSavingBriefing(true);
    try {
      await api.events.update(event.id, {
        briefing_cards: JSON.stringify(localBriefingCards),
      });
      showToast('Briefing cards saved', 'success');
      refetchEvent();
    } catch (err: any) {
      showToast(err.message || 'Failed to save', 'error');
    } finally {
      setSavingBriefing(false);
    }
  };

  const PRIMARY_TABS: { key: TabKey; label: string; badge?: number }[] = [
    { key: 'requests', label: 'Requests', badge: requestedCount },
    { key: 'attendees', label: 'Attendees' },
    { key: 'briefing', label: 'Briefing' },
    { key: 'tasting-notes', label: 'Tasting Notes', badge: tastingNotes.length || undefined },
  ];

  const OVERFLOW_TABS: { key: TabKey; label: string; badge?: number }[] = [
    { key: 'interest', label: 'Interest', badge: interestSignups.filter(s => !s.converted_at).length || undefined },
    { key: 'venue', label: 'Venue' },
    { key: 'tea-menu', label: 'Tea Menu' },
    { key: 'reminders', label: 'Reminders' },
    { key: 'notifications', label: 'Notifications' },
    { key: 'post-session', label: 'Post-Session' },
  ];

  const overflowActive = OVERFLOW_TABS.some(t => t.key === activeTab);

  return (
    <div className="p-6 max-w-3xl mx-auto overflow-x-hidden">
      {/* Back button */}
      <button
        onClick={() => navigate('/admin/events')}
        className="flex items-center gap-1.5 text-xs text-tea-text-sec hover:text-tea-text transition-colors mb-4"
      >
        <ArrowLeft size={14} /> <span>Events</span>
      </button>

      {/* Hero block — surface card */}
      <div className="bg-tea-surface border border-tea-border rounded-xl p-5 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="label-caps text-tea-text-dim mb-1">
              {new Date(event.eventDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()}
            </div>
            <h1 className="h2 text-tea-text mb-1">{event.title}</h1>
            {event.subtitle && (
              <p className="font-body italic text-ui-15 text-tea-text-sec mb-2 leading-snug">{event.subtitle}</p>
            )}
            <div className="flex items-center gap-4 text-ui-12 text-tea-text-dim flex-wrap mt-2">
              <span className="flex items-center gap-1">
                <Clock size={12} />
                {formatEventDate(event.eventDate)}
              </span>
              {(event.areaHint || event.locationName) && (
                <span className="flex items-center gap-1">
                  <MapPin size={12} />
                  {event.areaHint ?? event.locationName}
                </span>
              )}
              {requestedCount > 0 && (
                <span className="flex items-center gap-1 text-tea-gold">
                  <Bell size={10} className="shrink-0" />
                  {requestedCount} pending
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-3 shrink-0">
            <span className={`${STATUS_PILL_BASE} ${STATUS_PILL_VARIANTS[statusToVariant(event.status)]}`}>
              {event.status}
            </span>
            <div className="flex items-center gap-3 flex-wrap justify-end">
              <a
                href={`/event/${event.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-tea-text-sec hover:text-tea-text transition-colors"
              >
                <ExternalLink size={12} /> Preview
              </a>
              <button
                onClick={() => setIsShareOpen(true)}
                className="flex items-center gap-1.5 text-xs text-tea-text-sec hover:text-tea-text transition-colors"
              >
                <Share2 size={12} /> Share
              </button>
              <button
                onClick={() => setIsEditOpen(true)}
                className="flex items-center gap-1.5 text-xs text-tea-text-sec hover:text-tea-text transition-colors"
              >
                <Edit3 size={12} /> Edit
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Header — capacity + quick actions */}
      <div className="mb-6">
        {/* Capacity bar */}
        <div className="mb-4 space-y-2">
          <div className="flex items-center gap-3">
            {/* Three-segment bar */}
            <div className="flex-1 max-w-[300px]">
              <div className="h-2 bg-tea-bg rounded-full overflow-hidden flex">
                {/* Confirmed — solid gold */}
                <div
                  className="h-full bg-tea-gold transition-all duration-500 flex-shrink-0"
                  style={{ width: `${event.totalCapacity > 0 ? Math.min((confirmedCount / event.totalCapacity) * 100, 100) : 0}%` }}
                />
                {/* Pending approval — lighter, dashed-pattern via repeating gradient */}
                <div
                  className="h-full flex-shrink-0 transition-all duration-500"
                  style={{
                    width: `${event.totalCapacity > 0 ? Math.min((requestedCount / event.totalCapacity) * 100, 100 - Math.min((confirmedCount / event.totalCapacity) * 100, 100)) : 0}%`,
                    background: 'repeating-linear-gradient(90deg, var(--tea-gold) 0px, var(--tea-gold) 3px, transparent 3px, transparent 7px)',
                    opacity: 0.45,
                  }}
                />
                {/* Waitlist — dimmest */}
                <div
                  className="h-full bg-tea-text-sec/25 flex-shrink-0 transition-all duration-500"
                  style={{ width: `${event.totalCapacity > 0 ? Math.min((waitlistCount / event.totalCapacity) * 100, Math.max(0, 100 - Math.min(((confirmedCount + requestedCount) / event.totalCapacity) * 100, 100))) : 0}%` }}
                />
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs text-tea-text-sec flex-wrap">
              <span className="flex items-center gap-1">
                <Users size={11} />
                {confirmedCount}/{event.totalCapacity}
              </span>
              {requestedCount > 0 && (
                <span className="text-tea-text-sec">+{requestedCount} pending</span>
              )}
              {waitlistCount > 0 && (
                <span className="text-tea-text-dim">+{waitlistCount} waitlist</span>
              )}
            </div>
          </div>
          {/* Legend */}
          <div className="flex items-center gap-4 text-ui-10 text-tea-text-dim font-mono">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-6 h-px bg-tea-gold" />
              Confirmed
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block w-6 h-px"
                style={{ background: 'repeating-linear-gradient(90deg, var(--tea-gold) 0px, var(--tea-gold) 2px, transparent 2px, transparent 5px)', opacity: 0.7 }}
              />
              Pending
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-6 h-px bg-tea-text-sec/40" />
              Waitlist
            </span>
          </div>
        </div>

        {/* Quick Actions */}
        {event.status === 'active' && (
          <div className="flex flex-wrap gap-4 pt-1">
            <button
              onClick={() => setConfirmClose(true)}
              disabled={closingRsvp}
              className="flex items-center gap-1.5 text-ui-11 text-tea-text-sec hover:text-tea-text transition-colors"
            >
              {closingRsvp ? <Loader2 size={11} className="animate-spin" /> : <Lock size={11} />}
              Close RSVP
            </button>
          </div>
        )}
      </div>

      {/* Hairline divider separating header from tabs */}
      <div className="w-full h-px bg-tea-border mb-6" />

      {/* Tab Navigation */}
      <div className="flex items-end gap-0.5 border-b border-tea-border mb-6">
        {PRIMARY_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`relative flex-shrink-0 flex items-center gap-1.5 px-3 md:px-4 py-2.5 text-xs md:text-sm transition-colors border-b-2 -mb-px whitespace-nowrap ${
              activeTab === tab.key
                ? 'border-tea-gold text-tea-gold'
                : 'border-transparent text-tea-text-sec hover:text-tea-text'
            }`}
          >
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className={`text-ui-10 font-mono leading-none ${
                activeTab === tab.key ? 'text-tea-gold' : 'text-tea-gold'
              }`}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}

        {/* Overflow menu */}
        <div className="relative ml-auto" ref={overflowRef}>
          <button
            onClick={() => setOverflowOpen(o => !o)}
            className={`flex-shrink-0 flex items-center gap-1 px-3 py-2.5 text-xs transition-colors border-b-2 -mb-px whitespace-nowrap ${
              overflowActive
                ? 'border-tea-gold text-tea-gold'
                : 'border-transparent text-tea-text-sec hover:text-tea-text'
            }`}
          >
            <MoreHorizontal size={14} />
            {overflowActive && (
              <span className="text-ui-10">
                {OVERFLOW_TABS.find(t => t.key === activeTab)?.label}
              </span>
            )}
          </button>
          {overflowOpen && (
            <div className="absolute right-0 top-full mt-1 z-popover bg-tea-surface border border-tea-border rounded-md shadow-lg py-1 min-w-[140px]">
              {OVERFLOW_TABS.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`w-full text-left px-4 py-2 text-xs transition-colors flex items-center justify-between gap-3 ${
                    activeTab === tab.key
                      ? 'text-tea-gold bg-tea-gold/10'
                      : 'text-tea-text-sec hover:text-tea-text hover:bg-tea-elevated'
                  }`}
                >
                  {tab.label}
                  {(tab as any).badge > 0 && (
                    <span className="text-ui-10 font-mono text-tea-gold leading-none">
                      {(tab as any).badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tab Content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {/* ── Requests tab ── */}
        {activeTab === 'requests' && (
          <div>
            {requestedCount === 0 ? (
              <div className="text-center py-12 text-tea-text-sec text-sm">
                <Bell className="mx-auto mb-3 text-tea-text-dim" size={24} />
                <p>No pending requests</p>
              </div>
            ) : (
              <div className="space-y-3 max-w-xl">
                {attendees
                  .filter(a => a.status === 'requested')
                  .map(attendee => (
                    <ApprovalCard
                      key={attendee.id}
                      attendee={attendee}
                      onRefresh={refetchAttendees}
                    />
                  ))
                }
              </div>
            )}
          </div>
        )}

        {/* ── Attendees tab ── */}
        {activeTab === 'attendees' && (
          attendees.length === 0 ? (
            <div className="text-center py-12 text-tea-text-sec text-sm">
              <Users className="mx-auto mb-3 text-tea-text-dim" size={24} />
              <p>No attendees yet</p>
              <p className="text-xs text-tea-text-dim mt-1">Confirmed and waitlisted guests will appear here.</p>
            </div>
          ) : (
            <AttendeeTable attendees={attendees} eventId={event.id} onRefresh={refetchAttendees} />
          )
        )}

        {/* ── Briefing tab ── */}
        {activeTab === 'briefing' && (
          <div className="max-w-xl space-y-4">
            <BriefingCardsEditor
              cards={localBriefingCards}
              onChange={setBriefingCards}
              saving={savingBriefing}
            />
            {localBriefingCards.length > 0 && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveBriefing}
                  disabled={savingBriefing}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {savingBriefing ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                  Save Briefing Cards
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Reminders tab ── */}
        {activeTab === 'reminders' && (
          <div className="max-w-xl">
            <ReminderTimeline event={event} />
          </div>
        )}

        {/* ── Notifications tab ── */}
        {activeTab === 'notifications' && (
          <NotificationPanel eventId={event.id} event={event} />
        )}

        {/* ── Tea Menu tab ── */}
        {activeTab === 'tea-menu' && (
          <TeaMenuEditor eventId={event.id} />
        )}

        {/* ── Tasting Notes tab ── */}
        {activeTab === 'tasting-notes' && (
          <TastingNotesTab notes={tastingNotes} eventId={event.id} />
        )}

        {/* ── Post-Session tab ── */}
        {activeTab === 'post-session' && (
          <PostSessionEditor eventId={event.id} />
        )}

        {/* ── Interest tab ── */}
        {activeTab === 'interest' && (
          <div className="max-w-xl">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-sm text-tea-text font-medium">
                  {interestSignups.length} {interestSignups.length === 1 ? 'person' : 'people'} expressed interest
                </p>
                <p className="text-xs text-tea-text-sec mt-0.5">
                  {interestSignups.filter(s => s.converted_at).length} already converted · {interestSignups.filter(s => !s.converted_at).length} pending
                </p>
              </div>
              {interestSignups.filter(s => !s.converted_at).length > 0 && (
                <button
                  type="button"
                  onClick={handleConvertInterest}
                  disabled={convertingInterest}
                  className="flex items-center gap-1.5 text-xs text-tea-gold hover:text-tea-gold-lt transition-colors disabled:opacity-50"
                >
                  {convertingInterest ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                  Convert to RSVPs
                </button>
              )}
            </div>

            {interestSignups.length === 0 ? (
              <div className="text-center py-12 text-tea-text-sec text-sm">
                <Bell className="mx-auto mb-3 text-tea-text-dim" size={24} />
                <p>No interest signups yet</p>
                <p className="text-xs text-tea-text-dim mt-1">People who submit the "notify me" form will appear here.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {interestSignups.map((s: any) => (
                  <div
                    key={s.id}
                    className={`flex items-center justify-between gap-3 py-3 border-b border-tea-border ${
                      s.converted_at ? 'opacity-50' : ''
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-tea-text truncate">{s.name || '—'}</p>
                      <p className="text-xs text-tea-text-sec mt-0.5">{s.phone || s.email || '—'}</p>
                    </div>
                    {s.converted_at ? (
                      <span className={`${STATUS_PILL_BASE} ${STATUS_PILL_VARIANTS.archived} shrink-0`}>Converted</span>
                    ) : (
                      <span className={`${STATUS_PILL_BASE} ${STATUS_PILL_VARIANTS.active} shrink-0`}>Pending</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Venue tab ── */}
        {activeTab === 'venue' && (
          <div className="relative max-w-xl space-y-6">
            {/* Venue picker */}
            {venues.length === 0 ? (
              <div className="flex items-center justify-between py-2">
                <p className="text-xs text-tea-text-dim">No venues configured yet.</p>
                <button
                  type="button"
                  onClick={() => setIsVenueManagerOpen(true)}
                  className="flex items-center gap-1.5 text-xs text-tea-gold hover:text-tea-gold-lt transition-colors"
                >
                  <MapPin size={11} />
                  Add venue
                </button>
              </div>
            ) : (
              <>
                <div>
                  <label className="label-caps text-tea-text-sec block mb-1.5">Venue</label>
                  <div className="relative">
                    <MapPin size={12} className="absolute left-0 top-1/2 -translate-y-1/2 text-tea-text-sec" />
                    <select
                      value={selectedVenueId}
                      onChange={(e) => { setSelectedVenueId(e.target.value); setSelectedSpaceIds([]); }}
                      className="w-full border-b border-tea-border bg-transparent focus:border-tea-gold outline-none text-sm text-tea-text py-2 pl-5 appearance-none cursor-pointer [color-scheme:dark]"
                    >
                      <option value="">No venue assigned…</option>
                      {venues.map(v => (
                        <option key={v.id} value={v.id}>{v.name}</option>
                      ))}
                    </select>
                    <ChevronDown size={12} className="absolute right-0 top-1/2 -translate-y-1/2 text-tea-text-sec pointer-events-none" />
                  </div>
                </div>

                {/* Space picker */}
                {selectedVenueObj && selectedVenueObj.spaces.length > 0 && (
                  <div className="space-y-2">
                    <p className="label-caps text-tea-text-sec">Spaces</p>
                    {selectedSpaceIds.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {selectedVenueObj.spaces.filter(s => selectedSpaceIds.includes(s.id)).map(s => (
                          <span key={s.id} className="inline-flex items-center gap-1 text-ui-11 text-tea-gold">
                            {s.name} · {s.capacity}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="space-y-2">
                      {selectedVenueObj.spaces.map(space => {
                        const active = selectedSpaceIds.includes(space.id);
                        return (
                          <button
                            key={space.id}
                            type="button"
                            onClick={() => setSelectedSpaceIds(prev =>
                              prev.includes(space.id) ? prev.filter(id => id !== space.id) : [...prev, space.id]
                            )}
                            className={`w-full flex items-start gap-3 p-3 rounded-md border text-left transition-colors ${
                              active ? 'border-tea-gold/50 bg-tea-gold/5 text-tea-text' : 'border-tea-border text-tea-text-sec'
                            }`}
                          >
                            {space.photos[0] ? (
                              <div className="w-14 h-14 rounded overflow-hidden border border-tea-border flex-shrink-0">
                                <img src={space.photos[0]} alt={space.name} className="w-full h-full object-cover" loading="lazy" />
                              </div>
                            ) : (
                              <div className="w-14 h-14 rounded border border-dashed border-tea-border flex items-center justify-center flex-shrink-0">
                                <MapPin size={14} className="text-tea-text-dim" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-medium ${active ? 'text-tea-text' : 'text-tea-text-sec'}`}>{space.name}</p>
                              <p className="text-ui-11 text-tea-text-dim mt-0.5">{space.capacity} seats</p>
                              {space.description && (
                                <p className="text-ui-11 text-tea-text-dim mt-1 line-clamp-1">{space.description}</p>
                              )}
                            </div>
                            <div className={`w-4 h-4 rounded-sm border flex-shrink-0 mt-0.5 flex items-center justify-center transition-colors ${
                              active ? 'bg-tea-gold border-tea-gold' : 'border-tea-border'
                            }`}>
                              {active && <span className="text-tea-bg text-ui-10 font-semibold leading-none">✓</span>}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {selectedVenueObj && selectedVenueObj.spaces.length === 0 && (
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-tea-text-dim">This venue has no spaces yet.</p>
                    <button
                      type="button"
                      onClick={() => setIsVenueManagerOpen(true)}
                      className="flex items-center gap-1.5 text-xs text-tea-gold hover:text-tea-gold-lt transition-colors"
                    >
                      <MapPin size={11} />
                      Add spaces
                    </button>
                  </div>
                )}
              </>
            )}

            {/* Venue profile: photos + links */}
            {selectedVenueObj && (selectedVenueObj.photos.length > 0 || selectedVenueObj.website || selectedVenueObj.instagram) && (
              <div className="space-y-3 pt-2">
                <p className="label-caps text-tea-text-sec">Venue Profile</p>
                {/* Profile links */}
                {(selectedVenueObj.website || selectedVenueObj.instagram) && (
                  <div className="flex items-center gap-4 flex-wrap">
                    {selectedVenueObj.website && (
                      <a href={selectedVenueObj.website} target="_blank" rel="noopener noreferrer" className="text-xs text-tea-gold hover:text-tea-gold-lt transition-colors">
                        {selectedVenueObj.website.replace(/^https?:\/\//, '')}
                      </a>
                    )}
                    {selectedVenueObj.instagram && (
                      <span className="text-xs text-tea-text-sec">
                        {selectedVenueObj.instagram.startsWith('@') ? selectedVenueObj.instagram : `@${selectedVenueObj.instagram}`}
                      </span>
                    )}
                  </div>
                )}
                {/* Photos: hero + gallery */}
                {selectedVenueObj.photos.length > 0 && (
                  <div className="space-y-2">
                    {/* Hero */}
                    <div className="w-full aspect-[16/9] rounded-md overflow-hidden border border-tea-border">
                      <img src={selectedVenueObj.photos[0]} alt={selectedVenueObj.name} className="w-full h-full object-cover" loading="lazy" />
                    </div>
                    {/* Event vibe thumbnails */}
                    {selectedVenueObj.photos.length > 1 && (
                      <div className="flex gap-2 flex-wrap">
                        {selectedVenueObj.photos.slice(1).map((url, i) => (
                          <div key={i} className="w-20 h-20 rounded overflow-hidden border border-tea-border flex-shrink-0">
                            <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Footer: manage venues + save */}
            <div className="flex items-center justify-between pt-2 border-t border-tea-border">
              <button
                type="button"
                onClick={() => setIsVenueManagerOpen(true)}
                className="text-xs text-tea-text-sec hover:text-tea-text transition-colors"
              >
                Manage venues
              </button>
              <button
                type="button"
                onClick={handleSaveVenue}
                disabled={savingVenue}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {savingVenue ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                Save Venue
              </button>
            </div>

            {/* Inline Venue Manager overlay */}
            {isVenueManagerOpen && (
              <div className="absolute inset-0 bg-tea-bg z-toast flex flex-col" style={{ minHeight: '60vh' }}>
                <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3 border-b border-tea-border">
                  <button
                    type="button"
                    onClick={() => { setIsVenueManagerOpen(false); loadVenues(); }}
                    aria-label="Close"
                    className="text-tea-text-sec hover:text-tea-text transition-colors rounded-md p-1.5 tap-target"
                  >
                    <X size={16} />
                  </button>
                  <h3 className="h3 text-tea-text">Manage Venues</h3>
                </div>
                <div className="flex-1 overflow-y-auto">
                  <VenueManager />
                </div>
              </div>
            )}
          </div>
        )}
      </motion.div>

      {/* Close RSVP confirmation modal */}
      <AnimatePresence>
        {confirmClose && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-modal flex items-center justify-center p-4"
          >
            <button type="button" aria-hidden onClick={() => setConfirmClose(false)} className="absolute inset-0 bg-tea-bg/70 backdrop-blur-[2px]" />
            <motion.div
              initial={{ scale: 0.95, y: 8 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 8 }}
              className="relative bg-tea-surface border border-tea-border rounded-xl shadow-2xl w-full max-w-sm"
            >
              <button
                onClick={() => setConfirmClose(false)}
                aria-label="Close"
                className="absolute top-4 right-4 text-tea-text-sec hover:text-tea-text transition-colors rounded-md p-1.5 tap-target"
              >
                <X size={16} />
              </button>
              <div className="px-6 pt-6 pb-3">
                <h3 className="h3 text-tea-text">Close RSVPs?</h3>
                <p className="text-ui-13 text-tea-text-sec mt-1">Guests will no longer be able to register. Existing requests are unaffected.</p>
              </div>
              <div className="flex justify-between gap-2 px-6 py-4 border-t border-tea-border">
                <button
                  type="button"
                  onClick={() => setConfirmClose(false)}
                  className="px-2 py-1 text-xs text-tea-text-sec hover:text-tea-text transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setConfirmClose(false);
                    setClosingRsvp(true);
                    try {
                      await api.events.update(event.id, { status: 'closed' });
                      refetchEvent();
                      showToast('RSVPs closed', 'success');
                    } catch (err: any) {
                      showToast(err.message || 'Failed to close', 'error');
                    } finally {
                      setClosingRsvp(false);
                    }
                  }}
                  disabled={closingRsvp}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {closingRsvp ? <Loader2 size={13} className="animate-spin" /> : <Lock size={13} />}
                  Confirm
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Event Modal */}
      <EventForm
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        initialData={event}
        onSuccess={() => {
          refetchEvent();
          setIsEditOpen(false);
        }}
      />

      {/* Share Sheet */}
      {isShareOpen && (
        <ShareSheet
          isOpen={isShareOpen}
          onClose={() => setIsShareOpen(false)}
          event={event}
        />
      )}
    </div>
  );
};
