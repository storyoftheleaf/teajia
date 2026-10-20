import { useId } from 'react';
import type { InventoryItem } from '../../types';

/* A piece of teaware has no year, so the Save tile that carries a tea's year
   carries the piece instead, drawn the way old tea catalogues printed their
   wares: a solid ink silhouette in the classic forms (a Xi Shi teapot, a
   Shi Piao Yixing, an overhead-handle pot, a gaiwan on its saucer), with the
   lid seam and a glaze highlight cut out of the ink in fine lines. */

type Shape = {
  fill: readonly string[];
  circle: readonly (readonly [number, number, number])[];
  stroke: readonly (readonly [string, number])[];
  cut: readonly (readonly [string, number])[];
};

const VESSELS = {
  teapot: {
    fill: ['M13 31 C13 23.5 17.8 20.5 24 20.5 C30.2 20.5 35 23.5 35 31 C35 35.5 30.5 37.5 24 37.5 C17.5 37.5 13 35.5 13 31 Z', 'M18.8 21.2 C19.6 18.4 28.4 18.4 29.2 21.2 Z', 'M13.8 26.8 C10.6 25.8 8.2 23.4 6.6 19.6 L5 19 L5.8 20.8 C7 25.8 9.6 30.6 13.6 32.4 Z', 'M19.2 37.2 H28.8 L28.2 39 H19.8 Z'],
    circle: [[24, 17.4, 1.9]],
    stroke: [['M34.6 24.4 C40.8 23 42.4 30.2 35.8 33.6', 2.4]],
    cut: [['M18.2 21.6 Q24 23 29.8 21.6', 0.9], ['M16.2 28 Q17.2 24.6 20.6 23.4', 0.8]],
  },
  yixing: {
    fill: ['M13.6 36.6 L18.4 22.8 C19 21.4 29 21.4 29.6 22.8 L34.4 36.6 C30 38.2 18 38.2 13.6 36.6 Z', 'M21.4 21.8 C21.4 18.8 26.6 18.8 26.6 21.8 Z', 'M15.6 30.6 L9.4 26 L8.6 27.2 L14.6 34 Z'],
    circle: [],
    stroke: [['M32.4 26.2 C37.8 25.2 39 32.4 33.6 34.8', 2.3]],
    cut: [['M18.6 23.6 H29.4', 0.9], ['M17.2 31.6 L19.6 25.4', 0.8]],
  },
  kettle: {
    fill: ['M12.5 30.8 C12.5 24.4 17.5 21.4 24 21.4 C30.5 21.4 35.5 24.4 35.5 30.8 C35.5 35.2 30.5 37.4 24 37.4 C17.5 37.4 12.5 35.2 12.5 30.8 Z', 'M19.2 21.8 C20 19.4 28 19.4 28.8 21.8 Z', 'M13.2 27 C10.2 26 8 23.8 6.4 20.4 L4.8 19.8 L5.6 21.6 C6.8 26.2 9.4 30.6 13 32.4 Z', 'M19.6 37.2 H28.4 L27.8 38.8 H20.2 Z'],
    circle: [[24, 18.6, 1.5], [15.4, 22.8, 1.3], [32.6, 22.8, 1.3]],
    stroke: [['M15.4 22.6 C14.4 10.4 33.6 10.4 32.6 22.6', 1.6]],
    cut: [['M18.4 22.2 Q24 23.6 29.6 22.2', 0.9], ['M15.8 28.6 Q16.8 25.2 20.2 24', 0.8]],
  },
  gaiwan: {
    fill: ['M16 20.8 C17 17 20.4 15.8 24 15.8 C27.6 15.8 31 17 32 20.8 Z', 'M22.4 16 C22.4 14 25.6 14 25.6 16 Z', 'M13.4 20.6 H34.6 V21.9 H13.4 Z', 'M14.6 21.9 C15.2 28 19 31 24 31 C29 31 32.8 28 33.4 21.9 Z', 'M21 30.8 H27 L26.6 32.6 H21.4 Z', 'M9.2 32.4 C14 36.8 34 36.8 38.8 32.4 L37.8 32.4 C33 34.6 15 34.6 10.2 32.4 Z'],
    circle: [],
    stroke: [],
    cut: [['M13 20.6 H35', 0.8], ['M13 21.9 H35', 0.8], ['M17.4 26 Q18.4 23.8 20.6 23.2', 0.8]],
  },
  cup: {
    fill: ['M12.8 18.4 H35.2 C34.6 27.4 30.4 32 24 32 C17.6 32 13.4 27.4 12.8 18.4 Z', 'M20.8 31.8 H27.2 L26.8 34.2 H21.2 Z'],
    circle: [],
    stroke: [],
    cut: [['M14.2 19.9 Q24 21.6 33.8 19.9', 0.9]],
  },
  bowl: {
    fill: ['M9.6 21 H38.4 C37.6 30 31.4 34.2 24 34.2 C16.6 34.2 10.4 30 9.6 21 Z', 'M20.2 34 H27.8 L27.4 36.4 H20.6 Z'],
    circle: [],
    stroke: [],
    cut: [['M11.2 22.6 Q24 24.8 36.8 22.6', 0.9]],
  },
  pitcher: {
    fill: ['M14 18 H34 C33.2 26 31 32.4 28.4 35.6 H19.6 C17 32.4 14.8 26 14 18 Z', 'M14.4 18 C12.2 17.6 10.4 16.6 9 15 C10.2 18.4 12.4 20.4 15 21 Z', 'M19.8 35.4 H28.2 L27.8 37.2 H20.2 Z'],
    circle: [],
    stroke: [],
    cut: [['M15.6 19.8 H32.4', 0.9]],
  },
} satisfies Record<string, Shape>;

type Vessel = keyof typeof VESSELS;

/** Which drawing a piece wears, read from its category and its name. */
export function teawareVesselFor(item: Pick<InventoryItem, 'name' | 'subcategory'>): Vessel | null {
  const words = `${item.subcategory || ''} ${item.name || ''}`.toLowerCase();
  if (/gaiwan/.test(words)) return 'gaiwan';
  if (/yixing|zisha|shi ?piao/.test(words)) return 'yixing';
  if (/kettle|tetsubin|overhead|ti ?liang/.test(words)) return 'kettle';
  if (/pitcher|fairness|cha ?hai|gong ?dao/.test(words)) return 'pitcher';
  if (/bowl|chawan/.test(words)) return 'bowl';
  if (/cup/.test(words)) return 'cup';
  if (/pot/.test(words)) return 'teapot';
  return null;
}

export function TeawareGlyph({ vessel, className }: { vessel: Vessel; className?: string }) {
  const shape: Shape = VESSELS[vessel];
  // The cuts are holes in the ink, so the tile's own ground shows through
  // them in both themes; a mask needs an id unique to each row.
  const mask = `teaware-ink-${useId().replace(/:/g, '')}`;
  return (
    <svg viewBox="4 8 40 34" className={className} aria-hidden="true">
      <mask id={mask}>
        <rect width="48" height="48" fill="black" />
        {shape.fill.map(d => <path key={d} d={d} fill="white" />)}
        {shape.circle.map(([cx, cy, r]) => <circle key={`${cx},${cy}`} cx={cx} cy={cy} r={r} fill="white" />)}
        {shape.stroke.map(([d, w]) => <path key={d} d={d} fill="none" stroke="white" strokeWidth={w} strokeLinecap="round" />)}
        {shape.cut.map(([d, w]) => <path key={d} d={d} fill="none" stroke="black" strokeWidth={w} strokeLinecap="round" />)}
      </mask>
      <rect width="48" height="48" fill="currentColor" mask={`url(#${mask})`} />
    </svg>
  );
}
