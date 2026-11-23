import React, { useLayoutEffect, useRef } from 'react';
import type { CustomerTasting, InventoryItem } from '../../../types';
import { resolveTermLabel, TASTING_CATEGORY_ORDER } from '../../../data/tastingTaxonomy';
import { BODY, HEADING, LABEL } from '../../shared/typeRoles';
import { starredNotes } from '../../../lib/noteEntries';
import { ProductImpressions, type ProductImpression } from '../ProductImpressions';
import { AlcoveSectionHeading } from './AlcoveSectionHeading';
import { AlcoveTastingPlate } from './AlcoveTastingPlate';
import type { ProductResearchResolution } from '../../../wisdom/productResearch';

/** Converts a string to Title Case */
function toTitleCase(str: string): string {
  return str.replace(/\b\w/g, c => c.toUpperCase());
}

interface TermRef {
  termId: string;
  label: string;
  categoryId: string;
}

interface AlcoveCharacterBandProps {
  item: InventoryItem;
  /** Legacy free-text tags (item.tags): taste-line fallback when no structured flavor terms exist. */
  legacyNotes: string[];
  onTermClick?: (termId: string, categoryId: string) => void;
  potentialResearch?: ProductResearchResolution | null;
  /**
   * Recording a tasting belongs here rather than beside the order button.
   * The lines above say what the shop found in the cup; the invitation
   * underneath is to add what you found, and it is one tap from the tea you
   * are already looking at. Next to Add to order it was competing with a
   * purchase, and it is the one action you take after the tea is yours.
   */
  onTaste?: (item: InventoryItem, intent?: 'edit' | 'notes') => void;
  /**
   * This reader's own entry for this tea, when they have written one. The plate
   * shows it back to them instead of asking again: there is one entry per tea,
   * so a second visit edits rather than adds.
   */
  tastingEntry?: CustomerTasting | null;
  /**
   * Customer notes the shop has promoted, fetched once by the card and handed
   * down. Passed rather than fetched here so the band stays a pure render and
   * one page does not open two identical requests.
   */
  impressions?: ProductImpression[];
  /** Public listings and their quick views use only authored lot tasting. */
  verifiedOnly?: boolean;
}

const POTENTIAL_LABELS: Record<string, string> = {
  body: 'Body',
  finish: 'Finish',
  feeling: 'Feeling',
  flavor: 'Taste',
  'liquor-color': 'Liquor',
  brewing: 'Brewing',
};

function wisdomEntryPath({ entryKind, entryId }: ProductResearchResolution): string {
  const segment = entryKind === 'namedTea' ? 'named' : entryKind;
  return `/wisdom/${segment}/${entryId}`;
}

/** Each flex item is a whole descriptor. The dot lives in the gap, so showing
 * it never changes where the browser wraps the row. */
function CharacterTerms({ labels, className, onChoose }: {
  labels: string[];
  className: string;
  onChoose?: (index: number) => void;
}) {
  const list = useRef<HTMLUListElement>(null);
  useLayoutEffect(() => {
    const root = list.current;
    if (!root) return;
    const items = Array.from(root.children) as HTMLLIElement[];
    const markLines = () => {
      const tops = items.map(item => item.offsetTop);
      items.forEach((item, index) => item.toggleAttribute('data-joined', index > 0 && tops[index] === tops[index - 1]));
    };
    markLines();
    const observer = new ResizeObserver(markLines);
    observer.observe(root);
    // A font can change term widths without changing the container dimensions.
    items.forEach(item => observer.observe(item));
    return () => observer.disconnect();
  }, [labels]);

  return (
    <ul className={`alcove-character-terms ${className}`} ref={list} role="list">
      {labels.map((label, index) => (
        <li key={`${label}-${index}`}>
          {index > 0 && <span className="alcove-character-dot" aria-hidden="true">·</span>}
          {onChoose ? <button type="button" className="alcove-term-btn" onClick={() => onChoose(index)}>{label}</button> : label}
        </li>
      ))}
    </ul>
  );
}

function TermLine({ label, terms, onTermClick }: {
  label: string;
  terms: TermRef[];
  onTermClick?: (termId: string, categoryId: string) => void;
}) {
  return (
    <div className="grp">
      <div className="font-sans text-ui-10 uppercase tracking-[0.24em] indent-[0.24em] text-tea-text-dim">{label}</div>
      <CharacterTerms className="mx-auto mt-3 max-w-[300px] font-display text-[21px] leading-[1.65] text-tea-text lg:max-w-[360px] lg:text-ui-22"
        labels={terms.map(term => term.label)} onChoose={onTermClick && (i => onTermClick(terms[i].termId, terms[i].categoryId))} />
    </div>
  );
}

// Only the owner's product tasting carries exact-lot authorization. Guest words
// come from the placement endpoint so withdrawing an excerpt also removes it here.
function LotTasting({ item, impressions, onTermClick }: Pick<AlcoveCharacterBandProps, 'item' | 'onTermClick'> & {
  impressions: ProductImpression[];
}) {
  const tasting = item.tastingSource === 'owner' ? item.tasting : undefined;
  const journal = impressions.filter(note => note.productId === item.id);
  const textKey = (text: string) => text.trim().toLowerCase().replace(/[\s·,.;!?]+/g, ' ').trim();
  const published = new Set(journal.map(note => textKey(note.text)));
  const quotes = starredNotes(tasting).filter(note => {
    const key = textKey(note.text);
    if (!key || note.sourceAuthor || note.sourceJournalEntryId || published.has(key)) return false;
    published.add(key);
    return true;
  });
  const categories = [
    ['flavor', 'Taste'], ['aroma', 'Aroma'], ['body', 'Body'], ['finish', 'Finish'], ['feeling', 'Feeling'],
  ] as const;
  const lines = categories.flatMap(([id, label]) => {
    const terms = [...new Set(tasting?.[id] ?? [])].filter(term => term.trim() && !published.has(textKey(resolveTermLabel(term))));
    if (!terms.length || published.has(textKey(terms.map(resolveTermLabel).join(' ')))) return [];
    return [{ id, label, terms }];
  });
  return <>
    {(lines.length > 0 || quotes.length > 0) && <section aria-label="Taste" className="mx-5 mt-[var(--space-4)]">
      <div className="alcove-record grid gap-[var(--space-3)] p-[var(--space-4)] text-center">
        {lines.map(({ id, label, terms }) => <div key={id}>
          <p className={`${LABEL} text-tea-text-sec`}>{label}</p>
          <CharacterTerms className={`${HEADING} text-tea-text`} labels={terms.map(resolveTermLabel)}
            onChoose={onTermClick && (index => onTermClick(terms[index], id))} />
        </div>)}
        {quotes.map(note => <figure key={note.id}>
          <blockquote className={`${BODY} italic text-tea-text`}>{note.text}</blockquote>
          <figcaption className={`${LABEL} text-tea-text-sec`}>Teajia</figcaption>
        </figure>)}
      </div>
    </section>}
    {journal.length > 0 && <div className="mx-5"><ProductImpressions impressions={journal} /></div>}
  </>;
}

/**
 * "Character": the one chapter that gathers everything sensory: the taste
 * line, the feel line, and Adrian's starred notes together in a faint tonal
 * band. Renders only when there are customer-facing tasting terms or starred
 * notes (or, for admins, so the tasting editor stays reachable).
 */
export const AlcoveCharacterBand: React.FC<AlcoveCharacterBandProps> = ({
  item,
  legacyNotes,
  onTermClick,
  potentialResearch,
  onTaste,
  tastingEntry = null,
  impressions = [],
  verifiedOnly = false,
}) => {
  if (verifiedOnly) return <>
    <LotTasting item={item} impressions={impressions} onTermClick={onTermClick} />
    {onTaste && <AlcoveTastingPlate entry={tastingEntry} onTaste={intent => onTaste(item, intent)} />}
  </>;
  const tasting = item.tasting;

  // Shopper-facing terms: flavor → TASTE, feeling → FEEL. Body / finish /
  // liquor-color are journaling data, noisy on a product page.
  const flavorTerms: TermRef[] = (tasting?.flavor ?? []).map(termId => ({
    termId,
    label: resolveTermLabel(termId),
    categoryId: 'flavor',
  }));
  const feelingTerms: TermRef[] = (tasting?.feeling ?? []).map(termId => ({
    termId,
    label: resolveTermLabel(termId),
    categoryId: 'feeling',
  }));

  // Legacy tags fall back into the taste line when no structured terms exist.
  const tasteTerms: TermRef[] =
    flavorTerms.length > 0
      ? flavorTerms
      : legacyNotes.map(note => ({
          termId: note.toLowerCase().trim().replace(/\s+/g, '-'),
          label: toTitleCase(note),
          categoryId: 'flavor',
        }));

  /*
   * What has been said about this tea, and only what the shop chose to publish.
   *
   * Two sources, one grammar. The shop's own starred notes are Adrian writing
   * about his tea. The impressions are customers' notes he read in the review
   * queue and promoted, each going out under the byline the author chose. Both are
   * published claims on a public product page, which is what earns them a place
   * on the record.
   *
   * The reader's OWN note is deliberately absent. It used to appear here
   * captioned "You", which put a private journal line inside the shop's account
   * of the tea and made a page look reviewed when nobody had reviewed it. It
   * belongs on their own plate below, beside the terms they chose.
   */
  const shopStarred = starredNotes(tasting).map(note => ({
    text: note.text,
    attribution: note.sourceAuthor
      ? note.sourceAuthor.initial || note.sourceAuthor.accountName || 'Community'
      : 'Teajia',
    detail: null as string | null,
    key: `shop-${note.id}`,
  }));
  const promoted = impressions.map(impression => ({
    text: impression.text,
    attribution: impression.attributionName,
    detail: impression.attributionDetail,
    key: `said-${impression.id}`,
  }));
  const quotes = [...shopStarred, ...promoted];
  const hasVisibleStructuredTerms = flavorTerms.length > 0 || feelingTerms.length > 0;
  const hasTerms = tasteTerms.length > 0 || feelingTerms.length > 0;
  const hasCharacterContent = hasTerms || quotes.length > 0;
  const hasAny = hasCharacterContent || Boolean(potentialResearch) || Boolean(onTaste);
  if (!hasAny) return null;

  return (
    <section
      aria-label="Character"
      className={`alcove-band relative mt-[22px] px-5 pt-4 ${onTaste ? 'pb-6' : 'pb-[18px]'}`}
    >
      {/* The rule and the heading separate the character from the ledger above.
          With no terms and no starred note there is nothing to separate, and the
          page was drawing a 26px hairline over a bare invitation. */}
      {hasCharacterContent && <AlcoveSectionHeading label="Character" className="mb-3" />}

      {hasTerms && (
        <div className="text-center [&_.grp+.grp]:mt-3">
          {tasteTerms.length > 0 && (
            <TermLine label="Taste" terms={tasteTerms} onTermClick={onTermClick} />
          )}
          {feelingTerms.length > 0 && (
            <TermLine label="Feel" terms={feelingTerms} onTermClick={onTermClick} />
          )}
          {item.tastingSource === 'common' && hasVisibleStructuredTerms && (
            <p className="mt-2 font-sans text-ui-11 text-tea-text-dim">Potential profile</p>
          )}
          {item.tastingSource === 'source' && hasVisibleStructuredTerms && (
            <p className="mt-2 font-sans text-ui-11 text-tea-text-dim">Source-described profile</p>
          )}
        </div>
      )}

      {quotes.map(({ text, attribution, detail, key }, i) => (
        <figure
          key={key}
          className={`mx-0 mb-0 px-1 text-center ${i === 0 && hasTerms ? 'mt-3.5' : i === 0 ? 'mt-1' : 'mt-3.5'}`}
        >
          <blockquote className="m-0 font-display text-ui-17 not-italic leading-[1.5] text-tea-text">
            &ldquo;{text}&rdquo;
          </blockquote>
          <figcaption className="mt-2 font-sans text-ui-9 uppercase tracking-[0.2em] text-tea-text-dim">
            {attribution}
            {detail && <span className="normal-case tracking-[0.06em]">{`, ${detail}`}</span>}
          </figcaption>
        </figure>
      ))}

      {onTaste && (
        <div className={hasCharacterContent ? 'mt-4' : ''}>
          <AlcoveTastingPlate entry={tastingEntry} onTaste={intent => onTaste(item, intent)} />
        </div>
      )}

      {potentialResearch && (
        <div className={`border-t border-tea-border px-1 text-center ${hasTerms || quotes.length ? 'mt-4 pt-4' : 'pt-1'}`}>
          <p className="font-sans text-ui-9 uppercase tracking-[0.24em] indent-[0.24em] text-tea-text-dim">
            Potential character
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-x-6 gap-y-3">
            {TASTING_CATEGORY_ORDER.map(category => {
              const terms = potentialResearch.profile.tasting[category];
              if (!terms?.length) return null;
              return (
                <div key={category} className="max-w-full">
                  <p className="font-sans text-ui-9 uppercase tracking-[0.15em] text-tea-text-dim">
                    {POTENTIAL_LABELS[category]}
                  </p>
                  <CharacterTerms className="mt-1 font-display text-ui-17 leading-[1.4] text-tea-text" labels={terms.map(resolveTermLabel)} />
                </div>
              );
            })}
          </div>
          <p className="mt-3 font-sans text-ui-11 leading-relaxed text-tea-text-sec">
            Cited shared research
            {potentialResearch.sources.length > 0 && ` from ${potentialResearch.sources.map(source => source.publisher).join(', ')}`}
            {'. '}
            <a
              href={wisdomEntryPath(potentialResearch)}
              className="inline-flex min-h-tap items-center rounded-md underline decoration-tea-text-dim underline-offset-4 transition-colors hover:text-tea-gold hover:decoration-tea-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50"
            >
              Research context
            </a>
          </p>
        </div>
      )}
    </section>
  );
};
