import React from 'react';
import type { InventoryItem } from '../../../types';
import { starredNotes } from '../../../lib/noteEntries';
import { BODY, HEADING, LABEL, TITLE } from '../../shared/typeRoles';

interface AlcoveIdentityHeaderProps {
  item: InventoryItem;
  productName: string;
  givenName: string;
  teaType: string;
  origin: string;
  vintage: string | number | undefined;
  isAdmin?: boolean;
  onNavigateSource: () => void;
}

export const AlcoveIdentityHeader: React.FC<AlcoveIdentityHeaderProps> = ({
  item,
  productName,
  givenName,
  teaType,
  origin,
  vintage,
  isAdmin,
  onNavigateSource,
}) => {
  return (
    // `alcove-measure` is the container the TITLE role reads its size from.
    // Without it the role clamps against the window, so a 480px card on a
    // 1600px screen set the tea's name at the full 48px page-title size.
    <div className="alcove-header alcove-measure">
      {/* === Identity (scrolls with content) ===
          The four type roles do not stop at the page boundary. This card ran
          its own scale, 26 / 16 / 13, so a customer who opened a tea from the
          grid read it in one type system and the same tea from its own page in
          another. Same product, same roles: TITLE for the name, HEADING for
          the given name, BODY for the caption of facts.

          The colours came off an `alcoveColors` bag threaded through four
          components, whose every entry resolved to a theme token anyway. A bag
          of CSS variables handed to an inline style is a token the colour lint
          cannot read, so it is written as a class. */}
      <h1 id={`alcove-title-${item.id}`} className={`${TITLE} m-0 text-center text-tea-text`}>
        {productName}
      </h1>
      {givenName && (
        <p className={`${HEADING} mb-0 mt-[5px] text-center italic text-tea-text-sec`}>
          {givenName}
        </p>
      )}
      {/* Tea type · origin · year: a caption of three facts, on the same
          separator the product page joins the same three facts with. */}
      <div className="alcove-caption" data-tight={Boolean(givenName)}>
        <p className={`${BODY} m-0 text-center text-tea-text-dim`}>
          {teaType}
          {origin && <><span className="select-none"> · </span>{origin}</>}
          {vintage && <><span className="select-none"> · </span>{vintage}</>}
        </p>
      </div>
      {/* Vendor / Source: admin-only link to the source profile. */}
      {item.supplier && isAdmin && (
        <div className="pt-1 text-center">
          <button type="button" onClick={onNavigateSource} className="alcove-source-link">
            Source: {item.supplier}
          </button>
        </div>
      )}
    </div>
  );
};

interface AlcoveStorySectionProps {
  item: InventoryItem;
  allImages: string[];
  magazineUrl: string | undefined;
  mainStory: string;
  introduction: string;
  feelingDescription: string;
}

export const AlcoveStorySection: React.FC<AlcoveStorySectionProps> = ({
  item,
  allImages,
  magazineUrl,
  mainStory,
  introduction,
  feelingDescription,
}) => {
  return (
    <>
      {/* === STORY: prose (intro + lore + experience description merged) === */}
      {(() => {
        // When Adrian has starred voice notes, his impressions take over as
        // the sensory description. Suppress the AI-leaning experience and
        // introduction prose so they don't duplicate. Keep the historical
        // lore (mainStory), which is distinct cultural context.
        const hasImpressions = starredNotes(item.tasting).length > 0;
        const storyParts: string[] = [];
        if (!hasImpressions && feelingDescription) storyParts.push(feelingDescription);
        if (!hasImpressions && introduction) storyParts.push(introduction);
        if (mainStory) storyParts.push(mainStory);
        const fullStory = storyParts.join('\n\n');
        if (!fullStory) return null;

        const proseClass = `${BODY} m-0 whitespace-pre-line text-tea-text-sec`;

        return (
          <div className={`alcove-body-section ${allImages.length > 0 ? 'mt-5' : 'mt-4'}`}>
            {magazineUrl ? (
              <p className={proseClass}>
                <a
                  href={magazineUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="alcove-magazine-link text-tea-text-sec"
                >
                  {fullStory}
                </a>
              </p>
            ) : (
              <p className={proseClass}>{fullStory}</p>
            )}
          </div>
        );
      })()}

      {/* === IMPRESSIONS: starred tasting notes, promoted to primary voice === */}
      {(() => {
        const starred = starredNotes(item.tasting);
        if (starred.length === 0) return null;
        // Partition so community-attributed notes render distinct from
        // Adrian's own voice, but still under the same Impressions heading.
        return (
          <div className="mt-2 px-6 pb-1.5 pt-[22px]">
            {/* Section label, on the page's one caps setting. It was 10px
                display caps at 0.18em: the widest tracking anywhere in the
                shop, and bronze at rest on a card that opens above the fold,
                where bronze is reserved for warnings, active states and the
                buy button. */}
            <div className="mb-3">
              <span className={`${LABEL} whitespace-nowrap text-tea-text-dim`}>
                In Adrian&apos;s words
              </span>
            </div>

            {starred.map((note, i) => (
              <p
                key={note.id}
                className={`${BODY} mb-0 italic text-tea-text ${i === 0 ? 'mt-0' : 'mt-3.5'}`}
              >
                {note.text}
                {note.sourceAuthor && (
                  <span className={`${LABEL} mt-1.5 block not-italic text-tea-text-dim`}>
                    {note.sourceAuthor.initial || note.sourceAuthor.accountName || 'Community'}
                  </span>
                )}
              </p>
            ))}
          </div>
        );
      })()}
    </>
  );
};
