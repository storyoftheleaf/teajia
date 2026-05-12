import React, { useCallback, useEffect, useState } from 'react';
import { KeyRound, Loader2, Plus } from 'lucide-react';
import { useAppStore } from '../../lib/store';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';

// MCP tokens — voice/agent control of this account's inventory through the
// /mcp endpoint on the worker. Each token authenticates a single MCP client
// (Claude desktop, Claude mobile, an external script) as a specific user
// against this account, with full inventory + invoicing rights.
//
// The plaintext secret is shown ONCE on creation and never recoverable. The
// admin only ever sees the prefix afterwards.

interface TokenRow {
  id: string;
  user_email: string;
  label: string;
  token_prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

const API_URL = (import.meta as any).env?.VITE_API_URL || '';

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('teajia_token') || '';
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const accountId = useAppStore.getState().activeAccountId;
  if (accountId) headers['X-Teajia-Account'] = accountId;
  return headers;
}

const formatDate = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

export const MCPTokensView: React.FC = () => {
  const [tokens, setTokens] = useState<TokenRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showMint, setShowMint] = useState(false);
  const [justMinted, setJustMinted] = useState<{ token: string; label: string } | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/admin/mcp-tokens`, { headers: authHeaders() });
      if (!res.ok) throw new Error(await res.text());
      setTokens(await res.json());
    } catch (err: any) {
      setError(err?.message || 'Could not load MCP tokens.');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="px-4 md:px-6 pt-6 pb-nav-gap max-w-3xl mx-auto">
      <header className="mb-10">
        <h1 className={`${TYPOGRAPHY_CLASSES.h2} text-tea-text`}>Voice & agent access</h1>
        <div className="label-caps text-tea-text-dim mt-2">MCP · Owner-tier access</div>
        <p className="text-tea-text-sec text-ui-14 leading-[1.6] max-w-xl mt-4">
          Mint a token to connect Claude desktop, Claude mobile, or any MCP-compatible
          client to this account&apos;s inventory. Tools cover tea search, stock adjustments,
          customer lookup, and creating filled invoices — every mutating action requires
          a spoken confirmation in the model. The token grants full owner-level rights
          on this account; treat it like a password.
        </p>
      </header>

      {error && (
        <div className="mb-6 text-tea-error text-ui-13">{error}</div>
      )}

      {justMinted && (
        <div className="mb-8 border border-tea-gold/40 bg-tea-gold/10 p-4 rounded-xl">
          <div className="text-tea-text font-display mb-2">New token: {justMinted.label}</div>
          <p className="text-tea-text-sec text-ui-13 leading-[1.5] mb-3">
            Copy this now — you won&apos;t see it again. If you lose it, revoke and mint a new one.
          </p>
          <pre className="text-ui-12 bg-tea-bg p-3 rounded border border-tea-border overflow-x-auto select-all break-all whitespace-pre-wrap">{justMinted.token}</pre>
          <div className="mt-3 flex gap-3">
            <button
              type="button"
              onClick={() => { navigator.clipboard?.writeText(justMinted.token); }}
              className="text-tea-readgold hover:text-tea-gold-lt text-ui-13 transition-colors"
            >
              Copy to clipboard
            </button>
            <button
              type="button"
              onClick={() => setJustMinted(null)}
              className="text-tea-text-sec hover:text-tea-text text-ui-13 transition-colors ml-auto"
            >
              I&apos;ve saved it
            </button>
          </div>
        </div>
      )}

      {tokens === null && !error && (
        <div className="flex items-center justify-center py-12 text-tea-text-dim">
          <Loader2 size={20} className="animate-spin" />
        </div>
      )}

      {tokens !== null && (
        <div>
          <div className="label-caps text-tea-text-dim mb-4">Tokens</div>

          {tokens.length === 0 && (
            <div className="flex flex-col items-center text-center max-w-sm mx-auto py-12 px-6">
              <KeyRound size={28} strokeWidth={1.25} className="text-tea-text-dim mb-3" />
              <div className="font-display text-ui-17 text-tea-text">No tokens yet</div>
              <p className="text-ui-12 text-tea-text-sec leading-relaxed mt-2">
                Mint one to start using voice control through Claude.
              </p>
            </div>
          )}

          {tokens.map(t => (
            <TokenRowView key={t.id} row={t} onChange={load} />
          ))}

          <div className="mt-8 pt-6 border-t border-tea-border">
            {!showMint ? (
              <button
                type="button"
                onClick={() => setShowMint(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 active:bg-tea-gold/80 transition-colors"
              >
                <Plus size={13} />
                <span>Mint a new token</span>
              </button>
            ) : (
              <MintForm
                onCancel={() => setShowMint(false)}
                onMinted={async (token, label) => {
                  setShowMint(false);
                  setJustMinted({ token, label });
                  await load();
                }}
              />
            )}
          </div>

          <div className="mt-12 pt-6 border-t border-tea-border">
            <h2 className={`${TYPOGRAPHY_CLASSES.h3} text-tea-text mb-3`}>How to connect Claude desktop</h2>
            <ol className="text-tea-text-sec text-ui-14 leading-[1.7] list-decimal pl-5 space-y-2">
              <li>Open Claude desktop &rarr; Settings &rarr; Developer &rarr; Edit MCP config.</li>
              <li>
                Add a server entry pointing at this worker&apos;s <code className="text-tea-text">/mcp</code> endpoint
                with the bearer token from above. Example:
              </li>
            </ol>
            <pre className="mt-3 text-ui-12 bg-tea-bg p-3 rounded border border-tea-border overflow-x-auto leading-[1.5]">{`{
  "mcpServers": {
    "teajia-inventory": {
      "transport": {
        "type": "http",
        "url": "${API_URL || 'https://api.teajia.app'}/mcp",
        "headers": { "Authorization": "Bearer tjmcp_<your_token>" }
      }
    }
  }
}`}</pre>
            <p className="text-tea-text-sec text-ui-13 leading-[1.6] mt-3">
              Restart Claude. You should see seven Teajia tools (search_tea, get_tea, list_low_stock,
              find_customer, add_stock, remove_stock, record_sale) available in any conversation.
              Mobile voice mode works the same way once the desktop config syncs.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

interface TokenRowViewProps {
  row: TokenRow;
  onChange: () => Promise<void> | void;
}

const TokenRowView: React.FC<TokenRowViewProps> = ({ row, onChange }) => {
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const revoked = !!row.revoked_at;

  const revoke = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/admin/mcp-tokens/${row.id}`, {
        method: 'DELETE', headers: authHeaders(),
      });
      if (!res.ok) throw new Error(await res.text());
      await onChange();
    } catch (err: any) {
      setError(err?.message || 'Could not revoke token.');
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  return (
    <div className={`py-4 border-b border-tea-border ${revoked ? 'opacity-50' : ''}`}>
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="text-tea-text font-display text-ui-15 mb-1">{row.label}</div>
          <div className="text-tea-text-sec text-ui-12 leading-[1.5]">
            <code className="text-tea-text">{row.token_prefix}…</code> ·
            owner {row.user_email} ·
            created {formatDate(row.created_at)} ·
            last used {formatDate(row.last_used_at)}
            {revoked && <> · <span className="text-tea-text">revoked {formatDate(row.revoked_at)}</span></>}
          </div>
        </div>
        {!revoked && (
          <div>
            {!confirming ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirming(true)}
                className="text-tea-text-sec hover:text-tea-text text-ui-13 transition-colors"
              >
                Revoke
              </button>
            ) : (
              <div className="flex gap-3 items-center">
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="text-tea-text-sec hover:text-tea-text text-ui-13 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={revoke}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-error text-tea-bg text-xs font-semibold hover:bg-tea-error/90 active:bg-tea-error/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Confirm revoke
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      {error && <div className="text-tea-error text-ui-12 mt-2">{error}</div>}
    </div>
  );
};

interface MintFormProps {
  onCancel: () => void;
  onMinted: (token: string, label: string) => void | Promise<void>;
}

const MintForm: React.FC<MintFormProps> = ({ onCancel, onMinted }) => {
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = label.trim();
    if (!trimmed) {
      setError('Give the token a label so you remember what it&apos;s for.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/admin/mcp-tokens`, {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({ label: trimmed }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      await onMinted(data.token, trimmed);
    } catch (err: any) {
      setError(err?.message || 'Could not mint token.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <label className="label-caps text-tea-text-dim mb-2 block">
        Label
      </label>
      <input
        type="text"
        value={label}
        onChange={e => setLabel(e.target.value)}
        placeholder="e.g. Claude desktop on MBP"
        className="w-full bg-tea-bg border border-tea-border rounded-md text-tea-text px-3 py-2 text-ui-14 mb-3 focus:outline-none focus:border-tea-gold/40"
        autoFocus
      />
      {error && <div className="text-tea-error text-ui-12 mb-3">{error}</div>}
      <div className="flex justify-between items-center">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="text-tea-text-sec hover:text-tea-text text-ui-13 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy || !label.trim()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 active:bg-tea-gold/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {busy && <Loader2 size={13} className="animate-spin" />}
          <span>{busy ? 'Minting…' : 'Mint token'}</span>
        </button>
      </div>
    </form>
  );
};
