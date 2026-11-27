// Three ways to keep the desktop rail slim (Adrian, 2026-11-27: "Give me three
// very different ideas to keep it slim"). A mock for him to choose from: once
// he picks one, the other two and this switch are taken out and the chosen
// idea becomes the rail.
//
//   a  Rooms in the rail: Manage opens in place, its rooms as small words in
//      the rail's own type, between the four words and the foot.
//   b  The rail turns over: in Manage the rail swaps the four words for the
//      rooms, each a glyph with a small word under it.
//   c  A card from the word: Manage opens a card that rises from the word,
//      every room with its screens, and the rail never widens.
//
// Pick one with ?rail=a, ?rail=b or ?rail=c on any address; ?rail=now goes
// back to today's rail. The choice is remembered in this browser.

export type RailIdea = 'now' | 'a' | 'b' | 'c';

const KEY = 'teajia_rail_idea';
const IDEAS: readonly RailIdea[] = ['now', 'a', 'b', 'c'];

function isIdea(value: string | null | undefined): value is RailIdea {
  return !!value && (IDEAS as readonly string[]).includes(value);
}

/** The rail idea for this browser: the address first, then what was picked last. */
export function railIdea(search: string = typeof window === 'undefined' ? '' : window.location.search): RailIdea {
  const asked = new URLSearchParams(search).get('rail');
  if (isIdea(asked)) {
    try {
      if (asked === 'now') window.localStorage.removeItem(KEY);
      else window.localStorage.setItem(KEY, asked);
    } catch {
      // Storage refused: the address still decides this load.
    }
    return asked;
  }
  try {
    const kept = window.localStorage.getItem(KEY);
    if (isIdea(kept)) return kept;
  } catch {
    // Storage refused: today's rail.
  }
  return 'now';
}

/** A two-word label on two lines ("tea" over "table"), so it fits the slim rail and reads as one. */
export function stackedLines(label: string): string[] {
  return label.split(' ').filter(Boolean);
}
