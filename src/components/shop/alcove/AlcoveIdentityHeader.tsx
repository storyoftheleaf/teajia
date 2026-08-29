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
}) => {
  const typeLabel = typeLabelProp ?? (teaType
    ? /tea/i.test(teaType) ? teaType : `${teaType} tea`
    : '');
  // The prominent title is the GIVEN name when there is one (a human-assigned
  // name for the tea, e.g. "Silent Forest"). Fall back to the product name.
  // A given name that is empty, "unknown", or identical to the product name is
  // not a real name — hide it and use the product name.
  const hasGivenName = Boolean(givenName.trim()) && !/^unknown$/i.test(givenName.trim());
  const title = hasGivenName && givenName.trim() !== productName.trim() ? givenName : productName;
  // When the given name is not the title, keep it at the end of the sub-line so
  // the distinguishing descriptor is not lost.
  const subLine = [givenName.trim() !== productName.trim() ? givenName : '', typeLabel].filter(Boolean).join(' · ');

  return (
    <header className="px-6 pt-7 pb-5 text-center">
      <h1
        id={`alcove-title-${item.id}`}
        className="m-0 font-display text-ui-28 font-normal leading-[1.12] tracking-[0.01em] text-tea-text [text-wrap:balance]"
      >
        {title}
      </h1>
      {chineseCharacters && (
        <p
          lang="zh"
          className="m-0 mt-[7px] font-calligraphy text-ui-17 leading-none text-tea-gold-lt tracking-[0.34em] indent-[0.34em]"
        >
          {chineseCharacters}
        </p>
      )}
      {subLine && (
        <p className="m-0 mt-[11px] flex flex-wrap items-center justify-center gap-x-2 font-sans text-ui-10 uppercase tracking-[0.18em] text-tea-text-sec">
          <span
            aria-hidden="true"
            className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ background: typeColor }}
          />
          <span>{subLine}</span>
        </p>
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
