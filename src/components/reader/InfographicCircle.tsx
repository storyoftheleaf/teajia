import React, { useEffect, useRef, useState } from 'react';

interface DataPoint {
  label: string;
  value: number;
  color?: string;
}

interface InfographicCircleProps {
  data: DataPoint[];
  title?: string;
  size?: number;
}

// Tea-themed default palette
const TEA_COLORS = [
  '#c9a84c', // gold
  '#6b8f6e', // moss green
  '#c0725a', // warm red
  '#5a8f8a', // jade
  '#a08040', // amber
  '#7a6fa0', // lavender
];

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describeArc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number
): string {
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end = polarToCartesian(cx, cy, r, endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return [
    'M', cx, cy,
    'L', start.x, start.y,
    'A', r, r, 0, largeArc, 1, end.x, end.y,
    'Z',
  ].join(' ');
}

/**
 * InfographicCircle — Pure SVG radial/pie chart.
 * Segments sweep in sequentially on mount.
 * Tea-themed colors used if not specified.
 * Responsive via viewBox. Center shows title or largest segment.
 */
const InfographicCircle: React.FC<InfographicCircleProps> = ({
  data,
  title,
  size = 300,
}) => {
  const [progress, setProgress] = useState(0);
  const animRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const ANIM_DURATION = 900; // ms

  useEffect(() => {
    startTimeRef.current = null;

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const p = Math.min(elapsed / ANIM_DURATION, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - p, 3);
      setProgress(eased);

      if (p < 1) {
        animRef.current = requestAnimationFrame(animate);
      }
    };

    animRef.current = requestAnimationFrame(animate);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [data]);

  const total = data.reduce((sum, d) => sum + d.value, 0);
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size * 0.4;
  const innerR = size * 0.2; // donut hole

  // Find largest segment for center label
  const largest = data.reduce(
    (max, d) => (d.value > max.value ? d : max),
    data[0] ?? { label: '', value: 0 }
  );

  let currentAngle = 0;

  return (
    <div className="flex flex-col items-center gap-4">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        style={{ maxWidth: '100%' }}
        aria-label={title ?? 'Radial chart'}
        role="img"
      >
        {data.map((d, i) => {
          const sliceDeg = (d.value / total) * 360 * progress;
          const startAngle = currentAngle;
          const endAngle = currentAngle + sliceDeg;
          currentAngle = endAngle;

          const color = d.color ?? TEA_COLORS[i % TEA_COLORS.length];

          // Label position at midpoint of arc
          const midAngle = startAngle + sliceDeg / 2;
          const labelR = outerR * 0.72;
          const labelPos = polarToCartesian(cx, cy, labelR, midAngle);
          const showLabel = sliceDeg > 20;

          const path = describeArc(cx, cy, outerR, startAngle, endAngle);

          return (
            <g key={i}>
              <path
                d={path}
                fill={color}
                opacity={0.85}
                style={{ transition: 'opacity 0.2s' }}
              />
              {showLabel && progress > 0.8 && (
                <text
                  x={labelPos.x}
                  y={labelPos.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={size * 0.035}
                  fill="#fff"
                  fontWeight="600"
                  style={{ pointerEvents: 'none' }}
                >
                  {d.label}
                </text>
              )}
            </g>
          );
        })}

        {/* Donut hole */}
        <circle cx={cx} cy={cy} r={innerR} fill="var(--tea-bg)" />

        {/* Center label */}
        <text
          x={cx}
          y={cy - size * 0.02}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={size * 0.055}
          fill="var(--tea-text)"
          fontWeight="700"
        >
          {title ?? largest?.label ?? ''}
        </text>
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div
              className="w-2.5 h-2.5 rounded-md flex-shrink-0"
              style={{ background: d.color ?? TEA_COLORS[i % TEA_COLORS.length] }}
            />
            <span className="text-xs text-tea-text-sec">
              {d.label}{' '}
              <span className="text-tea-text-dim">
                ({Math.round((d.value / total) * 100)}%)
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default InfographicCircle;
