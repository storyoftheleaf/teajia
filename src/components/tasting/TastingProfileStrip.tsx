import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronDown, Droplets, Waves, Timer, Flame, Circle } from 'lucide-react';
import {
  resolveTermLabel,
  resolveTermIcon,
  TERM_MAP,
  LIQUOR_COLORS,
  TASTING_CATEGORY_ORDER,
} from '../../data/tastingTaxonomy';
import type { TastingData } from '../../types';
import type { TastingCategoryId } from '../../data/tastingTaxonomy';
import { shopTermHref } from '../shop/termFilter';
import { BODY, LABEL } from '../shared/typeRoles';

export type TastingStripLinkMode = 'remove' | 'shop-filter';

interface TastingProfileStripProps {
  value?: TastingData;
  tasting?: TastingData;
  onRemove?: (categoryId: TastingCategoryId, termId: string) => void;
  variant?: string | 'cloud';
  /**
   * Interaction mode for individual term chips.
   * - 'remove' (default): clicking fires onRemove, for editing contexts.
   * - 'shop-filter': chips become <Link>s to /shop?flavor=<id> or /shop?feel=<id>.
   */
  linkMode?: TastingStripLinkMode;
}

/**
 * Kept as a one-line wrapper so the category this component already knows is
 * not thrown away and re-derived. The rule itself lives in one place now, in
 * shop/termFilter, because a review block on the same page prints the same
 * terms and has to reach the same answer.
 */
function shopFilterHref(_categoryId: string, termId: string): string | null {
  return shopTermHref(termId);
}

/**
 * Categories are told apart by their icon, not by a hue of their own.
 *
 * This block used to be five hardcoded hex values, plus two `#8a8a80`
 * fallbacks and a `#888`: eight colour literals, all of them painted through
 * an inline style, on the component the product page renders third from the
 * top. `npm run lint:colors` reads className strings, so an inline style is
 * exactly the blind spot round six closed on the shop card, and these were the
 * same defect one folder over.
 *
 * None of the five adapted to the theme, none was near a token, and all five
 * were muted browns within about fifteen percent of each other, which is not a
 * legible code even before the light-mode background moves under them. The
 * component already owns a per-category icon and used it in the grouped
 * variant. The cloud variant now uses the same icon, so the legend and the
 * terms it explains are marked with one thing rather than two, and the code
 * survives a theme flip and a colour-blind reader.
 */

/** Category display labels - small uppercase */
const CATEGORY_LABELS: Record<string, string> = {
  flavor: 'FLAVOR',
  body: 'BODY',
  finish: 'FINISH',
  feeling: 'FEEL',
  'liquor-color': 'COLOR',
};

/** Category header icons */
const CATEGORY_HEADER_ICONS: Record<string, React.FC<{ size?: number; className?: string; style?: React.CSSProperties }>> = {
  flavor: (props) => <Droplets {...props} />,
  body: (props) => <Waves {...props} />,
  finish: (props) => <Timer {...props} />,
  feeling: (props) => <Flame {...props} />,
  'liquor-color': (props) => <Circle {...props} />,
};

/**
 * One tone for every category label.
 *
 * These carried four weights and two opacities, which put a silent ranking on
 * five peer categories: flavour semibold and full strength, feeling and colour
 * normal at 70 percent. Nothing behind the data says flavour outranks finish,
 * and an opacity on a label that is already the dimmest token on the page is
 * how a label becomes unreadable outdoors. The categories are peers, so they
 * are set as peers.
 */
const CATEGORY_LABEL_CLASS = 'text-tea-text-dim';

/**
 * One tint for every category's terms.
 *
 * Flavour used to sit on `bg-tea-gold/8` with the `.tag` primitive's bronze
 * text, which put a row of bronze pills above the fold on the product page,
 * where bronze is reserved for warnings, active states and the buy button.
 * Hover is still bronze, because hover is one of those states.
 */
const TERM_TINT = 'bg-tea-surface text-tea-text-sec';

/**
 * The term pill, in three parts.
 *
 * These used to ride the shared `.tag` primitive, whose background and colour
 * are declared in a stylesheet loaded after Tailwind, so the per-category tint
 * classes stacked on top of it never applied at all: every term rendered
 * bronze on bronze regardless of what the component asked for. Setting the
 * pill from tokens here means what the component says is what the page shows.
 *
 * SHELL carries the shape and the size, CONTROL carries the 44px floor and the
 * hover for a term you can press, STATIC carries the tighter padding for a term
 * that is only being read.
 */
const TERM_SHELL = `${BODY} group inline-flex shrink-0 items-center rounded-full transition-colors`;
const TERM_CONTROL = 'flex min-h-11 items-center gap-1.5 rounded-full px-3 transition-colors hover:bg-tea-gold/10';
const TERM_STATIC = 'gap-1.5 px-3 py-1';

/** Maximum visible terms before collapsing */
const MAX_VISIBLE = 8;
const COLLAPSED_SHOW = 6;

const TastingProfileStripInner: React.FC<TastingProfileStripProps> = ({ value, tasting, onRemove, variant, linkMode = 'remove' }) => {
  const [expanded, setExpanded] = useState(false);
  const data = tasting ?? value ?? {};

  // Group terms by category following the canonical order
  const groupedTerms = TASTING_CATEGORY_ORDER
    .map(catId => ({
      categoryId: catId,
      label: CATEGORY_LABELS[catId] || catId.toUpperCase(),
      tintClass: TERM_TINT,
      terms: (data as any)[catId] || [],
    }))
    .filter(g => g.terms.length > 0);

  // Total term count across all categories
  const totalTerms = groupedTerms.reduce((sum, g) => sum + g.terms.length, 0);

  if (totalTerms === 0) return null;

  // ── Cloud variant: unified note cloud with dot-coded categories ──────────
  if (variant === 'cloud') {
    const nonColorGroups = groupedTerms.filter(g => g.categoryId !== 'liquor-color');
    const colorGroup = groupedTerms.find(g => g.categoryId === 'liquor-color');
    const activeCats = groupedTerms.filter(g => g.terms.length > 0 && g.categoryId !== 'liquor-color');

    return (
      <div className="space-y-2">
        {/* Legend row: non-color categories only */}
        {activeCats.length > 1 && (
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {activeCats.map(group => {
              const LegendIcon = CATEGORY_HEADER_ICONS[group.categoryId];
              return (
                <span key={group.categoryId} className={`${LABEL} inline-flex items-center gap-1 text-tea-text-dim`}>
                  {LegendIcon && <LegendIcon size={9} className="shrink-0" />}
                  {CATEGORY_LABELS[group.categoryId] ?? group.categoryId}
                </span>
              );
            })}
          </div>
        )}

        {/* Tag cloud: all non-color terms */}
        <div className="flex flex-wrap gap-1.5">
          {nonColorGroups.map(group =>
            group.terms.map(termId => {
              const TagIcon = CATEGORY_HEADER_ICONS[group.categoryId];
              const label = resolveTermLabel(termId);
              return (
                <button
                  key={`${group.categoryId}-${termId}`}
                  type="button"
                  onClick={() => onRemove?.(group.categoryId as TastingCategoryId, termId)}
                  className="tag curate-tasting-tag tap-target group"
                  aria-label={onRemove ? `Remove ${label}` : label}
                  style={{ gap: '6px' }}
                >
                  {TagIcon && <TagIcon size={9} className="shrink-0" />}
                  {label}
                  {onRemove && <X size={8} className="shrink-0 opacity-0 group-hover:opacity-50 transition-opacity" />}
                </button>
              );
            })
          )}

          {/* Liquor-color swatches: rendered as color circles, not text pills */}
          {colorGroup?.terms.map(termId => {
            // The liquor's own colour is the one colour on this component that
            // is data rather than styling: it is what the tea looks like in the
            // cup, so it is read from the taxonomy and painted as given. A term
            // the taxonomy has no colour for gets no swatch and no tint, rather
            // than an invented grey standing in for a measurement nobody made.
            const hex: string | undefined = LIQUOR_COLORS[termId];
            const label = resolveTermLabel(termId);
            return (
              <button
                key={`liquor-${termId}`}
                type="button"
                title={label}
                onClick={() => onRemove?.('liquor-color', termId)}
                className="tap-target group inline-flex min-h-11 items-center gap-1.5 px-2 py-1 rounded-full text-ui-12 text-tea-text-dim hover:text-tea-text transition-colors"
                aria-label={onRemove ? `Remove ${label}` : label}
                // No border. A visible outline on a badge is banned everywhere
                // else in the app, and the swatch dot inside already carries a
                // ring in the same hue, so the outline was drawing the colour
                // twice on one pill.
                style={hex ? { background: `${hex}22` } : undefined}
              >
                {hex && (
                  <span className="shrink-0 rounded-full" style={{ width: 10, height: 10, background: hex, display: 'inline-block', boxShadow: `0 0 0 1px ${hex}80` }} />
                )}
                {label}
                {onRemove && <X size={8} className="shrink-0 opacity-0 group-hover:opacity-50 transition-opacity" />}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Determine if we need compact mode
  const needsCompact = totalTerms > MAX_VISIBLE && !expanded;

  // In compact mode, distribute the visible budget across groups
  // Also track which categories got 0 visible terms (fully hidden)
  let termsRemaining = COLLAPSED_SHOW;
  const hiddenCategoryLabels: string[] = [];

  // Pre-calculate visibility in compact mode for the expand hint
  if (needsCompact) {
    let budget = COLLAPSED_SHOW;
    for (const group of groupedTerms) {
      if (budget <= 0) {
        hiddenCategoryLabels.push(group.label);
      } else {
        const shown = Math.min(group.terms.length, budget);
        budget -= shown;
      }
    }
  }

  const expandHint = hiddenCategoryLabels.length > 0
    ? `+${totalTerms - COLLAPSED_SHOW} more · ${hiddenCategoryLabels.join(', ')}`
    : `+${totalTerms - COLLAPSED_SHOW} more`;

  return (
    <div className="space-y-2">
      {/* "Show less" at TOP when expanded */}
      {expanded && totalTerms > MAX_VISIBLE && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          aria-expanded={true}
          aria-label="Show fewer tasting notes"
          className={`${BODY} flex items-center gap-1 text-tea-text-dim hover:text-tea-text-sec transition-colors ml-0.5 min-h-[44px]`}
        >
          <ChevronDown size={10} className="rotate-180" />
          <span>Show less</span>
        </button>
      )}

      <AnimatePresence mode="popLayout">
        {groupedTerms.map(group => {
          // In compact mode, limit terms shown per group
          let visibleTerms = group.terms;
          if (needsCompact) {
            if (termsRemaining <= 0) return null;
            visibleTerms = group.terms.slice(0, termsRemaining);
            termsRemaining -= visibleTerms.length;
          }

          const isSingleTerm = visibleTerms.length === 1 && group.categoryId !== 'flavor';
          const HeaderIcon = CATEGORY_HEADER_ICONS[group.categoryId];

          // Single-term inline treatment (not flavor category)
          if (isSingleTerm) {
            const termId = visibleTerms[0];
            const isColor = group.categoryId === 'liquor-color';
            const hex = isColor ? LIQUOR_COLORS[termId] : null;
            const Icon = !isColor ? resolveTermIcon(termId) : null;
            const termLabel = resolveTermLabel(termId);

            return (
              <motion.div
                key={group.categoryId}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                layout
                className="flex items-center gap-1 ml-0.5"
              >
                {HeaderIcon && (
                  <HeaderIcon size={9} className="shrink-0 text-tea-text-dim" />
                )}
                <span className={`${LABEL} ${CATEGORY_LABEL_CLASS}`}>{group.label}</span>
                {(() => {
                  const value = (
                    <>
                      {hex ? (
                        <span
                          className="shrink-0 rounded-full"
                          style={{ width: 12, height: 12, background: hex, display: 'inline-block' }}
                        />
                      ) : Icon ? (
                        <Icon size={11} className="shrink-0 text-tea-text-sec" />
                      ) : null}
                      <span className={`${BODY} text-tea-text-sec`}>{termLabel}</span>
                      {onRemove && (
                        <X size={9} className="shrink-0 opacity-0 group-hover:opacity-60 transition-opacity" />
                      )}
                    </>
                  );
                  return onRemove ? (
                    <button
                      type="button"
                      onClick={() => onRemove(group.categoryId, termId)}
                      aria-label={`Remove ${termLabel}`}
                      className="group ml-1 flex min-h-11 items-center gap-1"
                    >
                      {value}
                    </button>
                  ) : (
                    <span className="ml-1 flex items-center gap-1">{value}</span>
                  );
                })()}
              </motion.div>
            );
          }

          return (
            <motion.div
              key={group.categoryId}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              layout
            >
              {/* Category label with icon. The page's one caps setting: sans,
                  11px, 0.08em. This tracked at 0.15em in the display serif,
                  which is a second caps setting and the widest one on the
                  page. */}
              <div className={`${LABEL} ${CATEGORY_LABEL_CLASS} flex items-center gap-1 mb-1 ml-0.5`}>
                {HeaderIcon && <HeaderIcon size={9} className="shrink-0" />}
                {group.label}
              </div>

              {/* Terms row. Three shapes, decided by what the term can do: a
                  link when the shop can filter on it, a button when it can be
                  removed, and a plain span when it can do neither. A button
                  wired to nothing is not a control, and pricing it like one
                  cost every read-only surface a 44px row it did not need. */}
              <div className="flex flex-wrap gap-1.5">
                <AnimatePresence mode="popLayout">
                  {visibleTerms.map(termId => {
                    const isColor = group.categoryId === 'liquor-color';
                    const hex = isColor ? LIQUOR_COLORS[termId] : null;
                    const Icon = !isColor ? resolveTermIcon(termId) : null;
                    const label = resolveTermLabel(termId);
                    const href = linkMode === 'shop-filter' ? shopFilterHref(group.categoryId, termId) : null;

                    const inner = (
                      <>
                        {hex ? (
                          <span
                            className="shrink-0 rounded-full"
                            style={{
                              width: 12,
                              height: 12,
                              background: hex,
                              display: 'inline-block',
                            }}
                          />
                        ) : Icon ? (
                          <Icon size={11} className="shrink-0" />
                        ) : null}
                        {/* The page's one link setting: dim at rest, bronze on
                            hover. A bronze underline at rest put the accent
                            above the fold on every flavour term, where it is
                            reserved for warnings, active states and the buy
                            button. */}
                        <span
                          className={href ? 'underline decoration-1 decoration-tea-text-dim underline-offset-[3px] transition-colors group-hover:decoration-tea-gold' : ''}
                        >
                          {label}
                        </span>
                        {onRemove && (
                          <X
                            size={9}
                            className="shrink-0 opacity-0 group-hover:opacity-60 transition-opacity ml-0.5"
                          />
                        )}
                      </>
                    );

                    const motionProps = {
                      layout: true as const,
                      initial: { opacity: 0, scale: 0.8 },
                      animate: { opacity: 1, scale: 1 },
                      exit: { opacity: 0, scale: 0.6 },
                      transition: { duration: 0.18 },
                    };

                    if (href) {
                      return (
                        <motion.span
                          key={`${group.categoryId}-${termId}`}
                          {...motionProps}
                          className={`${TERM_SHELL} ${group.tintClass}`}
                        >
                          <Link to={href} className={`${TERM_CONTROL} rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-tea-gold/50`}>
                            {inner}
                          </Link>
                        </motion.span>
                      );
                    }

                    if (onRemove) {
                      return (
                        <motion.button
                          key={`${group.categoryId}-${termId}`}
                          type="button"
                          {...motionProps}
                          className={`${TERM_SHELL} ${TERM_CONTROL} ${group.tintClass}`}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => onRemove(group.categoryId, termId)}
                        >
                          {inner}
                        </motion.button>
                      );
                    }

                    return (
                      <motion.span
                        key={`${group.categoryId}-${termId}`}
                        {...motionProps}
                        className={`${TERM_SHELL} ${TERM_STATIC} ${group.tintClass}`}
                      >
                        {inner}
                      </motion.span>
                    );
                  })}
                </AnimatePresence>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Expand toggle: only shown when NOT expanded */}
      {!expanded && totalTerms > MAX_VISIBLE && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          aria-expanded={false}
          aria-label={`Show ${totalTerms - COLLAPSED_SHOW} more tasting notes`}
          className={`${BODY} flex items-center gap-1 text-tea-text-dim hover:text-tea-text-sec transition-colors mt-1 ml-0.5 min-h-[44px]`}
        >
          <span>{expandHint}</span>
          <ChevronDown size={10} />
        </button>
      )}
    </div>
  );
};

export const TastingProfileStrip = React.memo(TastingProfileStripInner);
TastingProfileStrip.displayName = 'TastingProfileStrip';
