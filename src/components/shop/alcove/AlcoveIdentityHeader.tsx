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
   * the tea's own printed label reads in the hand. The plate is its own
   * surface, cream on parchment and printed black on the dark page, so its
   * type uses the plate ink classes rather than the page's text tokens.
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
/**
 * The label stock, ported verbatim from the design file.
 *
 * A fractal field posterised into soft strata by three table transfers, one
 * per channel, which is what puts the cloud in it; then a second, finer
 * turbulence composited over as the speckle in the paper. The tables are
 * lifted so any crop of it lands in the cream family rather than wherever the
 * noise happens to sit.
 *
 * Two of them, because the plate is cream on parchment and printed black on
 * the dark page, and card-utilities.css picks by theme. The night stock is the
 * SAME field with the tables remapped into the black: each channel keeps its
 * six-step shape, so the cloud survives at a floor about a twentieth of the
 * cream's. Glazing the cream one down instead was the obvious move and the
 * wrong one, because an overlay heavy enough to reach black collapses the span to
 * roughly a single value and leaves a flat panel. The speckle goes with it,
 * warmed down to a dim fibre so it reads as the paper rather than dust.
 *
 * The night tables carry a further 20% off the saturation, each endpoint moved
 * a fifth of the way to its own luminance, which is why they are not round
 * numbers. Keeping the span and only draining the chroma is the point: the
 * brown reads less like a stain and the cloud is untouched.
 *
 * Rendered once per plate. It costs a filter pass, which is why the element it
 * paints is a fixed background layer rather than anything that reflows; the
 * unused one costs nothing, since a filter def is only evaluated where a
 * `filter: url(...)` actually references it.
 */
const LabelStockFilter: React.FC = () => (
  <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: 'absolute' }}>
    <defs>
      <filter id="teajia-label-stock" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.0016 0.0030" numOctaves={6} seed={29} result="f" />
        <feColorMatrix
          in="f"
          type="matrix"
          values="0.34 0.33 0.33 0 0  0.34 0.33 0.33 0 0  0.34 0.33 0.33 0 0  0 0 0 0 1"
          result="l"
        />
        <feComponentTransfer in="l" result="b">
          <feFuncR type="table" tableValues="0.60 1.00 0.68 1.00 0.76 1.00" />
          <feFuncG type="table" tableValues="0.50 0.95 0.59 0.97 0.68 0.99" />
          <feFuncB type="table" tableValues="0.34 0.79 0.43 0.84 0.53 0.89" />
        </feComponentTransfer>
        <feTurbulence type="turbulence" baseFrequency="0.19" numOctaves={3} seed={8} result="c" />
        <feColorMatrix
          in="c"
          type="matrix"
          values="0 0 0 0 1  0 0 0 0 0.98  0 0 0 0 0.93  0.8 0.2 0.2 0 -0.58"
          result="ck"
        />
        <feComposite in="ck" in2="b" operator="over" />
      </filter>
      <filter id="teajia-label-stock-night" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.0016 0.0030" numOctaves={6} seed={29} result="f" />
        <feColorMatrix
          in="f"
          type="matrix"
          values="0.34 0.33 0.33 0 0  0.34 0.33 0.33 0 0  0.34 0.33 0.33 0 0  0 0 0 0 1"
          result="l"
        />
        <feComponentTransfer in="l" result="b">
          <feFuncR type="table" tableValues="0.0289 0.1265 0.0484 0.1265 0.0679 0.1265" />
          <feFuncG type="table" tableValues="0.0241 0.0946 0.0382 0.0978 0.0523 0.1009" />
          <feFuncB type="table" tableValues="0.0169 0.0634 0.0262 0.0685 0.0365 0.0737" />
        </feComponentTransfer>
        <feTurbulence type="turbulence" baseFrequency="0.19" numOctaves={3} seed={8} result="c" />
        <feColorMatrix
          in="c"
          type="matrix"
          values="0 0 0 0 0.59  0 0 0 0 0.55  0 0 0 0 0.47  0.8 0.2 0.2 0 -0.7"
          result="ck"
        />
        <feComposite in="ck" in2="b" operator="over" />
      </filter>
    </defs>
  </svg>
);

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
          ? 'label-plate mx-[18px] mt-2 flex h-[396px] flex-col justify-end px-7 pb-[38px] text-center lg:m-0 lg:h-full lg:min-h-[900px] lg:justify-start lg:px-[clamp(22px,4.3vw,62px)] lg:pb-0 lg:pt-[clamp(120px,20vw,300px)]'
          : 'px-6 pt-7 pb-5 text-center'
      }
    >
      {onPlate && (
        <>
          <LabelStockFilter />
          <span aria-hidden="true" className="label-plate__stock" />
          <span aria-hidden="true" className="label-plate__veil" />
        </>
      )}
      <h1
        id={`alcove-title-${item.id}`}
        className={`m-0 font-display font-normal leading-[1.02] tracking-[0.005em] [text-wrap:balance] lg:leading-none ${
          onPlate ? 'plate-ink text-[40px] lg:text-[clamp(32px,4vw,58px)]' : 'text-ui-28 leading-[1.12] text-tea-text'
        }`}
      >
        {title}
      </h1>
      {chineseCharacters && (
        <p
          lang="zh"
          className={`m-0 font-calligraphy leading-none tracking-[0.3em] indent-[0.3em] lg:tracking-[0.32em] lg:indent-[0.32em] ${
            onPlate ? 'plate-ink-han mt-[13px] text-[19px] lg:mt-6 lg:text-[clamp(18px,1.9vw,27px)]' : 'mt-[7px] text-ui-17 text-tea-gold-lt'
          }`}
        >
          {chineseCharacters}
        </p>
      )}
      {subLine && (
        <p
          className={`m-0 flex flex-wrap items-center justify-center font-sans uppercase tracking-[0.22em] ${
            onPlate
              ? 'plate-ink-sec mt-[15px] gap-x-2 text-ui-10 lg:mt-[22px] lg:gap-x-[9px] lg:text-ui-11'
              : 'mt-[11px] gap-x-2 text-ui-10 text-tea-text-sec'
          }`}
        >
          <span
            aria-hidden="true"
            className={`inline-block shrink-0 rounded-full ${onPlate ? 'h-1.5 w-1.5 lg:h-[7px] lg:w-[7px]' : 'h-1.5 w-1.5'}`}
            style={{ background: typeColor }}
          />
          <span>{subLine}</span>
        </p>
      )}
      {onPlate && standfirst && (
        <div className="hidden lg:block">
          <div aria-hidden="true" className="plate-rule mx-auto mt-[38px] h-px w-[34px]" />
          <p className="plate-ink-body mx-auto mt-8 max-w-[340px] font-body text-ui-17 italic leading-[1.65]">
            {standfirst}
          </p>
        </div>
      )}
      {onPlate && footNote && (
        <p className="plate-ink-sec absolute inset-x-0 bottom-[58px] m-0 hidden font-sans text-ui-10 uppercase tracking-[0.22em] tabular-nums lg:block">
          {footNote}
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
