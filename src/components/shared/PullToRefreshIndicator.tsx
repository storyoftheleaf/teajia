import React from 'react';

interface PullToRefreshIndicatorProps {
  pullDistance: number;
  isRefreshing: boolean;
  progress: number;
}

// A single, calm tea-leaf glyph — one closed leaf with a centre vein, not the
// old tangle of five strokes. Sits inside the progress ring.
const TeaLeaf: React.FC<{ filled: boolean }> = ({ filled }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" style={{ display: 'block' }}>
    <path
      d="M12 3C8 6 6.5 11 8 16c1 3.2 2.4 4.4 4 5 1.6-.6 3-1.8 4-5 1.5-5 0-10-4-13Z"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
      opacity={filled ? 0.9 : 1}
    />
    <path d="M12 6.5V19" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" opacity={filled ? 0.5 : 0.7} />
  </svg>
);

/**
 * Pull-to-refresh chip in the aged-bronze register: a thin ring that traces
 * itself as you pull, a single tea leaf at its centre, and a smooth continuous
 * rotation while refreshing (no jerky CSS spin, no heavy solid-gold fill).
 */
export const PullToRefreshIndicator: React.FC<PullToRefreshIndicatorProps> = ({
  pullDistance,
  isRefreshing,
  progress,
}) => {
  if (pullDistance <= 0 && !isRefreshing) return null;

  const atThreshold = progress >= 1;
  const accent = atThreshold || isRefreshing;

  // Ring geometry — a 36px chip with a hairline track and a bronze arc.
  const R = 15;
  const CIRC = 2 * Math.PI * R;
  // While refreshing show a fixed ~70% arc that the wrapper spins; while pulling
  // the arc length tracks the pull progress so the ring "draws" itself.
  const dash = isRefreshing ? CIRC * 0.7 : CIRC * Math.min(progress, 1);

  return (
    <div
      className="fixed top-[env(safe-area-inset-top)] left-0 right-0 z-modal flex items-center justify-center pointer-events-none"
      style={{
        transform: `translateY(${pullDistance}px)`,
        opacity: Math.min(progress * 1.6, 1),
      }}
    >
      <div
        className="-mt-7 rounded-full"
        style={{
          background: 'var(--tea-surface, #1b160f)',
          boxShadow: '0 6px 20px -6px rgba(0,0,0,0.55), 0 0 0 1px rgba(168,135,77,0.16)',
          padding: 6,
          // A gentle settle as the chip appears / lands on threshold.
          transform: `scale(${isRefreshing ? 1 : 0.82 + progress * 0.18})`,
          transition: 'transform 0.18s cubic-bezier(0.22,0.61,0.36,1)',
        }}
      >
        <div
          style={{
            position: 'relative',
            width: 36,
            height: 36,
            animation: isRefreshing ? 'tjPtrSpin 0.9s linear infinite' : undefined,
          }}
        >
          <svg width="36" height="36" viewBox="0 0 36 36" style={{ display: 'block', transform: 'rotate(-90deg)' }}>
            {/* track */}
            <circle cx="18" cy="18" r={R} fill="none" stroke="rgba(168,135,77,0.14)" strokeWidth="2" />
            {/* progress / refreshing arc */}
            <circle
              cx="18"
              cy="18"
              r={R}
              fill="none"
              stroke={accent ? 'var(--tea-gold, #a8874d)' : 'rgba(205,192,168,0.55)'}
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${CIRC}`}
              style={{ transition: isRefreshing ? undefined : 'stroke-dasharray 0.08s linear, stroke 0.2s ease' }}
            />
          </svg>
          {/* leaf, centred over the ring; eases up to full as you near threshold */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: accent ? 'var(--tea-gold, #a8874d)' : 'var(--tea-text-sec, #80735f)',
              transform: isRefreshing ? undefined : `scale(${0.7 + progress * 0.3})`,
              transition: isRefreshing ? undefined : 'transform 0.12s ease-out, color 0.2s ease',
            }}
          >
            <TeaLeaf filled={atThreshold} />
          </div>
        </div>
      </div>
      <style>{`@keyframes tjPtrSpin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
};
