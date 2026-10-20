import React from 'react';
import { BowlIcon, GaiwanIcon, TeapotIcon, YixingIcon } from '../TeaDiscovery/VesselIcons';
import type { InventoryItem } from '../../types';

/* A piece of teaware has no year, so the Save tile that carries a tea's year
   carries a drawing of what the piece is instead. The four vessels come from
   the brewing question's ink-line set; cup, pitcher and kettle are drawn here
   in the same 48-unit grid and 1.5 stroke so the set reads as one hand. */

const base = {
  viewBox: '0 0 48 48',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

interface IconProps { className?: string }

const CupIcon: React.FC<IconProps> = ({ className }) => (
  <svg {...base} className={className} aria-hidden="true">
    <ellipse cx="24" cy="18" rx="10" ry="2.6" />
    <path d="M14 18 q1 14 10 14 q9 0 10 -14" />
    <path d="M19 35 h10" />
  </svg>
);

const PitcherIcon: React.FC<IconProps> = ({ className }) => (
  <svg {...base} className={className} aria-hidden="true">
    <path d="M15 14 h16 l4 -2" />
    <path d="M15 14 q-1 14 2 20 h12 q3 -6 2 -20" />
    <path d="M17 34 h12" />
  </svg>
);

const KettleIcon: React.FC<IconProps> = ({ className }) => (
  <svg {...base} className={className} aria-hidden="true">
    <path d="M13 36 h22" />
    <path d="M13 36 q-1 -12 11 -13 q12 1 11 13" />
    <path d="M35 30 l6 -6" />
    <path d="M17 23 q7 -12 14 0" />
    <path d="M22 23 h4" />
  </svg>
);

type Glyph = React.FC<IconProps>;

/** Which drawing a piece wears, read from its category and its name. */
export function teawareGlyphFor(item: Pick<InventoryItem, 'name' | 'subcategory'>): Glyph | null {
  const words = `${item.subcategory || ''} ${item.name || ''}`.toLowerCase();
  if (/gaiwan/.test(words)) return GaiwanIcon;
  if (/yixing|zisha/.test(words)) return YixingIcon;
  if (/kettle/.test(words)) return KettleIcon;
  if (/pitcher|fairness|cha ?hai|gong ?dao/.test(words)) return PitcherIcon;
  if (/bowl/.test(words)) return BowlIcon;
  if (/cup|chawan/.test(words)) return CupIcon;
  if (/pot/.test(words)) return TeapotIcon;
  return null;
}

export function TeawareGlyph({ item, className }: { item: Pick<InventoryItem, 'name' | 'subcategory'>; className?: string }) {
  const Icon = teawareGlyphFor(item);
  return Icon ? <Icon className={className} /> : null;
}
