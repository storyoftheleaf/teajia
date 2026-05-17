import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check, RefreshCw } from 'lucide-react';
import { api } from '../../../lib/api';

interface ShareScreenProps {
  sessionId: string;
  sessionTitle?: string | null;
}

interface HostLive {
  session: { id: string; title?: string | null };
  teas: { id: string; tea_name: string; tea_metadata: { name?: string }; position: number }[];
  members: { user_id: string; name?: string | null; user_name?: string | null }[];
}

export function ShareScreen({ sessionId }: ShareScreenProps) {
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);

  const codeQuery = useQuery<{ code: string; expires_at: string }>({
    queryKey: ['tasting-join-code', sessionId],
    queryFn: () => api.sessions.issueJoinCode(sessionId),
    staleTime: Infinity,
  });

  const liveQuery = useQuery<HostLive>({
    queryKey: ['tasting-host-live', sessionId, 'share'],
    queryFn: () => api.sessions.hostLive(sessionId),
    refetchInterval: 5_000,
    staleTime: 0,
  });

  const revoke = useMutation({
    mutationFn: () => api.sessions.revokeJoinCode(codeQuery.data!.code),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['tasting-join-code', sessionId] });
      await codeQuery.refetch();
    },
  });

  const code = codeQuery.data?.code ?? '';
  const joinUrl = code ? `${window.location.origin}/join/${code}` : '';

  const onCopyCode = () => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopied(true);
  };

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(t);
  }, [copied]);

  const teas = (liveQuery.data?.teas ?? []).slice().sort((a, b) => a.position - b.position);
  const members = liveQuery.data?.members ?? [];

  return (
    <div className="max-w-3xl mx-auto py-8 px-6 space-y-12">
      {/* Code */}
      <div className="text-center">
        <p className="text-ui-11 uppercase tracking-[0.18em] text-tea-text-sec mb-4">
          Code
        </p>
        <button
          type="button"
          onClick={onCopyCode}
          className="font-display font-light text-tea-text tracking-[0.08em] leading-none cursor-pointer"
          style={{ fontSize: '88px' }}
          aria-label="Copy code"
        >
          {codeQuery.isLoading ? '…' : code}
        </button>
        <div className="mt-3 flex items-center justify-center gap-3 text-ui-12 text-tea-text-sec">
          <button
            type="button"
            onClick={onCopyCode}
            disabled={!code}
            className="inline-flex items-center gap-1.5 hover:text-tea-text"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-tea-gold-lt" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <span>·</span>
          <button
            type="button"
            onClick={() => revoke.mutate()}
            disabled={!code || revoke.isPending}
            className="inline-flex items-center gap-1.5 hover:text-tea-text disabled:opacity-50"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {revoke.isPending ? 'Revoking…' : 'Revoke + new'}
          </button>
        </div>
      </div>

      {/* QR */}
      <div className="flex flex-col items-center">
        <div className="rounded-xl bg-tea-elevated p-6">
          {joinUrl && (
            <QRCodeSVG
              value={joinUrl}
              size={240}
              bgColor="transparent"
              fgColor="currentColor"
              className="text-tea-text"
              level="M"
            />
          )}
        </div>
        <p className="mt-4 text-ui-12 text-tea-text-sec text-center">
          Guests open <span className="text-tea-text">teajia.app/join</span> and enter this code
        </p>
      </div>

      {/* Tea list */}
      {teas.length > 0 && (
        <div>
          <p className="text-ui-11 uppercase tracking-[0.14em] text-tea-text-sec mb-3 text-center">
            On the table
          </p>
          <ul className="max-w-sm mx-auto space-y-1.5">
            {teas.map((t, i) => (
              <li key={t.id} className="flex items-baseline gap-3 text-ui-13">
                <span className="font-display text-tea-gold-lt w-7 text-right">
                  {romanShort(i)}
                </span>
                <span className="text-tea-text">
                  {t.tea_metadata?.name || t.tea_name}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Joined strip */}
      <div>
        <p className="text-ui-11 uppercase tracking-[0.14em] text-tea-text-sec mb-3 text-center">
          Joined ({members.length})
        </p>
        {members.length === 0 ? (
          <p className="text-ui-12 text-tea-text-sec text-center">
            Waiting for first guest…
          </p>
        ) : (
          <div className="flex flex-wrap gap-2 justify-center">
            {members.map((m) => (
              <span
                key={m.user_id}
                className="rounded-full bg-tea-elevated px-3 py-1 text-ui-12 text-tea-text"
              >
                {m.user_name || m.name || 'Guest'}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const ROMAN = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
function romanShort(i: number): string { return ROMAN[i] ?? String(i + 1); }
