import { useState, useEffect, useCallback } from 'react';
import { api, setToken, clearToken, hasToken, getTokenClaims, SESSION_EXPIRED_EVENT } from '../lib/api';

export interface AuthUser {
  email: string;
  username: string | null;
  name: string;
  role: string;
}

interface UseAuthReturn {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string, username?: string | null) => Promise<void>;
  logout: () => void;
  checkSession: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<AuthUser | null>(() => {
    // Initialize from token claims if available
    const claims = getTokenClaims();
    if (claims) {
      return { email: claims.email, username: claims.username ?? null, name: claims.name, role: claims.role };
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState(false);

  const checkSession = useCallback(async () => {
    if (!hasToken()) {
      setUser(null);
      return;
    }
    try {
      setIsLoading(true);
      const data = await api.auth.me();
      setUser({ email: data.email, username: data.username ?? null, name: data.name, role: data.role });
    } catch {
      // Token expired or invalid
      clearToken();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Check session on mount if we have a token
  useEffect(() => {
    if (hasToken()) {
      checkSession();
    }
  }, [checkSession]);

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
    login,
    signup,
    logout,
    checkSession,
  };
}
