import React from 'react';
import { Link } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { resolveTermLabel } from '../../data/tastingTaxonomy';
import type { TastingData } from '../../types';
import type { ResolvedTastingSource } from '../../hooks/useProductTasting';
import { BODY, LINK, SECTION } from '../shared/typeRoles';
import { TastingProfileStrip } from './TastingProfileStrip';

/**
 * The fourth source: the words on the product record itself.
 *
 * Not a tasting. A product can carry freeform tags and a written mood that
 * nobody has ever resolved to a taxonomy term, and until round five those
 * rendered in a different component, in Title Case, unlinked and unsigned,
 * while a resolved tea rendered as lowercase linked terms with an attribution.
 * One slot, two registers, and nothing on the page told the reader which one
 * they were looking at or why. It is the same slot, so it is the same
 * component and the same voice; the attribution is what carries the
 * difference, because the difference is a fact about provenance.
 */
export type SensorySource = ResolvedTastingSource | 'record';

interface ProductTastingEditorialProps {
  tasting?: TastingData;
  /**
   * Freeform terms written on the product record. Used when nothing resolves.
   * They are not taxonomy ids, so they are not links: the shop cannot filter
   * on a string it has never seen.
   */
  freeform?: string[];
  source: SensorySource;
  /** If provided, renders a subtle admin-only pencil next to the source line. */
  onEdit?: () => void;
}

/**
 * Where the tasting came from, in a sentence rather than in capitals.
 *
 * These were micro-caps labels until one of them ("Common to this style") ran
 * to four words, which is a sentence wearing a label's clothes. They are
 * attributions, so they are set as attributions.
 */
const SOURCE_LINE: Record<SensorySource, string> = {
  owner: 'Tasted by Adrian',
  community: 'From the community',
  common: 'Common to this style',
  record: 'Written on the record, not yet tasted',
};

/** Adrian's own note carries one step more presence than a borrowed one. */
const SOURCE_TONE: Record<SensorySource, string> = {
  owner: 'text-tea-text-sec',
  community: 'text-tea-text-dim',
  common: 'text-tea-text-dim',
  record: 'text-tea-text-dim',
};

/**
 * Editorial tasting block for the Shop product page.
 *
 * The energy terms read first as a plain italic line, the flavour row follows,
 * and the attribution signs the bottom the way the authorship line signs the
 * lineage block. It used to open with a 10px caps label tracked at 0.18em: the
 * page settled on one caps setting in round two and this block, living in
 * another folder, was the last piece of fine print left on the page.
 *
 * Both rows link out to /shop filters, which the shop genuinely reads from the
 * URL (?feel= and ?flavor= hydrate the browser's filters), so these are links
 * that keep their promise. Body, finish and liquor colour are deliberately not
 * shown here; those are journaling data.
 */
export const ProductTastingEditorial: React.FC<ProductTastingEditorialProps> = ({ tasting, freeform, source, onEdit }) => {
  const feelingTerms = tasting?.feeling ?? [];
  const flavorTerms = tasting?.flavor ?? [];
  const writtenTerms = (freeform ?? []).map(term => term.trim().toLowerCase()).filter(Boolean);

  if (feelingTerms.length === 0 && flavorTerms.length === 0 && writtenTerms.length === 0) return null;

  const flavorOnly: TastingData = { flavor: flavorTerms };

  return (
    <div className={SECTION}>
      {writtenTerms.length > 0 && (
        // Same line, same italic, same separator as a resolved feeling row.
        // Lower case rather than Title Case, because a Title Cased string is
        // the page pretending an untyped word is a proper term. What these
        // cannot do is be followed, and the attribution below says so.
        <p className={`${BODY} mb-3 italic text-tea-text-sec`}>
          {writtenTerms.map((term, idx) => (
            <React.Fragment key={term}>
              {idx > 0 && <span className="select-none text-tea-text-dim"> · </span>}
              {term}
            </React.Fragment>
          ))}
        </p>
      )}

      {feelingTerms.length > 0 && (
        // Separated on the page's one separator. The interpuncts that join the
        // type, origin and year above are the same mark, so a reader learns one
        // rhythm instead of one per block.
        <p className={`${BODY} mb-3 italic text-tea-text-sec`}>
          {feelingTerms.map((termId, idx) => (
            <React.Fragment key={termId}>
              {idx > 0 && <span className="select-none text-tea-text-dim"> · </span>}
              <Link to={`/shop?feel=${encodeURIComponent(termId)}`} className={LINK}>
                {resolveTermLabel(termId).toLowerCase()}
              </Link>
            </React.Fragment>
          ))}
        </p>
      )}

      {flavorTerms.length > 0 && <TastingProfileStrip tasting={flavorOnly} linkMode="shop-filter" />}

      <p className={`${BODY} mt-2 flex items-center gap-2 ${SOURCE_TONE[source]}`}>
        <span>{SOURCE_LINE[source]}</span>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            aria-label="Edit tasting profile"
            className="tap-target text-tea-text-dim transition-colors hover:text-tea-gold"
          >
            <Pencil size={12} strokeWidth={1.5} />
          </button>
        )}
      </p>
    </div>
  );
};
