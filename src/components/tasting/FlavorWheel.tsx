import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { TASTING_TAXONOMY, GROUP_ICON_MAP } from '../../data/tastingTaxonomy';
import type { TastingFlowState } from './useTastingFlow';

interface FlavorWheelProps {
  flow: TastingFlowState;
}

/**
 * Subtle tea-themed colors per flavor group.
 * Uses color-mix with currentColor so they adapt to both light and dark themes.
 * The base hues are defined via CSS custom properties for theme adaptability.
 */
const SEGMENT_COLORS = [
  'color-mix(in srgb, var(--tea-accent-sub, #c878a0) 15%, transparent)', // Floral
  'color-mix(in srgb, var(--tea-gold, #a8874d) 15%, transparent)',       // Sweet
  'color-mix(in srgb, var(--tea-gold, #c86450) 12%, transparent)',       // Fruity
  'color-mix(in srgb, var(--tea-gold, #b49664) 12%, transparent)',       // Nutty
  'color-mix(in srgb, var(--tea-gold, #a0643c) 15%, transparent)',       // Roasted
  'color-mix(in srgb, var(--tea-accent-sub, #788c64) 15%, transparent)', // Woody
  'color-mix(in srgb, var(--tea-text-dim, #8c7864) 12%, transparent)',   // Earthy
  'color-mix(in srgb, var(--tea-text-sec, #8c96aa) 12%, transparent)',   // Mineral
  'color-mix(in srgb, var(--tea-accent-sub, #64a064) 15%, transparent)', // Fresh
  'color-mix(in srgb, var(--tea-text-dim, #a0a0a0) 10%, transparent)',   // Other
];

const SELECTED_FILL = 'rgb(var(--tea-gold-rgb) / 0.25)';

/** Get flavor groups from the taxonomy */
function getFlavorGroups() {
  const flavorCat = TASTING_TAXONOMY.categories.find(c => c.id === 'flavor');
  if (!flavorCat) return [];
  return flavorCat.groups;
}

/** Convert polar to cartesian coordinates */
function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(angleRad),
    y: cy + r * Math.sin(angleRad),
  };
}

/** Build an SVG arc path for a pie segment */
function describeArc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number
): string {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;

  return [
    `M ${cx} ${cy}`,
    `L ${start.x} ${start.y}`,
    `A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`,
    'Z',
  ].join(' ');
}

const FlavorWheel: React.FC<FlavorWheelProps> = ({ flow }) => {
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);

  const groups = useMemo(() => getFlavorGroups(), []);
  const segmentAngle = groups.length > 0 ? 360 / groups.length : 0;

  const cx = 150;
  const cy = 150;
  const outerR = 130;
  const labelR = 90;

  return (
    <div className="flex flex-col items-center gap-3">
      <span
        className="text-[10px] uppercase tracking-[0.15em] text-tea-text-dim"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        Flavor Wheel
      </span>

      <svg
        viewBox="0 0 300 300"
        className="w-full max-w-[280px] aspect-square"
        role="img"
        aria-label="Flavor wheel showing flavor groups as tappable segments"
      >
        {groups.map((group, i) => {
          const startAngle = i * segmentAngle;
          const endAngle = startAngle + segmentAngle;
          const midAngle = startAngle + segmentAngle / 2;

          const isSelected = flow.isGroupSelected('flavor', group.label);
          const isHovered = hoveredGroup === group.label;
          const fill = isSelected ? SELECTED_FILL : SEGMENT_COLORS[i % SEGMENT_COLORS.length];

          // Label position
          const labelPos = polarToCartesian(cx, cy, labelR, midAngle);

          // Rotate text so it reads along the arc direction
          let textRotation = midAngle;
          // Flip text on bottom half so it doesn't read upside down
          if (midAngle > 90 && midAngle < 270) {
            textRotation = midAngle + 180;
          }

          const segmentPath = describeArc(cx, cy, outerR, startAngle, endAngle);

          return (
            <g key={group.label}>
              {/* Segment arc */}
              <motion.path
                d={segmentPath}
                fill={fill}
                stroke="var(--tea-border)"
                strokeWidth={0.5}
                strokeOpacity={0.4}
                initial={false}
                animate={{
                  scale: isHovered ? 1.02 : 1,
                  opacity: isHovered || isSelected ? 1 : 0.85,
                }}
                transition={{ duration: 0.15 }}
                style={{ cursor: 'pointer', transformOrigin: `${cx}px ${cy}px` }}
                onPointerEnter={() => setHoveredGroup(group.label)}
                onPointerLeave={() => setHoveredGroup(null)}
                onClick={() => flow.toggleGroup('flavor', group.label)}
                role="button"
                aria-label={`${group.label}${isSelected ? ' (selected)' : ''}`}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    flow.toggleGroup('flavor', group.label);
                  }
                }}
              />

              {/* Group label text */}
              <text
                x={labelPos.x}
                y={labelPos.y}
                textAnchor="middle"
                dominantBaseline="central"
                transform={`rotate(${textRotation}, ${labelPos.x}, ${labelPos.y})`}
                fill={isSelected ? 'var(--tea-gold)' : 'var(--tea-text-sec)'}
                fontSize={10}
                fontFamily="var(--font-display)"
                letterSpacing="0.04em"
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {group.label}
              </text>

              {/* Selected indicator — small gold dot at inner edge */}
              {isSelected && (
                <motion.circle
                  cx={polarToCartesian(cx, cy, outerR * 0.45, midAngle).x}
                  cy={polarToCartesian(cx, cy, outerR * 0.45, midAngle).y}
                  r={3}
                  fill="var(--tea-gold)"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                />
              )}
            </g>
          );
        })}

        {/* Center circle — decorative */}
        <circle
          cx={cx}
          cy={cy}
          r={25}
          fill="var(--tea-surface)"
          stroke="var(--tea-border)"
          strokeWidth={0.5}
          strokeOpacity={0.3}
        />
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="central"
          fill="var(--tea-text-dim)"
          fontSize={8}
          fontFamily="var(--font-display)"
          letterSpacing="0.1em"
          style={{ textTransform: 'uppercase' }}
        >
          FLAVOR
        </text>
      </svg>

      {/* Hovered group detail */}
      {hoveredGroup && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          className="text-center"
        >
          <span
            className="text-[11px] text-tea-text-sec"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            {hoveredGroup}
          </span>
        </motion.div>
      )}
    </div>
  );
};

// Default export for React.lazy
export default FlavorWheel;
