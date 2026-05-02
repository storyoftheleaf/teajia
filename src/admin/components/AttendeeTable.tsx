import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpDown, Check, UserPlus, Phone, Leaf, Star, Loader2, Users, Link2, X, Search } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from './Toast';
import { EventAttendee, AttendeeStatus } from '../../types/events';
import type { Customer } from '../types';

interface AttendeeTableProps {
  attendees: EventAttendee[];
  eventId: string;
  onRefresh: () => void;
}

type SortField = 'name' | 'status' | 'createdAt';
type FilterTab = 'all' | 'confirmed' | 'waitlist' | 'cancelled' | 'denied';

const STATUS_LABELS: Record<AttendeeStatus, string> = {
  confirmed: '✓',
  requested: 'req',
  waitlist: 'wait',
  cancelled: 'cancel',
  denied: 'denied',
};

// Status chip styles — NO borders on chips per CLAUDE.md
const STATUS_CHIPS: Record<AttendeeStatus, string> = {
  requested: 'bg-amber-500/15 text-amber-400',
  confirmed: 'bg-green-500/10 text-green-400',
  waitlist: 'bg-tea-gold/10 text-tea-gold',
  cancelled: 'bg-tea-text-sec/10 text-tea-text-sec',
  denied: 'bg-tea-text-sec/10 text-tea-text-dim line-through',
};

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'waitlist', label: 'Waitlisted' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'denied', label: 'Denied' },
];

type EnrichedAttendee = EventAttendee & {
  isDenied: boolean;
  totalGuests: number;
  approvedGuests: number;
  isReturning: boolean;
};

const AttendeeActions: React.FC<{
  attendee: EventAttendee;
  loadingId: string | null;
  onUpdate: (attendee: EventAttendee, status: AttendeeStatus) => void;
  compact?: boolean;
}> = ({ attendee, loadingId, onUpdate, compact = false }) => {
  const px = compact ? 'px-2.5' : 'px-2';
  return (
    <>
      {attendee.status === 'waitlist' && (
        <button onClick={() => onUpdate(attendee, 'confirmed')} disabled={!!loadingId}
          className={`text-ui-10 ${px} py-1 rounded bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors disabled:opacity-50`}>
          Promote
        </button>
      )}
      {(attendee.status === 'confirmed' || attendee.status === 'waitlist') && (
        <button onClick={() => onUpdate(attendee, 'cancelled')} disabled={!!loadingId}
          className={`text-ui-10 ${px} py-1 rounded bg-tea-text-sec/10 text-tea-text-sec hover:bg-tea-text-sec/20 transition-colors disabled:opacity-50`}>
          Cancel
        </button>
      )}
      {attendee.status === 'cancelled' && (
        <button onClick={() => onUpdate(attendee, 'confirmed')} disabled={!!loadingId}
          className={`text-ui-10 ${px} py-1 rounded bg-tea-gold/10 text-tea-gold hover:bg-tea-gold/20 transition-colors disabled:opacity-50`}>
          Restore
        </button>
      )}
      {attendee.status === 'denied' && (
        <button onClick={() => onUpdate(attendee, 'waitlist')} disabled={!!loadingId}
          className={`text-ui-10 ${px} py-1 rounded bg-tea-elevated text-tea-text-dim hover:text-tea-text-sec transition-colors disabled:opacity-50`}>
          Reconsider
        </button>
      )}
    </>
  );
};

// Hover card content — built from EventAttendee data already in scope (no API call)
const AttendeeHoverCard: React.FC<{
  attendee: EnrichedAttendee;
  pos: { x: number; y: number };
}> = ({ attendee, pos }) => (
  <div
    className="fixed z-50 pointer-events-none bg-tea-surface border border-tea-border rounded-xl shadow-2xl p-3 w-56 text-ui-11 space-y-2"
    style={{ top: pos.y + 8, left: pos.x }}
  >
    <div className="flex items-center justify-between gap-2">
      <span className="font-medium text-tea-text leading-snug">{attendee.fullName}</span>
      {attendee.accessTier === 'golden' && (
        <span className="flex items-center gap-0.5 text-tea-gold text-ui-10">
          <Star size={9} fill="currentColor" />Golden
        </span>
      )}
    </div>
    {attendee.isReturning && (
      <div className="text-tea-text-sec">
        {attendee.sessionsAttended} session{attendee.sessionsAttended !== 1 ? 's' : ''} attended
        {attendee.lastAttended && (
          <span className="text-tea-text-dim ml-1">
            · last {new Date(attendee.lastAttended).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
          </span>
        )}
      </div>
    )}
    {attendee.favoriteTypes && attendee.favoriteTypes.length > 0 && (
      <div className="flex flex-wrap gap-1">
        {attendee.favoriteTypes.map(t => (
          <span key={t} className="bg-tea-elevated text-tea-text-sec px-1.5 py-0.5 rounded text-ui-10">{t}</span>
        ))}
      </div>
    )}
    {attendee.teaPreference && (
      <div className="flex items-center gap-1 text-tea-text-sec">
        <Leaf size={9} />{attendee.teaPreference}
      </div>
    )}
    {attendee.notes && (
      <p className="text-tea-text-dim leading-snug line-clamp-2">{attendee.notes}</p>
    )}
    {attendee.customerId && (
      <p className="text-tea-gold text-ui-10 pt-0.5">Click to view full profile →</p>
    )}
  </div>
);

// ─── Link Existing Customer Modal ────────────────────────────────────────────

interface LinkCustomerModalProps {
  attendee: EventAttendee;
  onClose: () => void;
  onLinked: () => void;
}

const LinkCustomerModal: React.FC<LinkCustomerModalProps> = ({ attendee, onClose, onLinked }) => {
  const { showToast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    api.customers.list().then((data: any) => {
      if (cancelled) return;
      const list: Customer[] = (data || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        email: c.email || undefined,
        phone: c.phone || undefined,
        whatsapp: c.whatsapp || undefined,
        tags: typeof c.tags === 'string' ? JSON.parse(c.tags || '[]') : (c.tags || []),
        contacts: typeof c.contacts === 'string' ? JSON.parse(c.contacts || '[]') : (c.contacts || []),
        type: c.type || 'customer',
        preferredCurrency: c.preferred_currency || 'USD',
        createdAt: c.created_at,
        updatedAt: c.updated_at,
      }));
      setCustomers(list);
      setLoading(false);
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    // Focus the search input once customers have loaded
    if (!loading) inputRef.current?.focus();
  }, [loading]);

  const filtered = useMemo(() => {
    if (!query.trim()) return customers.slice(0, 20);
    const q = query.toLowerCase();
    return customers.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.phone && c.phone.includes(q)) ||
      (c.whatsapp && c.whatsapp.includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q))
    ).slice(0, 20);
  }, [customers, query]);

  const handleLink = async (customer: Customer) => {
    if (linking) return;
    setLinking(true);
    try {
      await api.events.updateAttendee(attendee.id, { customer_id: customer.id });
      showToast(`Linked ${attendee.fullName} to ${customer.name}`, 'success');
      onLinked();
      onClose();
    } catch (e: any) {
      showToast(e.message || 'Failed to link customer', 'error');
      setLinking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-tea-bg/80 backdrop-blur-sm" onClick={onClose} />

      {/* Modal panel */}
      <div className="relative z-10 bg-tea-surface border border-tea-border rounded-2xl shadow-2xl w-full max-w-sm flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-3 border-b border-tea-border shrink-0">
          <div>
            <p className="text-sm font-medium text-tea-text">Link existing customer</p>
            <p className="text-xs text-tea-text-sec mt-0.5">{attendee.fullName}</p>
          </div>
          <button onClick={onClose} className="text-tea-text-sec hover:text-tea-text transition-colors" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 shrink-0">
          <div className="flex items-center gap-2 bg-tea-elevated rounded-lg px-3 py-2">
            <Search size={13} className="text-tea-text-sec shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Name, phone, or email…"
              className="flex-1 bg-transparent text-sm text-tea-text placeholder:text-tea-text-dim outline-none"
            />
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto min-h-0 px-2 pb-2">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-tea-text-sec">
              <Loader2 size={16} className="animate-spin mr-2" />
              <span className="text-sm">Loading customers…</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-sm text-tea-text-sec">No match found</p>
              <p className="text-xs text-tea-text-dim mt-1">Try a different name or use "Create new" instead</p>
            </div>
          ) : (
            <ul className="space-y-0.5">
              {filtered.map(customer => (
                <li key={customer.id}>
                  <button
                    onClick={() => handleLink(customer)}
                    disabled={linking}
                    className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-tea-elevated transition-colors disabled:opacity-50 group"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-tea-text font-medium group-hover:text-tea-gold transition-colors">{customer.name}</span>
                      {linking && <Loader2 size={11} className="animate-spin text-tea-text-dim shrink-0" />}
                    </div>
                    {(customer.phone || customer.email) && (
                      <p className="text-xs text-tea-text-sec mt-0.5">
                        {customer.phone || customer.email}
                      </p>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center px-4 py-3 border-t border-tea-border shrink-0">
          <button onClick={onClose} className="text-sm text-tea-text-sec hover:text-tea-text transition-colors">
            Cancel
          </button>
          <span className="text-xs text-tea-text-dim">
            {loading ? '' : `${customers.length} customers`}
          </span>
        </div>
      </div>
    </div>
  );
};

// ─── Main Table ───────────────────────────────────────────────────────────────

export const AttendeeTable: React.FC<AttendeeTableProps> = ({ attendees, eventId, onRefresh }) => {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<FilterTab>('all');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortAsc, setSortAsc] = useState(true);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [hoveredAttendee, setHoveredAttendee] = useState<EnrichedAttendee | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const [linkModalAttendee, setLinkModalAttendee] = useState<EventAttendee | null>(null);

  const counts = useMemo(() => ({
    confirmed: attendees.filter(a => a.status === 'confirmed').length,
    waitlist: attendees.filter(a => a.status === 'waitlist').length,
    cancelled: attendees.filter(a => a.status === 'cancelled').length,
    denied: attendees.filter(a => a.status === 'denied').length,
    requested: attendees.filter(a => a.status === 'requested').length,
  }), [attendees]);

  const filtered = useMemo((): EnrichedAttendee[] => {
    let list = [...attendees];
    // Filter out 'requested' from the attendees view — they belong in the Requests tab
    if (filter === 'all') {
      list = list.filter(a => a.status !== 'requested');
    } else {
      list = list.filter(a => a.status === filter);
    }
    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name') cmp = a.fullName.localeCompare(b.fullName);
      else if (sortField === 'status') cmp = a.status.localeCompare(b.status);
      else cmp = (a.createdAt || '').localeCompare(b.createdAt || '');
      return sortAsc ? cmp : -cmp;
    });
    return list.map(attendee => ({
      ...attendee,
      isDenied: attendee.status === 'denied',
      totalGuests: attendee.guestRequests?.length ?? (attendee.plusOne ? 1 : 0),
      approvedGuests: attendee.guestRequests?.filter(g => g.approved === true).length ?? (attendee.plusOne ? 1 : 0),
      isReturning: (attendee.sessionsAttended ?? 0) > 0,
    }));
  }, [attendees, filter, sortField, sortAsc]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(true); }
  };

  const updateStatus = async (attendee: EventAttendee, newStatus: AttendeeStatus) => {
    setLoadingId(attendee.id);
    try {
      if (newStatus === 'confirmed') {
        await api.events.approveAttendee(attendee.id);
      } else if (newStatus === 'denied') {
        await api.events.denyAttendee(attendee.id);
      } else if (newStatus === 'waitlist') {
        await api.events.waitlistAttendee(attendee.id);
      } else {
        await api.events.updateAttendee(attendee.id, { status: newStatus });
      }
      showToast(
        `${attendee.fullName} ${newStatus === 'confirmed' ? 'promoted' : newStatus}`,
        'success'
      );
      onRefresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to update', 'error');
    } finally {
      setLoadingId(null);
    }
  };

  const toggleAttended = async (attendee: EventAttendee) => {
    setLoadingId(attendee.id);
    try {
      await api.events.updateAttendee(attendee.id, { attended: !attendee.attended });
      showToast(
        `${attendee.fullName} marked as ${!attendee.attended ? 'attended' : 'not attended'}`,
        'success'
      );
      onRefresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to update', 'error');
    } finally {
      setLoadingId(null);
    }
  };

  const handleCreateCustomer = async (attendee: EventAttendee) => {
    if (!confirm(`Create customer record for ${attendee.fullName}?`)) return;

    try {
      const customer = await api.customers.create({
        name: attendee.fullName,
        phone: attendee.phoneNumber || undefined,
        email: attendee.email || undefined,
        whatsapp: attendee.phoneNumber || undefined,
        tags: ['retail'],
        source: `Event attendee`,
        preferredCurrency: 'USD',
      });

      await api.events.updateAttendee(attendee.id, { customer_id: customer.id });

      showToast(`Customer record created for ${attendee.fullName}`, 'success');
      onRefresh();
      navigate(`/admin/people/${customer.id}`);
    } catch (e: any) {
      console.error('Failed to create customer:', e);
      showToast(e.message || 'Failed to create customer record', 'error');
    }
  };

  const openCustomerProfile = (attendee: EventAttendee) => {
    if (!attendee.customerId) return;
    setHoveredAttendee(null);
    setHoverPos(null);
    navigate(`/admin/people/${attendee.customerId}`);
  };

  const handleNameMouseEnter = (e: React.MouseEvent, attendee: EnrichedAttendee) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHoverPos({ x: rect.left, y: rect.bottom });
    setHoveredAttendee(attendee);
  };

  const handleNameMouseLeave = () => {
    setHoveredAttendee(null);
    setHoverPos(null);
  };

  // Name cell — linked customer: clickable with profile open; unlinked: name + create prompt
  const AttendeeName: React.FC<{ attendee: EnrichedAttendee; compact?: boolean }> = ({ attendee, compact }) => {
    if (attendee.customerId) {
      return (
        <button
          onClick={() => openCustomerProfile(attendee)}
          onMouseEnter={(e) => handleNameMouseEnter(e, attendee)}
          onMouseLeave={handleNameMouseLeave}
          className={`inline-flex items-center gap-1.5 text-left transition-colors ${
            compact ? 'text-ui-14 font-medium' : 'text-sm font-medium'
          } text-tea-text hover:text-tea-gold group`}
        >
          <span className="group-hover:underline underline-offset-2 decoration-tea-gold/50">{attendee.fullName}</span>
        </button>
      );
    }
    return (
      <span className={`inline-flex items-center gap-1.5 ${compact ? 'text-ui-14 font-medium' : 'text-sm font-medium'} text-tea-text`}>
        {attendee.fullName}
        <button
          onClick={() => setLinkModalAttendee(attendee)}
          className="text-tea-text-dim hover:text-tea-gold transition-colors"
          title="Link to existing customer"
        >
          <Link2 size={12} />
        </button>
        <button
          onClick={() => handleCreateCustomer(attendee)}
          className="text-tea-text-dim hover:text-tea-gold transition-colors"
          title="Create new customer record"
        >
          <UserPlus size={12} />
        </button>
      </span>
    );
  };

  return (
    <div>
      {/* Count Summary */}
      <div className="flex items-center gap-4 mb-4 text-xs text-tea-text-sec flex-wrap">
        <span className="text-green-400">{counts.confirmed} confirmed</span>
        <span className="text-tea-gold">{counts.waitlist} waitlisted</span>
        <span>{counts.cancelled} cancelled</span>
        {counts.denied > 0 && <span className="text-tea-text-dim">{counts.denied} denied</span>}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-0.5 mb-4 border-b border-tea-border overflow-x-auto scrollbar-hide">
        {FILTER_TABS.map(tab => {
          const count = tab.key === 'all'
            ? attendees.filter(a => a.status !== 'requested').length
            : counts[tab.key as keyof typeof counts] ?? 0;
          return (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`flex items-center gap-1 px-3 py-2 text-xs transition-colors border-b-2 -mb-px whitespace-nowrap ${
                filter === tab.key
                  ? 'border-tea-gold text-tea-gold'
                  : 'border-transparent text-tea-text-sec hover:text-tea-text-sec'
              }`}
            >
              {tab.label}
              {count > 0 && (
                <span className={`text-ui-9 px-1.5 py-0.5 rounded-full leading-none ${
                  filter === tab.key ? 'bg-tea-gold/15 text-tea-gold' : 'bg-tea-elevated text-tea-text-dim'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-8 text-tea-text-sec text-sm">No attendees in this category</div>
      ) : (
        <>
          {/* Mobile card list */}
          <div className="md:hidden divide-y divide-tea-border">
            {filtered.map(attendee => (
              <div key={attendee.id} className={`py-3 px-1 ${attendee.isDenied ? 'opacity-50' : ''}`}>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <AttendeeName attendee={attendee} compact />
                  <span className={`text-ui-10 uppercase tracking-widest px-2 py-0.5 rounded-full shrink-0 ${STATUS_CHIPS[attendee.status]}`}>
                    {STATUS_LABELS[attendee.status]}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-ui-11 text-tea-text-sec mb-2.5 flex-wrap">
                  {attendee.phoneNumber && (
                    <span className="flex items-center gap-1"><Phone size={10} />{attendee.phoneNumber}</span>
                  )}
                  {attendee.accessTier === 'golden' && (
                    <span className="flex items-center gap-1 text-tea-gold"><Star size={10} fill="currentColor" />Golden</span>
                  )}
                  {attendee.isReturning && (
                    <span className="text-tea-text-dim">{attendee.sessionsAttended}× sessions</span>
                  )}
                  {attendee.totalGuests > 0 && (
                    <span className="flex items-center gap-1">
                      <Users size={10} />
                      {attendee.guestRequests ? `${attendee.approvedGuests}/${attendee.totalGuests}` : 'Yes'}
                    </span>
                  )}
                  {attendee.teaPreference && (
                    <span className="flex items-center gap-1"><Leaf size={10} />{attendee.teaPreference}</span>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={() => toggleAttended(attendee)}
                    disabled={loadingId === attendee.id || attendee.isDenied}
                    className={`flex items-center gap-1.5 text-ui-11 px-2.5 py-1 rounded transition-colors disabled:opacity-30 ${
                      attendee.attended
                        ? 'bg-tea-gold/15 text-tea-gold'
                        : 'bg-tea-elevated text-tea-text-sec hover:text-tea-text'
                    }`}
                  >
                    {loadingId === attendee.id ? (
                      <Loader2 size={10} className="animate-spin" />
                    ) : (
                      <Check size={10} className={attendee.attended ? 'opacity-100' : 'opacity-40'} />
                    )}
                    {attendee.attended ? 'Attended' : 'Mark attended'}
                  </button>

                  <div className="flex items-center gap-1.5">
                    <AttendeeActions attendee={attendee} loadingId={loadingId} onUpdate={updateStatus} compact />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-tea-border">
                  {[
                    { field: 'name' as SortField, label: 'Name' },
                    { field: null, label: 'Phone' },
                    { field: 'status' as SortField, label: 'Status' },
                    { field: null, label: 'Tier' },
                    { field: null, label: 'Guests' },
                    { field: null, label: 'Journey' },
                    { field: null, label: 'Tea Pref' },
                    { field: null, label: 'Notes' },
                    { field: null, label: 'Attended' },
                    { field: null, label: 'Actions' },
                  ].map((col, i) => (
                    <th key={i} className="text-left text-ui-10 uppercase tracking-caps text-tea-text-sec font-medium py-2 px-2">
                      {col.field ? (
                        <button onClick={() => toggleSort(col.field!)} className="flex items-center gap-1 hover:text-tea-text transition-colors">
                          {col.label}
                          <ArrowUpDown size={10} className={sortField === col.field ? 'text-tea-gold' : ''} />
                        </button>
                      ) : col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(attendee => (
                  <tr key={attendee.id} className={`border-b border-tea-border hover:bg-tea-elevated/30 transition-colors ${attendee.isDenied ? 'opacity-50' : ''}`}>
                    <td className="py-2.5 px-2">
                      <AttendeeName attendee={attendee} />
                    </td>
                    <td className="py-2.5 px-2 text-tea-text-sec text-xs">
                      {attendee.phoneNumber ? (
                        <span className="flex items-center gap-1"><Phone size={10} />{attendee.phoneNumber}</span>
                      ) : <span className="text-tea-text-sec">—</span>}
                    </td>
                    <td className="py-2.5 px-2">
                      <span className={`text-ui-10 uppercase tracking-widest px-2 py-0.5 rounded-full ${STATUS_CHIPS[attendee.status]}`}>
                        {STATUS_LABELS[attendee.status]}
                      </span>
                    </td>
                    <td className="py-2.5 px-2">
                      {attendee.accessTier === 'golden' ? (
                        <span className="flex items-center gap-1 text-tea-gold text-xs"><Star size={10} fill="currentColor" />Golden</span>
                      ) : <span className="text-tea-text-sec text-xs">—</span>}
                    </td>
                    <td className="py-2.5 px-2 text-xs">
                      {attendee.totalGuests > 0 ? (
                        <div>
                          <span className="flex items-center gap-1 text-tea-text-sec">
                            <Users size={10} />
                            {attendee.guestRequests ? (
                              <span>{attendee.approvedGuests}/{attendee.totalGuests}</span>
                            ) : (
                              <span><UserPlus size={9} className="inline mr-0.5" />Yes</span>
                            )}
                          </span>
                          {attendee.guestRequests && attendee.guestRequests.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {attendee.guestRequests.map((gr, i) => (
                                <span key={i} className={`text-ui-9 px-1.5 py-0.5 rounded-sm ${
                                  gr.approved === true ? 'bg-green-500/10 text-green-400'
                                  : gr.approved === false ? 'bg-tea-text-sec/10 text-tea-text-dim'
                                  : 'bg-amber-500/10 text-amber-400'
                                }`} title={`${gr.approved === true ? 'Approved' : gr.approved === false ? 'Denied' : 'Pending'}: "${gr.nameHint}"`}>
                                  "{gr.nameHint}"
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : <span className="text-tea-text-sec">—</span>}
                    </td>
                    <td className="py-2.5 px-2 text-xs text-tea-text-sec">
                      {attendee.isReturning ? (
                        <div>
                          <span className="text-tea-text-sec">{attendee.sessionsAttended}×</span>
                          {attendee.favoriteTypes && attendee.favoriteTypes.length > 0 && (
                            <span className="text-tea-text-dim ml-1 text-ui-10">{attendee.favoriteTypes.slice(0, 2).join(', ')}</span>
                          )}
                        </div>
                      ) : <span className="text-tea-text-dim text-ui-10">new</span>}
                    </td>
                    <td className="py-2.5 px-2">
                      {attendee.teaPreference ? (
                        <span className="inline-flex items-center gap-1 text-ui-10 bg-tea-elevated/50 text-tea-text-sec px-1.5 py-0.5 rounded">
                          <Leaf size={9} />{attendee.teaPreference}
                        </span>
                      ) : <span className="text-tea-text-sec text-xs">—</span>}
                    </td>
                    <td className="py-2.5 px-2 text-tea-text-sec text-xs max-w-[120px] truncate" title={attendee.notes}>
                      {attendee.notes || (attendee.denialMessage ? <span className="text-tea-text-dim">denied: {attendee.denialMessage}</span> : '—')}
                    </td>
                    <td className="py-2.5 px-2">
                      <button
                        onClick={() => toggleAttended(attendee)}
                        disabled={loadingId === attendee.id || attendee.isDenied}
                        className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                          attendee.attended ? 'bg-tea-gold border-tea-gold text-tea-bg' : 'border-tea-border text-tea-text-sec hover:border-tea-gold/50'
                        } disabled:opacity-30`}
                      >
                        {loadingId === attendee.id ? <Loader2 size={10} className="animate-spin" /> : attendee.attended ? <Check size={10} /> : null}
                      </button>
                    </td>
                    <td className="py-2.5 px-2">
                      <div className="flex items-center gap-1 flex-wrap">
                        <AttendeeActions attendee={attendee} loadingId={loadingId} onUpdate={updateStatus} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Hover card — fixed-position to escape table overflow clipping */}
      {hoveredAttendee && hoverPos && (
        <AttendeeHoverCard attendee={hoveredAttendee} pos={hoverPos} />
      )}

      {/* Link existing customer modal */}
      {linkModalAttendee && (
        <LinkCustomerModal
          attendee={linkModalAttendee}
          onClose={() => setLinkModalAttendee(null)}
          onLinked={onRefresh}
        />
      )}

    </div>
  );
};
