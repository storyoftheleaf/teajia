import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { familyApi } from '../../lib/familyApi';
import { mediaUrl } from '../../lib/mediaUrl';
import type { FamilyMyTea, FamilyPhotograph, FamilySharedPhotograph, FamilyTeaPhotographs } from '../../lib/familyContract';

/** The one drag type the member's own thumbnails carry onto the plate. */
export const PHOTOGRAPH_DRAG_TYPE = 'application/x-teajia-photograph';

/** What the plate shows in place of its bare label stock, and whose it is. */
export interface TeaPlatePicture {
  src: string;
  alt: string;
  /** 'cover' is the signed-in member's own choice, seen only by them. 'lead' is the shop's public pick. */
  kind: 'cover' | 'lead';
  /** The person credited under a lead picture. Never set for a member's own cover. */
  credit?: { name: string; href: string | null };
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
 * What the plate holds. The reader's own cover wins, and nobody else ever sees
 * it. Otherwise the shop's lead picture, credited. Otherwise nothing, which
 * leaves the plate exactly as it has always been.
 */
export function pickPlatePicture(
  teaName: string,
  own: FamilyPhotograph[],
  coverId: string | null,
  lead: FamilySharedPhotograph | null,
): TeaPlatePicture | null {
  const cover = coverId ? own.find(p => p.id === coverId) : undefined;
  if (cover) return { src: mediaUrl(cover.full_url), alt: `Your photograph of ${teaName}`, kind: 'cover' };
  if (lead) {
    return {
      src: mediaUrl(lead.full_url),
      alt: `${teaName}, photographed by ${lead.author.name}`,
      kind: 'lead',
      credit: { name: lead.author.name, href: personPath(lead.author.page_id) },
    };
  }
  return null;
}

/** The shop's placed photographs and the family's shared ones read as one strip; one that is both shows once. */
export function mergeStrip(placed: FamilySharedPhotograph[], family: FamilySharedPhotograph[]): FamilySharedPhotograph[] {
  const seen = new Set<string>();
  return [...placed, ...family].filter(p => (seen.has(p.id) ? false : (seen.add(p.id), true)));
}

export { readPublic as readPublicTeaPhotographs };

/**
 * Everything the family adds to one tea page: the shop's lead picture, the
 * strip of other people's shared photographs, and, signed in, the reader's own
 * photographs of this tea with the one they have made their cover.
 */
export function useTeaFamily(productId: string | undefined, teaName: string) {
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
  const plate = pickPlatePicture(teaName, own, mine?.cover_photograph_id ?? null, publicSide.lead);
  const strip = mergeStrip(publicSide.placed, publicSide.family);
  const cover = own.find(p => p.id === mine?.cover_photograph_id) ?? null;

  const chooseCover = useCallback(async (photographId: string | null) => {
    if (!productId) return;
    const before = queryClient.getQueryData<FamilyMyTea | null>(mineKey);
    // The plate answers at once; the server confirms, and a refusal puts it back.
    if (before) queryClient.setQueryData<FamilyMyTea | null>(mineKey, { ...before, cover_photograph_id: photographId });
    try {
      await familyApi.setCover(productId, photographId);
    } catch {
      queryClient.setQueryData<FamilyMyTea | null>(mineKey, before ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, queryClient]);

  return {
    plate,
    ownPhotographs: own,
    coverId: cover?.id ?? null,
    familyStrip: strip,
    chooseCover,
  };
}
