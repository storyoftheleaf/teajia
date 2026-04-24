import React, { useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import type { Product } from '../types';
import type { TastingData } from '../../types';
import { TastingSession } from '../../components/tasting/TastingSession';
import { buildTastingSyncPayload, deriveMoodFromFeeling } from '../../lib/tastingUtils';
import { api } from '../../lib/api';
import { useToast } from './Toast';
import { useQueryClient } from '@tanstack/react-query';

interface TastingEditorModalProps {
  product: Product;
  onClose: () => void;
  onSaved?: (product: Product, tastingData: TastingData, derivedMood: string) => void;
  allProducts?: Product[];
}

export const TastingEditorModal: React.FC<TastingEditorModalProps> = ({
  product,
  onClose,
  onSaved,
}) => {
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const handleSave = useCallback(async (tastingData: TastingData) => {
    try {
      const syncFields = buildTastingSyncPayload(tastingData);
      const hasTerms = Object.keys(tastingData).length > 0;
      // Owner-stamp: saving through this editor means Adrian has reviewed the profile.
      // Clearing everything resets source so the public page falls back to the style baseline.
      const tastingSource: 'owner' | null = hasTerms ? 'owner' : null;
      const payload: Record<string, unknown> = {
        tasting: hasTerms ? tastingData : null,
        tasting_source: tastingSource,
        ...syncFields,
      };

      await api.products.update(product.id, payload);

      queryClient.setQueryData(['products'], (old: Product[] | undefined) => {
        if (!old) return old;
        return old.map(p =>
          p.id === product.id
            ? { ...p, tasting: tastingData, tastingSource: tastingSource ?? undefined, ...syncFields }
            : p
        );
      });

      // Optimistically patch the public storefront cache too, so toggling a
      // star (on or off) reflects on the card immediately — even while the
      // 10s edge cache still serves stale JSON to fresh fetches.
      queryClient.setQueriesData<any[]>({ queryKey: ['storefront', 'products'] }, (old) => {
        if (!Array.isArray(old)) return old;
        return old.map((item: any) =>
          item?.id === product.id
            ? {
                ...item,
                tasting: hasTerms ? tastingData : undefined,
                tastingSource: tastingSource ?? undefined,
              }
            : item
        );
      });

      // Refetch in the background so eventual reality catches up with the
      // optimistic patch once the edge cache expires.
      queryClient.invalidateQueries({ queryKey: ['storefront', 'products'] });

      const derivedMood = deriveMoodFromFeeling(tastingData);
      showToast('Tasting profile saved', 'success');
      onSaved?.(product, tastingData, derivedMood);
    } catch {
      showToast('Failed to save tasting data', 'error');
      throw new Error('save failed');
    }
  }, [product, queryClient, showToast, onSaved]);

  const handleWriteDescription = useCallback(async (text: string) => {
    try {
      await api.products.update(product.id, { description: text });
      queryClient.setQueryData(['products'], (old: Product[] | undefined) => {
        if (!old) return old;
        return old.map(p => p.id === product.id ? { ...p, description: text } : p);
      });
      showToast('Description saved', 'success');
    } catch {
      showToast('Failed to save description', 'error');
      throw new Error('save failed');
    }
  }, [product.id, queryClient, showToast]);

  return (
    <AnimatePresence>
      <TastingSession
        item={{
          id: product.id,
          name: product.givenName || product.productName,
          type: product.type,
          image: product.imageUrl || undefined,
          teaKey: product.teaKey,
        }}
        adminMode
        initialData={product.tasting || {}}
        onClose={onClose}
        onSave={handleSave}
        onWriteDescription={handleWriteDescription}
      />
    </AnimatePresence>
  );
};
