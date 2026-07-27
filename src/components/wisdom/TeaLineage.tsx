import React, { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  findCultivarById,
  findRegion,
  loadCultivarStory,
  matchCultivar,
  type Cultivar,
  type CultivarStory,
  type Region,
} from '../../wisdom';
import { authorshipLine } from '../../wisdom/authorship';
import { Icons } from '../Icons';

/**
 * The subset of a product's own fields needed to resolve the plant and place
 * it is made from. Kept narrow and decoupled from `InventoryItem` so this
 * component can be dropped onto any surface that sells a tea, not just the
 * product page.
 */
export interface TeaLineageProduct {
  name: string;
  chineseName?: string | null;
  origin?: string | null;
  /** A cultivar id or a freeform name recorded directly on the product, when known. */
  cultivar?: string | null;
}

export interface TeaLineageResolution {
  cultivar: Cultivar | null;
  region: Region | null;
}

/**
 * Resolves the plant and place a product is made from, without guessing.
 *
 * Resolution order for the plant: a directly recorded cultivar wins (by id,
 * falling back to a name match on the same stored string); otherwise the
 * product's own names are matched against the wisdom base. A blank result is
 * correct when nothing is known. A wrong lineage is worse than no lineage.
 *
 * The growing region is resolved independently, from the product's own
 * recorded origin, so a product can show altitude/climate for where it was
 * actually grown even when its cultivar's home region differs.
 */
export function resolveLineage(product: TeaLineageProduct): TeaLineageResolution {
  const cultivar = product.cultivar
    ? findCultivarById(product.cultivar) ?? matchCultivar(product.cultivar)
    : matchCultivar(product.name, product.chineseName);
  const region = findRegion(product.origin);
  return { cultivar, region };
}

/** The first sentence of a story's description, not the full paragraph. */
function firstSentence(text: string | undefined): string {
  if (!text) return '';
  const match = text.match(/^.*?[.!?](?=\s|$)/);
  return (match ? match[0] : text).trim();
}

/**
 * Shows the shared background a tea is made from, beneath the shop's own
 * words about the product. This is reference, not voice: written once in the
 * wisdom base and improved everywhere the day it is corrected. Renders
 * nothing when the plant cannot be resolved, a blank is correct here.
 */
export const TeaLineage: React.FC<{ product: TeaLineageProduct }> = ({ product }) => {
  const { cultivar, region } = resolveLineage(product);
  const [story, setStory] = useState<CultivarStory | null>(null);
  const [storyLoading, setStoryLoading] = useState(Boolean(cultivar));
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!cultivar) {
      setStory(null);
      setStoryLoading(false);
      return;
    }
    let live = true;
    setStoryLoading(true);
    loadCultivarStory(cultivar.id).then(result => {
      if (!live) return;
      setStory(result);
      setStoryLoading(false);
    });
    return () => {
      live = false;
    };
  }, [cultivar?.id]);

  if (!cultivar) return null;

  const plantOrigin = [cultivar.originRegion, cultivar.originCountry].filter(Boolean).join(', ');
  const growingConditions = [region?.altitude, region?.climate].filter(Boolean).join(' · ');
  const storyLine = firstSentence(story?.description);

  return (
    <div className="mb-5 rounded-md border border-tea-border bg-tea-surface">
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        aria-expanded={expanded}
        className="w-full flex items-center justify-between gap-3 p-4 text-left tap-target"
      >
        <div className="flex items-start gap-1.5 min-w-0">
          <Icons.Leaf className="w-3.5 h-3.5 text-tea-gold flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <h3 className="text-ui-11 uppercase tracking-[0.12em] text-tea-gold">Lineage</h3>
            <p className="text-xs text-tea-text-sec truncate mt-0.5">
              {cultivar.name}
              {cultivar.chineseName ? ` · ${cultivar.chineseName}` : ''}
              {plantOrigin ? ` · ${plantOrigin}` : ''}
            </p>
          </div>
        </div>
        <ChevronDown
          aria-hidden
          className={`w-4 h-4 flex-shrink-0 text-tea-text-dim transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-3 border-t border-tea-border space-y-3 animate-[fadeIn_0.3s_ease-out]">
          {cultivar.parentage && (
            <p className="text-sm text-tea-text-sec leading-relaxed">
              <span className="font-sans text-ui-10 uppercase tracking-[0.15em] text-tea-text-dim mr-2">Bred from</span>
              {cultivar.parentage}
            </p>
          )}

          {growingConditions && (
            <p className="text-sm text-tea-text-sec leading-relaxed">
              <span className="font-sans text-ui-10 uppercase tracking-[0.15em] text-tea-text-dim mr-2">Growing conditions</span>
              {growingConditions}
            </p>
          )}

          {storyLoading ? (
            <div className="h-4 w-3/4 shimmer-warm" aria-hidden />
          ) : storyLine ? (
            <p className="text-sm text-tea-text-sec leading-relaxed italic">{storyLine}</p>
          ) : null}

          <p className="font-sans text-ui-10 uppercase tracking-[0.15em] text-tea-text-dim pt-1">
            {authorshipLine(cultivar.id)}
          </p>
        </div>
      )}
    </div>
  );
};

export default TeaLineage;
