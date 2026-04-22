import { useState, useEffect, useCallback } from 'react';
import type { CostCurrency } from '../types';
import { loadExchangeRates, fetchAndSaveExchangeRates } from '../utils/currency';
import { TIMING, STORAGE_KEYS } from '../constants/admin';
import { safeLocalStorageGet, safeLocalStorageSet } from '../utils/errorHandling';

export type ExchangeRateStatus = 'idle' | 'loading' | 'success' | 'error';

export const useExchangeRates = (autoFetch = true) => {
  const [rates, setRates] = useState<Record<CostCurrency, number>>(loadExchangeRates);
  const [status, setStatus] = useState<ExchangeRateStatus>('idle');
  const [lastFetch, setLastFetch] = useState<Date | null>(() => {
    const timestamp = safeLocalStorageGet<number | null>(STORAGE_KEYS.EXCHANGE_RATES_TIMESTAMP, null);
    return timestamp ? new Date(timestamp) : null;
  });
  const [error, setError] = useState<string | null>(null);

  const isStale = useCallback(() => {
    if (!lastFetch) return true;
    const now = Date.now();
    const fetchTime = lastFetch.getTime();
    return now - fetchTime > TIMING.EXCHANGE_RATE_REFRESH_MS;
  }, [lastFetch]);

  const fetchRates = useCallback(async (force = false) => {
    // Don't fetch if not stale unless forced
    if (!force && !isStale()) {
      if (import.meta.env.DEV) { console.log('Exchange rates are still fresh, skipping fetch'); }
      return;
    }

    setStatus('loading');
    setError(null);

    try {
      await fetchAndSaveExchangeRates();
      const newRates = loadExchangeRates();
      const now = new Date();

      setRates(newRates);
      setLastFetch(now);
      setStatus('success');

      // Save timestamp
      safeLocalStorageSet(STORAGE_KEYS.EXCHANGE_RATES_TIMESTAMP, now.getTime());

      if (import.meta.env.DEV) { console.log('Exchange rates updated successfully'); }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch exchange rates';
      setError(errorMessage);
      setStatus('error');
      if (import.meta.env.DEV) { console.error('Failed to fetch exchange rates:', err); }
    }
  }, [isStale]);

  // Auto-fetch on mount if enabled and rates are stale
  useEffect(() => {
    if (autoFetch && isStale()) {
      fetchRates();
    }
  }, [autoFetch, isStale, fetchRates]);

  // Set up interval for auto-refresh (only if autoFetch is enabled)
  useEffect(() => {
    if (!autoFetch) return;

    const intervalId = setInterval(() => {
      if (isStale()) {
        fetchRates();
      }
    }, TIMING.EXCHANGE_RATE_REFRESH_MS);

    return () => clearInterval(intervalId);
  }, [autoFetch, isStale, fetchRates]);

  const refresh = useCallback(() => {
    return fetchRates(true);
  }, [fetchRates]);

  const getTimeSinceLastFetch = useCallback((): string | null => {
    if (!lastFetch) return null;

    const now = Date.now();
    const diff = now - lastFetch.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    }
    if (minutes > 0) {
      return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    }
    return 'just now';
  }, [lastFetch]);

  return {
    rates,
    status,
    error,
    lastFetch,
    isStale: isStale(),
    refresh,
    getTimeSinceLastFetch,
  };
};
