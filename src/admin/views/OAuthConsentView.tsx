import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { useAppStore } from '../../lib/store';
import { getTokenClaims, hasToken } from '../../lib/api';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';

// OAuth 2.1 consent screen. Reached when an MCP client (Claude desktop/mobile,
// ChatGPT) hits /oauth/authorize on the worker — the worker 302s here with
// all the OAuth params in the query string. We:
//
//   1. If the user isn't logged in, send them through the normal login flow
//      first (preserving the consent URL so we land back here after).
//   2. Show "Claude is requesting access to {account}" with approve/deny.
//   3. On approve, POST to /oauth/authorize/decision with our JWT in the
//      Authorization header, get back a redirect URL pointing into the client's redirect_uri
//      with `code=<auth code>`, and navigate the browser there.

const API_URL = (import.meta as any).env?.VITE_API_URL || '';

interface ConsentParams {
  client_id: string;
  redirect_uri: string;
  response_type: string;
  code_challenge: string;
  code_challenge_method: string;
  state: string | null;
  scope: string | null;
}

const KNOWN_CLIENT_NAMES: Record<string, RegExp> = {
  'Claude (desktop or mobile)': /claude|anthropic/i,
  'ChatGPT': /chatgpt|openai/i,
};

function inferClientLabel(redirectUri: string): string {
  for (const [label, pat] of Object.entries(KNOWN_CLIENT_NAMES)) {
    if (pat.test(redirectUri)) return label;
  }
  try { return new URL(redirectUri).host; } catch { return 'an external app'; }
}

export const OAuthConsentView: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const activeAccountId = useAppStore(s => s.activeAccountId);
  const activeAccount = useAppStore(s => s.activeAccount);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loggedIn = hasToken();

  const params: ConsentParams = {
    client_id: searchParams.get('client_id') || '',
    redirect_uri: searchParams.get('redirect_uri') || '',
    response_type: searchParams.get('response_type') || '',
    code_challenge: searchParams.get('code_challenge') || '',
    code_challenge_method: searchParams.get('code_challenge_method') || '',
    state: searchParams.get('state'),
    scope: searchParams.get('scope'),
  };

  const missing: string[] = [];
  if (!params.client_id) missing.push('client_id');
  if (!params.redirect_uri) missing.push('redirect_uri');
  if (!params.code_challenge) missing.push('code_challenge');
  if (params.code_challenge_method !== 'S256') missing.push('code_challenge_method=S256');

  // If not logged in, send to the existing admin login. We stash the full
  // current URL in `next` so AdminApp's login flow returns here with all the
  // OAuth query params intact.
  useEffect(() => {
    if (!loggedIn && missing.length === 0) {
      const next = encodeURIComponent(location.pathname + location.search);
      navigate(`/admin?next=${next}`, { replace: true });
    }
  }, [loggedIn, missing.length, location.pathname, location.search, navigate]);

  if (missing.length > 0) {
    return (
      <div className="px-4 md:px-6 pt-6 pb-nav-gap max-w-xl mx-auto">
        <h1 className={`${TYPOGRAPHY_CLASSES.h2} text-tea-text mb-4`}>Authorization request</h1>
        <p className="text-tea-text-sec text-ui-14 leading-[1.6]">
          This authorization link is missing required parameters: <code className="text-tea-text">{missing.join(', ')}</code>.
          Please return to the app you were using and try again.
        </p>
      </div>
    );
  }

  if (!loggedIn) {
    return (
      <div className="px-4 md:px-6 pt-6 pb-nav-gap max-w-xl mx-auto">
        <p className="text-tea-text-sec italic text-ui-14">Redirecting to login…</p>
      </div>
    );
  }

  const claims = getTokenClaims();
  const userEmail = claims?.email || '';
  const accountName = activeAccount?.name || 'this account';
  const clientLabel = inferClientLabel(params.redirect_uri);

  const approve = async () => {
    setSubmitting(true);
    setError(null);
    const jwt = localStorage.getItem('teajia_token') || sessionStorage.getItem('teajia_token') || '';
    try {
      if (!jwt) throw new Error('Login required before approval');
      const res = await fetch(`${API_URL}/oauth/authorize/decision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          client_id: params.client_id,
          redirect_uri: params.redirect_uri,
          code_challenge: params.code_challenge,
          code_challenge_method: params.code_challenge_method,
          state: params.state,
          scope: params.scope,
          account_id: activeAccountId,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error_description || body?.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      if (!data?.redirect_to) throw new Error('No redirect URL in response');
      // Send the browser back to the OAuth client (Claude / ChatGPT etc).
      window.location.assign(data.redirect_to);
    } catch (err: any) {
      setError(err?.message || 'Approval failed.');
      setSubmitting(false);
    }
  };

  const deny = () => {
    // Per RFC 6749 — return to the client with error=access_denied.
    const sep = params.redirect_uri.includes('?') ? '&' : '?';
    const stateParam = params.state ? `&state=${encodeURIComponent(params.state)}` : '';
    window.location.assign(`${params.redirect_uri}${sep}error=access_denied${stateParam}`);
  };

  return (
    <div className="px-4 md:px-6 pt-10 pb-nav-gap max-w-xl mx-auto">
      <header className="mb-8">
        <div className="text-tea-text-sec text-ui-11 uppercase tracking-[0.12em] mb-3">
          Authorization request
        </div>
        <h1 className={`${TYPOGRAPHY_CLASSES.h2} text-tea-text mb-3`}>
          Connect <span className="text-tea-gold">{clientLabel}</span> to {accountName}?
        </h1>
        <p className="text-tea-text-sec text-ui-14 leading-[1.7]">
          You&apos;re signed in as <span className="text-tea-text">{userEmail}</span>. Approving will let
          {' '}{clientLabel} use the seven Teajia inventory tools (search, stock adjustments, customer
          lookup, and creating filled invoices) on this account. You can revoke at any time from
          the Voice &amp; Agent (MCP) admin page.
        </p>
      </header>

      <div className="border border-tea-border rounded p-4 mb-6 bg-tea-elevated">
        <div className="text-tea-text-sec text-ui-11 uppercase tracking-[0.12em] mb-3">
          The app is asking for
        </div>
        <ul className="text-tea-text text-ui-13 leading-[1.7] space-y-1.5">
          <li>· Read your tea inventory and stock levels</li>
          <li>· Adjust stock when you tell it to (with explicit per-action confirmation)</li>
          <li>· Look up customers</li>
          <li>· Create and fill invoices when you tell it to</li>
        </ul>
        <div className="text-tea-text-sec text-ui-12 mt-4 leading-[1.6]">
          The token issued here is restricted to <span className="text-tea-text">{accountName}</span> only,
          and inherits owner-tier permissions on this account.
        </div>
      </div>

      {error && (
        <div className="text-tea-text-sec italic text-ui-13 mb-4">{error}</div>
      )}

      <div className="flex justify-between items-center pt-4 border-t border-tea-border">
        <button
          type="button"
          onClick={deny}
          disabled={submitting}
          className="text-tea-text-sec hover:text-tea-text text-ui-13 font-display"
        >
          Deny
        </button>
        <button
          type="button"
          onClick={approve}
          disabled={submitting}
          className="text-tea-gold hover:text-tea-text text-ui-14 font-display disabled:text-tea-text-dim"
        >
          {submitting ? 'Approving…' : `Approve ${clientLabel}`}
        </button>
      </div>
    </div>
  );
};
