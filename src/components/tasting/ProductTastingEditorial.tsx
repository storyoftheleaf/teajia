import React from 'react';
import { Link } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { resolveTermLabel } from '../../data/tastingTaxonomy';
import type { TastingData } from '../../types';
import type { ResolvedTastingSource } from '../../hooks/useProductTasting';
import { TastingProfileStrip } from './TastingProfileStrip';

interface ProductTastingEditorialProps {
  tasting: TastingData;
  source: ResolvedTastingSource;
  /** If provided, renders a subtle admin-only pencil next to the source label. */
  onEdit?: () => void;
}

const SOURCE_LABEL: Record<ResolvedTastingSource, string> = {
  owner: 'Tasted by Adrian',
  community: 'From the community',
  common: 'Common to this style',
};

const SOURCE_LABEL_TONE: Record<ResolvedTastingSource, string> = {
  owner: 'text-tea-gold',
  community: 'text-tea-text-sec',
  common: 'text-tea-text-dim',
};

/**
 * Editorial tasting block for the Shop product page.
 *
 * Renders the energy (feeling) terms at the top as an italic display
 * caption — the deliberate first impression — then the flavor row as
 * tinted aged-gold pills below. Both rows link out to /shop filters so
 * a shopper can keep browsing by note. Body / finish / liquor-color
 * terms are intentionally not shown here; those are journaling data.
 */
export const ProductTastingEditorial: React.FC<ProductTastingEditorialProps> = ({ tasting, source, onEdit }) => {
  const feelingTerms = tasting.feeling ?? [];
  const flavorTerms = tasting.flavor ?? [];

  if (feelingTerms.length === 0 && flavorTerms.length === 0) return null;

  const flavorOnly: TastingData = { flavor: flavorTerms };

  return (
    <div className="mb-6">
      <div
        className={`flex items-center gap-2 text-ui-10 uppercase tracking-[0.18em] mb-2 ${SOURCE_LABEL_TONE[source]}`}
        style={{ fontFamily: 'var(--font-display)' }}
      >
        <span>{SOURCE_LABEL[source]}</span>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            aria-label="Edit tasting profile"
            className="text-tea-text-dim hover:text-tea-gold transition-colors"
          >
            <Pencil size={11} strokeWidth={1.5} />
          </button>
        )}
      </div>

      {feelingTerms.length > 0 && (
        <p
          className="mb-3 text-ui-15 leading-snug text-tea-text-sec"
          style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic' }}
        >
          <span className="text-tea-text-dim select-none">— </span>
          {feelingTerms.map((termId, idx) => (
            <React.Fragment key={termId}>
              {idx > 0 && <span className="text-tea-text-dim select-none"> — </span>}
              <Link
                to={`/shop?feel=${encodeURIComponent(termId)}`}
                className="underline decoration-tea-gold/35 decoration-[1px] underline-offset-[4px] hover:decoration-tea-gold hover:text-tea-text transition-colors"
              >
                {resolveTermLabel(termId).toLowerCase()}
              </Link>
            </React.Fragment>
          ))}
          <span className="text-tea-text-dim select-none"> —</span>
        </p>
      )}

      {flavorTerms.length > 0 && (
        <TastingProfileStrip tasting={flavorOnly} linkMode="shop-filter" />
      )}
    </div>
  );
};
