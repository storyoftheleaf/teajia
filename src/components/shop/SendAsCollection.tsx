import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Check, Copy, ExternalLink, Send, Share2 } from 'lucide-react';
import { makeCollection } from '../../lib/madeCollectionsApi';
import { useAppStore } from '../../lib/store';

/**
 * Saved teas sent as a collection: anyone signed in names it, adds a note if
 * they like, and gets a /c/ link to send, the way a tea master tells someone
 * what to buy (Adrian, 2026-11-27). The shop's own price applies on the link.
 * The words "Send as a collection" are a placeholder until Adrian names it.
 */
export function SendAsCollection({ productIds }: { productIds: string[] }) {
  const authUser = useAppStore(s => s.authUser);
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const firstName = authUser?.name?.trim().split(/\s+/)[0] || '';
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [made, setMade] = useState<{ url: string; title: string; leftOut: number } | null>(null);
  const [copied, setCopied] = useState(false);

  if (!productIds.length) return null;
  const count = `${productIds.length} ${productIds.length === 1 ? 'tea' : 'teas'}`;

  if (!authUser) {
    return (
      <div className="my-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-tea-border bg-tea-elevated px-4 py-3" data-testid="send-as-collection">
        <span className="font-body text-ui-13 text-tea-text-sec">Send these {count} to someone as a collection.</span>
        <Link to={`/signin?returnTo=${encodeURIComponent(location.pathname + location.search)}`} className="btn-secondary tap-target">
          Sign in to send
        </Link>
      </div>
    );
  }

  const make = async () => {
    const name = title.trim() || (firstName ? `Teas from ${firstName}` : 'Teas for you');
    setBusy(true);
    setError(null);
    try {
      const result = await makeCollection({ title: name, note: note.trim() || undefined, product_ids: productIds });
      setMade({ url: `${window.location.origin}/c/${result.slug}`, title: name, leftOut: result.left_out });
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not work. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    if (!made) return;
    if (navigator.share) {
      try { await navigator.share({ title: made.title, url: made.url }); return; } catch { /* closed the sheet */ return; }
    }
    await copy();
  };
  const copy = async () => {
    if (!made) return;
    try { await navigator.clipboard.writeText(made.url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* no clipboard */ }
  };

  return (
    <div className="my-4 rounded-md border border-tea-border bg-tea-elevated px-4 py-3" data-testid="send-as-collection">
      {made ? (
        <div className="flex flex-col gap-3">
          <div>
            <p className="font-body text-ui-14 text-tea-text">{made.title} is ready to send.</p>
            {made.leftOut > 0 && (
              <p className="font-body text-ui-12 text-tea-text-sec mt-1">
                {made.leftOut === 1 ? 'One tea is' : `${made.leftOut} teas are`} not in the shop now, so it stayed out.
              </p>
            )}
          </div>
          <span className="break-all font-mono text-ui-12 text-tea-text-sec">{made.url}</span>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <a href={made.url} target="_blank" rel="noopener noreferrer" className="btn-quiet tap-target">
              <ExternalLink size={13} /> Open
            </a>
            <button type="button" onClick={copy} className="btn-secondary tap-target">
              {copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy link</>}
            </button>
            <button type="button" onClick={share} className="btn-primary tap-target">
              <Share2 size={13} /> Share
            </button>
          </div>
        </div>
      ) : open ? (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="label-caps text-tea-text-sec">Name</span>
            <input
              value={title}
              onChange={event => setTitle(event.target.value)}
              placeholder={firstName ? `Teas from ${firstName}` : 'Teas for you'}
              maxLength={120}
              className="input-field min-h-tap px-3 py-2 text-ui-16"
              autoFocus
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="label-caps text-tea-text-sec">A note for them</span>
            <textarea
              value={note}
              onChange={event => setNote(event.target.value)}
              rows={3}
              maxLength={2000}
              className="input-field px-3 py-2 text-ui-16"
            />
          </label>
          {error && <p className="font-body text-ui-12 text-tea-error" role="alert">{error}</p>}
          <div className="flex items-center justify-between gap-3">
            <button type="button" onClick={() => setOpen(false)} className="btn-quiet tap-target">Cancel</button>
            <button type="button" onClick={make} disabled={busy} className="btn-primary tap-target">
              <Send size={13} /> {busy ? 'Making the link' : `Make the link for ${count}`}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="font-body text-ui-13 text-tea-text-sec">Send these {count} to someone as a collection.</span>
          <button type="button" onClick={() => setOpen(true)} className="btn-secondary tap-target">
            <Send size={13} /> Send as a collection
          </button>
        </div>
      )}
    </div>
  );
}
