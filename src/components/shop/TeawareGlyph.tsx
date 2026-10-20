import type { InventoryItem } from '../../types';

/* A piece of teaware has no year, so the Save tile that carries a tea's year
   carries a drawing of what the piece is instead. One hand for the set: a
   48-unit grid, a fine round stroke, each vessel drawn at its true
   proportions with the details that name it (a ring foot, a lid knob, a
   saucer, a beak spout), so the row reads as a catalogue mark, not a sticker. */

const VESSELS = {
  teapot: [
    'M12 30 C12 22.5 17 19.5 24 19.5 C31 19.5 36 22.5 36 30 C36 35 31 37 24 37 C17 37 12 35 12 30 Z',
    'M18.6 19.9 C20 17.4 28 17.4 29.4 19.9',
    'M24 17.6 V16.4',
    'M22.6 16.4 H25.4',
    'M12.2 25.2 C9.6 24.6 8 22 6.8 18.8',
    'M12.6 31.4 C9 30.4 7.4 25.2 6.8 18.8',
    'M35.6 24.4 C40.4 23.2 42.4 27.6 40.6 30.8 C39.6 32.6 37.8 33.2 35.8 32.8',
    'M19.6 37 L20 38.4 H28 L28.4 37',
  ],
  yixing: [
    'M11.5 30.5 C11.5 26 17 24 24 24 C31 24 36.5 26 36.5 30.5 C36.5 34.4 31 36 24 36 C17 36 11.5 34.4 11.5 30.5 Z',
    'M17.5 24.4 C20 23.4 28 23.4 30.5 24.4',
    'M22.2 23.6 C22.2 21.6 25.8 21.6 25.8 23.6',
    'M11.9 28.4 L6.2 24.2',
    'M12 32.2 L6.2 24.2',
    'M36.1 27 C40.6 26.6 41.4 32 36.4 33.4',
  ],
  gaiwan: [
    'M22.8 16.8 C22.8 15.2 25.2 15.2 25.2 16.8',
    'M16.6 20.8 C18 17.8 21 16.8 24 16.8 C27 16.8 30 17.8 31.4 20.8',
    'M13.8 21 H34.2',
    'M15 21.2 C15.6 27.8 19 31.2 24 31.2 C29 31.2 32.4 27.8 33 21.2',
    'M21.2 31.2 L21.6 32.8 H26.4 L26.8 31.2',
    'M10.6 33.2 C15 35.6 33 35.6 37.4 33.2',
  ],
  cup: [
    'M12.6 18.6 H35.4',
    'M13 19 C13.6 27.4 17.8 32 24 32 C30.2 32 34.4 27.4 35 19',
    'M15.4 18.6 C19 20.2 29 20.2 32.6 18.6',
    'M20.6 32 L21 34 H27 L27.4 32',
  ],
  bowl: [
    'M9.6 21.4 H38.4',
    'M10 21.8 C11 30.2 16.8 34.2 24 34.2 C31.2 34.2 37 30.2 38 21.8',
    'M20.2 34.2 L20.6 36.2 H27.4 L27.8 34.2',
  ],
  pitcher: [
    'M13.6 18.4 H34.2',
    'M14.2 18.8 C15 26 17 32 19.6 35.4 H28.4 C31 32 33 26 33.8 18.8',
    'M13.6 18.4 C11.8 18.2 10.4 17.4 9.2 16 C10.6 18.6 12.4 20.2 14.3 20.8',
    'M19.8 35.6 L20.2 37 H27.8 L28.2 35.6',
  ],
  kettle: [
    'M11 29.5 C11 23 16.5 20.5 24 20.5 C31.5 20.5 37 23 37 29.5 C37 34.8 31.5 37 24 37 C16.5 37 11 34.8 11 29.5 Z',
    'M18.6 20.9 C20 18.8 28 18.8 29.4 20.9',
    'M24 18.9 V17.6',
    'M14.4 23 C14.4 9.6 33.6 9.6 33.6 23',
    'M11.4 25.8 C8.8 25 7 22.8 5.8 19.6',
    'M11.6 31 C8.2 30.2 6.4 25 5.8 19.6',
  ],
} as const;

type Vessel = keyof typeof VESSELS;

/** Which drawing a piece wears, read from its category and its name. */
export function teawareVesselFor(item: Pick<InventoryItem, 'name' | 'subcategory'>): Vessel | null {
  const words = `${item.subcategory || ''} ${item.name || ''}`.toLowerCase();
  if (/gaiwan/.test(words)) return 'gaiwan';
  if (/yixing|zisha/.test(words)) return 'yixing';
  if (/kettle|tetsubin/.test(words)) return 'kettle';
  if (/pitcher|fairness|cha ?hai|gong ?dao/.test(words)) return 'pitcher';
  if (/bowl|chawan/.test(words)) return 'bowl';
  if (/cup/.test(words)) return 'cup';
  if (/pot/.test(words)) return 'teapot';
  return null;
}

export function TeawareGlyph({ vessel, className }: { vessel: Vessel; className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {VESSELS[vessel].map(d => <path key={d} d={d} />)}
    </svg>
  );
}
