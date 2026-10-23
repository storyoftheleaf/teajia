import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, hasToken } from '../lib/api';
import { TYPOGRAPHY_CLASSES } from '../designTokens';
import { LIBRARY_PREVIEW_ORIGIN, LIBRARY_PREVIEW_PATH, validLibraryPreviewRequest } from '../lib/libraryPreviewSession';

export default function LibraryPreviewAuthorize() {
  const params = new URLSearchParams(window.location.search);
  const challenge = params.get('challenge');
  const valid = validLibraryPreviewRequest(params.get('origin'), challenge);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [grants, setGrants] = useState<Array<{ id: string; origin: string; expires_at: number }>>([]);
  const [revokeBusy, setRevokeBusy] = useState('');
  useEffect(() => {
    if (hasToken()) api.libraryPreview.listGrants().then(result => setGrants(result.grants)).catch(() => setError('Could not load existing preview connections.'));
  }, []);
  async function revoke(id: string) {
    setRevokeBusy(id);
    try { await api.libraryPreview.revokeGrant(id); setGrants(current => current.filter(grant => grant.id !== id)); }
    catch { setError('Could not revoke this connection. Please retry.'); }
    finally { setRevokeBusy(''); }
  }
  const returnTo = `${window.location.pathname}${window.location.search}`;
  async function authorize() {
    if (!valid || busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await api.libraryPreview.createGrant({ origin: LIBRARY_PREVIEW_ORIGIN, challenge: challenge! });
      if (!/^[A-Za-z0-9_-]{32,160}$/.test(result.code)) throw new Error('Invalid preview code');
      // Fixed destination; neither query parameters nor the API choose a redirect.
      window.location.replace(`${LIBRARY_PREVIEW_ORIGIN}${LIBRARY_PREVIEW_PATH}#code=${encodeURIComponent(result.code)}`);
    } catch {
      setError('Could not authorize the preview. Check that you are signed in as the account owner and try again.');
      setBusy(false);
    }
  }
  return <main className="mx-auto max-w-lg px-5 pt-8 pb-nav-gap-lg text-tea-text">
    <section className="rounded-xl border border-tea-border bg-tea-surface p-5 space-y-4">
      <p className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-dim`}>Development preview</p>
      <h1 className={TYPOGRAPHY_CLASSES.h2}>Your Library, read-only</h1>
      <p className={TYPOGRAPHY_CLASSES.bodyLight}>Allow the preview on this computer to display your Library suppliers, pricing, tasting status and order quantities for up to eight hours. It cannot edit records or access other account areas.</p>
      <p className={`${TYPOGRAPHY_CLASSES.mono} break-all text-tea-text-sec`}>{LIBRARY_PREVIEW_ORIGIN}</p>
      {!valid && (params.has('origin') || params.has('challenge')) ? <p role="alert" className={TYPOGRAPHY_CLASSES.bodyLight}>This connection request is invalid. Start again from the local Library preview.</p>
        : !hasToken() ? <Link className="inline-flex min-h-11 items-center rounded-md bg-tea-accent-sub px-4 text-tea-text" to={`/signin?returnTo=${encodeURIComponent(returnTo)}`}>Sign in to authorize</Link>
        : valid ? <button type="button" disabled={busy} onClick={authorize} className="min-h-11 w-full rounded-md border border-tea-border bg-tea-elevated px-4 py-2 text-left text-tea-text hover:bg-tea-accent-sub disabled:opacity-50">{busy ? 'Connecting…' : 'Open read-only Library preview'}</button> : <p className={TYPOGRAPHY_CLASSES.bodyLight}>Start a connection from your local Library preview, or revoke an existing connection below.</p>}
      {grants.length > 0 && <div className="space-y-2 border-t border-tea-border pt-4"><h2 className={TYPOGRAPHY_CLASSES.h3}>Active connections</h2>{grants.map(grant => <div key={grant.id} className="flex flex-wrap items-center justify-between gap-2"><div className="min-w-0"><p className={`${TYPOGRAPHY_CLASSES.mono} break-all`}>{grant.origin}</p><p className={`${TYPOGRAPHY_CLASSES.mono} text-tea-text-dim`}>Expires {new Date(grant.expires_at).toLocaleString()}</p></div><button type="button" disabled={Boolean(revokeBusy)} onClick={() => revoke(grant.id)} className="min-h-11 rounded-md border border-tea-border px-3 text-tea-text">{revokeBusy === grant.id ? 'Revoking…' : 'Revoke'}</button></div>)}</div>}
      {error && <p role="alert" className={TYPOGRAPHY_CLASSES.bodyLight}>{error}</p>}
    </section>
  </main>;
}
