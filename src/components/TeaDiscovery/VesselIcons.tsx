import React from 'react';

/* ───────────────────────────────────────────────────────────────────────────
   Simple ink-line vessel illustrations for the "How do you brew?" question.
   stroke = currentColor so they inherit text color (selected → tea-gold).
   Kept deliberately minimal to match the brand's hand-drawn aesthetic; these
   are recognition aids, not technical diagrams. Real photography can replace
   them later via DiscoveryOption.image without touching this file.
   ─────────────────────────────────────────────────────────────────────────── */

interface IconProps {
  className?: string;
}

const base = {
  viewBox: '0 0 48 48',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export const TeabagIcon: React.FC<IconProps> = ({ className }) => (
  <svg {...base} className={className} aria-hidden="true">
    <rect x="20" y="6" width="8" height="5" rx="1.2" />
    <path d="M24 11 V19" />
    <rect x="17" y="19" width="14" height="21" rx="2.5" />
    <path d="M21 26 h6 M21 31 h6" />
  </svg>
);

export const BowlIcon: React.FC<IconProps> = ({ className }) => (
  <svg {...base} className={className} aria-hidden="true">
    <ellipse cx="24" cy="22" rx="15" ry="3.6" />
    <path d="M9 22 a15 12 0 0 0 30 0" />
    <path d="M19 21 q2.5 -4 5.5 -2.5" />
    <path d="M26 20.5 q2.5 -3.5 5.5 -1.5" />
  </svg>
);

export const TeapotIcon: React.FC<IconProps> = ({ className }) => (
  <svg {...base} className={className} aria-hidden="true">
    <path d="M14 26 h20" />
    <path d="M14 26 a12 9 0 0 0 24 0" />
    <path d="M14 27 q-7 -1 -9 4" />
    <path d="M34 25 a5 5 0 0 1 6 4" />
    <ellipse cx="26" cy="25.5" rx="6.5" ry="2" />
    <path d="M26 23.5 v-2.5" />
    <circle cx="26" cy="20" r="1.4" />
  </svg>
);

export const GaiwanIcon: React.FC<IconProps> = ({ className }) => (
  <svg {...base} className={className} aria-hidden="true">
    <path d="M15 25 h18 a9 7 0 0 1 -18 0 Z" />
    <path d="M12 37 h24" />
    <path d="M24 32 v5" />
    <ellipse cx="24" cy="24" rx="9" ry="2.4" />
    <path d="M16.5 24 a7.5 5 0 0 1 15 0" />
    <path d="M24 19 v-2" />
  </svg>
);

export const YixingIcon: React.FC<IconProps> = ({ className }) => (
  <svg {...base} className={className} aria-hidden="true">
    <path d="M14 27 a10 6.5 0 0 0 20 0 a10 4.5 0 0 0 -20 0" />
    <path d="M34 25 l6 -1.5" />
    <path d="M14 25 a4.5 4 0 0 0 -5.5 3.5" />
    <ellipse cx="24" cy="22.5" rx="6.5" ry="1.6" />
    <path d="M24 21 v-2" />
    <circle cx="24" cy="18" r="1.3" />
  </svg>
);
