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

export type TastingStripLinkMode = 'remove' | 'shop-filter';

interface TastingProfileStripProps {
  value?: TastingData;
  tasting?: TastingData;
  onRemove?: (categoryId: TastingCategoryId, termId: string) => void;
  variant?: string | 'cloud';
  /**
   * Interaction mode for individual term chips.
   * - 'remove' (default): clicking fires onRemove — for editing contexts.
   * - 'shop-filter': chips become <Link>s to /shop?flavor=<id> or /shop?feel=<id>.
   */
  linkMode?: TastingStripLinkMode;
}

function shopFilterHref(categoryId: string, termId: string): string | null {
  if (categoryId === 'flavor') return `/shop?flavor=${encodeURIComponent(termId)}`;
  if (categoryId === 'feeling') return `/shop?feel=${encodeURIComponent(termId)}`;
  return null;
}

const CATEGORY_DOT_COLORS: Record<string, string> = {
  body: '#a08060',
  feeling: '#7a9a80',
  flavor: '#9a7a6a',
  finish: '#8a8a72',
  'liquor-color': '#8a7a6a',
};

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

/** Category header font weight classes */
const CATEGORY_LABEL_CLASS: Record<string, string> = {
  flavor: 'font-semibold text-tea-text-dim',
  body: 'font-medium text-tea-text-dim',
  finish: 'font-medium text-tea-text-dim',
  feeling: 'font-normal text-tea-text-dim/70',
  'liquor-color': 'font-normal text-tea-text-dim/70',
};

/** Category-specific tint classes for term backgrounds */
const CATEGORY_TINT_CLASSES: Record<string, string> = {
  flavor: 'bg-tea-gold/8',
  body: 'bg-tea-surface',
  finish: 'bg-tea-surface',
  feeling: 'bg-tea-accent-sub/30',
  'liquor-color': 'bg-tea-surface',
};

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
      tintClass: CATEGORY_TINT_CLASSES[catId] || 'bg-tea-surface',
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
        {/* Legend row — non-color categories only */}
        {activeCats.length > 1 && (
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {activeCats.map(group => (
              <span key={group.categoryId} className="inline-flex items-center gap-1 text-ui-12 text-tea-text-dim tracking-wide uppercase">
                <span className="shrink-0 rounded-full" style={{ width: 5, height: 5, background: CATEGORY_DOT_COLORS[group.categoryId] ?? '#8a8a80', display: 'inline-block', opacity: 0.9 }} />
                {CATEGORY_LABELS[group.categoryId] ?? group.categoryId}
              </span>
            ))}
          </div>
        )}

        {/* Tag cloud — all non-color terms */}
        <div className="flex flex-wrap gap-1.5">
          {nonColorGroups.map(group =>
            group.terms.map(termId => {
              const dotColor = CATEGORY_DOT_COLORS[group.categoryId] ?? '#8a8a80';
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
                  <span className="shrink-0 rounded-full" style={{ width: 6, height: 6, background: dotColor, display: 'inline-block', opacity: 0.7 }} />
                  {label}
                  {onRemove && <X size={8} className="shrink-0 opacity-0 group-hover:opacity-50 transition-opacity" />}
                </button>
              );
            })
          )}

          {/* Liquor-color swatches — rendered as color circles, not text pills */}
          {colorGroup?.terms.map(termId => {
            const hex = LIQUOR_COLORS[termId] ?? '#888';
            const label = resolveTermLabel(termId);
            return (
              <button
                key={`liquor-${termId}`}
                type="button"
                title={label}
                onClick={() => onRemove?.('liquor-color', termId)}
                className="tap-target group inline-flex min-h-11 items-center gap-1.5 px-2 py-1 rounded-full text-ui-12 text-tea-text-dim hover:text-tea-text transition-colors"
                aria-label={onRemove ? `Remove ${label}` : label}
                style={{ background: `${hex}22`, border: `1px solid ${hex}55` }}
              >
                <span className="shrink-0 rounded-full" style={{ width: 10, height: 10, background: hex, display: 'inline-block', boxShadow: `0 0 0 1px ${hex}80` }} />
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
          className="flex items-center gap-1 text-ui-10 text-tea-text-dim hover:text-tea-text-sec transition-colors ml-0.5 min-h-[44px]"
          style={{ fontFamily: 'var(--font-body)' }}
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
          const labelClass = CATEGORY_LABEL_CLASS[group.categoryId] || 'font-medium text-tea-text-dim';

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
                <span
                  className={`text-ui-10 uppercase tracking-[0.12em] ${labelClass}`}
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {group.label}
                </span>
                <button
                  type="button"
                  onClick={() => onRemove?.(group.categoryId, termId)}
                  className="group flex items-center gap-1 ml-1"
                >
                  {hex ? (
                    <span
                      className="shrink-0 rounded-full"
                      style={{ width: 12, height: 12, background: hex, display: 'inline-block' }}
                    />
                  ) : Icon ? (
                    <Icon size={11} className="shrink-0 text-tea-text-sec" />
                  ) : null}
                  <span className="text-ui-10 text-tea-text-sec">{termLabel}</span>
                  <X
                    size={9}
                    className="shrink-0 opacity-0 group-hover:opacity-60 transition-opacity"
                  />
                </button>
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
              {/* Category label with icon */}
              <div
                className={`flex items-center gap-1 text-ui-11 uppercase tracking-[0.15em] ${labelClass} mb-1 ml-0.5`}
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {HeaderIcon && <HeaderIcon size={9} className="shrink-0" />}
                {group.label}
              </div>

              {/* Terms row with category-tinted backgrounds */}
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
                        <span
                          className={href ? 'underline decoration-tea-gold/35 decoration-[1px] underline-offset-[3px] group-hover:decoration-tea-gold transition-colors' : ''}
                        >
                          {label}
                        </span>
                        {linkMode === 'remove' && (
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
                      className: `tag group shrink-0 cursor-pointer hover:bg-tea-gold/14 transition-colors ${group.tintClass}`,
                    };

                    if (href) {
                      return (
                        <motion.span key={`${group.categoryId}-${termId}`} {...motionProps}>
                          <Link to={href} className="flex items-center gap-1.5">
                            {inner}
                          </Link>
                        </motion.span>
                      );
                    }

                    return (
                      <motion.button
                        key={`${group.categoryId}-${termId}`}
                        type="button"
                        {...motionProps}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => onRemove?.(group.categoryId, termId)}
                      >
                        {inner}
                      </motion.button>
                    );
                  })}
                </AnimatePresence>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Expand toggle — only shown when NOT expanded */}
      {!expanded && totalTerms > MAX_VISIBLE && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          aria-expanded={false}
          aria-label={`Show ${totalTerms - COLLAPSED_SHOW} more tasting notes`}
          className="flex items-center gap-1 text-ui-10 text-tea-text-dim hover:text-tea-text-sec transition-colors mt-1 ml-0.5 min-h-[44px]"
          style={{ fontFamily: 'var(--font-body)' }}
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
