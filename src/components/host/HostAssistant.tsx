// Launch 5, M6 part two: "Your assistant", on the host's own page (/account/host).
//
// A host makes a key for their own assistant (ChatGPT, Claude, or another one
// that speaks MCP), names it, sees their live keys and disconnects one. The
// key reaches the host's own tables, guests, teas, notes and chest, and
// nothing else on Teajia. Its secret is shown once, right after it is made.
// Making one is a step in the address (?assistant=new) and so is the question
// before disconnecting (?assistant=off-<id>), so back closes either. Nothing
// here counts anything.
import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../shared/Button';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { useAuth } from '../../hooks/useAuth';
import { useStepParam } from '../../hooks/useStepParam';
import { api } from '../../lib/api';
import { PART_QUERY, partView } from '../../lib/closedPart';
import { LoadFailed } from '../shared/LoadFailed';
import { HOST_TOKEN_LABEL_MAX, type HostToken, type HostTokenMinted } from '../../lib/hostTokens';
import { hostSmallText, hostText } from './hostTableParts';

const fieldClass = 'btn-field block min-h-tap w-full min-w-0';
const labelClass = `${TYPOGRAPHY_CLASSES.label} grid min-w-0 gap-1 text-tea-text-sec`;
const OFF = 'off-';
const DEFAULT_KEY_NAME = 'My assistant';

/**
 * The key just made, kept in memory for the life of the page and nowhere else:
 * never in storage, and never fetchable again from the server. It belongs to the
 * history entry `?assistant=made`, so Back then Forward shows it again instead
 * of an empty form. Done clears it.
 */
let shownOnceKey: HostTokenMinted | null = null;

/** A stored time ('YYYY-MM-DD HH:MM:SS' in UTC, or ISO) as a day the host reads. */
function dayOf(value: string | null): string {
  if (!value) return '';
  const iso = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value) ? `${value.replace(' ', 'T')}Z` : value;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * `onlyWithKeys`: for a person who no longer hosts. The section shows only
 * while they still hold a key, so they can disconnect it; otherwise nothing.
 */
export function HostAssistantSection({ onlyWithKeys = false }: { onlyWithKeys?: boolean } = {}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const key = ['host-assistant-tokens', user?.email] as const;
  const [step, setStep] = useStepParam('assistant');
  const tokens = useQuery({ queryKey: key, queryFn: () => api.hostTokens.list(), ...PART_QUERY });
  const view = partView(tokens);
  const refresh = () => queryClient.invalidateQueries({ queryKey: key });
  const list = tokens.data?.tokens ?? [];
  const stopping = step.startsWith(OFF) ? list.find(token => token.id === step.slice(OFF.length)) : undefined;
  if (onlyWithKeys && list.length === 0) return null;
  // Not open on the worker yet: the part is not offered (A10-3).
  if (view.state === 'closed') return null;

  return (
    <section aria-labelledby="host-assistant-heading" className="mt-8 space-y-3 border-t border-tea-border pt-4" data-testid="host-assistant">
      <h2 id="host-assistant-heading" className={TYPOGRAPHY_CLASSES.h2}>Your assistant</h2>
      <p className={hostSmallText}>
        Connect your own assistant, such as ChatGPT or Claude, to your tables. It can make a table, add its teas,
        answer your guests and keep your notes on them. It cannot reach anything else on Teajia, and it asks you
        before it changes anything.
      </p>
      {tokens.isPending && <p className={hostSmallText} role="status">Opening your keys…</p>}
      {view.state === 'failed' && <LoadFailed sentence="Could not open your keys just now." onRetry={view.retry} />}
      {list.length > 0 && (
        <ul className="space-y-2" data-testid="host-assistant-keys">
          {list.map(token => (
            <KeyRow key={token.id} token={token}
              asking={stopping?.id === token.id}
              onAsk={() => setStep(`${OFF}${token.id}`)}
              onCancel={() => setStep(null)}
              onGone={() => { void refresh(); setStep(null); }} />
          ))}
        </ul>
      )}
      {tokens.data && !tokens.data.may_connect && (
        <p className={hostSmallText}>While you are not hosting, no assistant can reach your tables and no new key can be made.</p>
      )}
      {step === 'made' && shownOnceKey && tokens.data?.may_connect ? (
        <ShownOnce minted={shownOnceKey} onDone={() => { shownOnceKey = null; setStep(null); }} />
      ) : (step === 'new' || step === 'made') && tokens.data?.may_connect ? (
        <MakeKey mcpUrl={tokens.data.mcp_url}
          onMade={minted => { shownOnceKey = minted; void refresh(); setStep('made'); }}
          onDone={() => setStep(null)} />
      ) : tokens.data?.may_connect && (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="secondary" className="tap-target" onClick={() => setStep('new')}>Connect an assistant</Button>
        </div>
      )}
    </section>
  );
}

function KeyRow({ token, asking, onAsk, onCancel, onGone }: {
  token: HostToken; asking: boolean; onAsk: () => void; onCancel: () => void; onGone: () => void;
}) {
  const revoke = useMutation({ mutationFn: () => api.hostTokens.revoke(token.id), retry: false, onSuccess: onGone });
  const used = token.last_used_at ? `Last used ${dayOf(token.last_used_at)}` : 'Not used yet';
  return (
    <li className="space-y-2 rounded-md border border-tea-border bg-tea-surface p-3" data-testid="host-assistant-key" aria-label={token.label}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className={`${hostText} break-words`}>{token.label}</p>
          <p className={hostSmallText}>Made {dayOf(token.created_at)}. {used}.</p>
        </div>
        {!asking && (
          <Button type="button" variant="quiet" className="tap-target" onClick={onAsk}>Disconnect</Button>
        )}
      </div>
      {asking && (
        <div className="space-y-2" data-testid="host-assistant-disconnect">
          <p className={hostText}>Disconnect {token.label}? It stops working at once. You can connect it again with a new key.</p>
          {revoke.isError && <p className={hostSmallText} role="alert">{(revoke.error as Error).message || 'Could not disconnect. Try again.'}</p>}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button type="button" variant="quiet" className="tap-target" onClick={onCancel}>Cancel</Button>
            <Button type="button" variant="danger" className="tap-target" disabled={revoke.isPending} onClick={() => revoke.mutate()}>
              {revoke.isPending ? 'Disconnecting…' : 'Disconnect'}
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}

function MakeKey({ mcpUrl, onMade, onDone }: { mcpUrl: string; onMade: (minted: HostTokenMinted) => void; onDone: () => void }) {
  const [label, setLabel] = useState(DEFAULT_KEY_NAME);
  const make = useMutation({
    mutationFn: (name: string) => api.hostTokens.make(name),
    retry: false,
    onSuccess: onMade,
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (make.isPending || !label.trim()) return;
    make.mutate(label.trim());
  }

  return (
    <form className="space-y-3" onSubmit={submit} data-testid="host-assistant-new">
      <label className={labelClass}>
        Name it
        <input type="text" className={fieldClass} maxLength={HOST_TOKEN_LABEL_MAX} required value={label}
          placeholder="ChatGPT on my phone" onFocus={event => event.currentTarget.select()} onChange={event => setLabel(event.target.value)} />
      </label>
      <p className={hostSmallText}>Your assistant will connect at {mcpUrl}</p>
      {make.isError && <p className={hostSmallText} role="alert">{(make.error as Error).message || 'Could not make a key. Try again.'}</p>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button type="button" variant="quiet" className="tap-target" onClick={onDone}>Cancel</Button>
        <Button type="submit" className="tap-target" disabled={make.isPending || !label.trim()}>
          {make.isPending ? 'Making the key…' : 'Make the key'}
        </Button>
      </div>
    </form>
  );
}

function ShownOnce({ minted, onDone }: { minted: HostTokenMinted; onDone: () => void }) {
  const [copied, setCopied] = useState<'key' | 'address' | null>(null);
  async function copy(what: 'key' | 'address') {
    try {
      await navigator.clipboard.writeText(what === 'key' ? minted.token : minted.mcp_url);
      setCopied(what);
    } catch {
      setCopied(null);
    }
  }
  return (
    <div className="space-y-3 rounded-md border border-tea-border bg-tea-surface p-3" data-testid="host-assistant-secret">
      <p className={hostText}>
        Here is the key for {minted.label}. Copy it into your assistant now: it is shown this once, and Teajia keeps
        only a scrambled copy that cannot be read back.
      </p>
      <label className={labelClass}>
        Key
        <input type="text" readOnly className={`${fieldClass} font-mono`} value={minted.token}
          onFocus={event => event.currentTarget.select()} data-testid="host-assistant-secret-value" />
      </label>
      <label className={labelClass}>
        Address
        <input type="text" readOnly className={fieldClass} value={minted.mcp_url} onFocus={event => event.currentTarget.select()} />
      </label>
      <p className={hostSmallText} role="status">
        {copied === 'key' ? 'Key copied.' : copied === 'address' ? 'Address copied.' : ''}
      </p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" className="tap-target" onClick={() => void copy('key')}>Copy the key</Button>
          <Button type="button" variant="quiet" className="tap-target" onClick={() => void copy('address')}>Copy the address</Button>
        </div>
        <Button type="button" className="tap-target" onClick={onDone}>Done</Button>
      </div>
    </div>
  );
}
