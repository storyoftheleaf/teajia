import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../../lib/api';
import { addProductPhotograph, familyApi } from '../../lib/familyApi';
import { FAMILY_PHOTOS_PER_TEA, type FamilyPhotoPage, type FamilyPhotograph, type FamilyPhotographFrame, type FamilyPhotographShape } from '../../lib/familyContract';
import { useQueryClient } from '@tanstack/react-query';

export const PHOTO_LIMIT_SENTENCE = 'You have six photographs of this tea. Remove one from your page to add another.';

function plainSentence(error: unknown): string {
  if (error instanceof ApiError && error.message && !error.message.startsWith('Request failed')) return error.message;
  if (error instanceof Error && error.message && !(error instanceof ApiError)) return error.message;
  return 'That photograph could not be added. Please try again.';
}

/**
 * The worker's answer for "my photographs of this tea", or null when what came
 * back is not that answer. Only the worker's own answer counts: anything else
 * (a stand-in server, a page served where JSON was asked for) means "not a shop
 * tea", and is never handed to the row, which would fall over on it.
 */
export function readMyTea(answer: unknown): { photos: FamilyPhotograph[]; remaining: number } | null {
  if (!answer || typeof answer !== 'object') return null;
  const { photographs, remaining } = answer as { photographs?: unknown; remaining?: unknown };
  if (!Array.isArray(photographs)) return null;
  return { photos: photographs as FamilyPhotograph[], remaining: typeof remaining === 'number' ? remaining : FAMILY_PHOTOS_PER_TEA };
}

/**
 * The person's own photographs of one tea, for the tasting screen. Each file is
 * re-encoded on the phone (both sizes, no location data) before it is sent.
 * The tasting itself stays one record; photographs are stored by tea.
 */
export function useTastingPhotographs({ productId, enabled }: { productId: string; enabled: boolean }) {
  const queryClient = useQueryClient();
  const [photos, setPhotos] = useState<FamilyPhotograph[]>([]);
  const [remaining, setRemaining] = useState(FAMILY_PHOTOS_PER_TEA);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // True once the worker has answered for this tea, which it does only for a tea
  // in the shop. A tea from Curate that is not a shop tea, or a session's tea,
  // is refused there, and so has no camera, no row and no Share step here.
  const [inShop, setInShop] = useState(false);
  const remainingRef = useRef(FAMILY_PHOTOS_PER_TEA);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const setLeft = (n: number) => { remainingRef.current = n; setRemaining(n); };

  useEffect(() => {
    setInShop(false);
    if (!enabled) return;
    let live = true;
    familyApi.myTea(productId)
      .then(answer => {
        const mine = readMyTea(answer);
        if (!live || !mine) return;
        setPhotos(mine.photos);
        setLeft(mine.remaining);
        setInShop(true);
      })
      .catch(() => { /* not a shop tea, or the shop could not be reached: no photographs here */ });
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
          const result = await addProductPhotograph(productId, file, page);
          void queryClient.invalidateQueries({ queryKey: ['family', 'my-tea', productId] });
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
  }, [enabled, productId, queryClient]);

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
  const reshape = useCallback(async (photographId: string, shape: FamilyPhotographShape, frame: FamilyPhotographFrame | null = null) => {
    setError('');
    let before: FamilyPhotograph | undefined;
    setPhotos(current => current.map(p => {
      if (p.id !== photographId) return p;
      before = p;
      return { ...p, shape, frame };
    }));
    try {
      await familyApi.setPhotographShape(photographId, shape, frame);
    } catch (err) {
      if (!mounted.current) return;
      setPhotos(current => current.map(p => (p.id === photographId ? { ...p, shape: before?.shape ?? 'square', frame: before?.frame ?? null } : p)));
      setError(plainSentence(err));
    }
  }, []);

  return { photos, remaining, busy, error, inShop, add, remove, reshape, clearError: () => setError('') };
}
