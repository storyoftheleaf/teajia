import { useId } from 'react';
import type { InventoryItem } from '../../types';

/* A piece of teaware has no year, so the Save tile that carries a tea's year
   carries the piece instead, as a solid ink silhouette with its lid seams and
   a glaze highlight cut out of the ink. The forms are traced from real pieces
   Adrian chose: a round clay pot (the round body, flanged dome lid with a
   pearl knob, straight spout and ring handle of the classic Yixing pot, used
   for every teapot), and a drum-bodied water kettle under a hinged arched
   handle. The gaiwan, cup, bowl and pitcher follow the same traditional
   profiles: flared lips on ring feet, the gaiwan on a flat saucer. The rest of the table is drawn the same way:
   a tea boat with a cup on it for trays, a high-shouldered jar for caddies,
   the tea-tool set standing in its holder for tools, and a seated toad for
   tea pets and ornaments. */

type Shape = {
  fill: readonly string[];
  circle: readonly (readonly [number, number, number])[];
  stroke: readonly (readonly [string, number])[];
  cut: readonly (readonly [string, number])[];
};

const VESSELS = {
  teapot: {
    fill: ['M16.4 25.6 C14 26.4 13 28.8 13 31.3 C13 33.8 14.6 35.6 17.2 36.2 H28 C30.6 35.6 32.1 33.8 32.1 31.3 C32.1 28.8 31 26.4 28.6 25.6 Z', 'M16.4 23.9 C16.4 23.6 16.6 23.5 17 23.5 H28 C28.4 23.5 28.6 23.6 28.6 23.9 V25.7 H16.4 Z', 'M17.9 23.7 C18.1 21.9 19.9 21.1 22.5 21.1 C25.1 21.1 26.9 21.9 27.1 23.7 Z', 'M21.9 21.3 H23.1 V20.4 H21.9 Z', 'M17.8 36 H27.6 V37.5 H17.8 Z', 'M13.9 26.5 L8.4 23.9 L9.5 25.2 C10.6 26.6 12 28.8 13.3 30.8 Z'],
    circle: [[22.5, 19.7, 1.4]],
    stroke: [['M34.6 25.5 a3.1 3.9 0 1 1 0 7.8 a3.1 3.9 0 1 1 0 -7.8', 1.6]],
    cut: [['M16 25.7 H29', 0.55], ['M16.6 24.6 H28.4', 0.4], ['M17.4 36.1 H28', 0.45], ['M15.2 30.6 Q15.6 28.2 17.6 27.1', 0.6]],
  },
  yixing: {
    fill: ['M16.4 25.6 C14 26.4 13 28.8 13 31.3 C13 33.8 14.6 35.6 17.2 36.2 H28 C30.6 35.6 32.1 33.8 32.1 31.3 C32.1 28.8 31 26.4 28.6 25.6 Z', 'M16.4 23.9 C16.4 23.6 16.6 23.5 17 23.5 H28 C28.4 23.5 28.6 23.6 28.6 23.9 V25.7 H16.4 Z', 'M17.9 23.7 C18.1 21.9 19.9 21.1 22.5 21.1 C25.1 21.1 26.9 21.9 27.1 23.7 Z', 'M21.9 21.3 H23.1 V20.4 H21.9 Z', 'M17.8 36 H27.6 V37.5 H17.8 Z', 'M13.9 26.5 L8.4 23.9 L9.5 25.2 C10.6 26.6 12 28.8 13.3 30.8 Z'],
    circle: [[22.5, 19.7, 1.4]],
    stroke: [['M34.6 25.5 a3.1 3.9 0 1 1 0 7.8 a3.1 3.9 0 1 1 0 -7.8', 1.6]],
    cut: [['M16 25.7 H29', 0.55], ['M16.6 24.6 H28.4', 0.4], ['M17.4 36.1 H28', 0.45], ['M15.2 30.6 Q15.6 28.2 17.6 27.1', 0.6]],
  },
  kettle: {
    fill: ['M17.6 24.4 C15.8 24.6 15.2 25.6 15.2 27.2 V31.6 C15.2 34.6 16.8 35.9 19.6 36 H28.6 C31.4 35.9 32.6 34.6 32.6 31.6 V27.2 C32.6 25.6 32 24.6 30.2 24.4 Z', 'M17.4 23.2 H30.4 V24.6 H17.4 Z', 'M17.9 23.3 C18 19.6 20.2 18.3 24 18.3 C27.8 18.3 30 19.6 30.1 23.3 Z', 'M22.9 15.8 H25.1 L24.7 18.4 H23.3 Z', 'M15.6 24 C14.2 23.2 13.4 22.2 13.1 19.8 L13 18.8 L10.3 18.5 C11.3 19.2 11.6 20.2 11.6 21.6 C11.6 24.6 12.8 27.4 15.6 28 Z'],
    circle: [[16.7, 20.7, 0.95], [31.7, 21.6, 0.95]],
    stroke: [['M16.8 20.4 C15.4 16 15.2 12 18 10.8 C21 9.8 27 9.8 30 10.8 C33.4 12 33.6 16 31.8 21.2', 1.5]],
    cut: [['M17 24.5 H30.8', 0.5], ['M19.6 21.4 Q24 20.2 28.4 21.4', 0.4], ['M17 30.6 Q17.2 27.4 19.6 26', 0.6]],
  },
  gaiwan: {
    fill: ['M22.6 15.8 H25.4 L25 17.2 H23 Z', 'M15.6 21 C16.4 18.6 19.6 17.1 24 17.1 C28.4 17.1 31.6 18.6 32.4 21 Z', 'M13.4 20.8 H34.6 V21.7 H13.4 Z', 'M14.6 21.7 H33.4 C32.6 27.4 28.8 30.6 24 30.6 C19.2 30.6 15.4 27.4 14.6 21.7 Z', 'M21.4 30.4 H26.6 L26.4 31.9 H21.6 Z', 'M10 31.8 H38 L36.6 33.6 C33 34.6 15 34.6 11.4 33.6 Z'],
    circle: [],
    stroke: [],
    cut: [['M13 20.8 H35', 0.5], ['M13 21.75 H35', 0.5], ['M16.6 25.4 Q17.4 23.4 19.6 22.6', 0.6]],
  },
  cup: {
    fill: ['M12.8 18.4 H35.2 C34.6 27.4 30.4 32 24 32 C17.6 32 13.4 27.4 12.8 18.4 Z', 'M20.8 31.8 H27.2 L26.8 34.2 H21.2 Z'],
    circle: [],
    stroke: [],
    cut: [['M13.4 19.5 H34.6', 0.5], ['M15.8 24.6 Q16.6 22 19 20.8', 0.6]],
  },
  bowl: {
    fill: ['M9.6 21 H38.4 C37.6 30 31.4 34.2 24 34.2 C16.6 34.2 10.4 30 9.6 21 Z', 'M20.2 34 H27.8 L27.4 36.4 H20.6 Z'],
    circle: [],
    stroke: [],
    cut: [['M10.2 22.1 H37.8', 0.5], ['M12.8 26.6 Q13.8 24 16.4 22.8', 0.6]],
  },
  pitcher: {
    fill: ['M13.6 18 H34.4 C33.8 26.4 31.2 32.6 28.4 35.4 H19.6 C16.8 32.6 14.2 26.4 13.6 18 Z', 'M14.2 18 L10.4 16.8 L13.9 20.2 Z', 'M20 35.2 H28 L27.6 37 H20.4 Z'],
    circle: [],
    stroke: [],
    cut: [['M14.2 19.1 H33.8', 0.5], ['M16.8 25 Q17.4 22.4 19.4 21', 0.6]],
  },
  tray: {
    fill: ['M7 26 H41 V28 H7 Z', 'M8 28 H40 L37.6 34 H10.4 Z', 'M11 34 H15 V36 H11 Z', 'M33 34 H37 V36 H33 Z', 'M20.6 20.6 H27.4 C27.2 23.8 25.8 25.4 24 25.4 C22.2 25.4 20.8 23.8 20.6 20.6 Z', 'M22.6 25.2 H25.4 V26.1 H22.6 Z'],
    circle: [],
    stroke: [],
    cut: [['M8 28 H40', 0.5], ['M9.6 30.6 H38.4', 0.45], ['M21 21.5 H27', 0.4]],
  },
  jar: {
    fill: ['M18.6 22.8 C14.4 23.4 12.6 25.6 12.6 28.4 C12.6 32 15.6 35.4 18.6 36.4 H29.4 C32.4 35.4 35.4 32 35.4 28.4 C35.4 25.6 33.6 23.4 29.4 22.8 Z', 'M18.4 20.6 H29.6 V22.8 H18.4 Z', 'M17.6 20.8 C18 17.8 20.6 16.4 24 16.4 C27.4 16.4 30 17.8 30.4 20.8 Z', 'M19.4 36.2 H28.6 V37.4 H19.4 Z'],
    circle: [[24, 15.2, 1.3]],
    stroke: [],
    cut: [['M17.2 20.8 H30.8', 0.5], ['M18 22.7 H30', 0.45], ['M19 36.3 H29', 0.45], ['M15 29.6 Q15.6 26.6 18.2 25.2', 0.6]],
  },
  tools: {
    fill: ['M17.2 22.4 H30.8 V35.8 C30.8 36.7 30.2 37.2 29.4 37.2 H18.6 C17.8 37.2 17.2 36.7 17.2 35.8 Z', 'M16.4 21 H31.6 V22.6 H16.4 Z', 'M21 9.6 C22.6 9.6 23.4 10.8 23 12.6 L22.6 14 H21.6 L21 12.4 C20.6 10.8 20.2 9.6 21 9.6 Z'],
    circle: [],
    stroke: [['M19.4 21 L17.4 11.4', 1.1], ['M22.1 21 L22 13.6', 1.1], ['M25 21 L25.8 10.6', 1.1], ['M28.2 21 L30.8 12.2', 1.1], ['M26.6 21 L28 13.4', 0.9]],
    cut: [['M17.2 26.6 H30.8', 0.45], ['M17.2 32.6 H30.8', 0.45], ['M16.4 22.6 H31.6', 0.45]],
  },
  pet: {
    fill: ['M10 36.6 C10 30 14.4 24 21 22.6 C24 21.4 27 21.6 29 22.8 C30.8 21 33.4 20.8 35 22.4 C37 24.4 37.4 27.6 36 30 C37.6 31.4 38.4 33.6 38 36.6 Z'],
    circle: [[31.6, 22.4, 1.9]],
    stroke: [],
    cut: [['M31.5 22.3 h0.2', 1.1], ['M32.6 27.2 Q35.2 27.8 36.6 26.4', 0.5], ['M16.2 36.4 C16.2 32 18.8 29.8 22.4 30.2 C24.8 30.6 25.8 33 25.6 36.4', 0.5], ['M15.4 29 Q17 25.4 21 24.2', 0.6]],
  },
} satisfies Record<string, Shape>;

type Vessel = keyof typeof VESSELS;

/** Which drawing a piece wears, read from its category and its name. */
export function teawareVesselFor(item: Pick<InventoryItem, 'name' | 'subcategory'>): Vessel | null {
  const words = `${item.subcategory || ''} ${item.name || ''}`.toLowerCase();
  if (/gaiwan/.test(words)) return 'gaiwan';
  if (/yixing|zisha|shi ?piao/.test(words)) return 'yixing';
  if (/kettle|tetsubin|overhead|ti ?liang/.test(words)) return 'kettle';
  // Before cup: the curation screen files a pitcher as "Fair Cup".
  if (/pitcher|fair|cha ?hai|gong ?dao/.test(words)) return 'pitcher';
  if (/\btea ?pets?\b|\bpet\b|toad|figurine|ornament|decorative/.test(words)) return 'pet';
  if (/caddy|canister|\bjars?\b|storage/.test(words)) return 'jar';
  if (/tray|boat|\bmats?\b|tea table|chapan|cha ?chuan/.test(words)) return 'tray';
  if (/tong|scoop|needle|\bpick|strainer|filter|lid rest|\btools?\b|accessor/.test(words)) return 'tools';
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
