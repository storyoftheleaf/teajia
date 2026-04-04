import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpDown, Check, X, UserPlus, Phone, Leaf, Star, Loader2, Users } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from './Toast';
import { EventAttendee, AttendeeStatus } from '../../types/events';

interface AttendeeTableProps {
  attendees: EventAttendee[];
  eventId: string;
  onRefresh: () => void;
}

type SortField = 'name' | 'status' | 'createdAt';
type FilterTab = 'all' | 'confirmed' | 'waitlist' | 'cancelled' | 'denied';

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

export const AttendeeTable: React.FC<AttendeeTableProps> = ({ attendees, eventId, onRefresh }) => {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<FilterTab>('all');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortAsc, setSortAsc] = useState(true);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const counts = useMemo(() => ({
    confirmed: attendees.filter(a => a.status === 'confirmed').length,
    waitlist: attendees.filter(a => a.status === 'waitlist').length,
    cancelled: attendees.filter(a => a.status === 'cancelled').length,
    denied: attendees.filter(a => a.status === 'denied').length,
    requested: attendees.filter(a => a.status === 'requested').length,
  }), [attendees]);

  const filtered = useMemo(() => {
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
    return list;
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

      await api.events.updateAttendee(attendee.id, { customerId: customer.id });

      showToast(`Customer record created for ${attendee.fullName}`, 'success');
      onRefresh();
    } catch (e: any) {
      console.error('Failed to create customer:', e);
      showToast(e.message || 'Failed to create customer record', 'error');
    }
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
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full leading-none ${
                  filter === tab.key ? 'bg-tea-gold/15 text-tea-gold' : 'bg-tea-elevated text-tea-text-dim'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-8 text-tea-text-sec text-sm">No attendees in this category</div>
      ) : (
        <div className="overflow-x-auto">
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
                  <th
                    key={i}
                    className="text-left text-[10px] uppercase tracking-[0.15em] text-tea-text-sec font-medium py-2 px-2"
                  >
                    {col.field ? (
                      <button
                        onClick={() => toggleSort(col.field!)}
                        className="flex items-center gap-1 hover:text-tea-text transition-colors"
                      >
                        {col.label}
                        <ArrowUpDown size={10} className={sortField === col.field ? 'text-tea-gold' : ''} />
                      </button>
                    ) : (
                      col.label
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(attendee => {
                const isDenied = attendee.status === 'denied';
                const rowClass = isDenied ? 'opacity-50' : '';
                const totalGuests = attendee.guestRequests?.length ?? (attendee.plusOne ? 1 : 0);
                const approvedGuests = attendee.guestRequests?.filter(g => g.approved === true).length ?? (attendee.plusOne ? 1 : 0);
                const isReturning = (attendee.sessionsAttended ?? 0) > 0;

                return (
                  <tr
                    key={attendee.id}
                    className={`border-b border-tea-border hover:bg-tea-elevated/30 transition-colors ${rowClass}`}
                  >
                    <td className="py-2.5 px-2 text-tea-text font-medium">
                      <span className="inline-flex items-center gap-0.5">
                        {attendee.fullName}
                        {attendee.customerId ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/admin/people?search=${encodeURIComponent(attendee.fullName)}`);
                            }}
                            className="ml-1.5 inline-flex items-center text-tea-gold hover:text-tea-gold-lt transition-colors"
                            title="View customer profile"
                          >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                              <circle cx="12" cy="7" r="4"/>
                            </svg>
                          </button>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCreateCustomer(attendee);
                            }}
                            className="ml-1.5 inline-flex items-center text-tea-text-dim hover:text-tea-gold transition-colors"
                            title="Create customer record"
                          >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                              <circle cx="8.5" cy="7" r="4"/>
                              <line x1="20" y1="8" x2="20" y2="14"/>
                              <line x1="23" y1="11" x2="17" y2="11"/>
                            </svg>
                          </button>
                        )}
                      </span>
                    </td>

                    <td className="py-2.5 px-2 text-tea-text-sec text-xs">
                      {attendee.phoneNumber ? (
                        <span className="flex items-center gap-1">
                          <Phone size={10} /> {attendee.phoneNumber}
                        </span>
                      ) : (
                        <span className="text-tea-text-sec">—</span>
                      )}
                    </td>

                    <td className="py-2.5 px-2">
                      <span className={`text-[10px] uppercase tracking-[0.1em] px-2 py-0.5 rounded-full ${STATUS_CHIPS[attendee.status]}`}>
                        {attendee.status}
                      </span>
                    </td>

                    <td className="py-2.5 px-2">
                      {attendee.accessTier === 'golden' ? (
                        <span className="flex items-center gap-1 text-tea-gold text-xs">
                          <Star size={10} fill="currentColor" /> Golden
                        </span>
                      ) : (
                        <span className="text-tea-text-sec text-xs">—</span>
                      )}
                    </td>

                    {/* Guests column — show V2 guest requests or legacy plus one */}
                    <td className="py-2.5 px-2 text-xs">
                      {totalGuests > 0 ? (
                        <div>
                          <span className="flex items-center gap-1 text-tea-text-sec">
                            <Users size={10} />
                            {attendee.guestRequests ? (
                              <span>{approvedGuests}/{totalGuests}</span>
                            ) : (
                              <span><UserPlus size={9} className="inline mr-0.5" />Yes</span>
                            )}
                          </span>
                          {attendee.guestRequests && attendee.guestRequests.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {attendee.guestRequests.map((gr, i) => (
                                <span
                                  key={i}
                                  className={`text-[9px] px-1.5 py-0.5 rounded-sm ${
                                    gr.approved === true
                                      ? 'bg-green-500/10 text-green-400'
                                      : gr.approved === false
                                      ? 'bg-tea-text-sec/10 text-tea-text-dim'
                                      : 'bg-amber-500/10 text-amber-400'
                                  }`}
                                  title={`${gr.approved === true ? 'Approved' : gr.approved === false ? 'Denied' : 'Pending'}: "${gr.nameHint}"`}
                                >
                                  "{gr.nameHint}"
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-tea-text-sec">—</span>
                      )}
                    </td>

                    {/* Journey column */}
                    <td className="py-2.5 px-2 text-xs text-tea-text-sec">
                      {isReturning ? (
                        <div>
                          <span className="text-tea-text-sec">{attendee.sessionsAttended}×</span>
                          {attendee.favoriteTypes && attendee.favoriteTypes.length > 0 && (
                            <span className="text-tea-text-dim ml-1 text-[10px]">
                              {attendee.favoriteTypes.slice(0, 2).join(', ')}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-tea-text-dim text-[10px]">new</span>
                      )}
                    </td>

                    <td className="py-2.5 px-2">
                      {attendee.teaPreference ? (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-tea-elevated/50 text-tea-text-sec px-1.5 py-0.5 rounded">
                          <Leaf size={9} /> {attendee.teaPreference}
                        </span>
                      ) : (
                        <span className="text-tea-text-sec text-xs">—</span>
                      )}
                    </td>

                    <td className="py-2.5 px-2 text-tea-text-sec text-xs max-w-[120px] truncate" title={attendee.notes}>
                      {attendee.notes || (attendee.denialMessage ? <span className="text-tea-text-dim">denied: {attendee.denialMessage}</span> : '—')}
                    </td>

                    <td className="py-2.5 px-2">
                      <button
                        onClick={() => toggleAttended(attendee)}
                        disabled={loadingId === attendee.id || isDenied}
                        className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                          attendee.attended
                            ? 'bg-tea-gold border-tea-gold text-tea-bg'
                            : 'border-tea-border text-tea-text-sec hover:border-tea-gold/50'
                        } disabled:opacity-30`}
                      >
                        {loadingId === attendee.id ? (
                          <Loader2 size={10} className="animate-spin" />
                        ) : attendee.attended ? (
                          <Check size={10} />
                        ) : null}
                      </button>
                    </td>

                    <td className="py-2.5 px-2">
                      <div className="flex items-center gap-1 flex-wrap">
                        {attendee.status === 'waitlist' && (
                          <button
                            onClick={() => updateStatus(attendee, 'confirmed')}
                            disabled={!!loadingId}
                            className="text-[10px] px-2 py-1 rounded bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors disabled:opacity-50"
                          >
                            Promote
                          </button>
                        )}
                        {(attendee.status === 'confirmed' || attendee.status === 'waitlist') && (
                          <button
                            onClick={() => updateStatus(attendee, 'cancelled')}
                            disabled={!!loadingId}
                            className="text-[10px] px-2 py-1 rounded bg-tea-text-sec/10 text-tea-text-sec hover:bg-tea-text-sec/20 transition-colors disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        )}
                        {attendee.status === 'cancelled' && (
                          <button
                            onClick={() => updateStatus(attendee, 'confirmed')}
                            disabled={!!loadingId}
                            className="text-[10px] px-2 py-1 rounded bg-tea-gold/10 text-tea-gold hover:bg-tea-gold/20 transition-colors disabled:opacity-50"
                          >
                            Restore
                          </button>
                        )}
                        {attendee.status === 'denied' && (
                          <button
                            onClick={() => updateStatus(attendee, 'waitlist')}
                            disabled={!!loadingId}
                            className="text-[10px] px-2 py-1 rounded bg-tea-elevated text-tea-text-dim hover:text-tea-text-sec transition-colors disabled:opacity-50"
                          >
                            Reconsider
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
