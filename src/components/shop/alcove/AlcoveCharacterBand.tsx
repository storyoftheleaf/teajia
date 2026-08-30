import React from 'react';
import type { InventoryItem } from '../../../types';
import { resolveTermLabel, TASTING_CATEGORY_ORDER } from '../../../data/tastingTaxonomy';
import { starredNotes } from '../../../lib/noteEntries';
import { AlcoveSectionHeading } from './AlcoveSectionHeading';
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
  onTaste?: (item: InventoryItem) => void;
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
    <div className="font-sans text-ui-10 uppercase tracking-[0.24em] indent-[0.24em] text-tea-text-dim">
      {label}
    </div>
    <div className="mx-auto mt-[10px] max-w-[360px] font-display text-[22px] leading-[1.45] text-tea-text">
      {terms.map((term, i) => (
        <React.Fragment key={term.termId}>
          {i > 0 && (
            <span aria-hidden="true" className="px-2 text-ui-15 text-tea-gold-lt">
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

  const starred = starredNotes(tasting);
  const hasVisibleStructuredTerms = flavorTerms.length > 0 || feelingTerms.length > 0;
  const hasTerms = tasteTerms.length > 0 || feelingTerms.length > 0;
  const hasAny = hasTerms || starred.length > 0 || Boolean(potentialResearch) || Boolean(onTaste);

  // No sensory data: no band, no empty heading. (The admin "Edit" affordance
  // lives on the card's top edge, not here, so an empty tasting shows nothing.)
  if (!hasAny) return null;

  return (
    <section
      aria-label="Character"
      className={`alcove-band relative px-6 ${open ? 'alcove-band--open mt-9 pb-2 pt-0' : 'mt-[22px] pb-[18px] pt-4'}`}
    >
      {open ? (
        <div aria-hidden="true" className="alcove-rule mb-5" />
      ) : (
        <AlcoveSectionHeading label="Character" className="mb-3" />
      )}

      {hasTerms && (
        <div className="text-center [&_.grp+.grp]:mt-3">
          {tasteTerms.length > 0 && (
            <TermLine label={open ? 'Tastes of' : 'Taste'} terms={tasteTerms} onTermClick={onTermClick} sentenceCase={open} />
          )}
          {feelingTerms.length > 0 && (
            <TermLine label="Feel" terms={feelingTerms} onTermClick={onTermClick} sentenceCase={open} />
          )}
          {open && feelingTerms.length === 0 && (
            <p className="mt-3 font-body text-ui-13 italic text-tea-text-dim">no feeling terms recorded yet</p>
          )}
          {item.tastingSource === 'common' && hasVisibleStructuredTerms && (
            <p className="mt-2 font-sans text-ui-11 text-tea-text-dim">Potential profile</p>
          )}
          {item.tastingSource === 'source' && hasVisibleStructuredTerms && (
            <p className="mt-2 font-sans text-ui-11 text-tea-text-dim">Source-described profile</p>
          )}
        </div>
      )}

      {onTaste && (
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              onTaste(item);
            }}
            className="tap-target inline-flex min-h-[44px] items-center border border-tea-border px-5 font-sans text-ui-10 uppercase tracking-[0.18em] text-tea-text-sec transition-colors hover:border-tea-gold/40 hover:text-tea-text"
          >
            Add your tasting
          </button>
          {open && <div aria-hidden="true" className="alcove-rule mt-8" />}
        </div>
      )}

      {starred.map((note, i) => {
        const attribution = note.sourceAuthor
          ? note.sourceAuthor.initial || note.sourceAuthor.accountName || 'Community'
          : 'Adrian';
        return (
          <figure
            key={note.id}
            className={`mx-0 mb-0 px-1 text-center ${i === 0 && hasTerms ? 'mt-3.5' : i === 0 ? 'mt-1' : 'mt-3.5'}`}
          >
            <blockquote className="m-0 font-display text-ui-17 not-italic leading-[1.5] text-tea-text">
              &ldquo;{note.text}&rdquo;
            </blockquote>
            <figcaption className="mt-2 font-sans text-ui-9 uppercase tracking-[0.2em] text-tea-text-dim">
              {attribution}
            </figcaption>
          </figure>
        );
      })}

      {potentialResearch && (
        <div className={`border-t border-tea-border px-1 text-center ${hasTerms || starred.length ? 'mt-4 pt-4' : 'pt-1'}`}>
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
