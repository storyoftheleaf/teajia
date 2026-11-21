// The two voices every photo's actions are written in, wherever a placed photo
// is shown with things to do to it: the people editor's photo panel, and the
// zoom a family photograph opens into. One row, one voice: the one thing to do
// to this photo is a bronze word with a hairline under it; the rest are quiet.
// The rule itself is written in docs/CONTRIBUTOR_EDITOR.md.

/** A word that does something: Cormorant, reading bronze, a hairline under it. */
export const PHOTO_ACTION = 'tap-target inline-flex min-h-tap items-center border-b border-tea-border bg-transparent font-display text-ui-17 leading-none text-tea-readgold transition-colors hover:border-tea-gold hover:text-tea-gold-lt disabled:cursor-default disabled:border-transparent disabled:opacity-40';

/** The quiet version, for removing and reordering: secondary text, no line until hover. */
export const PHOTO_QUIET = 'tap-target inline-flex min-h-tap items-center border-b border-transparent bg-transparent font-sans text-ui-13 text-tea-text-sec transition-colors hover:border-tea-border hover:text-tea-text disabled:cursor-default disabled:opacity-40';
