import React from 'react';
import type { InventoryItem } from '../../../types';
import { resolveTermLabel } from '../../../data/tastingTaxonomy';
import { starredNotes } from '../../../lib/noteEntries';
import { AlcoveSectionHeading } from './AlcoveSectionHeading';

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
  /** Legacy free-text tags (item.tags) — taste-line fallback when no structured flavor terms exist. */
  legacyNotes: string[];
  isAdmin?: boolean;
  onEditProductTasting?: (item: InventoryItem) => void;
  onTermClick?: (termId: string, categoryId: string) => void;
}

/** One centered label + serif term line, terms separated by gold middots. */
const TermLine: React.FC<{
  label: string;
  terms: TermRef[];
  onTermClick?: (termId: string, categoryId: string) => void;
}> = ({ label, terms, onTermClick }) => (
  <div className="grp">
    <div className="font-sans text-ui-9 uppercase tracking-[0.24em] indent-[0.24em] text-tea-text-dim">
      {label}
    </div>
    <div className="mt-[3px] font-display text-[19px] leading-[1.4] text-tea-text">
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
              {term.label}
            </button>
          ) : (
            <span>{term.label}</span>
          )}
        </React.Fragment>
      ))}
    </div>
  </div>
);

/**
 * "Character" — the one chapter that gathers everything sensory: the taste
 * line, the feel line, and Adrian's starred notes together in a faint tonal
 * band. Renders only when there are customer-facing tasting terms or starred
 * notes (or, for admins, so the tasting editor stays reachable).
 */
export const AlcoveCharacterBand: React.FC<AlcoveCharacterBandProps> = ({
  item,
  legacyNotes,
  isAdmin,
  onEditProductTasting,
  onTermClick,
}) => {
  const tasting = item.tasting;

  // Shopper-facing terms: flavor → TASTE, feeling → FEEL. Body / finish /
  // liquor-color are journaling data — noisy on a product page.
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
  const hasTerms = tasteTerms.length > 0 || feelingTerms.length > 0;
  const hasAny = hasTerms || starred.length > 0;

  // No sensory data and no admin editor — no band, no empty heading.
  if (!hasAny && !(isAdmin && onEditProductTasting)) return null;

  return (
    <section aria-label="Character" className="alcove-band relative mt-[22px] px-6 pb-[18px] pt-4">
      <AlcoveSectionHeading label="Character" className="mb-3" />

      {isAdmin && onEditProductTasting && (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onEditProductTasting(item); }}
          className="tap-target absolute right-2 top-1 font-sans text-ui-9 uppercase tracking-[0.15em] text-tea-text-dim transition-colors hover:text-tea-gold"
          aria-label="Edit product tasting"
        >
          Edit tasting
        </button>
      )}

      {hasTerms && (
        <div className="text-center [&_.grp+.grp]:mt-3">
          {tasteTerms.length > 0 && (
            <TermLine label="Taste" terms={tasteTerms} onTermClick={onTermClick} />
          )}
          {feelingTerms.length > 0 && (
            <TermLine label="Feel" terms={feelingTerms} onTermClick={onTermClick} />
          )}
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
    </section>
  );
};
