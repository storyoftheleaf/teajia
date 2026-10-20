import { useId } from 'react';
import type { InventoryItem } from '../../types';

/* A piece of teaware has no year, so the Save tile that carries a tea's year
   carries the piece instead, drawn the way old tea catalogues printed their
   wares: a solid ink silhouette in the classic forms (a Xi Shi teapot, a
   Shi Piao Yixing, an overhead-handle pot, a gaiwan on its saucer). The pots
   sit low and wide with the spout tip, rim and handle on one level line, the
   way a Yixing pot is made to pour, with the
   lid seam and a glaze highlight cut out of the ink in fine lines. */

type Shape = {
  fill: readonly string[];
  circle: readonly (readonly [number, number, number])[];
  stroke: readonly (readonly [string, number])[];
  cut: readonly (readonly [string, number])[];
};

const VESSELS = {
  teapot: {
    fill: ['M11.5 31 C11.5 25.2 17 23 24 23 C31 23 36.5 25.2 36.5 31 C36.5 35.4 31.5 37 24 37 C16.5 37 11.5 35.4 11.5 31 Z', 'M19 23.6 C20.4 21.7 27.6 21.7 29 23.6 Z', 'M12.4 28 C9.8 27.2 8.4 25.4 7.6 23 L5.8 23 C7 27.8 9 32 12.8 33.6 Z', 'M19.4 36.8 H28.6 L28.2 38.2 H19.8 Z'],
    circle: [[24, 20.7, 1.4]],
    stroke: [['M35.8 25.8 C41 24.6 42.6 30.4 36.4 33.8', 2.2]],
    cut: [['M18.6 24 Q24 25.1 29.4 24', 0.8], ['M15 29.6 Q16 26.6 19.4 25.6', 0.7]],
  },
  yixing: {
    fill: ['M11 36.4 C12.6 31 16.6 25.6 19.6 25 H28.4 C31.4 25.6 35.4 31 37 36.4 C33 37.8 15 37.8 11 36.4 Z', 'M22.2 24.8 C22.2 22.4 25.8 22.4 25.8 24.8 Z', 'M14.4 30.2 L7.8 25.6 L7 26.8 L13.2 34 Z'],
    circle: [],
    stroke: [['M33.4 28.2 L38.8 27.6 C39.8 31 37.8 33.8 35.4 34.8', 2]],
    cut: [['M19.4 25.8 H28.6', 0.8], ['M15 34 Q16.6 30.4 19 27.8', 0.7]],
  },
  kettle: {
    fill: ['M11.5 31.2 C11.5 25.6 17 23.2 24 23.2 C31 23.2 36.5 25.6 36.5 31.2 C36.5 35.4 31.5 37.2 24 37.2 C16.5 37.2 11.5 35.4 11.5 31.2 Z', 'M19.4 23.8 C20.6 22 27.4 22 28.6 23.8 Z', 'M12.4 28.2 C9.8 27.4 8.4 25.6 7.6 23.2 L5.8 23.2 C7 28 9 32.2 12.8 33.8 Z', 'M19.6 37 H28.4 L28 38.4 H20 Z'],
    circle: [[24, 21.1, 1.2], [15.6, 24.8, 1.2], [32.4, 24.8, 1.2]],
    stroke: [['M15.6 24.6 C15.6 14.6 32.4 14.6 32.4 24.6', 1.5]],
    cut: [['M19 24.2 Q24 25.2 29 24.2', 0.8], ['M15 29.8 Q16 26.8 19.4 25.8', 0.7]],
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
