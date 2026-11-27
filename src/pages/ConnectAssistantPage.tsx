import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Button } from '../components/shared/Button';
import { TYPOGRAPHY_CLASSES as T } from '../designTokens';
import { authedFetch, fetchWithTimeout, getApiOrigin, hasToken } from '../lib/api';
import { authPagePath } from '../lib/authNavigation';

// A host connects ChatGPT or Claude by signing in (OAuth), on the site's own
// page, not in Manage. The app reaches only their own tables, tea spaces,
// guests and notes: the grant is `host:self` alone (worker/src/mcp.ts,
// resolveHostOAuthContext). A shop owner arriving here can still use the
// owner's consent screen in Manage.

const API = getApiOrigin();

function appName(clientName: string | null | undefined, redirectUri: string): string {
  const text = `${clientName ?? ''} ${redirectUri}`;
  if (/chatgpt|openai/i.test(text)) return 'ChatGPT';
  if (/claude|anthropic/i.test(text)) return 'Claude';
  return clientName || 'This app';
}

type Request = { client_name?: string | null; redirect_uri: string };

export default function ConnectAssistantPage() {
  const { requestId = '' } = useParams<{ requestId: string }>();
  const location = useLocation();
  const signedIn = hasToken();
  const [request, setRequest] = useState<Request | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const response = await fetchWithTimeout(`${API}/oauth/authorize/request/${encodeURIComponent(requestId)}`);
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body?.error_description || 'This link has run out. Start connecting again from the app.');
        if (live) setRequest({ client_name: body.client_name ?? null, redirect_uri: String(body.redirect_uri ?? '') });
      } catch (caught) {
        if (live) setError((caught as Error).message);
      }
    })();
    return () => { live = false; };
  }, [requestId]);

  async function allow() {
    setSending(true);
    setError(null);
    try {
      const answer = await authedFetch(`${API}/oauth/authorize/decision`, {
        method: 'POST', body: JSON.stringify({ request_id: requestId, host: true }),
      });
      if (!answer?.redirect_to) throw new Error('Could not connect just now. Try again in a moment.');
      window.location.assign(answer.redirect_to);
    } catch (caught) {
      setError((caught as Error).message || 'Could not connect just now. Try again in a moment.');
      setSending(false);
    }
  }

  const name = request ? appName(request.client_name, request.redirect_uri) : 'Your assistant';

  return (
    <div className="mx-auto w-full max-w-xl px-4 pt-12 pb-nav-gap" data-testid="connect-assistant">
      <Helmet><title>Connect your assistant | Teajia</title></Helmet>
      <h1 className={T.h1}>Connect {name}</h1>
      {request && (
        <p className={`${T.body} mt-4 text-tea-text-sec`}>
          {name} will be able to see and change your own tables, tea spaces, guests and notes, as you can on your page. Nothing of the shop.
        </p>
      )}
      {error && <p className={`${T.body} mt-4 text-tea-text`} role="alert">{error}</p>}
      {request && !signedIn && (
        <div className="mt-8 flex flex-wrap items-center justify-end gap-2">
          <Link to={authPagePath('signin', location.pathname)} className="btn-primary tap-target">Sign in to connect</Link>
        </div>
      )}
      {request && signedIn && (
        <div className="mt-8 flex flex-wrap items-center justify-between gap-2">
          <Link to="/account/host" className="btn-quiet tap-target">Cancel</Link>
          <Button type="button" className="tap-target" disabled={sending} onClick={allow} data-testid="connect-assistant-allow">
            {sending ? 'Connecting…' : `Connect ${name}`}
          </Button>
        </div>
      )}
    </div>
  );
}
