import React from 'react';
import type { CustomerTasting, InventoryItem } from '../../../types';
import { resolveTermLabel, TASTING_CATEGORY_ORDER } from '../../../data/tastingTaxonomy';
import { starredNotes } from '../../../lib/noteEntries';
import type { ProductImpression } from '../ProductImpressions';
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
  /** The standalone page sets the character in air rather than in a panel. */
  open?: boolean;
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

/** One centered label + serif term line, terms separated by gold middots. */
const TermLine: React.FC<{
  label: string;
  terms: TermRef[];
  onTermClick?: (termId: string, categoryId: string) => void;
  /** Title Case reads as a database. A sentence reads as someone writing. */
  sentenceCase?: boolean;
}> = ({ label, terms, onTermClick, sentenceCase }) => {
  const cased = (text: string) =>
    sentenceCase ? text.charAt(0).toUpperCase() + text.slice(1).toLowerCase() : text;
  return (
  <div className="grp">
    {/* On the page, label and terms are ONE line. They used to be a caps line,
        then a 21px serif block running to three or five lines, then an
        empty-state note, then a boxed button: five stacked things and a couple
        of hundred pixels to say a tea tastes of five flavours. The label now
        sits inline at the head of the sentence and the terms run on after it,
        wrapping only when they must. The card keeps the stacked form, where
        the block is the point and there is nothing competing with it. */}
    {!sentenceCase && (
      <div className="font-sans text-ui-10 uppercase tracking-[0.24em] indent-[0.24em] text-tea-text-dim">
        {label}
      </div>
    )}
    <div
      className={
        sentenceCase
          ? 'mx-auto max-w-[560px] text-balance font-display text-ui-16 leading-[1.55] text-tea-text'
          : 'mx-auto mt-3 max-w-[300px] font-display text-[21px] leading-[1.65] text-tea-text lg:max-w-[360px] lg:text-[22px]'
      }
    >
      {sentenceCase && (
        <span className="mr-2 font-sans text-ui-10 uppercase tracking-[0.2em] text-tea-text-dim">
          {label}
        </span>
      )}
      {terms.map((term, i) => (
        <React.Fragment key={term.termId}>
          {i > 0 && (
            <span aria-hidden="true" className="px-[7px] text-tea-gold-lt">
              ·
            </span>
          )}
          {onTermClick ? (
            <button
              type="button"
              className="alcove-term-btn"
              onClick={() => onTermClick(term.termId, term.categoryId)}
            >
              {cased(term.label)}
            </button>
          ) : (
            <span>{cased(term.label)}</span>
          )}
        </React.Fragment>
      ))}
    </div>
  </div>
  );
};

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
  open = false,
}) => {
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
   * queue and promoted, each going out under the name he set. Both are
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
      : 'Adrian',
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

  // No sensory data: no band, no empty heading. (The admin "Edit" affordance
  // lives on the card's top edge, not here, so an empty tasting shows nothing.)
  if (!hasAny) return null;

  /*
   * The page's record card.
   *
   * What the tea IS, held in one keyline: what it tastes of, what it feels
   * like, and what has been said about it, each on its own band.
   *
   * No TASTE and FEEL labels. They were 9px caps sitting inline in front of a
   * 21px serif line, which collapsed into a ragged hanging indent the moment
   * the terms wrapped on a phone. Size and colour separate the two lines now:
   * taste leads, feel follows a hairline at a smaller size in a quieter ink.
   * The words are the point, so the words are all that is there.
   *
   * Your own tasting is NOT in here. It sits on its own above the reading,
   * because this card is the shop's claim about the tea and that is yours.
   */
  if (open) {
    const termLine = (
      terms: TermRef[],
      className: string,
    ) => (
      <p className={`m-0 [text-wrap:balance] ${className}`}>
        {terms.map((term, i) => (
          <React.Fragment key={term.termId}>
            {i > 0 && (
              <span aria-hidden="true" className="px-[7px] text-tea-gold-lt lg:px-[9px]">
                ·
              </span>
            )}
            {onTermClick ? (
              <button
                type="button"
                className="alcove-term-btn"
                onClick={() => onTermClick(term.termId, term.categoryId)}
              >
                {term.label}
              </button>
            ) : (
              <span>{term.label}</span>
            )}
          </React.Fragment>
        ))}
      </p>
    );

    const sourceNote =
      item.tastingSource === 'common' && hasVisibleStructuredTerms
        ? 'Potential profile'
        : item.tastingSource === 'source' && hasVisibleStructuredTerms
          ? 'Source-described profile'
          : null;

    return (
      <section aria-label="Character" className="mx-5 mt-7">
        {/*
          Two things, not a stack of boxes.

          The character is ONE block: what it tastes of, and under it what it
          feels like. They are two readings of a single cup, so a keyline
          between them made the record look like a form with two fields. Size
          and ink separate them instead, the way the card already did.

          Under that, one rule, and then what has been said about it. Everything
          below the rule is somebody's sentence with a name under it, which is a
          different kind of claim from a term and deserves the only division on
          the card.
        */}
        <div className="alcove-record">
          {hasTerms && (
            <div className="px-4 py-[18px] text-center lg:px-6 lg:py-6">
              {tasteTerms.length > 0 &&
                termLine(
                  tasteTerms,
                  'font-display text-[19px] leading-[1.3] text-tea-text lg:text-[25px]',
                )}
              {feelingTerms.length > 0 && (
                <div className={tasteTerms.length > 0 ? 'mt-2.5 lg:mt-3' : ''}>
                  {termLine(
                    feelingTerms,
                    'font-display text-ui-16 leading-[1.3] text-tea-text-dim lg:text-[19px]',
                  )}
                </div>
              )}
              {sourceNote && (
                <p className="m-0 mt-3 font-sans text-ui-10 uppercase tracking-[0.2em] text-tea-text-dim">
                  {sourceNote}
                </p>
              )}
            </div>
          )}
          {quotes.length > 0 && (
            <div className={`px-4 py-[18px] lg:px-6 lg:py-6 ${hasTerms ? 'alcove-record-said' : ''}`}>
              {quotes.map(({ text, attribution, detail, key }, i) => (
                <figure key={key} className={`m-0 text-center ${i > 0 ? 'mt-5 lg:mt-6' : ''}`}>
                  <blockquote className="m-0 font-body text-[15.5px] italic leading-[1.66] text-tea-text-sec lg:text-ui-16">
                    &ldquo;{text}&rdquo;
                  </blockquote>
                  <figcaption className="mt-[7px] font-sans text-ui-9 uppercase tracking-[0.2em] text-tea-text-dim">
                    {attribution}
                    {detail && <span className="normal-case tracking-[0.06em]">{`, ${detail}`}</span>}
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
          {potentialResearch && (
            <div className="alcove-record-band px-4 py-4 text-center lg:px-6">
              <p className="m-0 font-sans text-ui-9 uppercase tracking-[0.24em] indent-[0.24em] text-tea-text-dim">
                Potential character
              </p>
              <div className="mt-2.5 flex flex-wrap justify-center gap-x-6 gap-y-3">
                {TASTING_CATEGORY_ORDER.map(category => {
                  const terms = potentialResearch.profile.tasting[category];
                  if (!terms?.length) return null;
                  return (
                    <div key={category} className="max-w-full">
                      <p className="font-sans text-ui-9 uppercase tracking-[0.15em] text-tea-text-dim">
                        {POTENTIAL_LABELS[category]}
                      </p>
                      <p className="mt-1 font-display text-ui-17 leading-[1.4] text-tea-text">
                        {terms.map(resolveTermLabel).join(' · ')}
                      </p>
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
                  className="inline-flex min-h-[44px] items-center rounded-md underline decoration-tea-text-dim underline-offset-4 transition-colors hover:text-tea-gold hover:decoration-tea-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50"
                >
                  Research context
                </a>
              </p>
            </div>
          )}
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label="Character"
      className={`alcove-band relative px-5 ${
        open
          ? `alcove-band--open mt-9 pt-0 ${onTaste ? 'pb-5' : 'pb-2'}`
          : `mt-[22px] pt-4 ${onTaste ? 'pb-6' : 'pb-[18px]'}`
      }`}
    >
      {/* The rule and the heading separate the character from the ledger above.
          With no terms and no starred note there is nothing to separate, and the
          page was drawing a 26px hairline over a bare invitation. */}
      {hasCharacterContent &&
        (open ? (
          <div aria-hidden="true" className="alcove-rule mb-3.5" />
        ) : (
          <AlcoveSectionHeading label="Character" className="mb-3" />
        ))}

      {hasTerms && (
        <div className={open ? "text-center [&_.grp+.grp]:mt-1.5" : "text-center [&_.grp+.grp]:mt-3"}>
          {tasteTerms.length > 0 && (
            <TermLine label={open ? 'Tastes of' : 'Taste'} terms={tasteTerms} onTermClick={onTermClick} sentenceCase={open} />
          )}
          {feelingTerms.length > 0 && (
            <TermLine label="Feel" terms={feelingTerms} onTermClick={onTermClick} sentenceCase={open} />
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
                  <p className="mt-1 font-display text-ui-17 leading-[1.4] text-tea-text">
                    {terms.map(resolveTermLabel).join(' · ')}
                  </p>
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
              className="inline-flex min-h-[44px] items-center rounded-md underline decoration-tea-text-dim underline-offset-4 transition-colors hover:text-tea-gold hover:decoration-tea-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50"
            >
              Research context
            </a>
          </p>
        </div>
      )}
    </section>
  );
};
