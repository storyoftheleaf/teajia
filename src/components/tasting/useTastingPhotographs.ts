import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../../lib/api';
import { familyApi } from '../../lib/familyApi';
import { FAMILY_PHOTOS_PER_TEA, type FamilyPhotoPage, type FamilyPhotograph, type FamilyPhotographShape } from '../../lib/familyContract';
import { prepareFamilyPhotograph } from '../../lib/familyPhotographSizes';

export const PHOTO_LIMIT_SENTENCE = 'You have six photographs of this tea. Remove one from your page to add another.';

function plainSentence(error: unknown): string {
  if (error instanceof ApiError && error.message && !error.message.startsWith('Request failed')) return error.message;
  if (error instanceof Error && error.message && !(error instanceof ApiError)) return error.message;
  return 'That photograph could not be added. Please try again.';
}

/**
 * The person's own photographs of one tea, for the tasting screen. Each file is
 * re-encoded on the phone (both sizes, no location data) before it is sent.
 * The tasting itself stays one record; photographs are stored by tea.
 */
export function useTastingPhotographs({ productId, enabled }: { productId: string; enabled: boolean }) {
  const [photos, setPhotos] = useState<FamilyPhotograph[]>([]);
  const [remaining, setRemaining] = useState(FAMILY_PHOTOS_PER_TEA);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const remainingRef = useRef(FAMILY_PHOTOS_PER_TEA);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const setLeft = (n: number) => { remainingRef.current = n; setRemaining(n); };

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    familyApi.myTea(productId)
      .then(mine => { if (live) { setPhotos(mine.photographs); setLeft(mine.remaining); } })
      .catch(() => { /* the row simply starts empty; adding still works */ });
    return () => { live = false; };
  }, [productId, enabled]);

  const add = useCallback(async (files: File[], page?: FamilyPhotoPage) => {
    if (!enabled || files.length === 0) return;
    setError('');
    setBusy(true);
    try {
      for (const file of files) {
        if (remainingRef.current <= 0) { if (mounted.current) setError(PHOTO_LIMIT_SENTENCE); break; }
        try {
          const prepared = await prepareFamilyPhotograph(file);
          const result = await familyApi.uploadPhotograph({ productId, full: prepared.full, small: prepared.small, page });
          if (!mounted.current) return;
          setPhotos(current => [...current, result.photograph]);
          setLeft(result.remaining);
        } catch (err) {
          if (mounted.current) setError(plainSentence(err));
          break;
        }
      }
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, [enabled, productId]);

  const remove = useCallback(async (photographId: string) => {
    setError('');
    try {
      await familyApi.removePhotograph(photographId);
      if (!mounted.current) return;
      setPhotos(current => current.filter(p => p.id !== photographId));
      setLeft(Math.min(FAMILY_PHOTOS_PER_TEA, remainingRef.current + 1));
    } catch (err) {
      if (mounted.current) setError(plainSentence(err));
    }
  }, []);

  /** The shape answers at once; the server confirms, and a refusal puts it back. */
  const reshape = useCallback(async (photographId: string, shape: FamilyPhotographShape) => {
    setError('');
    let before: FamilyPhotographShape | undefined;
    setPhotos(current => current.map(p => {
      if (p.id !== photographId) return p;
      before = p.shape;
      return { ...p, shape };
    }));
    try {
      await familyApi.setPhotographShape(photographId, shape);
    } catch (err) {
      if (!mounted.current) return;
      setPhotos(current => current.map(p => (p.id === photographId ? { ...p, shape: before ?? 'square' } : p)));
      setError(plainSentence(err));
    }
  }, []);

  return { photos, remaining, busy, error, add, remove, reshape, clearError: () => setError('') };
}
