import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { familyApi } from '../../lib/familyApi';
import type { FamilyAuthor, FamilyMyTea, FamilyPhotograph, FamilyPhotographFrame, FamilyPhotographShape, FamilySharedPhotograph, FamilyTeaPhotographs } from '../../lib/familyContract';

/**
 * One photograph in the row under the plaque. The reader's own and other
 * people's sit in the same row and look the same; whose it is, and what can be
 * done with it, shows only in the zoom.
 */
export interface TeaRowPhotograph {
  id: string;
  small_url: string;
  full_url: string;
  width: number;
  height: number;
  /** The shape its author chose; square when nothing was chosen. */
  shape: FamilyPhotographShape;
  /** The part of the picture its author framed; null shows the middle. */
  frame: FamilyPhotographFrame | null;
  /** True for the signed-in reader's own photograph. */
  mine: boolean;
  /** Who to credit in the zoom. Null on the reader's own. */
  author: FamilyAuthor | null;
  /** The reader's own cover for this tea: first in their row, seen only by them. */
  isCover: boolean;
  /** The shop's chosen picture for this tea: first in everyone else's row. */
  isLead: boolean;
}

const NONE: FamilyTeaPhotographs = { product_id: '', lead: null, placed: [], family: [] };

/**
 * The public read is trusted to the letter of the contract and no further: an
 * answer of any other shape (an old server, a stubbed route) is read as "the
 * family has added nothing", so the page stays exactly as it was.
 */
function readPublic(value: unknown): FamilyTeaPhotographs {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return NONE;
  const raw = value as Partial<FamilyTeaPhotographs>;
  const list = (v: unknown) => (Array.isArray(v) ? (v as FamilySharedPhotograph[]).filter(p => p && typeof p.small_url === 'string') : []);
  const lead = raw.lead && typeof raw.lead === 'object' && typeof raw.lead.full_url === 'string' ? raw.lead : null;
  return { product_id: raw.product_id ?? '', lead, placed: list(raw.placed), family: list(raw.family) };
}

function readMine(value: unknown): FamilyMyTea | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Partial<FamilyMyTea>;
  if (!Array.isArray(raw.photographs)) return null;
  return { ...(raw as FamilyMyTea), photographs: raw.photographs.filter(p => p && typeof p.small_url === 'string') };
}

export function personPath(pageId: string | null | undefined): string | null {
  return pageId ? `/people/${encodeURIComponent(pageId)}` : null;
}


/**
 * The row under the plaque, in order: the reader's own cover (only they ever
 * see it first), then the shop's chosen picture, then the reader's other
 * photographs, then what the shop placed and what the family shared. A
 * photograph that is in more than one of those shows once.
 */
export function buildTeaRow(
  own: FamilyPhotograph[],
  coverId: string | null,
  shared: FamilyTeaPhotographs,
): TeaRowPhotograph[] {
  const mine = (p: FamilyPhotograph): TeaRowPhotograph => ({
    id: p.id, small_url: p.small_url, full_url: p.full_url, width: p.small_width, height: p.small_height, shape: p.shape ?? 'square', frame: p.frame ?? null,
    mine: true, author: null, isCover: p.id === coverId, isLead: shared.lead?.id === p.id,
  });
  const theirs = (p: FamilySharedPhotograph): TeaRowPhotograph => ({
    id: p.id, small_url: p.small_url, full_url: p.full_url, width: p.small_width, height: p.small_height, shape: p.shape ?? 'square', frame: p.frame ?? null,
    mine: false, author: p.author, isCover: false, isLead: shared.lead?.id === p.id,
  });
  const ownIds = new Set(own.map(p => p.id));
  const cover = own.find(p => p.id === coverId);
  const ordered: TeaRowPhotograph[] = [
    ...(cover ? [mine(cover)] : []),
    ...(shared.lead && !ownIds.has(shared.lead.id) ? [theirs(shared.lead)] : []),
    ...own.map(mine),
    ...[...shared.placed, ...shared.family].filter(p => !ownIds.has(p.id)).map(theirs),
  ];
  const seen = new Set<string>();
  return ordered.filter(p => (seen.has(p.id) ? false : (seen.add(p.id), true)));
}

export { readPublic as readPublicTeaPhotographs };

/**
 * Everything the family adds to one tea page: the shop's lead picture, the
 * strip of other people's shared photographs, and, signed in, the reader's own
 * photographs of this tea with the one they have made their cover.
 */
export function useTeaFamily(productId: string | undefined) {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const publicQuery = useQuery({
    queryKey: ['family', 'tea-photographs', productId],
    queryFn: async () => readPublic(await familyApi.teaPhotographs(productId!)),
    enabled: Boolean(productId),
    staleTime: 1000 * 60 * 5,
    retry: false,
  });
  const mineKey = ['family', 'my-tea', productId] as const;
  const mineQuery = useQuery({
    queryKey: mineKey,
    queryFn: async () => readMine(await familyApi.myTea(productId!)),
    enabled: Boolean(productId) && isAuthenticated,
    retry: false,
  });

  const publicSide = publicQuery.data ?? NONE;
  const mine = isAuthenticated ? mineQuery.data ?? null : null;
  const own: FamilyPhotograph[] = mine?.photographs ?? [];
  const coverId = own.find(p => p.id === mine?.cover_photograph_id)?.id ?? null;
  const row = buildTeaRow(own, coverId, publicSide);

  const chooseCover = useCallback(async (photographId: string | null) => {
    if (!productId) return;
    const before = queryClient.getQueryData<FamilyMyTea | null>(mineKey);
    // The row answers at once; the server confirms, and a refusal puts it back.
    if (before) queryClient.setQueryData<FamilyMyTea | null>(mineKey, { ...before, cover_photograph_id: photographId });
    try {
      await familyApi.setCover(productId, photographId);
    } catch {
      queryClient.setQueryData<FamilyMyTea | null>(mineKey, before ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, queryClient]);

  /** "Remove from my page": gone from the reader's page and view at once. The shop keeps the file. */
  const removeOwn = useCallback(async (photographId: string) => {
    if (!productId) return;
    await familyApi.removePhotograph(photographId);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['family', 'my-tea', productId] }),
      queryClient.invalidateQueries({ queryKey: ['family', 'tea-photographs', productId] }),
    ]);
  }, [productId, queryClient]);

  /** The reader's own photograph, shown square, 2:3 or 3:2. Answers at once; a refusal puts it back. */
  const reshapeOwn = useCallback(async (photographId: string, shape: FamilyPhotographShape, frame: FamilyPhotographFrame | null = null) => {
    if (!productId) return;
    const before = queryClient.getQueryData<FamilyMyTea | null>(mineKey);
    if (before) {
      queryClient.setQueryData<FamilyMyTea | null>(mineKey, {
        ...before, photographs: before.photographs.map(p => (p.id === photographId ? { ...p, shape, frame } : p)),
      });
    }
    try {
      await familyApi.setPhotographShape(photographId, shape, frame);
      await queryClient.invalidateQueries({ queryKey: ['family', 'tea-photographs', productId] });
    } catch {
      queryClient.setQueryData<FamilyMyTea | null>(mineKey, before ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, queryClient]);

  return { row, coverId, chooseCover, removeOwn, reshapeOwn };
}
