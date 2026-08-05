import React from 'react';

interface AlcoveShellProps {
  /**
   * The card's own surface colour, as a token reference.
   *
   * Kept as a prop because the teaware card asks for a different one, but it is
   * handed to CSS as a custom property rather than painted inline, so the value
   * that actually lands is declared in card-utilities.css where the colour lint
   * can read it.
   */
  alcoveBg?: string;
  chineseCharacters: string;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  showFade: boolean;
  children: React.ReactNode;
  commerceFooter: React.ReactNode;
  modals: React.ReactNode;
  /** Override grain layer opacity (default: 0.05) */
  grainOpacity?: number;
  /** Override the two radial warmth opacities [inner, outer] (defaults: [0.055, 0.025]) */
  warmthOpacities?: [number, number];
  /**
   * Optional space-separated "r g b" string to tint the two radial warmth
   * gradients from (e.g. the tea's liquor colour). Same opacities as the
   * bronze defaults.
   *
   * Space-separated, not comma-separated, because it is handed to CSS as a
   * custom property that lands inside `rgb(<channels> / <alpha>)` alongside
   * `--tea-gold-rgb`, which is written the same way. A comma form parses as a
   * legacy three-argument rgb() and takes the whole declaration down with it.
   */
  warmthRGB?: string;
}

/**
 * The card's frame: surface, warmth, grain, watermark, scroll, fade.
 *
 * Every colour here used to be an inline style, and two of them were literal
 * rgba triples that no longer matched any token. `npm run lint:colors` reads
 * className strings, so the surface carrying the most colour in the shop was
 * the one surface the colour rules could not see at all. The layers are now
 * classes; only the two opacity numbers stay inline, because a number is not a
 * colour and the lint has no opinion about it.
 */
export const AlcoveShell: React.FC<AlcoveShellProps> = ({
  alcoveBg,
  chineseCharacters,
  scrollRef,
  showFade,
  children,
  commerceFooter,
  modals,
  grainOpacity = 0.05,
  warmthOpacities = [0.055, 0.025],
  warmthRGB,
}) => {
  return (
    <div
      className="alcove-shell"
      style={{
        ...(alcoveBg ? { ['--alcove-bg' as string]: alcoveBg } : {}),
        ...(warmthRGB ? { ['--alcove-warmth-rgb' as string]: warmthRGB } : {}),
        ['--alcove-grain' as string]: grainOpacity,
        ['--alcove-warmth-inner' as string]: warmthOpacities[0],
        ['--alcove-warmth-outer' as string]: warmthOpacities[1],
      }}
    >
      {/* Layer 1: multi-stop radial warmth. Layer 2: fine noise grain. */}
      <div className="alcove-warmth" />
      <div className="alcove-grain" />

      {/* Vertical calligraphy watermark, top-right, flowing down like a hanging scroll. */}
      {chineseCharacters && (
        <div className="alcove-watermark">{chineseCharacters}</div>
      )}

      {/* Scrollable middle. */}
      <div ref={scrollRef} className="tea-card-scroll alcove-scroll">
        {children}
      </div>

      {commerceFooter}

      {/* Fade indicator at the bottom of the scrollable area, above pinned commerce. */}
      <div className="alcove-fade-anchor">
        <div className="alcove-fade" data-visible={showFade} />
      </div>

      {modals}
    </div>
  );
};
