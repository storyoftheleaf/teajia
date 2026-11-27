import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { splitOrigin } from './TeaLedger';
import { wisdomRelationsApi } from '../../admin/components/wisdom/relationsApi';
import { listingFacts } from '../../wisdom/reference/listingFacts';
import { EMPTY_LISTING_PASSAGES, resolveListingPassages } from '../../wisdom/reference/listingPassages';
import { GENERATED_CLAIMS } from '../../wisdom/reference/generatedClaims';
import { GENERATED_ENTRIES } from '../../wisdom/reference/generatedEntries';
import { GENERATED_TEA_REFERENCE_REGISTRY } from '../../wisdom/reference/generatedPages';
import { entryClaimUses, entryLinkFor, entrySegments, type ComposedEntry } from '../../wisdom/reference/composedEntry';
import type { ListingPassages } from '../../wisdom/reference/claims';
import type { InventoryItem } from '../../types';

/**
 * A tea on a private link (a /c/ collection, an invoice's pay page), drawn the
 * way the shop draws it: its photo or the shop's type illustration, its type
 * and place in the shop's one line, and its Tea Wisdom writing. The writing is
 * the same approved entry the shop's tea page shows, read from the Wisdom Base,
 * never written here.
 */

export interface LinkTeaSource {
  productId?: string | null;
  name?: string | null;
  type?: string | null;
  form?: string | null;
  originRegion?: string | null;
  originCountry?: string | null;
}

export interface WisdomPageLink {
  pageId: string;
  label: string;
  href: string;
}

export interface LinkTeaWriting {
  entry?: ComposedEntry;
  passages: ListingPassages;
  /** The Wisdom Base pages this tea's writing rests on, in reading order. */
  pages: WisdomPageLink[];
  /** The writing's opening, plain text, for a card. */
  lead: string | null;
}

const PAGE_LABEL = new Map<string, string>(GENERATED_TEA_REFERENCE_REGISTRY.pages.map(page => [page.id, page.label]));

/** The opening two sentences of a paragraph, its link marks dropped. */
function openingOf(text: string): string {
  const plain = entrySegments(text).map(segment => segment.text).join('').trim();
  const sentences = plain.match(/[^.!?]+[.!?]+(\s|$)/g);
  if (!sentences) return plain;
  return sentences.slice(0, 2).join('').trim();
}

export function useLinkTeaWriting(source: LinkTeaSource): LinkTeaWriting {
  const facts = useMemo(() => listingFacts({
    id: source.productId,
    type: source.type,
    form: source.form,
    originRegion: [source.originRegion, source.originCountry].filter(Boolean).join(', '),
    name: source.name,
  }), [source.productId, source.type, source.form, source.originRegion, source.originCountry, source.name]);
  const namedTeaId = facts.namedTeaId;

  // A named tea's history shows only once its Wisdom page is known to be
  // public, the same rule the shop's tea page keeps (AlcoveCard).
  const namedState = useQuery({
    queryKey: ['wisdom-public-state', 'named_tea', namedTeaId],
    queryFn: () => wisdomRelationsApi.publicState({ nodeType: 'named_tea', nodeId: namedTeaId! }),
    enabled: Boolean(namedTeaId),
    staleTime: 60_000,
    retry: false,
  });
  const namedPublic = Boolean(namedTeaId && namedState.isSuccess && namedState.data.is_public);

  return useMemo(() => {
    const publicFacts = namedPublic ? facts : { ...facts, namedTeaId: undefined };
    const approved = source.productId ? GENERATED_ENTRIES[source.productId] : undefined;
    const carriesNamedHistory = Boolean(namedTeaId && approved
      && entryClaimUses(approved).some(id => id.startsWith(`${namedTeaId}:`)));
    const entry = carriesNamedHistory
      ? (namedPublic ? approved : undefined)
      : (namedPublic ? undefined : approved);
    const passages = entry
      ? EMPTY_LISTING_PASSAGES
      : resolveListingPassages(publicFacts, GENERATED_CLAIMS, GENERATED_TEA_REFERENCE_REGISTRY.pages);

    const pages: WisdomPageLink[] = [];
    const add = (pageId: string, href: string | null) => {
      if (!href || pages.some(page => page.pageId === pageId)) return;
      const label = PAGE_LABEL.get(pageId);
      if (!label) return;
      pages.push({ pageId, label, href: href.split('#')[0] });
    };
    if (entry) {
      for (const claimId of entryClaimUses(entry)) add(claimId.split(':')[0], entryLinkFor(claimId, GENERATED_CLAIMS));
    } else {
      for (const passage of passages.passages) add(passage.claim.pageId, passage.wisdomHref);
    }

    const first = entry?.paragraphs[0]?.text ?? passages.passages[0]?.claim.text ?? null;
    return { entry, passages, pages, lead: first ? openingOf(first) : null };
  }, [facts, namedPublic, namedTeaId, source.productId]);
}

/** The shop's one line under a tea's name: type, then the place. */
export function linkTeaMetaLine(source: LinkTeaSource & { year?: number | string | null }): string {
  const origin = splitOrigin([source.originRegion, source.originCountry].filter(Boolean).join(', '));
  return [source.type, source.year, origin.near, origin.mid].filter(Boolean).join(' · ');
}

/** A tea's photo. A tea with no photo shows none (Adrian, 2026-11-27): the words take the width. */
export const LinkTeaPhoto: React.FC<{
  src?: string | null;
  className?: string;
  dim?: boolean;
  eager?: boolean;
}> = ({ src, className = '', dim, eager }) => {
  if (!src) return null;
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <img
        src={src}
        alt=""
        loading={eager ? 'eager' : 'lazy'}
        className={`absolute inset-0 h-full w-full object-cover ${dim ? 'opacity-[0.72]' : ''}`}
      />
    </div>
  );
};

/** The shop card's written fields, as a link's worker route sends them (publicLinkTea.ts). */
export interface LinkTeaDetailFields {
  description?: string | null;
  images?: string[];
  lore?: string | null;
  terroir?: string | null;
  processing_notes?: string | null;
  mood?: string | null;
  experience?: string | null;
  cultivar?: string | null;
  /** JSON, scores already removed by the worker. */
  tasting?: string | null;
  variant_name?: string | null;
}

/**
 * The tea as the shop's own card reads it, so a link opens the shop's card
 * (AlcoveCard) and not a second drawing of the same tea.
 */
export function linkTeaInventoryItem(source: LinkTeaSource & LinkTeaDetailFields & {
  chineseName?: string | null;
  year?: number | string | null;
  image?: string | null;
  pricePerGramUsd?: number | null;
  soldOut?: boolean;
}): InventoryItem {
  const images = source.images?.length ? source.images : source.image ? [source.image] : [];
  let tasting: InventoryItem['tasting'];
  try { tasting = source.tasting ? JSON.parse(source.tasting) : undefined; } catch { tasting = undefined; }
  const isWare = source.type === 'Teaware';
  return {
    id: source.productId ?? '',
    category: isWare ? 'ware' : 'tea',
    type: source.type ?? '',
    form: source.form ?? undefined,
    name: source.name ?? 'Tea',
    variant: source.variant_name ?? source.name ?? '',
    year: source.year != null ? String(source.year) : '',
    origin: [source.originRegion, source.originCountry].filter(Boolean).join(', '),
    stock_g: source.soldOut ? 0 : 1000,
    cost_price: '',
    price_per_gram: source.pricePerGramUsd != null ? String(source.pricePerGramUsd) : undefined,
    description: source.description ?? '',
    tags: [],
    image: images[0] ?? '',
    additionalImages: images.slice(1),
    chineseName: source.chineseName ?? undefined,
    cultivar: source.cultivar ?? null,
    lore: source.lore ?? undefined,
    terroir: source.terroir ?? undefined,
    processingNotes: source.processing_notes ?? undefined,
    mood: source.mood ?? undefined,
    experience: source.experience ?? undefined,
    tasting,
  } as InventoryItem;
}

function EntryProse({ text, className = '' }: { text: string; className?: string }) {
  return (
    <p className={`font-body text-ui-15 leading-[1.75] m-0 [overflow-wrap:anywhere] ${className}`}>
      {entrySegments(text).map((segment, index) => {
        const href = segment.claimId ? entryLinkFor(segment.claimId, GENERATED_CLAIMS) : null;
        return href
          ? <Link key={index} to={href} className="underline decoration-tea-text-dim underline-offset-4 hover:text-tea-gold hover:decoration-tea-gold">{segment.text}</Link>
          : <React.Fragment key={index}>{segment.text}</React.Fragment>;
      })}
    </p>
  );
}

/**
 * The tea's written entry from the Wisdom Base, as the shop's tea page reads
 * it: the story, what people often notice in the style, then brewing. Falls
 * back to the approved passages that match the tea when it has no entry yet.
 */
export const LinkTeaEntry: React.FC<{ writing: LinkTeaWriting; className?: string }> = ({ writing, className = '' }) => {
  const { entry, passages } = writing;
  if (!entry && passages.passages.length === 0) return null;
  return (
    <section className={`flex flex-col gap-4 ${className}`} aria-label="About this tea" data-link-tea-entry={entry?.productId ?? 'passages'}>
      {entry ? (
        <>
          {entry.paragraphs.map((paragraph, index) => (
            <EntryProse key={index} text={paragraph.text} className="text-tea-text" />
          ))}
          {entry.notice && (
            <div>
              <p className="label-caps text-tea-text-dim mb-2">What people often notice in {entry.notice.styleName}</p>
              <EntryProse text={entry.notice.text} className="text-tea-text-sec" />
            </div>
          )}
          {entry.brewing && (
            <div>
              <p className="label-caps text-tea-text-dim mb-2">Brewing</p>
              <EntryProse text={entry.brewing.text} className="text-tea-text" />
            </div>
          )}
        </>
      ) : passages.passages.map(passage => (
        <div key={passage.claim.claimId}>
          <p className="label-caps text-tea-text-dim mb-2">{passage.claim.label}</p>
          <p className="font-body text-ui-15 leading-[1.75] text-tea-text m-0">{passage.claim.text}</p>
        </div>
      ))}
    </section>
  );
};
