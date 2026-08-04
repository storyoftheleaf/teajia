import React from 'react';
import type { InventoryItem } from '../../../types';
import { resolveTermLabel } from '../../../data/tastingTaxonomy';
import { starredNotes } from '../../../lib/noteEntries';
import { AlcoveSectionHeading } from './AlcoveSectionHeading';

interface AlcoveAboutSectionProps {
  item: InventoryItem;
  magazineUrl?: string;
  /** Historical / cultural lore (item.lore). */
  mainStory: string;
  /** Description prose (item.description). */
  introduction: string;
  /** Experience prose (item.experience). */
  feelingDescription: string;
  terroir: string;
  processing: string;
}

/**
 * "About this tea" — the one reading chapter. Description, terroir, and craft
 * merge into continuous Lora prose, with the brewing profile as the practical
 * closing ledger row. Renders only when there is something to read.
 */
export const AlcoveAboutSection: React.FC<AlcoveAboutSectionProps> = ({
  item,
  magazineUrl,
  mainStory,
  introduction,
  feelingDescription,
  terroir,
  processing,
}) => {
  // When Adrian has starred voice notes, his impressions take over as the
  // sensory description (they render in the Character band). Suppress the
  // AI-leaning experience and introduction prose so they don't duplicate —
  // keep the historical lore, which is distinct cultural context.
  const hasImpressions = starredNotes(item.tasting).length > 0;
  const storyParts: string[] = [];
  if (!hasImpressions && feelingDescription) storyParts.push(feelingDescription);
  if (!hasImpressions && introduction) storyParts.push(introduction);
  if (mainStory) storyParts.push(mainStory);
  const fullStory = storyParts.join('\n\n');

  const brewingTerms = item.tasting?.brewing ?? [];
  const hasBrewing = brewingTerms.length > 0;

  if (!fullStory && !terroir && !processing && !hasBrewing) return null;

  const paragraphClass =
    'm-0 whitespace-pre-line font-body text-ui-14 font-normal leading-[1.75] text-tea-text-sec [&+p]:mt-[9px]';

  return (
    <section aria-label="About this tea">
      <AlcoveSectionHeading label="About this tea" className="mx-6 mb-3 mt-[22px]" />

      {(fullStory || terroir || processing) && (
        <div className="px-6">
          {fullStory &&
            (magazineUrl ? (
              <p className={paragraphClass}>
                <a
                  href={magazineUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="alcove-magazine-link"
                >
                  {fullStory}
                </a>
              </p>
            ) : (
              <p className={paragraphClass}>{fullStory}</p>
            ))}
          {terroir && <p className={paragraphClass}>{terroir}</p>}
          {processing && <p className={paragraphClass}>{processing}</p>}
        </div>
      )}

      {hasBrewing && (
        <div className="mx-6 mt-3.5 grid grid-cols-[92px_1fr] items-start py-2.5">
          <div className="pt-[3px] font-sans text-ui-9 uppercase tracking-[0.2em] text-tea-text-dim">
            Brewing
          </div>
          <div className="font-body text-[13.5px] leading-[1.6] text-tea-text-sec">
            {brewingTerms.map(termId => resolveTermLabel(termId)).join(' · ')}
          </div>
        </div>
      )}
    </section>
  );
};
