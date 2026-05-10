import React from 'react';
import type { InventoryItem } from '../../../types';
import {
  resolveTermLabel,
  resolveTermIcon,
  LIQUOR_COLORS,
  TERM_MAP,
} from '../../../data/tastingTaxonomy';
import { useNavigate } from 'react-router-dom';
import { Leaf, ChevronRight } from 'lucide-react';

/** Converts a string to Title Case */
function toTitleCase(str: string): string {
  return str.replace(/\b\w/g, c => c.toUpperCase());
}

interface AlcoveSensoryGridProps {
  item: InventoryItem;
  notes: string[];
  moodTags: string[];
  typeColor: string;
  isAdmin?: boolean;
  onEditProductTasting?: (item: InventoryItem) => void;
  onTermClick?: (termId: string, categoryId: string) => void;
  tastingCount: number;
}

export const AlcoveSensoryGrid: React.FC<AlcoveSensoryGridProps> = ({
  item,
  notes,
  moodTags,
  typeColor,
  isAdmin,
  onEditProductTasting,
  onTermClick,
  tastingCount,
}) => {
  const navigate = useNavigate();
  const tasting = item.tasting;
  // Shopper-facing display: flavor + energy only. Body / finish /
  // liquor-color are journaling data, useful to the admin but noisy on
  // a product page.
  const customerFacingTerms = tasting
    ? [...(tasting.flavor ?? []), ...(tasting.feeling ?? [])]
    : [];
  const hasTasting = customerFacingTerms.length > 0;
  const sensoryNotes = hasTasting ? customerFacingTerms : [];
  const legacyNotes = !hasTasting ? notes : [];
  const hasAnySensory = sensoryNotes.length > 0 || legacyNotes.length > 0;
  // Legacy `mood` header (e.g. "Gentle Patience") is no longer rendered
  // on the card — the feeling of the tea is now carried by the
  // structured `feeling` chips in the grid below.
  const hasMood = false;
  void moodTags;

  if (!hasAnySensory && !hasMood && !(isAdmin && onEditProductTasting) && tastingCount === 0) return null;

  // Collect note items for the grid
  const noteItems = sensoryNotes.map((termId) => {
    const Icon = resolveTermIcon(termId);
    const label = resolveTermLabel(termId);
    const termInfo = TERM_MAP.get(termId);
    const isLiquorColor = termInfo?.categoryId === 'liquor-color';
    const swatchColor = isLiquorColor ? LIQUOR_COLORS[termId] : null;
    return { key: termId, label, termId, icon: Icon, swatchColor, categoryId: termInfo?.categoryId || 'flavor' };
  });

  // Legacy notes as fallback
  const legacyItems = legacyNotes.map((note) => {
    const termId = note.toLowerCase().replace(/\s+/g, '-');
    const Icon = resolveTermIcon(termId);
    return { key: `legacy-${note}`, label: toTitleCase(note), termId, icon: Icon, swatchColor: null as string | null, categoryId: 'flavor' };
  });

  const allNotes = [...noteItems, ...legacyItems];
  const noteTotalRows = Math.ceil(allNotes.length / 2);

  return (
    <div style={{
      marginTop: "24px",
      background: "rgb(var(--tea-text-rgb) / 0.08)",
      borderTop: "1px solid var(--tea-border)",
      borderBottom: "1px solid var(--tea-border)",
      padding: "4px 16px",
    }}>
      {isAdmin && onEditProductTasting && (
        <div style={{
          display: "flex",
          justifyContent: "flex-end",
          paddingTop: "6px",
        }}>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onEditProductTasting(item); }}
            className="text-ui-10 uppercase tracking-[0.15em] text-tea-text-dim hover:text-tea-gold transition-colors"
            style={{ fontFamily: "var(--font-display)", display: "inline-flex", alignItems: "center", gap: "4px" }}
            aria-label="Edit product tasting"
          >
            Edit tasting
          </button>
        </div>
      )}

      {/* Mood tags — centered single column with dashed dividers */}
      {hasMood && (
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "6px 0",
          borderBottom: hasAnySensory ? "1px solid var(--tea-border)" : "none",
        }}>
          {moodTags.map((tag, i) => {
            const Tag = onTermClick ? 'button' : 'span';
            return (
              <React.Fragment key={`mood-${tag}`}>
                {i > 0 && (
                  <div style={{
                    width: "40px",
                    borderTop: "1px dashed var(--tea-border)",
                    margin: "2px 0",
                  }} />
                )}
                <Tag
                  type={onTermClick ? 'button' : undefined}
                  onClick={onTermClick ? () => onTermClick(tag.toLowerCase().trim(), 'mood') : undefined}
                  className="alcove-note-btn"
                  data-readonly={!onTermClick}
                  style={{
                    fontStyle: "italic",
                    letterSpacing: "0.06em",
                    color: "var(--tea-text-sec)",
                    justifyContent: 'center',
                    textAlign: 'center',
                  }}
                >
                  {toTitleCase(tag)}
                </Tag>
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* Tasting notes grid */}
      {allNotes.length > 0 && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
        }}>
          {allNotes.map((noteItem, idx) => {
            const isLeftCol = idx % 2 === 0;
            const rowIdx = Math.floor(idx / 2);
            const isLastRow = rowIdx === noteTotalRows - 1;
            const isOddLast = idx === allNotes.length - 1 && allNotes.length % 2 === 1;
            const NoteIcon = noteItem.icon;
            const Tag = onTermClick ? 'button' : 'span';

            return (
              <Tag
                key={noteItem.key}
                type={onTermClick ? 'button' : undefined}
                onClick={onTermClick ? () => onTermClick(noteItem.termId, noteItem.categoryId || 'flavor') : undefined}
                className="alcove-note-btn"
                data-readonly={!onTermClick}
                style={{
                  color: typeColor,
                  ...(isOddLast ? { gridColumn: "1 / -1" } : {}),
                  borderRight: (isLeftCol && !isOddLast) ? "1px solid var(--tea-border)" : "none",
                  borderBottom: isLastRow ? "none" : "1px solid var(--tea-border)",
                }}
              >
                {noteItem.swatchColor ? (
                  <span style={{
                    width: "16px", height: "16px", borderRadius: "50%",
                    background: noteItem.swatchColor,
                    border: "1px solid var(--tea-border)",
                    flexShrink: 0,
                  }} />
                ) : NoteIcon ? (
                  <NoteIcon size={16} style={{ opacity: 0.72, flexShrink: 0, color: "currentColor" }} />
                ) : null}
                <span>{noteItem.label}</span>
              </Tag>
            );
          })}
        </div>
      )}

      {/* Tasting count — personal journal link, scoped to the tasting context */}
      {tastingCount > 0 && (
        <div style={{
          display: "flex",
          justifyContent: "center",
          paddingTop: "10px",
          paddingBottom: "2px",
          borderTop: (hasAnySensory || hasMood) ? "1px solid var(--tea-border)" : "none",
          marginTop: (hasAnySensory || hasMood) ? "10px" : "0",
        }}>
          <button
            onClick={() => navigate('/account?tab=journal')}
            style={{
              display: "flex", alignItems: "center", gap: "5px",
              background: "none", border: "none", cursor: "pointer",
              padding: "2px 6px", borderRadius: "4px",
              transition: "opacity 0.2s",
            }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.75'; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
          >
            <Leaf size={12} style={{ color: '#5A6E5A', opacity: 0.75 }} />
            <span style={{
              fontFamily: "var(--font-display)",
              fontSize: "10px", fontWeight: 400,
              color: "var(--tea-text-dim)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}>
              Tasted {tastingCount} {tastingCount === 1 ? 'time' : 'times'}
            </span>
            <ChevronRight size={10} style={{ color: "var(--tea-text-dim)", opacity: 0.6, marginLeft: "1px" }} />
          </button>
        </div>
      )}
    </div>
  );
};
