import React from 'react';
import { LIQUOR_COLORS, TASTING_CATEGORY_ORDER, resolveTermLabel } from '../../data/tastingTaxonomy';
import type { TastingCategoryId } from '../../data/tastingTaxonomy';
import type { TastingData } from '../../types';

const CATEGORY_LABELS: Record<string, string> = {
  flavor: 'Flavor',
  body: 'Body',
  finish: 'Finish',
  feeling: 'Feel',
  'liquor-color': 'Color',
};

/**
 * What was tasted, one line per kind (Body, Finish, Flavor, Feel, Color): the
 * kind in a Lora capital on the left, each chosen word a thin gold frame on
 * the right. Tapping a frame takes the word off, as the chips it replaces did.
 */
export const TasteRows: React.FC<{
  value?: TastingData;
  onRemove: (categoryId: TastingCategoryId, termId: string) => void;
}> = ({ value, onRemove }) => {
  const data = (value ?? {}) as Record<string, unknown>;
  const groups = TASTING_CATEGORY_ORDER
    .map((categoryId) => ({ categoryId, terms: Array.isArray(data[categoryId]) ? (data[categoryId] as string[]) : [] }))
    .filter((g) => g.terms.length > 0);
  if (!groups.length) return null;
  return (
    <div className="curate-v2" data-testid="taste-rows">
      {groups.map((group) => (
        <div key={group.categoryId} className="curate-v2-line flex-wrap gap-y-2 py-2" role="group" aria-label={CATEGORY_LABELS[group.categoryId] ?? group.categoryId}>
          <span className="curate-v2-label">{CATEGORY_LABELS[group.categoryId] ?? group.categoryId}</span>
          <span className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-1.5">
            {group.terms.map((termId) => {
              const label = resolveTermLabel(termId);
              const hex: string | undefined = group.categoryId === 'liquor-color' ? LIQUOR_COLORS[termId] : undefined;
              return (
                <button
                  key={termId}
                  type="button"
                  onClick={() => onRemove(group.categoryId as TastingCategoryId, termId)}
                  aria-label={`Remove ${label}`}
                  aria-pressed
                  className="curate-v2-frame is-tall is-name is-on gap-2"
                >
                  {hex && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: hex }} aria-hidden />}
                  {label}
                </button>
              );
            })}
          </span>
        </div>
      ))}
    </div>
  );
};
