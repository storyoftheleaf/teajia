import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams, useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAppStore } from '../../lib/store';
import { getTokenClaims, hasToken } from '../../lib/api';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';

// OAuth 2.1 consent screen. Reached when an MCP client (Claude desktop/mobile,
// ChatGPT) hits /oauth/authorize on the worker.
//
// Two arrival shapes are supported:
//   • New (robust): the worker persists the authorize request and redirects to
//     /admin/oauth-consent/<request_id> — a PATH segment, which survives the
//     302 even in in-app browsers that drop query strings (the Claude-mobile
//     bug). We fetch the params back from /oauth/authorize/request/<id>.
//   • Legacy: params arrive in the query string (older worker builds / desktop).
//
// Flow: log in if needed → pick scopes → approve → POST /oauth/authorize/decision
// with our JWT → receive a redirect into the client's redirect_uri with `code=`.

const API_URL = (import.meta as any).env?.VITE_API_URL || '';

interface ConsentParams {
  request_id: string | null;
  client_id: string;
  redirect_uri: string;
  code_challenge: string;
  code_challenge_method: string;
  state: string | null;
  scope: string | null;
  client_name?: string | null;
}

interface ScopeDef {
  scope: string;
  label: string;
  description: string;
  group: 'read' | 'operator' | 'owner';
  defaultChecked: boolean;
}

// Mirrors worker MCP_SCOPES + the mint UI. The worker re-filters owner-tier
// scopes by the approver's tier, so showing them here is safe — they're simply
// stripped server-side if the approver isn't owner-tier.
const SCOPE_DEFS: ScopeDef[] = [
  { scope: 'inventory:read', label: 'inventory:read', description: 'Search teas, view stock', group: 'read', defaultChecked: true },
  { scope: 'customers:read', label: 'customers:read', description: 'Look up customers', group: 'read', defaultChecked: true },
  { scope: 'sales:read', label: 'sales:read', description: 'List + read invoices, sales summaries', group: 'read', defaultChecked: true },
  { scope: 'stock:write', label: 'stock:write', description: 'Add / remove stock, create teas', group: 'operator', defaultChecked: true },
  { scope: 'sales:write', label: 'sales:write', description: 'Create / fill / void invoices', group: 'operator', defaultChecked: true },
  { scope: 'catalog:write', label: 'catalog:write', description: 'Pricing, thresholds, archive', group: 'owner', defaultChecked: false },
  { scope: 'customers:write', label: 'customers:write', description: 'Create / update customers', group: 'owner', defaultChecked: false },
  { scope: 'admin:write', label: 'admin:write', description: 'Account settings, exchange rates', group: 'owner', defaultChecked: false },
];

const KNOWN_CLIENT_NAMES: Record<string, RegExp> = {
  'Claude (desktop or mobile)': /claude|anthropic/i,
  'ChatGPT': /chatgpt|openai/i,
};

function inferClientLabel(redirectUri: string, clientName?: string | null): string {
  if (clientName) {
    for (const [label, pat] of Object.entries(KNOWN_CLIENT_NAMES)) {
      if (pat.test(clientName)) return label;
    }
    return clientName;
  }
  for (const [label, pat] of Object.entries(KNOWN_CLIENT_NAMES)) {
    if (pat.test(redirectUri)) return label;
  }
  try { return new URL(redirectUri).host; } catch { return 'an external app'; }
}

export const OAuthConsentView: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { requestId } = useParams<{ requestId?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const activeAccountId = useAppStore(s => s.activeAccountId);
  const activeAccount = useAppStore(s => s.activeAccount);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [params, setParams] = useState<ConsentParams | null>(null);
  const [loadingParams, setLoadingParams] = useState<boolean>(!!requestId);
  const loggedIn = hasToken();

  const [selectedScopes, setSelectedScopes] = useState<Record<string, boolean>>(
    () => Object.fromEntries(SCOPE_DEFS.map(s => [s.scope, s.defaultChecked])),
  );

  // Resolve params: fetch by request id (new flow) or read the query string (legacy).
  const loadByRequestId = useCallback(async (id: string) => {
    setLoadingParams(true);
    try {
      const res = await fetch(`${API_URL}/oauth/authorize/request/${encodeURIComponent(id)}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error_description || 'This authorization link has expired. Restart the connection from your app.');
      }
      const data = await res.json();
      setParams({
        request_id: id,
        client_id: data.client_id || '',
        redirect_uri: data.redirect_uri || '',
        code_challenge: data.code_challenge || '',
        code_challenge_method: data.code_challenge_method || '',
        state: data.state ?? null,
        scope: data.scope ?? null,
        client_name: data.client_name ?? null,
      });
    } catch (err: any) {
      setError(err?.message || 'Could not load the authorization request.');
    } finally {
      setLoadingParams(false);
    }
  }, []);

  useEffect(() => {
    if (requestId) {
      loadByRequestId(requestId);
    } else {
      setParams({
        request_id: null,
        client_id: searchParams.get('client_id') || '',
        redirect_uri: searchParams.get('redirect_uri') || '',
        code_challenge: searchParams.get('code_challenge') || '',
        code_challenge_method: searchParams.get('code_challenge_method') || '',
        state: searchParams.get('state'),
        scope: searchParams.get('scope'),
      });
      setLoadingParams(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId]);

  const missing = useMemo(() => {
    if (!params) return [];
    const m: string[] = [];
    if (!params.client_id) m.push('client_id');
    if (!params.redirect_uri) m.push('redirect_uri');
    if (!params.code_challenge) m.push('code_challenge');
    if (params.code_challenge_method !== 'S256') m.push('code_challenge_method=S256');
    return m;
  }, [params]);

  // If not logged in (and params are valid), route through admin login, stashing
  // the full current path so we land back here with the request id intact.
  useEffect(() => {
    if (!loadingParams && params && missing.length === 0 && !loggedIn) {
      const next = encodeURIComponent(location.pathname + location.search);
      navigate(`/admin?next=${next}`, { replace: true });
    }
  }, [loggedIn, loadingParams, params, missing.length, location.pathname, location.search, navigate]);

  const toggleScope = (scope: string) =>
    setSelectedScopes(prev => ({ ...prev, [scope]: !prev[scope] }));

  if (loadingParams) {
    return (
      <div className="px-4 md:px-6 pt-6 pb-nav-gap max-w-xl mx-auto">
        <p className="text-tea-text-sec italic text-ui-14">Loading authorization request…</p>
      </div>
    );
  }

  if (params && missing.length > 0) {
    return (
      <div className="px-4 md:px-6 pt-6 pb-nav-gap max-w-xl mx-auto">
        <h1 className={`${TYPOGRAPHY_CLASSES.h2} text-tea-text mb-4`}>Authorization request</h1>
        <p className="text-tea-text-sec text-ui-14 leading-[1.6]">
          {error || <>This authorization link is missing required parameters: <code className="text-tea-text">{missing.join(', ')}</code>. Please return to the app you were using and try again.</>}
        </p>
      </div>
    );
  }

  if (error && !params) {
    return (
      <div className="px-4 md:px-6 pt-6 pb-nav-gap max-w-xl mx-auto">
        <h1 className={`${TYPOGRAPHY_CLASSES.h2} text-tea-text mb-4`}>Authorization request</h1>
        <p className="text-tea-text-sec text-ui-14 leading-[1.6]">{error}</p>
      </div>
    );
  }

  if (!params) return null;

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
  const clientLabel = inferClientLabel(params.redirect_uri, params.client_name);

  const approve = async () => {
    setSubmitting(true);
    setError(null);
    const jwt = localStorage.getItem('teajia_token') || sessionStorage.getItem('teajia_token') || '';
    const scopes = Object.entries(selectedScopes).filter(([, v]) => v).map(([k]) => k);
    try {
      if (!jwt) throw new Error('Login required before approval');
      if (scopes.length === 0) throw new Error('Select at least one permission to grant.');
      const res = await fetch(`${API_URL}/oauth/authorize/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwt}` },
        body: JSON.stringify({
          request_id: params.request_id,
          // Legacy params (ignored by the worker when request_id is present).
          client_id: params.client_id,
          redirect_uri: params.redirect_uri,
          code_challenge: params.code_challenge,
          code_challenge_method: params.code_challenge_method,
          state: params.state,
          scopes,
          account_id: activeAccountId,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error_description || body?.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      if (!data?.redirect_to) throw new Error('No redirect URL in response');
      window.location.assign(data.redirect_to);
    } catch (err: any) {
      setError(err?.message || 'Approval failed.');
      setSubmitting(false);
    }
  };

  const deny = () => {
    const sep = params.redirect_uri.includes('?') ? '&' : '?';
    const stateParam = params.state ? `&state=${encodeURIComponent(params.state)}` : '';
    window.location.assign(`${params.redirect_uri}${sep}error=access_denied${stateParam}`);
  };

  const scopeGroups: { key: ScopeDef['group']; title: string; note?: string }[] = [
    { key: 'read', title: 'Read' },
    { key: 'operator', title: 'Write — Operator' },
    { key: 'owner', title: 'Write — Owner', note: 'Granted only if you are an account owner' },
  ];

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
          You&apos;re signed in as <span className="text-tea-text">{userEmail}</span>. Approving issues
          {' '}{clientLabel} a token scoped to <span className="text-tea-text">{accountName}</span> only,
          with the permissions you select below. Every mutating action still requires an explicit
          confirmation in the model. You can revoke at any time from the Voice &amp; Agent (MCP) admin page.
        </p>
      </header>

      <div className="border border-tea-border rounded p-4 mb-6 bg-tea-elevated">
        <div className="text-tea-text-sec text-ui-11 uppercase tracking-[0.12em] mb-3">
          Permissions to grant
        </div>
        <div className="space-y-4">
          {scopeGroups.map(group => {
            const defs = SCOPE_DEFS.filter(s => s.group === group.key);
            return (
              <div key={group.key}>
                <div className="text-tea-text-sec text-ui-11 mb-1.5 flex items-center gap-2">
                  <span>{group.title}</span>
                  {group.note && <span className="text-tea-text-dim text-ui-10 italic">{group.note}</span>}
                </div>
                <div className="space-y-1.5">
                  {defs.map(def => (
                    <label key={def.scope} className="flex items-start gap-2.5 cursor-pointer tap-target">
                      <input
                        type="checkbox"
                        checked={selectedScopes[def.scope] ?? def.defaultChecked}
                        onChange={() => toggleScope(def.scope)}
                        className="mt-0.5 accent-tea-gold"
                      />
                      <div>
                        <code className="text-ui-12 text-tea-text">{def.label}</code>
                        <span className="text-tea-text-sec text-ui-11 ml-2">{def.description}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {error && <div className="text-tea-text-sec italic text-ui-13 mb-4">{error}</div>}

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
