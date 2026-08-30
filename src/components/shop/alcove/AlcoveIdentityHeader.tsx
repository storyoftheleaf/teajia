import React from 'react';
import type { InventoryItem } from '../../../types';

interface AlcoveIdentityHeaderProps {
  item: InventoryItem;
  productName: string;
  givenName: string;
  teaType: string;
  /** CJK-only characters (already stripped of latin/digits), rendered as real text under the name. */
  chineseCharacters: string;
  /** Type-color dot from getTeaColor(item.type). */
  typeColor: string;
  /**
   * Verbatim type label for the sub-line. When omitted, the tea default is
   * derived from teaType ("Green" → "Green tea"). Teaware passes its raw type
   * ("Gaiwan") so no " tea" suffix is appended.
   */
  typeLabel?: string;
  isAdmin?: boolean;
  onNavigateSource: () => void;
  /**
   * 'plain' is the modal card's header, type straight onto the card.
   * 'plate' sets the same identity on a field of the label stock, the way
   * the tea's own printed label reads in the hand. The plate is a LIGHT
   * surface inside a dark interface, so its type uses the plate ink pair
   * rather than the page's text tokens.
   */
  variant?: 'plain' | 'plate';
  /**
   * The shop's own sentence about this tea, set in italic under the rule.
   * Only on the plate, and only when the record carries one: an empty
   * standfirst is better than an invented one.
   */
  standfirst?: string;
  /** How the tea is sold, at the foot of the plate. */
  footNote?: string;
}

/**
 * Quiet-card header: centered serif identity block.
 * Tea name in Cormorant, hanzi as real text (the watermark is retired),
 * then a tracked sub-line with the type-color dot.
 */
export const AlcoveIdentityHeader: React.FC<AlcoveIdentityHeaderProps> = ({
  item,
  productName,
  givenName,
  teaType,
  chineseCharacters,
  typeColor,
  typeLabel: typeLabelProp,
  isAdmin,
  onNavigateSource,
  variant = 'plain',
  standfirst,
  footNote,
}) => {
  const onPlate = variant === 'plate';
  const typeLabel = typeLabelProp ?? (teaType
    ? /tea/i.test(teaType) ? teaType : `${teaType} tea`
    : '');
  // The prominent title is the GIVEN name when there is one (a human-assigned
  // name for the tea, e.g. "Silent Forest"). Fall back to the product name.
  // A given name that is empty, "unknown", or identical to the product name is
  // not a real name. Hide it and use the product name.
  const hasGivenName = Boolean(givenName.trim()) && !/^unknown$/i.test(givenName.trim());
  const title = hasGivenName && givenName.trim() !== productName.trim() ? givenName : productName;
  // When the given name is not the title, keep it at the end of the sub-line so
  // the distinguishing descriptor is not lost.
  const subLine = [givenName.trim() !== productName.trim() ? givenName : '', typeLabel].filter(Boolean).join(' · ');

  return (
    <header
      className={
        onPlate
          ? 'label-plate mx-4 mt-2 flex flex-col justify-center px-7 pb-8 pt-20 text-center sm:mx-5 lg:mx-6 lg:mb-8 lg:min-h-[560px] lg:flex-1 lg:pb-14 lg:pt-14'
          : 'px-6 pt-7 pb-5 text-center'
      }
    >
      <h1
        id={`alcove-title-${item.id}`}
        className={`m-0 font-display font-normal leading-[1.04] tracking-[0.01em] [text-wrap:balance] ${
          onPlate ? 'plate-ink text-[36px] lg:text-[40px]' : 'text-ui-28 leading-[1.12] text-tea-text'
        }`}
      >
        {title}
      </h1>
      {chineseCharacters && (
        <p
          lang="zh"
          className={`m-0 font-calligraphy leading-none tracking-[0.3em] indent-[0.3em] ${
            onPlate ? 'plate-ink-sec mt-[13px] text-ui-20' : 'mt-[7px] text-ui-17 text-tea-gold-lt'
          }`}
        >
          {chineseCharacters}
        </p>
      )}
      {subLine && (
        <p
          className={`m-0 flex flex-wrap items-center justify-center gap-x-2 font-sans uppercase tracking-[0.2em] ${
            onPlate ? 'plate-ink-sec mt-[15px] text-ui-10' : 'mt-[11px] text-ui-10 text-tea-text-sec'
          }`}
        >
          <span
            aria-hidden="true"
            className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ background: typeColor }}
          />
          <span>{subLine}</span>
        </p>
      )}
      {onPlate && (standfirst || footNote) && (
        <>
          <div aria-hidden="true" className="mx-auto mt-7 h-px w-8 bg-[rgba(36,29,19,0.35)]" />
          {standfirst && (
            <p className="plate-ink-sec mx-auto mt-7 max-w-[34ch] font-body text-ui-15 italic leading-[1.65]">
              {standfirst}
            </p>
          )}
          {footNote && (
            <p className="plate-ink-sec mt-9 font-sans text-ui-10 uppercase tracking-[0.2em]">{footNote}</p>
          )}
        </>
      )}

      {/* Vendor / Source: admin-only link to source profile */}
      {item.supplier && isAdmin && (
        <div className="pt-1">
          <button type="button" onClick={onNavigateSource} className="alcove-source-link">
            Source: {item.supplier}
          </button>
        </div>
      )}
    </header>
  );
};
