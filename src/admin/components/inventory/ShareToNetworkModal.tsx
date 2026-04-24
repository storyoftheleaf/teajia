import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Search, X as XIcon, Check, Globe } from 'lucide-react';
import { api } from '../../../lib/api';

interface NetworkStore {
  id: string;
  slug: string;
  name: string;
  tagline?: string;
  location_city?: string;
  location_country?: string;
}

interface ShareToNetworkModalProps {
  open: boolean;
  productIds: string[];
  onClose: () => void;
  onSuccess: (count: number, storeName: string) => void;
}

export const ShareToNetworkModal: React.FC<ShareToNetworkModalProps> = ({
  open,
  productIds,
  onClose,
  onSuccess,
}) => {
  const [stores, setStores] = useState<NetworkStore[]>([]);
  const [storesLoading, setStoresLoading] = useState(true);
  const [storesError, setStoresError] = useState<string | null>(null);
  const [targetAccountId, setTargetAccountId] = useState('');
  const [storeSearch, setStoreSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setStoresLoading(true);
    setStoresError(null);
    api.network.getStores()
      .then((data) => { if (!cancelled) setStores(data); })
      .catch((err) => { if (!cancelled) setStoresError(err?.message || 'Failed to load network stores'); })
      .finally(() => { if (!cancelled) setStoresLoading(false); });
    return () => { cancelled = true; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      setTargetAccountId('');
      setStoreSearch('');
      setSubmitError(null);
    }
  }, [open]);

  const filteredStores = useMemo(() => {
    if (!storeSearch.trim()) return stores;
    const q = storeSearch.toLowerCase();
    return stores.filter(s =>
      s.name.toLowerCase().includes(q) || s.slug.toLowerCase().includes(q)
    );
  }, [stores, storeSearch]);

  const selectedStore = stores.find(s => s.id === targetAccountId);

  const handleConfirm = async () => {
    if (!targetAccountId || productIds.length === 0) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      const result = await api.catalog.seed(targetAccountId, productIds);
      onSuccess(result.seeded.length, selectedStore?.name || targetAccountId);
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to share products');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const count = productIds.length;

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-to-network-title"
    >
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-tea-bg/80 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative w-full max-w-md bg-tea-surface border border-tea-border rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">
        <header className="flex items-start justify-between gap-3 px-5 pt-5 pb-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-tea-gold-lt flex items-center justify-center flex-shrink-0">
              <Globe size={14} className="text-tea-gold" />
            </div>
            <div className="min-w-0">
              <h2 id="share-to-network-title" className="text-sm font-medium text-tea-text tracking-wide">
                Share to Network
              </h2>
              <p className="text-[11px] text-tea-text-dim mt-0.5">
                {count} product{count !== 1 ? 's' : ''} → partner store
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-tea-text-sec hover:text-tea-text transition-colors p-1 -mr-1"
            aria-label="Close"
          >
            <XIcon size={15} />
          </button>
        </header>

        <div className="px-5 pb-3 flex-1 min-h-0 flex flex-col">
          <div className="relative mb-2 flex-shrink-0">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-tea-text-dim pointer-events-none" />
            <input
              type="text"
              value={storeSearch}
              onChange={e => setStoreSearch(e.target.value)}
              placeholder="Search stores…"
              autoFocus
              className="w-full pl-8 pr-8 py-2 text-xs bg-tea-bg border border-tea-border rounded-lg outline-none text-tea-text placeholder:text-tea-text-dim focus:ring-1 focus:ring-tea-gold/40 transition-colors"
            />
            {storeSearch && (
              <button
                type="button"
                onClick={() => setStoreSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-tea-text-sec hover:text-tea-text transition-colors"
                aria-label="Clear search"
              >
                <XIcon size={12} />
              </button>
            )}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto -mx-1 px-1">
            {storesLoading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-tea-text-dim text-xs">
                <Loader2 size={13} className="animate-spin" />
                <span>Loading stores…</span>
              </div>
            ) : storesError ? (
              <p className="py-8 text-xs text-red-400 text-center">{storesError}</p>
            ) : filteredStores.length === 0 ? (
              <p className="py-8 text-xs text-tea-text-dim text-center">
                {storeSearch ? 'No stores match that search.' : 'No stores in your network yet.'}
              </p>
            ) : (
              <ul className="space-y-1 pb-1">
                {filteredStores.map(store => {
                  const isSelected = store.id === targetAccountId;
                  const locality = [store.location_city, store.location_country].filter(Boolean).join(', ');
                  return (
                    <li key={store.id}>
                      <button
                        type="button"
                        onClick={() => setTargetAccountId(store.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                          isSelected
                            ? 'bg-tea-gold-lt'
                            : 'bg-tea-bg hover:bg-tea-elevated'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center transition-colors ${
                          isSelected ? 'bg-tea-gold' : 'bg-tea-surface'
                        }`}>
                          {isSelected && <Check size={10} className="text-tea-bg" strokeWidth={3} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-tea-text truncate">{store.name}</p>
                          {locality && (
                            <p className="text-[11px] text-tea-text-dim truncate">{locality}</p>
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {submitError && (
          <p className="px-5 pb-2 text-xs text-red-400 text-center">{submitError}</p>
        )}

        <footer className="flex items-center justify-between gap-3 px-5 py-4 border-t border-tea-border flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="text-xs text-tea-text-sec hover:text-tea-text transition-colors disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting || !targetAccountId || productIds.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-tea-gold text-tea-bg rounded-lg text-xs font-semibold tracking-wide hover:bg-tea-gold/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <><Loader2 size={12} className="animate-spin" /> Sharing…</>
            ) : (
              <>Share {count} {selectedStore ? `to ${selectedStore.name}` : ''}</>
            )}
          </button>
        </footer>
      </div>
    </div>
  );
};
