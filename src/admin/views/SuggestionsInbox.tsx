import React, { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { useAppStore, selectHasBundle } from '../../lib/store';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import type { ProfileSuggestion, ProfileSuggestionDecision, ProfileSuggestionFieldStatus } from '../../types';

// ── Suggestions Inbox — Surface 6 per docs/NETWORK_UI_BRIEF.md ───────────────
//
// Adrian reviews incoming canonical-edit bundles from partners.
// Each bundle expands inline (no modal, no drawer). Per-field accept/reject.
// Accepted fields write to canonical immediately via api.network.decideSuggestion.
// No rationale on the suggestion (Decision 25). No toasts for routine actions.
// Errors as italic prose in tertiary color, no red boxes.

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'long' });
}

/** Human-readable label for a canonical field name. */
function fieldLabel(name: string): string {
  const labels: Record<string, string> = {
    name: 'name',
    chinese_name: 'chinese name',
    type: 'type',
    form: 'form',
    origin_country: 'origin country',
    origin_region: 'origin region',
    varietal: 'varietal',
    harvest_year: 'harvest year',
    description: 'description',
    lore: 'lore',
    processing_notes: 'processing notes',
    terroir: 'terroir',
    mood: 'mood',
    experience: 'experience',
    image_url: 'photo',
  };
  return labels[name] ?? name.replace(/_/g, ' ');
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton loading
// ─────────────────────────────────────────────────────────────────────────────

const SkeletonRow: React.FC = () => (
  <div className="py-5 border-b border-tea-border animate-pulse">
    <div className="h-[17px] w-1/2 bg-tea-surface rounded-[2px] mb-2" />
    <div className="h-[12px] w-2/5 bg-tea-surface rounded-[2px] mb-2" />
    <div className="h-[12px] w-1/3 bg-tea-surface rounded-[2px]" />
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Filter tab
// ─────────────────────────────────────────────────────────────────────────────

type FilterStatus = 'default' | 'partial' | 'resolved' | 'withdrawn';

interface FilterTabProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

const FilterTab: React.FC<FilterTabProps> = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`text-[14px] transition-colors ${
      active ? 'text-tea-gold' : 'text-tea-text-sec hover:text-tea-text'
    }`}
  >
    {children}
  </button>
);

// ─────────────────────────────────────────────────────────────────────────────
// Per-field decision state (local to one bundle expansion)
// ─────────────────────────────────────────────────────────────────────────────

interface FieldDecisionState {
  status: 'pending' | 'accepted' | 'rejected';
  rejectNote: string;
  rejectNoteOpen: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// FieldRow — one canonical field within an expanded bundle
// ─────────────────────────────────────────────────────────────────────────────

interface FieldRowProps {
  fieldId: string;
  fieldName: string;
  currentValue: string | null;
  proposedValue: string;
  serverStatus: ProfileSuggestionFieldStatus;
  decision: FieldDecisionState;
  onChange: (fieldId: string, patch: Partial<FieldDecisionState>) => void;
  submitted: boolean;
}

const FieldRow: React.FC<FieldRowProps> = ({
  fieldId,
  fieldName,
  currentValue,
  proposedValue,
  serverStatus,
  decision,
  onChange,
  submitted,
}) => {
  const rejectNoteRef = useRef<HTMLTextAreaElement>(null);

  // If server already has a terminal decision, show it read-only
  const isTerminal = serverStatus === 'accepted' || serverStatus === 'rejected';
  if (isTerminal) {
    return (
      <div className="py-4 border-b border-tea-border last:border-b-0">
        <div className="flex items-baseline gap-3 mb-3">
          <span className="text-tea-text-sec text-[11px] uppercase tracking-[0.1em]">
            {fieldLabel(fieldName)}
          </span>
          <span className="text-tea-text-sec italic text-[12px]">
            {serverStatus === 'accepted' ? 'accepted' : 'rejected'}
          </span>
        </div>
        <div className="space-y-1.5 pl-0">
          <div>
            <span className="text-tea-text-sec text-[12px] mr-2">Currently</span>
            <span className="text-tea-text-sec italic text-[14px]">
              {currentValue ?? <em className="text-tea-text-dim">none</em>}
            </span>
          </div>
          <div>
            <span className="text-tea-text-sec text-[12px] mr-2">Proposed</span>
            <span className="text-tea-text text-[14px]">{proposedValue}</span>
          </div>
        </div>
      </div>
    );
  }

  const { status, rejectNote, rejectNoteOpen } = decision;

  const handleAccept = () => {
    if (submitted) return;
    onChange(fieldId, { status: status === 'accepted' ? 'pending' : 'accepted', rejectNoteOpen: false });
  };

  const handleRejectClick = () => {
    if (submitted) return;
    if (status === 'rejected') {
      onChange(fieldId, { status: 'pending', rejectNoteOpen: false });
    } else {
      onChange(fieldId, { status: 'rejected', rejectNoteOpen: true });
      setTimeout(() => rejectNoteRef.current?.focus(), 50);
    }
  };

  return (
    <div className="py-4 border-b border-tea-border last:border-b-0">
      {/* Field label */}
      <div className="text-tea-text-sec text-[11px] uppercase tracking-[0.1em] mb-3">
        {fieldLabel(fieldName)}
      </div>

      {/* Current / proposed values */}
      <div className="space-y-2 mb-3">
        <div className="flex items-baseline gap-3 flex-wrap">
          <span className="text-tea-text-sec text-[12px] shrink-0 w-16">Currently</span>
          <span
            className={`text-[14px] leading-[1.6] ${
              currentValue ? 'text-tea-text-sec italic' : 'text-tea-text-dim italic'
            }`}
          >
            {currentValue ?? '—'}
          </span>
        </div>
        <div className="flex items-baseline gap-3 flex-wrap">
          <span className="text-tea-text-sec text-[12px] shrink-0 w-16">Proposed</span>
          <span
            className={`text-[14px] leading-[1.6] ${
              status === 'accepted'
                ? 'text-tea-text underline decoration-tea-gold decoration-1 underline-offset-2'
                : 'text-tea-text'
            }`}
          >
            {proposedValue}
          </span>
        </div>
      </div>

      {/* Decision row */}
      {status === 'accepted' ? (
        <div className="flex items-baseline gap-4 text-[13px]">
          <span className="text-tea-text-sec italic">Accepted just now</span>
          <button
            type="button"
            onClick={handleAccept}
            disabled={submitted}
            className="text-tea-text-sec hover:text-tea-text transition-colors disabled:text-tea-text-dim"
          >
            Undo
          </button>
        </div>
      ) : status === 'rejected' ? (
        <div className="space-y-2">
          <div className="flex items-baseline gap-4 text-[13px]">
            <span className="text-tea-text-sec italic">
              Rejected{rejectNote ? ': ' + rejectNote : ''}
            </span>
            <button
              type="button"
              onClick={handleRejectClick}
              disabled={submitted}
              className="text-tea-text-sec hover:text-tea-text transition-colors disabled:text-tea-text-dim"
            >
              Undo
            </button>
          </div>
          {rejectNoteOpen && (
            <div className="mt-2 space-y-2">
              <textarea
                ref={rejectNoteRef}
                value={rejectNote}
                onChange={e => onChange(fieldId, { rejectNote: e.target.value })}
                placeholder="Optional note for the partner"
                rows={2}
                disabled={submitted}
                className="w-full bg-transparent border-b border-tea-border focus:border-tea-gold outline-none text-tea-text font-body text-[14px] py-1.5 italic transition-colors resize-none placeholder:text-tea-text-dim"
              />
              <div className="flex gap-4 text-[13px]">
                <button
                  type="button"
                  onClick={() => onChange(fieldId, { rejectNoteOpen: false })}
                  disabled={submitted}
                  className="text-tea-text-sec hover:text-tea-text transition-colors"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => onChange(fieldId, { rejectNoteOpen: false, rejectNote: '', status: 'pending' })}
                  disabled={submitted}
                  className="text-tea-text-sec hover:text-tea-text transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-baseline gap-6 text-[13px]">
          <button
            type="button"
            onClick={handleAccept}
            disabled={submitted}
            className="text-tea-text-sec hover:text-tea-gold transition-colors disabled:text-tea-text-dim"
          >
            Accept
          </button>
          <button
            type="button"
            onClick={handleRejectClick}
            disabled={submitted}
            className="text-tea-text-sec hover:text-tea-text transition-colors disabled:text-tea-text-dim"
          >
            Reject
          </button>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// BundleRow — one suggestion bundle in the list
// ─────────────────────────────────────────────────────────────────────────────

interface BundleRowProps {
  suggestion: ProfileSuggestion;
  onRefetch: () => void;
}

const BundleRow: React.FC<BundleRowProps> = ({ suggestion, onRefetch }) => {
  const [expanded, setExpanded] = useState(false);
  const [decisions, setDecisions] = useState<Record<string, FieldDecisionState>>(() => {
    const init: Record<string, FieldDecisionState> = {};
    suggestion.fields.forEach(f => {
      init[f.id] = { status: 'pending', rejectNote: '', rejectNoteOpen: false };
    });
    return init;
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successLine, setSuccessLine] = useState<string | null>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const decidedCount = Object.values(decisions).filter(d => d.status !== 'pending').length;
  const totalFields = suggestion.fields.length;
  // Treat server-decided fields (accepted/rejected) as already counted
  const serverDecidedCount = suggestion.fields.filter(
    f => f.status === 'accepted' || f.status === 'rejected'
  ).length;
  const pendingFields = suggestion.fields.filter(f => f.status === 'pending');
  const localDecidedCount = pendingFields.filter(f => decisions[f.id]?.status !== 'pending').length;
  const totalDecided = serverDecidedCount + localDecidedCount;

  const handleFieldChange = useCallback((fieldId: string, patch: Partial<FieldDecisionState>) => {
    setDecisions(prev => ({
      ...prev,
      [fieldId]: { ...prev[fieldId], ...patch },
    }));
    setSubmitError(null);
  }, []);

  const handleSubmit = async () => {
    if (submitting) return;

    // Build decision payload — only fields that have a local decision
    const payload: ProfileSuggestionDecision[] = pendingFields
      .filter(f => decisions[f.id]?.status !== 'pending')
      .map(f => {
        const d = decisions[f.id];
        return {
          field_id: f.id,
          status: d.status as 'accepted' | 'rejected',
          ...(d.status === 'rejected' && d.rejectNote.trim()
            ? { reject_note: d.rejectNote.trim() }
            : {}),
        };
      });

    if (payload.length === 0) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await api.network.decideSuggestion(suggestion.id, payload);
      const acceptedCount = payload.filter(d => d.status === 'accepted').length;
      const rejectedCount = payload.filter(d => d.status === 'rejected').length;
      const stillPending = totalFields - totalDecided - payload.length;

      let line = `Decisions sent.`;
      if (acceptedCount > 0) line += ` ${acceptedCount} accepted`;
      if (rejectedCount > 0) line += `${acceptedCount > 0 ? ',' : ''} ${rejectedCount} rejected`;
      if (stillPending > 0) line += `, ${stillPending} still pending`;
      line += '.';
      setSuccessLine(line);

      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      successTimerRef.current = setTimeout(() => {
        setSuccessLine(null);
        onRefetch();
      }, 5000);

      // If bundle is resolved, collapse it
      if (result.bundle_status === 'resolved') {
        setExpanded(false);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('400') || msg.toLowerCase().includes('withdrawn')) {
        setSubmitError('This bundle was withdrawn.');
        onRefetch();
      } else {
        setSubmitError("Couldn't reach the server. Your decisions are held — try Submit again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Cleanup timer on unmount
  useEffect(() => () => {
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
  }, []);

  const fieldNames = suggestion.fields.map(f => fieldLabel(f.field_name)).join(', ');
  const suggestedByLine = [
    suggestion.suggested_by_user_name || suggestion.suggested_by_email || 'a partner',
    suggestion.suggested_by_account_name,
    formatDate(suggestion.created_at),
  ].filter(Boolean).join(' · ');

  return (
    <div className="border-b border-tea-border last:border-b-0">
      {/* Collapsed row */}
      <div className="py-5">
        {successLine && (
          <p className="text-tea-text-sec italic text-[13px] mb-3 leading-[1.6]">{successLine}</p>
        )}
        <div className="font-display text-[17px] text-tea-text leading-[1.3] mb-1">
          {suggestion.profile_name || suggestion.profile_id}
        </div>
        <div className="text-tea-text-sec text-[12px] mb-2 leading-[1.5]">{suggestedByLine}</div>
        <div className="flex items-baseline justify-between gap-4 flex-wrap">
          <div className="text-tea-text-sec text-[13px]">
            {suggestion.fields.length === 1
              ? `1 field proposed: ${fieldNames}`
              : `${suggestion.fields.length} fields proposed: ${fieldNames}`}
          </div>
          {!expanded && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="text-tea-text-sec hover:text-tea-text transition-colors text-[13px] shrink-0 font-display tracking-[0.04em]"
            >
              Review
            </button>
          )}
        </div>
      </div>

      {/* Expanded inline review */}
      {expanded && (
        <div className="pb-6">
          <div className="text-tea-text-sec text-[12px] uppercase tracking-[0.08em] mb-4">
            Field-by-field review for {suggestion.profile_name || suggestion.profile_id}
          </div>

          {submitError && (
            <p className="text-tea-text-sec italic text-[13px] mb-4 leading-[1.6]">{submitError}</p>
          )}

          {/* Field rows */}
          <div>
            {suggestion.fields.map(field => (
              <FieldRow
                key={field.id}
                fieldId={field.id}
                fieldName={field.field_name}
                currentValue={field.current_value}
                proposedValue={field.proposed_value}
                serverStatus={field.status}
                decision={decisions[field.id] ?? { status: 'pending', rejectNote: '', rejectNoteOpen: false }}
                onChange={handleFieldChange}
                submitted={submitting}
              />
            ))}
          </div>

          {/* Footer */}
          <div className="mt-5 flex items-baseline justify-between gap-4 flex-wrap">
            <span className="text-tea-text-sec text-[13px] italic">
              {totalDecided} of {totalFields} decided.
            </span>
            <div className="flex items-baseline gap-6 text-[13px]">
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="text-tea-text-sec hover:text-tea-text transition-colors"
              >
                Collapse
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || localDecidedCount === 0}
                className={`font-display tracking-[0.04em] transition-colors disabled:text-tea-text-dim ${
                  localDecidedCount > 0 && !submitting
                    ? 'text-tea-text-sec hover:text-tea-gold'
                    : 'text-tea-text-dim'
                }`}
              >
                {submitting ? 'Submitting…' : 'Submit decisions'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

interface SuggestionsInboxProps {
  /** When rendered inside the Network hub, drop the page-level top/bottom padding. */
  embedded?: boolean;
}

export const SuggestionsInbox: React.FC<SuggestionsInboxProps> = ({ embedded = false }) => {
  const hasCatalog = useAppStore(s => selectHasBundle(s, 'catalog'));
  const outerClass = embedded
    ? 'px-4 md:px-6 max-w-[720px] mx-auto'
    : 'px-4 md:px-6 pt-6 pb-nav-gap max-w-[720px] mx-auto';
  const [filter, setFilter] = useState<FilterStatus>('default');
  const [suggestions, setSuggestions] = useState<ProfileSuggestion[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const statusParam =
        filter === 'resolved' ? 'resolved'
        : filter === 'withdrawn' ? 'withdrawn'
        : filter === 'partial' ? 'partial'
        : undefined; // default = pending + partial
      const data = await api.network.incomingSuggestions(statusParam);
      setSuggestions(data.suggestions);
    } catch (err: unknown) {
      // Keep stale data visible; show error as prose
      if (suggestions === null) setSuggestions([]);
      setError("Couldn't reach the server. Showing the last known state.");
    } finally {
      setLoading(false);
    }
  }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void load();
  }, [load]);

  // Permission gate
  if (!hasCatalog) {
    return (
      <div className={outerClass}>
        <p className="text-tea-text-sec italic text-[15px] leading-[1.65]">
          This page requires the Catalog bundle. Ask your owner.
        </p>
      </div>
    );
  }

  // Build header count line
  const pendingCount = suggestions?.length ?? 0;
  const partnerSet = new Set(suggestions?.map(s => s.suggested_by_account_id) ?? []);
  const partnerCount = partnerSet.size;

  const countLine =
    filter === 'default'
      ? pendingCount === 0
        ? null
        : pendingCount === 1
          ? `1 bundle from ${partnerCount === 1 ? '1 partner' : `${partnerCount} partners`}`
          : `${pendingCount} bundles from ${partnerCount === 1 ? '1 partner' : `${partnerCount} partners`}`
      : null;

  return (
    <div className={outerClass}>
      {/* Header */}
      <header className="mb-8">
        <h1 className={`${TYPOGRAPHY_CLASSES.h2} text-tea-text mb-2`}>
          Suggestions waiting for you
        </h1>
        {loading && suggestions === null ? null : countLine ? (
          <p className="text-tea-text-sec italic text-[14px] leading-[1.6]">{countLine}</p>
        ) : filter === 'default' && !loading ? (
          <p className="text-tea-text-sec italic text-[14px] leading-[1.6]">
            Quiet for now. Partners haven't proposed any edits.
          </p>
        ) : null}
      </header>

      {/* Filter line — text-link tabs, no chrome */}
      <div className="flex items-baseline gap-3 mb-8 text-[14px]">
        <FilterTab active={filter === 'default'} onClick={() => setFilter('default')}>
          Pending
        </FilterTab>
        <span className="text-tea-border" aria-hidden>·</span>
        <FilterTab active={filter === 'partial'} onClick={() => setFilter('partial')}>
          Partial
        </FilterTab>
        <span className="text-tea-border" aria-hidden>·</span>
        <FilterTab active={filter === 'resolved'} onClick={() => setFilter('resolved')}>
          Resolved
        </FilterTab>
        <span className="text-tea-border" aria-hidden>·</span>
        <FilterTab active={filter === 'withdrawn'} onClick={() => setFilter('withdrawn')}>
          Withdrawn
        </FilterTab>
      </div>

      {/* Error prose */}
      {error && (
        <p className="text-tea-text-sec italic text-[14px] mb-6 leading-[1.6]">{error}</p>
      )}

      {/* Loading skeletons */}
      {loading && suggestions === null && (
        <div>
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      )}

      {/* Bundle list */}
      {suggestions !== null && suggestions.length === 0 && !loading && (
        <p className="text-tea-text-sec italic text-[15px] leading-[1.65]">
          {filter === 'resolved'
            ? 'No resolved suggestions.'
            : filter === 'withdrawn'
              ? 'No withdrawn suggestions.'
              : 'Quiet for now. Partners haven\'t proposed any edits.'}
        </p>
      )}

      {suggestions !== null && suggestions.length > 0 && (
        <div>
          {suggestions.map(s => (
            <BundleRow key={s.id} suggestion={s} onRefetch={load} />
          ))}
        </div>
      )}
    </div>
  );
};
