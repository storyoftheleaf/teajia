import React, { useState, useMemo } from 'react';
import { ArrowUpDown, Check, X, UserPlus, Phone, Leaf, Star, Loader2 } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from './Toast';
import { EventAttendee, AttendeeStatus } from '../../types/events';

interface AttendeeTableProps {
  attendees: EventAttendee[];
  eventId: string;
  onRefresh: () => void;
}

type SortField = 'name' | 'status' | 'createdAt';
type FilterTab = 'all' | 'confirmed' | 'waitlist' | 'cancelled';

const STATUS_CHIPS: Record<AttendeeStatus, string> = {
  confirmed: 'bg-green-500/10 text-green-400 border-green-500/30',
  waitlist: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  cancelled: 'bg-tea-text-sec/10 text-tea-text-sec border-tea-text-sec/30',
};

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'waitlist', label: 'Waitlisted' },
  { key: 'cancelled', label: 'Cancelled' },
];

export const AttendeeTable: React.FC<AttendeeTableProps> = ({ attendees, eventId, onRefresh }) => {
  const { showToast } = useToast();
  const [filter, setFilter] = useState<FilterTab>('all');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortAsc, setSortAsc] = useState(true);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const counts = useMemo(() => {
    const confirmed = attendees.filter(a => a.status === 'confirmed').length;
    const waitlist = attendees.filter(a => a.status === 'waitlist').length;
    const cancelled = attendees.filter(a => a.status === 'cancelled').length;
    return { confirmed, waitlist, cancelled };
  }, [attendees]);

  const filtered = useMemo(() => {
    let list = [...attendees];
    if (filter !== 'all') {
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
      await api.events.updateAttendee(attendee.id, { status: newStatus });
      showToast(`${attendee.fullName} ${newStatus === 'confirmed' ? 'promoted' : newStatus}`, 'success');
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
      showToast(`${attendee.fullName} marked as ${!attendee.attended ? 'attended' : 'not attended'}`, 'success');
      onRefresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to update', 'error');
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div>
      {/* Count Header */}
      <div className="flex items-center gap-4 mb-4 text-xs text-tea-text-sec">
        <span className="text-green-400">{counts.confirmed} confirmed</span>
        <span className="text-amber-400">{counts.waitlist} waitlisted</span>
        <span>{counts.cancelled} cancelled</span>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 mb-4 border-b border-tea-border">
        {FILTER_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-3 py-2 text-xs transition-colors border-b-2 -mb-px ${
              filter === tab.key
                ? 'border-tea-gold text-tea-gold'
                : 'border-transparent text-tea-text-sec hover:text-tea-text-sec'
            }`}
          >
            {tab.label}
          </button>
        ))}
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
                  { field: null, label: '+1' },
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
              {filtered.map(attendee => (
                <tr key={attendee.id} className="border-b border-tea-border/50 hover:bg-tea-elevated/30 transition-colors">
                  <td className="py-2.5 px-2 text-tea-text font-medium">{attendee.fullName}</td>
                  <td className="py-2.5 px-2 text-tea-text-sec text-xs">
                    {attendee.phoneNumber ? (
                      <span className="flex items-center gap-1"><Phone size={10} /> {attendee.phoneNumber}</span>
                    ) : (
                      <span className="text-tea-text-sec">—</span>
                    )}
                  </td>
                  <td className="py-2.5 px-2">
                    <span className={`text-[10px] uppercase tracking-[0.1em] px-2 py-0.5 rounded-full border ${STATUS_CHIPS[attendee.status]}`}>
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
                  <td className="py-2.5 px-2 text-tea-text-sec text-xs">
                    {attendee.plusOne ? (
                      <span className="flex items-center gap-1"><UserPlus size={10} /> Yes</span>
                    ) : (
                      <span className="text-tea-text-sec">—</span>
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
                    {attendee.notes || '—'}
                  </td>
                  <td className="py-2.5 px-2">
                    <button
                      onClick={() => toggleAttended(attendee)}
                      disabled={loadingId === attendee.id}
                      className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                        attendee.attended
                          ? 'bg-tea-gold border-tea-gold text-tea-bg'
                          : 'border-tea-border text-tea-text-sec hover:border-tea-gold/50'
                      }`}
                    >
                      {loadingId === attendee.id ? (
                        <Loader2 size={10} className="animate-spin" />
                      ) : attendee.attended ? (
                        <Check size={10} />
                      ) : null}
                    </button>
                  </td>
                  <td className="py-2.5 px-2">
                    <div className="flex items-center gap-1">
                      {attendee.status === 'waitlist' && (
                        <button
                          onClick={() => updateStatus(attendee, 'confirmed')}
                          disabled={loadingId === attendee.id}
                          className="text-[10px] px-2 py-1 rounded bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors"
                        >
                          Promote
                        </button>
                      )}
                      {attendee.status !== 'cancelled' && (
                        <button
                          onClick={() => updateStatus(attendee, 'cancelled')}
                          disabled={loadingId === attendee.id}
                          className="text-[10px] px-2 py-1 rounded bg-tea-text-sec/10 text-tea-text-sec hover:bg-tea-text-sec/20 transition-colors"
                        >
                          Cancel
                        </button>
                      )}
                      {attendee.status === 'cancelled' && (
                        <button
                          onClick={() => updateStatus(attendee, 'confirmed')}
                          disabled={loadingId === attendee.id}
                          className="text-[10px] px-2 py-1 rounded bg-tea-gold/10 text-tea-gold hover:bg-tea-gold/20 transition-colors"
                        >
                          Restore
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
