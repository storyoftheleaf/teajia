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
import { BODY, LABEL } from '../../shared/typeRoles';

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
  void moodTags;

  if (!hasAnySensory && !(isAdmin && onEditProductTasting) && tastingCount === 0) return null;

  // Collect note items for the grid
  const noteItems = sensoryNotes.map((termId) => {
    const Icon = resolveTermIcon(termId);
    const label = resolveTermLabel(termId);
    const termInfo = TERM_MAP.get(termId);
    const isLiquorColor = termInfo?.categoryId === 'liquor-color';
    const swatchColor = isLiquorColor ? LIQUOR_COLORS[termId] : null;
    return { key: termId, label, termId, icon: Icon, swatchColor, categoryId: termInfo?.categoryId || 'flavor' };
  });

  /**
   * A term nobody has typed stays in the case it was written in.
   *
   * This grid Title Cased them. Round five removed exactly that from the
   * product page, one folder over, on the reasoning that a Title Cased string
   * is the shop pretending an untyped word is a proper term. The two surfaces
   * then disagreed about the same field on the same tea: "Stone Fruit" here,
   * "stone fruit" on the page, with no fact behind the difference. The page's
   * reading wins, so the card follows it.
   */
  const legacyItems = legacyNotes.map((note) => {
    const label = note.trim().toLowerCase();
    const termId = label.replace(/\s+/g, '-');
    const Icon = resolveTermIcon(termId);
    return { key: `legacy-${note}`, label, termId, icon: Icon, swatchColor: null as string | null, categoryId: 'flavor' };
  });

  const allNotes = [...noteItems, ...legacyItems];
  const noteTotalRows = Math.ceil(allNotes.length / 2);

  return (
    <div className="alcove-sensory">
      {isAdmin && onEditProductTasting && (
        <div className="flex justify-end pt-1.5">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onEditProductTasting(item); }}
            className={`${LABEL} inline-flex min-h-[44px] items-center gap-1 text-tea-text-dim transition-colors hover:text-tea-gold`}
            aria-label="Edit product tasting"
          >
            Edit tasting
          </button>
        </div>
      )}

      {/* Tasting notes grid */}
      {allNotes.length > 0 && (
        <div className="alcove-note-grid">
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
                className={`alcove-note-btn ${BODY} ${isOddLast ? 'col-span-2' : ''}`}
                data-readonly={!onTermClick}
                data-col={isLeftCol && !isOddLast ? 'left' : 'right'}
                data-rule={!isLastRow}
                // The type's own hue is data, not decoration: it is resolved
                // per tea by getTeaColor, so it cannot become a class.
                style={{ color: typeColor }}
              >
                {noteItem.swatchColor ? (
                  <span className="alcove-note-swatch" style={{ background: noteItem.swatchColor }} />
                ) : NoteIcon ? (
                  <NoteIcon size={16} className="shrink-0 opacity-70" />
                ) : null}
                <span>{noteItem.label}</span>
              </Tag>
            );
          })}
        </div>
      )}

      {/* Tasting count: personal journal link, scoped to the tasting context */}
      {tastingCount > 0 && (
        <div className={`flex justify-center pb-0.5 pt-2.5 ${hasAnySensory ? 'mt-2.5 border-t border-tea-border' : ''}`}>
          <button
            type="button"
            onClick={() => navigate('/account?tab=journal')}
            className="alcove-tasted"
          >
            <Leaf size={12} className="shrink-0 text-tea-green" />
            <span className={LABEL}>
              Tasted {tastingCount} {tastingCount === 1 ? 'time' : 'times'}
            </span>
            <ChevronRight size={10} className="ml-px shrink-0" />
          </button>
        </div>
      )}
    </div>
  );
};
