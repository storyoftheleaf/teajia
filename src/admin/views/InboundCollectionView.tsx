import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Loader2, Building2, Check, Download,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../components/Toast';
import type { InboundCollectionDetail } from '../../types';

function formatWhen(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export const InboundCollectionView: React.FC = () => {
  const { pubId } = useParams<{ pubId: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [importing, setImporting] = useState<Set<string>>(new Set());
  const [bulkImporting, setBulkImporting] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-collection-inbound', pubId],
    queryFn: () => api.collections.getInbound(pubId!),
    enabled: !!pubId,
  });

  const detail = data as InboundCollectionDetail | undefined;
  const items = detail?.items ?? [];

  const remaining = useMemo(
    () => items.filter(i => !i.imported_product_id),
    [items]
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-collection-inbound', pubId] });
    queryClient.invalidateQueries({ queryKey: ['admin-collections-inbound'] });
    queryClient.invalidateQueries({ queryKey: ['admin-products'] });
  };

  const importOne = async (productId: string) => {
    if (!pubId) return;
    setImporting(prev => new Set(prev).add(productId));
    try {
      const res = await api.collections.importInbound(pubId, [productId]);
      if (res.imported.length === 0) {
        showToast('Already imported', 'info');
      } else {
        showToast('Imported as draft', 'success');
      }
      invalidate();
    } catch (err: any) {
      showToast(err?.message || 'Import failed', 'error');
    } finally {
      setImporting(prev => {
        const n = new Set(prev);
        n.delete(productId);
        return n;
      });
    }
  };

  const importAll = async () => {
    if (!pubId || remaining.length === 0 || bulkImporting) return;
    setBulkImporting(true);
    try {
      const res = await api.collections.importInbound(
        pubId,
        remaining.map(i => i.product_id)
      );
      const n = res.imported.length;
      showToast(
        n === 0
          ? 'Nothing new to import'
          : `Imported ${n} product${n !== 1 ? 's' : ''} as drafts`,
        n === 0 ? 'info' : 'success'
      );
      invalidate();
    } catch (err: any) {
      showToast(err?.message || 'Import failed', 'error');
    } finally {
      setBulkImporting(false);
    }
  };

  if (!pubId) return <p className="p-6 text-sm text-tea-text-dim">Missing publication id.</p>;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-tea-text-dim text-xs">
        <Loader2 size={14} className="animate-spin" /> Loading inbound collection…
      </div>
    );
  }
  if (isError || !detail) {
    return (
      <div className="py-20 text-center text-sm text-red-400">
        Failed to load inbound collection.
        <button onClick={() => refetch()} className="block mx-auto mt-3 text-xs text-tea-gold underline">Retry</button>
      </div>
    );
  }

  const pub = detail.publication;

  return (
    <div className="h-full flex flex-col overflow-hidden bg-tea-bg">
      <div className="flex items-center gap-2 px-4 md:px-6 py-4 border-b border-tea-border bg-tea-bg flex-shrink-0">
        <button
          onClick={() => navigate('/admin/collections')}
          className="flex items-center gap-1.5 text-xs text-tea-text-sec hover:text-tea-text transition-colors"
        >
          <ArrowLeft size={14} /> Collections
        </button>
        <div className="flex-1" />
        <span className="px-2.5 py-1 rounded-full text-ui-10 uppercase tracking-[1.2px] bg-tea-elevated text-tea-text-sec">
          Inbound
        </span>
      </div>

      <div className="flex-1 overflow-y-auto pb-nav-gap-lg">
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 flex flex-col gap-6">

          <section className="flex flex-col gap-2">
            <p className="flex items-center gap-1.5 text-ui-11 uppercase tracking-[1.2px] text-tea-text-dim">
              <Building2 size={11} /> From {pub.publisher_account_name}
              {pub.curator_display_name && (
                <span className="normal-case tracking-normal text-tea-text-dim/70">
                  · curated by {pub.curator_display_name}
                </span>
              )}
            </p>
            <h1 className="font-display text-[clamp(24px,3.5vw,32px)] leading-[1.2] text-tea-text" style={{ fontWeight: 500 }}>
              {pub.title}
            </h1>
            {pub.note && (
              <p className="font-body text-ui-15 leading-[1.65] text-tea-text italic">
                {pub.note}
              </p>
            )}
            <p className="text-ui-11 text-tea-text-dim mt-1">
              Shared {formatWhen(pub.published_at)}
            </p>
          </section>

          {pub.hero_image_url && (
            <div className="rounded-lg overflow-hidden bg-tea-elevated">
              <img src={pub.hero_image_url} alt="" className="w-full h-[200px] object-cover" />
            </div>
          )}

          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <label className="text-ui-10 uppercase tracking-[1.2px] text-tea-text-dim">
                Products <span className="text-tea-text-dim/70">({items.length})</span>
              </label>
              <button
                onClick={importAll}
                disabled={remaining.length === 0 || bulkImporting}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-tea-gold text-tea-bg rounded-md text-xs font-semibold tracking-wide hover:bg-tea-gold/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {bulkImporting
                  ? <><Loader2 size={11} className="animate-spin" /> Importing…</>
                  : <><Download size={11} /> Import all{remaining.length > 0 ? ` (${remaining.length})` : ''}</>}
              </button>
            </div>

            {items.length === 0 ? (
              <p className="text-xs text-tea-text-dim py-6 text-center border border-dashed border-tea-border rounded-lg">
                No products in this collection.
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {items.map((item, idx) => {
                  const isImported = !!item.imported_product_id;
                  const isImporting = importing.has(item.product_id);
                  return (
                    <li
                      key={item.item_id}
                      className="flex items-center gap-3 px-2.5 py-2 rounded-md hover:bg-tea-surface transition-colors"
                    >
                      <span className="w-5 text-right text-ui-11 text-tea-text-dim font-mono tabular-nums">
                        {idx + 1}
                      </span>
                      <div className="w-10 h-10 flex-shrink-0 rounded bg-tea-elevated overflow-hidden">
                        {item.image_url && (
                          <img src={item.image_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-tea-text truncate">
                          {item.product_name || 'Untitled'}
                          {item.chinese_name && <span className="text-tea-text-dim ml-1.5 text-xs">{item.chinese_name}</span>}
                        </p>
                        <p className="text-ui-11 text-tea-text-dim truncate">
                          {[item.origin_region, item.origin_country].filter(Boolean).join(', ') || item.product_type}
                          {item.year && ` · ${item.year}`}
                        </p>
                      </div>
                      {isImported ? (
                        <span className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-tea-elevated text-ui-10 uppercase tracking-[1.2px] text-tea-text-sec">
                          <Check size={10} /> Imported
                        </span>
                      ) : (
                        <button
                          onClick={() => importOne(item.product_id)}
                          disabled={isImporting || bulkImporting}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-md text-ui-10 uppercase tracking-[1.2px] text-tea-text-sec hover:text-tea-gold hover:bg-tea-gold-lt transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {isImporting
                            ? <Loader2 size={10} className="animate-spin" />
                            : <Download size={10} />}
                          Import
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            <p className="text-ui-11 text-tea-text-dim mt-2">
              Imported products land in your inventory as drafts. Edit pricing, stock, and visibility before publishing.
            </p>
          </section>

        </div>
      </div>
    </div>
  );
};
