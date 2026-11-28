// Who pours this shop's tea (Adrian, 2026-11-28: "Someone else might be
// pouring my teas at some point"). The owner names a person by the email they
// signed up with; from then on that person's own tables pour from this shop's
// shelf, with their name in the stock record. One press takes it away. The
// worker side is worker/src/tablePour.ts.
import { useEffect, useState, type FormEvent } from 'react';
import { API_URL, authedFetch } from '../../lib/api';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { BottomSheet } from '../../components/shared/BottomSheet';
import { Button } from '../../components/shared/Button';

type Pourer = { id: string; name: string; email: string };

const door = (path = '', init?: RequestInit) => authedFetch(`${API_URL}/api/admin/pour/pourers${path}`, { reportIncident: false, ...init });

export function PourersSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [pourers, setPourers] = useState<Pourer[] | null>(null);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState('');

  useEffect(() => {
    if (!open) return undefined;
    let live = true;
    setFailed('');
    door().then(result => { if (live) setPourers(result.pourers); }, () => { if (live) setFailed('The list could not be read.'); });
    return () => { live = false; };
  }, [open]);

  const run = async (work: () => Promise<{ pourers: Pourer[] }>) => {
    if (busy) return;
    setBusy(true);
    setFailed('');
    try { setPourers((await work()).pourers); } catch (reason) {
      setFailed(reason instanceof Error && reason.message ? reason.message : 'That did not save. Try again.');
    } finally { setBusy(false); }
  };
  const add = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim()) return;
    void run(async () => {
      const result = await door('', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim() }) });
      setEmail('');
      return result;
    });
  };

  return (
    <BottomSheet open={open} onOpenChange={next => { if (!next) onClose(); }} title="Who pours" large>
      <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-2 pt-1" data-pourers>
        {pourers === null && !failed && <p role="status" className={TYPOGRAPHY_CLASSES.bodyLight}>Reading the list…</p>}
        {pourers !== null && pourers.length > 0 && (
          <ul className="flex flex-col divide-y divide-tea-border">
            {pourers.map(one => (
              <li key={one.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="min-w-0">
                  <span className={`${TYPOGRAPHY_CLASSES.body} block break-words`}>{one.name}</span>
                  {one.name !== one.email && <span className={`${TYPOGRAPHY_CLASSES.bodyLight} block break-all text-tea-text-sec`}>{one.email}</span>}
                </span>
                <Button type="button" variant="quiet" size="sm" className="tap-target" disabled={busy}
                  aria-label={`${one.name} no longer pours`} onClick={() => void run(() => door(`/${encodeURIComponent(one.id)}`, { method: 'DELETE' }))}>
                  Take away
                </Button>
              </li>
            ))}
          </ul>
        )}
        <form className="flex flex-wrap items-end gap-2" onSubmit={add}>
          <label className="flex min-w-0 flex-1 flex-col gap-1">
            <span className={TYPOGRAPHY_CLASSES.label}>Their email</span>
            <input type="email" value={email} className="btn-field w-full" autoComplete="off" onChange={event => setEmail(event.target.value)} />
          </label>
          <Button type="submit" className="tap-target" disabled={busy || !email.trim()}>Let them pour</Button>
        </form>
        {failed && <p role="alert" className={TYPOGRAPHY_CLASSES.body}>{failed}</p>}
      </div>
    </BottomSheet>
  );
}
