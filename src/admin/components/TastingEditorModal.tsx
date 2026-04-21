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
      const payload: Record<string, unknown> = {
        tasting: Object.keys(tastingData).length > 0 ? tastingData : null,
        ...syncFields,
      };

      await api.products.update(product.id, payload);

      queryClient.setQueryData(['products'], (old: Product[] | undefined) => {
        if (!old) return old;
        return old.map(p =>
          p.id === product.id ? { ...p, tasting: tastingData, ...syncFields } : p
        );
      });

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
