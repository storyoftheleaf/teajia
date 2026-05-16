import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, hasToken } from '../lib/api';
import { Icons } from '../components/Icons';
import { TYPOGRAPHY_CLASSES } from '../designTokens';

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

function statusLabel(status: string): string {
  // Normalise lifecycle labels — the underlying column carries verbs like
  // "untasted" / "tasted" / "promoted"; render them in title case for the UI.
  if (!status) return 'Untasted';
  return status.charAt(0).toUpperCase() + status.slice(1).replace(/[-_]/g, ' ');
}

function statusTone(status: string): string {
  const s = status.toLowerCase();
  if (s === 'tasted' || s === 'promoted' || s === 'love') return 'text-tea-gold';
  if (s === 'declined' || s === 'pass') return 'text-tea-text-dim';
  return 'text-tea-text-sec';
}

export default function SampleHistoryPage() {
  const navigate = useNavigate();
  const authed = hasToken();

  useEffect(() => {
    if (!authed) {
      navigate(`/signin?returnTo=${encodeURIComponent('/account/samples')}`, { replace: true });
    }
  }, [authed, navigate]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['me', 'samples'],
    queryFn: () => api.me.samples(),
    enabled: authed,
  });

  if (!authed) return null;

  const samples = data?.samples ?? [];

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-8 pb-nav-gap-lg animate-[fadeIn_0.5s_ease-out]">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-tea-text-sec hover:text-tea-text transition-colors mb-8"
      >
        <Icons.Back className="w-4 h-4" />
        <span className="text-ui-12 uppercase tracking-[0.15em]">Back</span>
      </button>

      <header className="mb-8">
        <h1 className={`${TYPOGRAPHY_CLASSES.h2} text-tea-text mb-2`}>Your Samples</h1>
        <p className="text-ui-14 text-tea-text-sec">
          Teas sent to you for exploration. After tasting, add a journal entry to capture the impression.
        </p>
      </header>

      {isLoading && (
        <div className="space-y-3" aria-label="Loading samples">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-20 rounded border border-tea-border bg-tea-surface/40 animate-pulse" />
          ))}
        </div>
      )}

      {isError && !isLoading && (
        <div className="rounded border border-tea-border bg-tea-surface p-6 text-center">
          <p className="text-ui-14 text-tea-text-sec">We couldn't load your samples right now. Please try again in a moment.</p>
        </div>
      )}

      {!isLoading && !isError && samples.length === 0 && (
        <div className="rounded border border-tea-border bg-tea-surface p-8 text-center">
          <Icons.Leaf className="w-8 h-8 text-tea-gold/40 mx-auto mb-3" />
          <p className={`${TYPOGRAPHY_CLASSES.body} text-tea-text mb-1`}>No samples yet</p>
          <p className="text-ui-13 text-tea-text-sec max-w-xs mx-auto">
            Samples Adrian curates for you will appear here once they're sent.
          </p>
        </div>
      )}

      {!isLoading && !isError && samples.length > 0 && (
        <ul className="space-y-2">
          {samples.map(sample => (
            <li key={sample.id}>
              <article className="rounded border border-tea-border bg-tea-surface px-4 py-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-ui-14 text-tea-text font-medium truncate">{sample.tea_name}</span>
                      <span className={`text-ui-11 uppercase tracking-[0.1em] ${statusTone(sample.status)}`}>
                        {statusLabel(sample.status)}
                      </span>
                    </div>
                    <p className="text-ui-12 text-tea-text-sec mt-1">{formatDate(sample.sent_at)}</p>
                    {sample.notes && (
                      <p className="text-ui-13 text-tea-text-sec mt-2 line-clamp-2">{sample.notes}</p>
                    )}
                  </div>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
