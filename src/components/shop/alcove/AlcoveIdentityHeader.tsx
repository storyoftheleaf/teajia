import React from 'react';
import type { InventoryItem } from '../../../types';
import { starredNotes } from '../../../lib/noteEntries';

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
      {/* === Identity (scrolls with content) === */}
      <h1 id={`alcove-title-${item.id}`} style={{
        fontFamily: "var(--font-display)",
        fontSize: "26px", fontWeight: 340, color: alcoveColors.title,
        margin: 0, lineHeight: 1.1, letterSpacing: "-0.01em",
        textShadow: "0 0 20px rgba(0,0,0,0.3)",
        textAlign: "center",
      }}>
        {productName}
      </h1>
      {givenName && (
        <p style={{
          fontFamily: "var(--font-display)",
          fontSize: "16px", fontStyle: "italic", fontWeight: 300,
          lineHeight: 1.3,
          color: alcoveColors.subtitle, margin: "5px 0 0",
          textAlign: "center",
        }}>
          {givenName}
        </p>
      )}
      {/* Tea type · origin · year — descriptive bar */}
      <div style={{
        padding: "6px 0 5px",
        borderTop: "1px solid var(--tea-border)",
        borderBottom: "1px solid var(--tea-border)",
        margin: givenName ? "6px -20px 0" : "8px -20px 0",
      }}>
        <p style={{
          fontFamily: "var(--font-display)",
          fontSize: "13px", fontWeight: 300, fontStyle: "italic",
          color: alcoveColors.subtitle, margin: 0,
          textAlign: "center",
        }}>
          {teaType}
          {origin && <><span style={{ margin: "0 8px", opacity: 0.4 }}>·</span>{origin}</>}
          {vintage && <><span style={{ margin: "0 8px", opacity: 0.4 }}>·</span>{vintage}</>}
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

        const storyStyle = {
          fontFamily: "var(--font-body)",
          fontSize: "15px", fontWeight: 300 as const, lineHeight: 1.65,
          color: alcoveColors.body, margin: 0,
          whiteSpace: "pre-line" as const,
        };

        return (
          <div style={{
            padding: "0 20px",
            marginTop: allImages.length > 0 ? "20px" : "16px",
          }}>
            {magazineUrl ? (
              <p style={storyStyle}>
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
              <p style={storyStyle}>
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
            {/* Eyebrow — bronze used once; hairline removed to keep bronze rare. */}
            <div className="mb-3">
              <span style={{
                fontFamily: "var(--font-display)",
                fontSize: "10px",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "var(--tea-gold)",
                whiteSpace: "nowrap",
              }}>
                In Adrian's words
              </span>
            </div>

            {starred.map((note, i) => (
              <p
                key={note.id}
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "17px",
                  fontStyle: "italic",
                  lineHeight: 1.6,
                  color: "var(--tea-text)",
                  marginTop: i === 0 ? 0 : 14,
                  marginBottom: 0,
                }}
              >
                {note.text}
                {note.sourceAuthor && (
                  <span
                    style={{
                      display: "block",
                      marginTop: 6,
                      fontSize: "10px",
                      fontStyle: "normal",
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      color: "var(--tea-text-dim)",
                    }}
                  >
                    — {note.sourceAuthor.initial || note.sourceAuthor.accountName || 'Community'}
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
