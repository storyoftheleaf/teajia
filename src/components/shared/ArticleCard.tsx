import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Icons } from '../Icons';
import { CardContainer } from './CardContainer';
import { useLongPress } from '../../hooks/useLongPress';

// ─── Torn-edge SVG clip-path variants ───────────────────────────────────────
// Each polygon traces the full rectangle perimeter with small y-axis irregularities
// on all four edges to simulate hand-torn paper.
const TORN_EDGE_PATHS = [
  // Variant 0
  'polygon(0% 1%, 8% 0%, 17% 2%, 26% 0%, 35% 1.5%, 44% 0%, 53% 2%, 62% 0.5%, 71% 1%, 80% 0%, 89% 1.5%, 100% 0%, 99% 12%, 100% 25%, 98.5% 38%, 100% 51%, 99% 64%, 100% 77%, 98.5% 90%, 100% 100%, 88% 98.5%, 76% 100%, 64% 98%, 52% 100%, 40% 98.5%, 28% 100%, 16% 98%, 4% 100%, 0.5% 88%, 0% 75%, 1% 62%, 0% 49%, 1% 36%, 0% 23%, 0.5% 10%)',
  // Variant 1
  'polygon(0% 0%, 11% 1.5%, 22% 0%, 33% 2%, 44% 0.5%, 55% 1%, 66% 0%, 77% 1.5%, 88% 0%, 100% 1%, 99% 15%, 100% 30%, 98% 45%, 100% 60%, 99.5% 75%, 100% 90%, 98.5% 100%, 86% 99%, 72% 100%, 58% 98.5%, 44% 100%, 30% 98%, 16% 100%, 2% 98.5%, 0% 85%, 1% 70%, 0% 55%, 1.5% 40%, 0% 25%, 1% 10%)',
  // Variant 2
  'polygon(0% 2%, 7% 0%, 18% 1.5%, 29% 0%, 40% 2%, 51% 0.5%, 62% 1.5%, 73% 0%, 84% 1%, 95% 0%, 100% 0.5%, 98.5% 13%, 100% 26%, 99% 39%, 100% 52%, 98.5% 65%, 100% 78%, 99% 91%, 100% 100%, 87% 99.5%, 74% 100%, 61% 98%, 48% 100%, 35% 98.5%, 22% 100%, 9% 98%, 0% 100%, 1% 87%, 0% 74%, 1.5% 61%, 0% 48%, 1% 35%, 0% 22%, 1.5% 9%)',
  // Variant 3
  'polygon(0% 1.5%, 9% 0%, 20% 2%, 31% 0.5%, 42% 1%, 53% 0%, 64% 2%, 75% 0.5%, 86% 1%, 97% 0%, 100% 1.5%, 99% 14%, 100% 28%, 99.5% 42%, 100% 56%, 98.5% 70%, 100% 84%, 99% 100%, 85% 98.5%, 70% 100%, 55% 98%, 40% 100%, 25% 98.5%, 10% 100%, 0% 99%, 1% 84%, 0% 68%, 1.5% 52%, 0% 36%, 1% 20%, 0% 4%)',
];

// ─── useGyroscopeTilt hook ───────────────────────────────────────────────────
interface TiltValues {
  rotateX: number;
  rotateY: number;
}

function useGyroscopeTilt(): TiltValues & { requestPermission: () => void; needsPermission: boolean } {
  const [tilt, setTilt] = useState<TiltValues>({ rotateX: 0, rotateY: 0 });
  const [needsPermission, setNeedsPermission] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);

  const clamp = (val: number, min: number, max: number) => Math.min(max, Math.max(min, val));

  const handleOrientation = useCallback((e: DeviceOrientationEvent) => {
    const beta = e.beta ?? 0;   // front/back tilt
    const gamma = e.gamma ?? 0; // left/right tilt
    setTilt({
      rotateX: clamp(beta * 0.06, -3, 3),
      rotateY: clamp(gamma * 0.06, -3, 3),
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('DeviceOrientationEvent' in window)) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const DOE = DeviceOrientationEvent as any;
    if (typeof DOE.requestPermission === 'function') {
      // iOS 13+ requires explicit permission
      setNeedsPermission(true);
      return;
    }

    // Non-iOS or older iOS — add listener directly
    window.addEventListener('deviceorientation', handleOrientation, true);
    return () => window.removeEventListener('deviceorientation', handleOrientation, true);
  }, [handleOrientation]);

  useEffect(() => {
    if (!permissionGranted) return;
    window.addEventListener('deviceorientation', handleOrientation, true);
    return () => window.removeEventListener('deviceorientation', handleOrientation, true);
  }, [permissionGranted, handleOrientation]);

  const requestPermission = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const DOE = DeviceOrientationEvent as any;
    if (typeof DOE.requestPermission === 'function') {
      try {
        const result = await DOE.requestPermission();
        if (result === 'granted') {
          setNeedsPermission(false);
          setPermissionGranted(true);
        }
      } catch {
        // Permission denied or unavailable
      }
    }
  }, []);

  return { ...tilt, requestPermission, needsPermission };
}

// ─── TornEdgeMask component ──────────────────────────────────────────────────
interface TornEdgeMaskProps {
  index: number;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

const TornEdgeMask: React.FC<TornEdgeMaskProps> = ({ index, children, className = '', disabled = false }) => {
  if (disabled) {
    return <div className={className}>{children}</div>;
  }
  const variant = index % 4;
  return (
    <div
      className={className}
      style={{ clipPath: TORN_EDGE_PATHS[variant] }}
    >
      {children}
    </div>
  );
};

// ─── TiltShiftOverlay component ──────────────────────────────────────────────
// Applies a miniature/tilt-shift focus effect: blurs top 30% and bottom 30%,
// leaving the center 40% sharp.
const TiltShiftOverlay: React.FC = () => (
  <>
    {/* Top blur band */}
    <div
      className="absolute inset-x-0 top-0 pointer-events-none z-[5]"
      style={{
        height: '30%',
        backdropFilter: 'blur(5px)',
        WebkitBackdropFilter: 'blur(5px)',
        maskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.8) 60%, rgba(0,0,0,0) 100%)',
        WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.8) 60%, rgba(0,0,0,0) 100%)',
      }}
    />
    {/* Bottom blur band */}
    <div
      className="absolute inset-x-0 bottom-0 pointer-events-none z-[5]"
      style={{
        height: '30%',
        backdropFilter: 'blur(5px)',
        WebkitBackdropFilter: 'blur(5px)',
        maskImage: 'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.8) 60%, rgba(0,0,0,0) 100%)',
        WebkitMaskImage: 'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.8) 60%, rgba(0,0,0,0) 100%)',
      }}
    />
  </>
);

// ─── ArticleCard props & component ───────────────────────────────────────────
interface ArticleCardProps {
  title: string;
  description?: string;
  imageUrl?: string;
  aspectRatio?: 'portrait' | 'square';
  slug?: string;
  onClick?: () => void;
  className?: string;
  duration?: string;
  wordCount?: number;
  isFeatured?: boolean;
  /** Index among sibling cards — used to select torn-edge variant */
  cardIndex?: number;
  /** If true, apply tilt-shift miniature effect (for landscape hero images) */
  tiltShift?: boolean;
  /** If true, skip torn-edge mask (e.g. full-bleed or circle layouts) */
  noTornEdge?: boolean;
}

export const ArticleCard: React.FC<ArticleCardProps> = ({
  title,
  description,
  imageUrl,
  aspectRatio = 'portrait',
  slug,
  onClick,
  className = '',
  duration,
  wordCount,
  isFeatured,
  cardIndex = 0,
  tiltShift = false,
  noTornEdge = true,
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const aspect = aspectRatio === 'portrait' ? 'aspect-[3/4]' : 'aspect-square';
  const hasImage = imageUrl && !imageError;

  const { rotateX, rotateY, requestPermission, needsPermission } = useGyroscopeTilt();

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside as unknown as EventListener);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside as unknown as EventListener);
    };
  }, [contextMenu]);

  const handleLongPress = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    const clientX = 'touches' in e ? e.touches[0]?.clientX ?? 0 : e.clientX;
    const clientY = 'touches' in e ? e.touches[0]?.clientY ?? 0 : e.clientY;
    const rect = cardRef.current?.getBoundingClientRect();
    if (rect) {
      setContextMenu({
        x: Math.min(clientX - rect.left, rect.width - 120),
        y: Math.min(clientY - rect.top, rect.height - 80),
      });
    }
  }, []);

  const handleContextAction = useCallback((action: string) => {
    setContextMenu(null);
    if (action === 'share' && navigator.share) {
      navigator.share({ title, text: description || title }).catch(() => {});
    }
    // "Save" is a no-op placeholder — parent can wire this up later
  }, [title, description]);

  const longPressHandlers = useLongPress({
    delay: 500,
    onLongPress: handleLongPress,
    onClick,
  });

  // Gyroscope tilt transform for hero image
  const tiltStyle: React.CSSProperties =
    (rotateX !== 0 || rotateY !== 0)
      ? { transform: `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)` }
      : {};

  return (
    <div
      ref={cardRef}
      className={`cursor-pointer group transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02] active:scale-[0.98] relative ${isFeatured ? 'article-card-hero' : ''} ${className}`}
      {...longPressHandlers}
    >
      <CardContainer className="p-0 overflow-hidden">
        <TornEdgeMask index={cardIndex} disabled={noTornEdge} className="w-full h-full">
          <div className={`relative w-full ${aspect} bg-tea-elevated`} style={tiltStyle}>
            {hasImage ? (
              <>
                {/* Skeleton shimmer — shown until image fully loaded */}
                {!imageLoaded && (
                  <div className="absolute inset-0 z-20 overflow-hidden bg-tea-elevated/40">
                    <div
                      className="absolute inset-0 animate-shimmer"
                      style={{
                        background: 'linear-gradient(90deg, transparent, var(--tea-border), transparent)',
                      }}
                    />
                  </div>
                )}

                <img
                  src={imageUrl}
                  alt={title}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:saturate-100 group-hover:contrast-100"
                  style={{
                    // Blur-up progressive loading: start blurred+desaturated, reveal on load
                    filter: imageLoaded
                      ? 'saturate(0.88) contrast(1.03) blur(0px)'
                      : 'saturate(0) contrast(1) blur(12px)',
                    transform: imageLoaded ? 'scale(1)' : 'scale(1.05)',
                    transition: 'filter 0.6s ease, transform 0.6s ease',
                    willChange: 'filter, transform',
                  }}
                  onLoad={() => setImageLoaded(true)}
                  onError={() => {
                    setImageLoaded(true);
                    setImageError(true);
                  }}
                />

                {/* Paper texture overlay */}
                <div
                  className="absolute inset-0 opacity-[0.07] mix-blend-overlay pointer-events-none z-10"
                  style={{
                    backgroundImage: 'url("https://www.transparenttextures.com/patterns/cream-paper.png")',
                  }}
                />

                {/* Vignette overlay — editorial depth */}
                <div className="article-card-vignette" />

                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent opacity-80 group-hover:opacity-90 transition-opacity duration-500" />

                {/* Optional tilt-shift miniature effect (landscape/panoramic photos) */}
                {tiltShift && <TiltShiftOverlay />}
              </>
            ) : (
              <>
                {/* No-image fallback */}
                <div className="absolute inset-0 bg-tea-elevated flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full border border-tea-gold/10 flex items-center justify-center">
                    <Icons.BookOpen className="w-5 h-5 text-tea-text/30" />
                  </div>
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-transparent" />
              </>
            )}

            {/* Gold accent line — grows on hover */}
            <div className="article-card-accent" />

            {/* iOS gyroscope permission button — only shown when needed */}
            {needsPermission && (
              <button
                onClick={(e) => { e.stopPropagation(); requestPermission(); }}
                className="absolute bottom-3 left-3 z-20 px-2 py-1 text-[10px] rounded-sm bg-tea-surface/70 text-tea-text-sec backdrop-blur-sm transition-opacity duration-200 opacity-60 hover:opacity-100"
              >
                Enable tilt
              </button>
            )}

            {/* Bottom text overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
              <h3 className="font-serif text-[17px] md:text-[21px] text-tea-text leading-[1.15] tracking-[0.01em] line-clamp-2 mb-1 group-hover:text-tea-gold transition-colors duration-500">
                {title}
              </h3>
              {description && (
                <p className="text-[10px] text-tea-text-sec uppercase tracking-[0.2em] font-sans line-clamp-1 lg:line-clamp-none">
                  {description}
                </p>
              )}
            </div>
          </div>
        </TornEdgeMask>

        {/* Long-press context menu */}
        {contextMenu && (
          <div
            className="absolute z-30 bg-tea-elevated shadow-2xl rounded-sm overflow-hidden animate-[scaleIn_0.15s_ease-out] origin-top-left"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              onClick={(e) => { e.stopPropagation(); handleContextAction('save'); }}
              className="flex items-center gap-2 px-4 py-2.5 text-xs text-tea-text hover:bg-tea-gold/10 transition-colors w-full text-left"
            >
              <Icons.Leaf className="w-3.5 h-3.5 text-tea-gold" />
              Save
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleContextAction('share'); }}
              className="flex items-center gap-2 px-4 py-2.5 text-xs text-tea-text hover:bg-tea-gold/10 transition-colors w-full text-left"
            >
              <Icons.Share className="w-3.5 h-3.5 text-tea-gold" />
              Share
            </button>
          </div>
        )}
      </CardContainer>
    </div>
  );
};
