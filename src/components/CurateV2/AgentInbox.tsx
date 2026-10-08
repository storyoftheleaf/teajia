import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { api, hasToken, type CurateSuggestionGroup } from '../../lib/api';
import { hydrateCompassEntries } from '../../lib/teaCompassSync';
import { useAppStore } from '../../lib/store';
import { BottomSheet } from '../shared/BottomSheet';
import { CURRENCY_LABELS } from './PricingRow';

export const AGENT_KEYS = {
  suggestions: ['curate', 'agent-suggestions'] as const,
  todos: ['curate', 'todos'] as const,
  arriving: ['curate', 'pending-receipts'] as const,
};

const hostOf = (url: string | null) => {
  if (!url) return null;
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return null; }
};

export const errorText = (e: unknown) => (e instanceof Error ? e.message : 'That did not go through. Try again.');

/** What agents left: their finds, the to-dos, the orders on the way. One read each. */
export function useAgentLists() {
  const signedIn = hasToken();
  const suggestions = useQuery({ queryKey: AGENT_KEYS.suggestions, queryFn: () => api.compass.agentSuggestions(), enabled: signedIn, staleTime: 30_000 });
  const todos = useQuery({ queryKey: AGENT_KEYS.todos, queryFn: () => api.compass.todos(), enabled: signedIn, staleTime: 30_000 });
  const arriving = useQuery({ queryKey: AGENT_KEYS.arriving, queryFn: () => api.compass.pendingReceipts(), enabled: signedIn, staleTime: 30_000 });
  return {
    groups: suggestions.data?.waiting ?? [],
    todos: todos.data?.todos ?? [],
    arriving: arriving.data?.pending ?? [],
  };
}

/** A square tick, the size of a thumb. */
export const Tick: React.FC<{ on: boolean; label: string; onClick: () => void; round?: boolean }> = ({ on, label, onClick, round }) => (
  <button
    type="button"
    role="checkbox"
    aria-checked={on}
    aria-label={label}
    onClick={onClick}
    className="-ml-2.5 flex h-11 w-11 shrink-0 items-center justify-center"
  >
    <span className={`flex h-[17px] w-[17px] items-center justify-center border ${round ? 'rounded-full' : 'rounded-[3px]'} ${on ? 'cta-solid border-tea-gold' : 'border-tea-text-dim text-transparent'}`}>
      <Check size={12} strokeWidth={2.75} />
    </span>
  </button>
);

/**
 * One find from an agent, as its own screen: who found it and where, a tick
 * per tea, then Not now or Add to samples. The teas not ticked are cleared, so
 * the same find does not come back.
 */
export const AgentFindsSheet: React.FC<{ group: CurateSuggestionGroup | null; onClose: () => void }> = ({ group, onClose }) => {
  const queryClient = useQueryClient();
  const accountId = useAppStore((s) => s.activeAccountId);
  const [kept, setKept] = useState<Set<string>>(new Set());
  useEffect(() => { setKept(new Set()); }, [group?.batch_id]);
  const pick = useMutation({
    mutationFn: () => {
      const all = group!.teas.map((t) => t.id);
      return api.compass.pickAgentSuggestions({ pick: all.filter((id) => kept.has(id)), drop: all.filter((id) => !kept.has(id)) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AGENT_KEYS.suggestions });
      hydrateCompassEntries(accountId ?? undefined).catch(() => {});
      onClose();
    },
  });
  const toggle = (id: string) => setKept((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  if (!group) return null;
  const rest = group.teas.length - kept.size;
  const host = hostOf(group.url);

  return (
    <BottomSheet open={!!group} onOpenChange={(o) => { if (!o) onClose(); }} title={`From ${group.found_by || 'your agent'}`} description={`${kept.size} of ${group.teas.length} ticked`} large>
      <div className="curate-v2 pb-nav-gap" data-testid="agent-finds-sheet">
        {(group.vendor || host) && (
          <div className="flex items-baseline justify-between gap-3 border-b border-tea-border px-4 py-2.5">
            <span className="curate-v2-name">{group.vendor || 'Unknown vendor'}</span>
            {host && <span className="truncate text-ui-12 text-tea-text-sec">{host}</span>}
          </div>
        )}
        {group.note && <p className="border-b border-tea-border px-4 py-2 text-ui-13 text-tea-text-sec">{group.note}</p>}
        {group.teas.map((t) => {
          const sym = t.price ? (CURRENCY_LABELS[t.price.currency as keyof typeof CURRENCY_LABELS] ?? `${t.price.currency} `) : '';
          const per = t.price?.per_grams === 500 ? 'jin' : t.price?.per_grams === 50 ? 'liang' : t.price?.per_grams ? `${t.price.per_grams} g` : t.category === 'teaware' ? 'each' : '';
          return (
            <div key={t.id} className="curate-v2-row">
              <Tick on={kept.has(t.id)} label={`Keep ${t.name}`} onClick={() => toggle(t.id)} />
              <button type="button" onClick={() => toggle(t.id)} className="flex min-w-0 flex-1 items-baseline gap-2 text-left">
                <span className="curate-v2-name">{t.year != null && !t.name.includes(String(t.year)) ? `${t.year} ${t.name}` : t.name}</span>
                <span className="flex-1" />
                {t.price && (
                  <span className="text-ui-13 font-medium text-tea-text-sec tabular-nums">
                    {sym}{Number(t.price.amount).toLocaleString()}{per && <span className="ml-1 text-ui-12 font-normal text-tea-text-dim">{per}</span>}
                  </span>
                )}
              </button>
            </div>
          );
        })}
        <div className="grid grid-cols-2 gap-2 px-4 pt-3">
          <button type="button" onClick={onClose} className="min-h-11 rounded-md border border-tea-border text-ui-13 font-medium text-tea-text-sec hover:text-tea-text">Not now</button>
          <button type="button" onClick={() => pick.mutate()} disabled={pick.isPending || kept.size === 0} className="cta-solid min-h-11 rounded-md text-ui-13 font-semibold disabled:opacity-50">
            {kept.size ? `Add ${kept.size} to samples` : 'Tick the ones you want'}
          </button>
        </div>
        {kept.size > 0 && rest > 0 && <p className="px-4 pt-2 text-ui-12 text-tea-text-dim">The other {rest} are cleared.</p>}
        {pick.isError && <p className="px-4 pt-2 text-ui-12 text-tea-error">{errorText(pick.error)}</p>}
      </div>
    </BottomSheet>
  );
};
