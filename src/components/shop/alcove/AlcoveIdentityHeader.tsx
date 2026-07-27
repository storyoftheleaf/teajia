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
  alcoveColors: {
    title: string;
    subtitle: string;
    body: string;
    bodyHighlight: string;
  };
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
  alcoveColors,
  isAdmin,
  onNavigateSource,
}) => {
  return (
    <div style={{
      padding: "16px 20px 0",
      position: "relative",
    }}>
      {/* === Identity (scrolls with content) ===
          The four type roles do not stop at the page boundary. This card ran
          its own scale, 26 / 16 / 13, so a customer who opened a tea from the
          grid read it in one type system and the same tea from its own page in
          another. Same product, same roles: TITLE for the name, HEADING for
          the given name, BODY for the caption of facts. The text-shadow went
          with them, a hardcoded rgba that only ever softened the title against
          a background this card no longer has. */}
      <h1 id={`alcove-title-${item.id}`} className={`${TITLE} text-center`} style={{ color: alcoveColors.title, margin: 0 }}>
        {productName}
      </h1>
      {givenName && (
        <p className={`${HEADING} text-center italic`} style={{ color: alcoveColors.subtitle, margin: "5px 0 0" }}>
          {givenName}
        </p>
      )}
      {/* Tea type · origin · year — a caption of three facts, on the same
          separator the product page joins the same three facts with. */}
      <div style={{
        padding: "6px 0 5px",
        borderTop: "1px solid var(--tea-border)",
        borderBottom: "1px solid var(--tea-border)",
        margin: givenName ? "6px -20px 0" : "8px -20px 0",
      }}>
        <p className={`${BODY} text-center text-tea-text-dim`} style={{ margin: 0 }}>
          {teaType}
          {origin && <><span className="select-none"> · </span>{origin}</>}
          {vintage && <><span className="select-none"> · </span>{vintage}</>}
        </p>
      </div>
      {/* Vendor / Source — admin-only link to source profile */}
      {item.supplier && isAdmin && (
        <div style={{ textAlign: "center", paddingTop: 4 }}>
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
  alcoveColors: {
    body: string;
  };
}

export const AlcoveStorySection: React.FC<AlcoveStorySectionProps> = ({
  item,
  allImages,
  magazineUrl,
  mainStory,
  introduction,
  feelingDescription,
  alcoveColors,
}) => {
  return (
    <>
      {/* === STORY — prose (intro + lore + experience description merged) === */}
      {(() => {
        // When Adrian has starred voice notes, his impressions take over as
        // the sensory description. Suppress the AI-leaning experience and
        // introduction prose so they don't duplicate — keep the historical
        // lore (mainStory) which is distinct cultural context.
        const hasImpressions = starredNotes(item.tasting).length > 0;
        const storyParts: string[] = [];
        if (!hasImpressions && feelingDescription) storyParts.push(feelingDescription);
        if (!hasImpressions && introduction) storyParts.push(introduction);
        if (mainStory) storyParts.push(mainStory);
        const fullStory = storyParts.join('\n\n');
        if (!fullStory) return null;

        const storyStyle = { color: alcoveColors.body, margin: 0, whiteSpace: "pre-line" as const };

        return (
          <div style={{
            padding: "0 20px",
            marginTop: allImages.length > 0 ? "20px" : "16px",
          }}>
            {magazineUrl ? (
              <p className={BODY} style={storyStyle}>
                <a
                  href={magazineUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="alcove-magazine-link"
                  style={{ color: alcoveColors.body }}
                >
                  {fullStory}
                </a>
              </p>
            ) : (
              <p className={BODY} style={storyStyle}>
                {fullStory}
              </p>
            )}
          </div>
        );
      })()}

      {/* === IMPRESSIONS — starred tasting notes, promoted to primary voice === */}
      {(() => {
        const starred = starredNotes(item.tasting);
        if (starred.length === 0) return null;
        // Partition so community-attributed notes render distinct from
        // Adrian's own voice, but still under the same Impressions heading.
        return (
          <div style={{
            padding: "22px 24px 6px",
            marginTop: "8px",
          }}>
            {/* Section label, on the page's one caps setting. It was 10px
                display caps at 0.18em in bronze: the widest tracking anywhere
                in the shop, and bronze at rest on a card that opens above the
                fold, where bronze is reserved for warnings, active states and
                the buy button. */}
            <div className="mb-3">
              <span className={`${LABEL} whitespace-nowrap text-tea-text-dim`}>
                In Adrian&apos;s words
              </span>
            </div>

            {starred.map((note, i) => (
              <p
                key={note.id}
                className={`${BODY} italic text-tea-text`}
                style={{ marginTop: i === 0 ? 0 : 14, marginBottom: 0 }}
              >
                {note.text}
                {note.sourceAuthor && (
                  <span className={`${LABEL} block not-italic text-tea-text-dim`} style={{ marginTop: 6 }}>
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
