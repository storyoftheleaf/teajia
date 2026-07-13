import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Heart, ThumbsUp, Minus, ThumbsDown, Bookmark } from 'lucide-react';
import { api } from '../../../lib/api';

interface HostLive {
  session: { id: string; status: 'active' | 'completed'; title?: string | null };
  teas: { id: string; tea_name: string; tea_metadata: { name?: string }; position: number }[];
  members: { user_id: string; name?: string | null; user_name?: string | null }[];
  verdicts: {
    user_id: string;
    session_tea_id: string;
    verdict?: string;
    tasting_data?: any;
    notes?: string;
  }[];
  progress: { user_id: string; completed: number; total: number }[];
}

interface LiveMatrixProps {
  sessionId: string;
}

function VerdictDot({ v, wouldBuy, quality }: { v?: string; wouldBuy?: boolean; quality?: number | null }) {
  let icon: React.ReactNode = null;
  let cls = 'text-tea-text-dim';
  if (v === 'love') { icon = <Heart className="w-3.5 h-3.5 fill-current" />; cls = 'text-tea-gold'; }
  else if (v === 'like') { icon = <ThumbsUp className="w-3.5 h-3.5" />; cls = 'text-tea-gold-lt'; }
  else if (v === 'neutral') { icon = <Minus className="w-3.5 h-3.5" />; cls = 'text-tea-text-sec'; }
  else if (v === 'pass') { icon = <ThumbsDown className="w-3.5 h-3.5" />; cls = 'text-tea-text-dim'; }
  if (!icon) return <span className="block w-7 h-7 rounded-full border border-tea-border" aria-hidden />;
  return (
    <span className={`inline-flex flex-col items-center justify-center gap-0.5 w-9 ${cls}`}>
      <span className="inline-flex items-center gap-1">
        {icon}
        {wouldBuy && <Bookmark className="w-3 h-3 text-tea-gold-lt" />}
      </span>
      {quality != null && (
        <span className="text-ui-10 text-tea-text-sec font-display">{quality}</span>
      )}
    </span>
  );
}

export function LiveMatrix({ sessionId }: LiveMatrixProps) {
  const { data, isLoading } = useQuery<HostLive>({
    queryKey: ['tasting-host-live', sessionId, 'matrix'],
    queryFn: () => api.sessions.hostLive(sessionId),
    refetchInterval: 7_000,
    staleTime: 0,
  });

  const teas = useMemo(
    () => (data?.teas ?? []).slice().sort((a, b) => a.position - b.position),
    [data?.teas]
  );
  const members = data?.members ?? [];
  const verdicts = data?.verdicts ?? [];

  const aggregate = useMemo(() => {
    let tastings = 0;
    let wouldBuys = 0;
    const guestsCompleted = new Set<string>();
    for (const v of verdicts) {
      tastings++;
      if (v.tasting_data?.wouldBuy) wouldBuys++;
    }
    for (const p of (data?.progress ?? [])) {
      if (p.total > 0 && p.completed === p.total) guestsCompleted.add(p.user_id);
    }
    return { tastings, wouldBuys, guestsCompleted: guestsCompleted.size };
  }, [verdicts, data?.progress]);

  if (isLoading) {
    return <p className="text-ui-13 text-tea-text-sec px-6 py-6">Loading…</p>;
  }

  if (members.length === 0) {
    return (
      <div className="px-6 py-12 text-center max-w-md mx-auto">
        <p className="font-display font-normal text-ui-17 text-tea-text mb-2">
          No guests yet
        </p>
        <p className="text-ui-12 text-tea-text-sec">
          Switch to the Share tab to show the code or QR.
        </p>
      </div>
    );
  }

  const verdictByCell = (userId: string, teaId: string) =>
    verdicts.find(v => v.user_id === userId && v.session_tea_id === teaId);

  return (
    <div className="px-6 py-6 space-y-6">
      <div className="text-ui-12 text-tea-text-sec text-center tracking-wide">
        {aggregate.guestsCompleted} of {members.length} guests
        <span className="mx-2">·</span>
        {aggregate.tastings} tastings recorded
        <span className="mx-2">·</span>
        {aggregate.wouldBuys} would-buys
      </div>

      <div className="overflow-auto">
        <table className="min-w-full">
          <thead>
            <tr>
              <th className="text-left text-ui-11 uppercase tracking-[0.14em] text-tea-text-sec font-normal pb-3 pr-4">
                Tea
              </th>
              {members.map(m => (
                <th
                  key={m.user_id}
                  className="text-center text-ui-11 text-tea-text-sec font-normal pb-3 px-2 min-w-[64px]"
                >
                  {m.user_name || m.name || 'Guest'}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {teas.map((t, i) => (
              <tr key={t.id} className="border-t border-tea-border">
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-ui-12 text-tea-gold-lt w-6">
                      {romanShort(i)}
                    </span>
                    <span className="text-ui-13 text-tea-text">
                      {t.tea_metadata?.name || t.tea_name}
                    </span>
                  </div>
                </td>
                {members.map(m => {
                  const v = verdictByCell(m.user_id, t.id);
                  return (
                    <td key={m.user_id} className="text-center px-2 py-2">
                      <VerdictDot
                        v={v?.verdict}
                        wouldBuy={v?.tasting_data?.wouldBuy}
                        quality={v?.tasting_data?.quality ?? null}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const ROMAN = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
function romanShort(i: number): string { return ROMAN[i] ?? String(i + 1); }
