// src/admin/components/ImmersivePreview.tsx
// AR.5 live preview: renders the current block stack through the REAL immersive
// reader section components (renderBlock), so what Adrian arranges in the editor
// is exactly what publishes. A width toggle frames the same blocks at phone
// (390px) and desktop (1024px) so both forms are visible without leaving the
// editor. The desktop frame is scaled down to fit the narrow editor pane; the
// content renders at true width inside, then transforms to fit (transform only,
// GPU-safe). Reading-progress and scroll-highlight are scroll-driven against the
// real window, so this is a faithful arrangement preview, not a perfect runtime.
import React, { useState } from 'react';
import type { ArticleBlock } from '../../types';
import { renderBlock } from '../../components/immersive/sections';
import '../../styles/reader-animations.css';

type PreviewWidth = 'phone' | 'desktop';

const FRAME: Record<PreviewWidth, { w: number; label: string }> = {
  phone: { w: 390, label: 'Phone' },
  desktop: { w: 1024, label: 'Desktop' },
};

export const ImmersivePreview: React.FC<{ blocks: ArticleBlock[] }> = ({ blocks }) => {
  const [width, setWidth] = useState<PreviewWidth>('phone');

  return (
    <div className="flex flex-col h-full bg-tea-bg">
      {/* Width toggle — text labels per brand law (no icons) */}
      <div className="flex items-center gap-1 px-4 py-2.5 border-b border-tea-border shrink-0">
        <span className="text-ui-10 uppercase tracking-[0.18em] text-tea-text-dim mr-2">View</span>
        {(Object.keys(FRAME) as PreviewWidth[]).map(key => (
          <button
            key={key}
            type="button"
            onClick={() => setWidth(key)}
            className={`px-3 py-1 rounded-full text-ui-11 tracking-[0.06em] transition-colors ${
              width === key
                ? 'bg-tea-gold text-tea-bg'
                : 'text-tea-text-sec hover:text-tea-text bg-tea-elevated'
            }`}
          >
            {FRAME[key].label}
          </button>
        ))}
        <span className="ml-auto text-ui-10 text-tea-text-dim tabular-nums">{FRAME[width].w}px</span>
      </div>

      {/* Scroll surface holding the framed render */}
      <div data-testid="immersive-preview-scroll" className="flex-1 overflow-auto bg-tea-bg">
        {blocks.length === 0 ? (
          <div className="flex items-center justify-center h-40">
            <p className="text-ui-12 text-tea-text-dim">Nothing to preview yet. Add blocks in the editor.</p>
          </div>
        ) : (
          <PreviewFrame width={width}>
            <div className="bg-tea-bg text-tea-text" data-testid="immersive-preview-article">
              {blocks.map((block, i) => renderBlock(block, i))}
            </div>
          </PreviewFrame>
        )}
      </div>
    </div>
  );
};

// Frames the true-width render and scales it to fit the editor pane. The phone
// frame fits as-is in most editor widths; the desktop frame scales down via a
// container-query-free fixed approach: render at FRAME.w then scale by the pane
// width measured at mount + resize. Scale uses transform (compositable).
const PreviewFrame: React.FC<{ width: PreviewWidth; children: React.ReactNode }> = ({ width, children }) => {
  const outerRef = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const target = FRAME[width].w;

  React.useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const measure = () => {
      const avail = el.clientWidth - 24; // mat padding
      setScale(avail >= target ? 1 : Math.max(0.2, avail / target));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [target]);

  return (
    <div ref={outerRef} className="flex justify-center px-3 py-4">
      <div
        className="rounded-xl overflow-hidden border border-tea-border shadow-xl"
        style={{
          width: target,
          transform: `scale(${scale})`,
          transformOrigin: 'top center',
          // collapse the visual footprint to the scaled height so the scroll
          // area does not reserve full unscaled space
          marginBottom: scale < 1 ? `calc((${scale} - 1) * 100%)` : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
};
