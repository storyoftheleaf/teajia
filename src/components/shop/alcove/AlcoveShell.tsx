import React from 'react';

interface AlcoveShellProps {
  alcoveBg: string;
  chineseCharacters: string;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  showFade: boolean;
  children: React.ReactNode;
  commerceFooter: React.ReactNode;
  modals: React.ReactNode;
  /** Override grain layer opacity (default: 0.06) */
  grainOpacity?: number;
  /** Override the two radial warmth opacities [inner, outer] (defaults: [0.09, 0.05]) */
  warmthOpacities?: [number, number];
}

export const AlcoveShell: React.FC<AlcoveShellProps> = ({
  alcoveBg,
  chineseCharacters,
  scrollRef,
  showFade,
  children,
  commerceFooter,
  modals,
  grainOpacity = 0.06,
  warmthOpacities = [0.09, 0.05],
}) => {
  return (
    <div style={{
      width: "100%",
      height: "100%",
      maxHeight: "100%",
      background: alcoveBg,
      position: "relative",
      overflow: "hidden",
      borderRadius: "3px",
      display: "flex",
      flexDirection: "column",
    }}>

      {/* Layer 1: Multi-stop radial warmth */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: `
          radial-gradient(ellipse 70% 50% at 85% 8%, rgba(180,120,40,${warmthOpacities[0]}) 0%, transparent 60%),
          radial-gradient(ellipse 50% 40% at 90% 0%, rgba(200,140,50,${warmthOpacities[1]}) 0%, transparent 50%)
        `,
      }} />

      {/* Layer 2: Fine noise grain */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none", opacity: grainOpacity,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        backgroundSize: "120px",
      }} />

      {/* Vertical calligraphy watermark — top-right, flowing down like a hanging scroll */}
      {chineseCharacters && (
        <div style={{
          position: "absolute", right: "16px", bottom: "90px",
          writingMode: "vertical-rl",
          fontFamily: "'Ma Shan Zheng', cursive",
          fontSize: "92px", fontWeight: 400, lineHeight: 1,
          color: "var(--tea-text-dim)",
          letterSpacing: "0.18em",
          userSelect: "none", pointerEvents: "none",
          whiteSpace: "nowrap",
          opacity: 0.065,
          zIndex: 4,
        }}>
          {chineseCharacters}
        </div>
      )}

      {/* === SCROLLABLE MIDDLE === */}
      <div ref={scrollRef} className="tea-card-scroll" style={{
        position: "relative", zIndex: 1,
        flex: 1,
        overflowY: "auto",
        minHeight: 0,
      }}>
        {children}
      </div>

      {commerceFooter}

      {/* Fade indicator at bottom of scrollable area, above pinned commerce */}
      <div style={{
        position: "relative", flexShrink: 0, height: 0,
        pointerEvents: "none", zIndex: 2,
      }}>
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: "24px",
          background: `linear-gradient(to top, ${alcoveBg}, transparent)`,
          opacity: showFade ? 1 : 0,
          transition: "opacity 0.3s ease",
        }} />
      </div>

      {modals}
    </div>
  );
};
