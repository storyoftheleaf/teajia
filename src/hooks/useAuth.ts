import { useState, useEffect, useCallback } from 'react';
import {
  api,
  setToken,
  clearToken,
  hasToken,
  getTokenClaims,
  SESSION_EXPIRED_EVENT,
  shouldProactivelyRefreshToken,
  isTokenExpired,
  ensureTokenRefreshed,
} from '../lib/api';

export interface AuthUser {
  email: string;
  username: string | null;
  name: string;
  role: string;
  phone?: string | null;
  canCreateCollections?: boolean;
}

interface UseAuthReturn {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  /** True once the on-mount session check (api.auth.me) has completed — or immediately
   *  if there was no token to check. Use this to gate sync hooks so they don't fire
   *  authenticated API calls before the server has validated the stored token. */
  isSessionReady: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string, username?: string | null) => Promise<void>;
  logout: () => void;
  checkSession: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<AuthUser | null>(() => {
    // Initialize from token claims if available (local decode, no server round-trip)
    const claims = getTokenClaims();
    if (claims) {
      return { email: claims.email, username: claims.username ?? null, name: claims.name, role: claims.role };
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState(false);
  // Ready immediately when there is no token — nothing to verify with the server.
  // Stays false until checkSession() completes so sync hooks don't fire
  // authenticated API calls before the stored token has been validated.
  const [isSessionReady, setIsSessionReady] = useState(!hasToken());

  const checkSession = useCallback(async () => {
    if (!hasToken()) {
      setUser(null);
      setIsSessionReady(true);
      return;
    }
    try {
      setIsLoading(true);
      const data = await api.auth.me();
      setUser({ email: data.email, username: data.username ?? null, name: data.name, role: data.role, phone: data.phone ?? null, canCreateCollections: Boolean(data.can_create_collections) });
    } catch (err: any) {
      // Only clear the session when the server explicitly rejected the token.
      // Transient issues (offline, CORS hiccup, timeout, 5xx) used to boot
      // the user out here — now we keep the local session and let
      // handleResponse's silent-refresh flow decide. The SESSION_EXPIRED
      // event is what actually triggers clearing, centrally.
      const msg = typeof err?.message === 'string' ? err.message : '';
      const explicitAuthFailure = /\b(401|unauthorized|invalid token|expired)\b/i.test(msg);
      if (explicitAuthFailure) {
        clearToken();
        setUser(null);
      }
      // Otherwise keep the current user — the token is still there and
      // another sync/api call may succeed once the network recovers.
    } finally {
      setIsLoading(false);
      // Always mark session as ready once the check completes, regardless of
      // outcome. Sync hooks can now safely fire.
      setIsSessionReady(true);
    }
  }, []);

  // Check session on mount if we have a token.
  //
  // If the token is within the refresh threshold (e.g., user hasn't opened
  // the app for a couple of weeks on a 30-day token), fire a silent refresh
  // first so we never hit the server with a soon-to-expire token.
  useEffect(() => {
    if (!hasToken()) return;
    let cancelled = false;
    (async () => {
      if (shouldProactivelyRefreshToken()) {
        await ensureTokenRefreshed();
      }
      if (!cancelled) await checkSession();
    })();
    return () => { cancelled = true; };
  }, [checkSession]);

  // When the tab returns from background, check the session. Mobile browsers
  // pause JS for long periods — this catches tokens that rolled through the
  // refresh window while the tab was asleep so the user never sees a 401.
  // Also handles the edge case where the token crossed its exp boundary while
  // the tab was hidden (shouldProactivelyRefreshToken returns false once exp
  // has passed because secondsLeft <= 0, so we explicitly check isTokenExpired too).
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      if (!hasToken()) return;
      if (isTokenExpired() || shouldProactivelyRefreshToken()) {
        void ensureTokenRefreshed();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // Clear React auth state when a 401 triggers session expiry
  useEffect(() => {
    const handleSessionExpired = () => {
      setUser(null);
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
  }, []);

  const login = useCallback(async (identifier: string, password: string) => {
    const result = await api.auth.login(identifier, password);
    setToken(result.token);
    const claims = getTokenClaims();
    if (claims) {
      setUser({ email: claims.email, username: claims.username ?? null, name: claims.name, role: claims.role });
    }
  }, []);

  const signup = useCallback(async (email: string, password: string, name: string, username?: string | null) => {
    const result = await api.auth.signup(email, password, name, username);
    setToken(result.token);
    const claims = getTokenClaims();
    if (claims) {
      setUser({ email: claims.email, username: claims.username ?? null, name: claims.name, role: claims.role });
    }
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  return {
    user,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin' || user?.role === 'owner',
    isLoading,
    isSessionReady,
    login,
    signup,
    logout,
    checkSession,
  };
}
