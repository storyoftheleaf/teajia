import { useState, useEffect, useCallback } from 'react';
import {
  api,
  setToken,
  clearToken,
  hasToken,
  getTokenClaims,
  hydrateAccountStateFromToken,
  SESSION_EXPIRED_EVENT,
  shouldProactivelyRefreshToken,
  isTokenExpired,
  ensureTokenRefreshed,
  type PendingSignup,
} from '../lib/api';
import { useAppStore, type AuthUser } from '../lib/store';

export type { AuthUser };

type SessionResponse = Awaited<ReturnType<typeof api.auth.me>>;

// useAuth is mounted by the app shell, sidebar, bottom navigation, and account
// surfaces. Their mount effects used to call /api/auth/me independently. Share
// one bootstrap request for the lifetime of the current page/token so entering
// Admin cannot fan a single session check into several Worker invocations.
let sessionBootstrapPromise: Promise<SessionResponse> | null = null;

function getSessionBootstrap(): Promise<SessionResponse> {
  if (!sessionBootstrapPromise) {
    sessionBootstrapPromise = (async () => {
      if (shouldProactivelyRefreshToken()) await ensureTokenRefreshed();
      return api.auth.me();
    })().catch(error => {
      // A transient failure must remain retryable later.
      sessionBootstrapPromise = null;
      throw error;
    });
  }
  return sessionBootstrapPromise;
}

function resetSessionBootstrap() {
  sessionBootstrapPromise = null;
}

// Hydrate auth user from local JWT claims once, on module load. This runs
// before any component mounts, so every `useAuth()` call sees the same
// initial state — fixes the per-component useState hydration race that
// hid the admin sidebar nav on first render after login.
(() => {
  const store = useAppStore.getState();
  if (store.authUser) return;
  const claims = getTokenClaims();
  if (claims) {
    store.setAuthUser({
      email: claims.email,
      username: claims.username ?? null,
      name: claims.name,
      role: claims.role,
    });
  }
  if (!hasToken()) {
    store.setIsSessionReady(true);
  }
})();

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
  signup: (email: string, password: string, name: string, username?: string | null) => Promise<PendingSignup>;
  verifySignup: (pending: PendingSignup, code: string) => Promise<void>;
  redeemJoinCode: (data: { code: string; first_name: string; email: string }) => Promise<{ session_id: string; session_title: string | null; is_new_user: boolean }>;
  logout: () => void;
  checkSession: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  // Shared via Zustand — every component sees the same user/session state.
  // Selectors (not destructure of getState) so updates trigger re-renders.
  const user = useAppStore(s => s.authUser);
  const isSessionReady = useAppStore(s => s.isSessionReady);
  const setUser = useAppStore(s => s.setAuthUser);
  const setIsSessionReady = useAppStore(s => s.setIsSessionReady);
  const [isLoading, setIsLoading] = useState(false);

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
      try {
        setIsLoading(true);
        const data = await getSessionBootstrap();
        if (!cancelled) {
          setUser({ email: data.email, username: data.username ?? null, name: data.name, role: data.role, phone: data.phone ?? null, canCreateCollections: Boolean(data.can_create_collections) });
        }
      } catch (err: any) {
        const msg = typeof err?.message === 'string' ? err.message : '';
        if (/\b(401|unauthorized|invalid token|expired)\b/i.test(msg)) {
          clearToken();
          setUser(null);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
        setIsSessionReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

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
      resetSessionBootstrap();
      useAppStore.getState().clearAccountState();
      setUser(null);
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
  }, []);

  const login = useCallback(async (identifier: string, password: string) => {
    const result = await api.auth.login(identifier, password);
    setToken(result.token);
    resetSessionBootstrap();
    hydrateAccountStateFromToken();
    const claims = getTokenClaims();
    if (claims) {
      setUser({ email: claims.email, username: claims.username ?? null, name: claims.name, role: claims.role });
    }
  }, []);

  const signup = useCallback(async (email: string, password: string, name: string, username?: string | null) => {
    return api.auth.signup(email, password, name, username);
  }, []);

  const verifySignup = useCallback(async (pending: PendingSignup, code: string) => {
    const result = await api.auth.verifySignup(pending, code);
    setToken(result.token);
    resetSessionBootstrap();
    hydrateAccountStateFromToken();
    const claims = getTokenClaims();
    if (claims) {
      setUser({ email: claims.email, username: claims.username ?? null, name: claims.name, role: claims.role });
    }
  }, []);

  const redeemJoinCode = useCallback(async (data: { code: string; first_name: string; email: string }) => {
    const result = await api.auth.redeemJoinCode(data);
    setToken(result.token);
    resetSessionBootstrap();
    hydrateAccountStateFromToken();
    const claims = getTokenClaims();
    if (claims) {
      setUser({ email: claims.email, username: claims.username ?? null, name: claims.name, role: claims.role });
    }
    return {
      session_id: result.session_id as string,
      session_title: (result.session_title ?? null) as string | null,
      is_new_user: Boolean(result.is_new_user),
    };
  }, []);

  const logout = useCallback(() => {
    resetSessionBootstrap();
    clearToken();
    useAppStore.getState().clearAccountState();
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
    verifySignup,
    redeemJoinCode,
    logout,
    checkSession,
  };
}
