/**
 * Four type roles for a product page and the shared reference beneath it.
 *
 * Round one corrected the labels inside the lineage block and left the shop's
 * own sections carrying the defect it had just rejected, so the reference read
 * better than the writing above it. These four roles are the whole scale for
 * the page, which is what stops that inversion coming back.
 *
 *   TITLE     the product's name. One per page.
 *   HEADING   a named thing under the title: a plant, a related tea, a figure.
 *   BODY      every sentence on the page, and every field value.
 *   LABEL     the micro-caps marker that opens a section or names a field.
 *
 * Four sizes: 32/48, 20, 15, 11. Nothing between them. Inside a block the
 * hierarchy is carried by colour rather than by another size step, which is
 * why none of these roles carries a colour of its own.
 *
 * This file lived under components/wisdom until round four. It never belonged
 * there: the wisdom folder holds the reference band, and by round three the
 * same scale was governing the shop's own sections and the tasting blocks, so
 * two folders were importing a page scale out of a third folder's namespace to
 * get it. A scale that three folders share is shared code, and shared code
 * lives in shared.
 */
import { TYPOGRAPHY_CLASSES } from '../../designTokens';

/**
 * The title. Cormorant, 32px in a narrow column and 48px in a wide one.
 *
 * Measured against its container, not against the window. `h1` clamps on `vw`,
 * which is right for a page that fills the window and wrong everywhere else:
 * the quick view is a 480px card, and on a 1600px screen `4.8vw` is 77px, so
 * the clamp pinned every tea's name in that card to the full 48px page-title
 * size. A title set to the same size in a 480px card and on a 900px page is not
 * a scale, it is a coincidence, and it read as a headline shouting inside a
 * postcard.
 *
 * `cqi` is one percent of the nearest query container's inline size. Where no
 * ancestor declares `container-type` the unit falls back to the small viewport,
 * which is exactly the previous behaviour, so the product page is untouched at
 * every width. The alcove card declares the container (`.alcove-measure` in
 * card-utilities.css), so 4.8cqi of 480px is 23px and the clamp holds the title
 * at its 32px floor.
 *
 * Deliberately written here rather than in designTokens: `h1` is a page-title
 * class used by pages that are their own container, and this is the shop's
 * reading of it.
 */
export const TITLE = 'font-display text-[clamp(32px,4.8cqi,48px)] font-normal leading-[1.12] tracking-[0.01em]';

/** A named thing. Cormorant 20px, one scale stop, no clamp. */
export const HEADING = 'font-display text-ui-20 leading-[1.3] tracking-[0.01em]';

/** Every sentence and every field value. Lora 15px. */
export const BODY = TYPOGRAPHY_CLASSES.bodyLight;

/**
 * The micro-caps marker. 11px at 0.08em.
 *
 * Deliberately not TYPOGRAPHY_CLASSES.label, which tracks at 1.2px (0.109em on
 * an 11px body). At that width a label stops being typography and becomes fine
 * print. Round one settled the setting inside the lineage block; this is the
 * same setting, applied to the page.
 *
 * A label is one to three words. Nothing longer, and no sentence, is ever set
 * in capitals. A run of facts joined by interpuncts is a sentence wearing a
 * label's clothes, so it is set as BODY.
 */
export const LABEL = 'font-sans text-ui-11 uppercase tracking-[0.08em]';

/**
 * The numeral face. Deliberately not a fifth size.
 *
 * Round four's buy cluster ran mono at 11, 15 and 20, none of which was
 * declared anywhere, so the one part of the page a customer transacts on had a
 * private scale. Numerals do need their own *face*: a proportional figure
 * reflows the price as the slider drags, which makes a number that is not
 * changing look like it is. That is an argument about the face, not about the
 * size, so this class carries only the face and the tabular figures, and every
 * numeral on the page takes its size from one of the four roles.
 *
 * Written as a modifier (`${BODY} ${NUMERAL}`), never on its own.
 */
export const NUMERAL = 'font-mono tabular-nums';

/**
 * LABEL's size, in the numeral face, in its own case.
 *
 * Deliberately not written as `${LABEL} ${NUMERAL}`. LABEL carries `font-sans`,
 * and in the built stylesheet Tailwind emits `.font-sans` after `.font-mono`,
 * so that combination silently renders in the sans face and the tabular figures
 * are lost. Two utilities in one class attribute are resolved by their order in
 * the sheet, never by their order in the string. Measured, not assumed.
 *
 * `normal-case` because these live inside controls that carry LABEL's capitals,
 * and text-transform inherits: without it a per-gram price set "$0.85/g" as
 * "$0.85/G" and a ten gram sample as "10G". A unit symbol is not a label.
 *
 * This is not a fifth size. It is LABEL's 11px, which is the smallest declared
 * role, used where BODY at 15px cannot fit a price, a per-gram and four presets
 * across a 303px row without wrapping or scrolling sideways.
 */
export const LABEL_NUMERAL = `text-ui-11 normal-case ${NUMERAL}`;

/**
 * A 44px hit area around a control too small to be one, without the layout
 * height that making the box 44px tall would add.
 *
 * `tap-target` in card-utilities.css sets `min-height: 44px` on the element
 * itself. That is right for an icon sitting alone, and wrong for a word set
 * inside a heading: round four made a linked group heading a 44px control, and
 * the gap beneath "Same place" became visually double the gap beneath "About",
 * which broke round two's single rhythm value in the one place round four
 * touched. This expands the pressable area with a pseudo-element instead, so
 * the heading keeps its own line box and the rhythm holds.
 *
 * Deliberately lopsided: 24px up, 8px down. Up is SECTION's own gap and is
 * always empty, so the hit area fills it and stops at the section boundary.
 * Down is only LABEL_GAP, so the area stops exactly where the section's
 * content begins rather than swallowing the top of the first thing under it.
 * An 11px label sets a 13px line box at worst, so the floor is 13 + 24 + 8 =
 * 45px, and the pseudo-element inherits the label's own width, which for one
 * to three words is always past 44 as well.
 */
export const HIT_AREA = "relative after:absolute after:content-[''] after:inset-x-0 after:-top-6 after:-bottom-2";

/**
 * The one link setting for text inside a sentence or a field value.
 *
 * A resting underline, because half this page is read on a phone where nothing
 * hovers: a link that only announces itself to a mouse is not a link on a
 * phone. Bronze is the hover and focus colour only, which keeps the resting
 * page at zero bronze while still marking the one state that is an action.
 *
 * Card links (a related tea, the back link) are deliberately not set with this.
 * They are whole surfaces you press, not words inside a line.
 */
export const LINK =
  'underline decoration-1 decoration-tea-text-dim underline-offset-4 transition-colors hover:text-tea-gold hover:decoration-tea-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 rounded-md';

/** 4px, inside a single field: its label to its value. */
export const FIELD_GAP = 'mb-1';

/** 8px, a section's label to the first line of its body. */
export const LABEL_GAP = 'mb-2';

/** 24px, section to section. The only gap between top-level blocks. */
export const SECTION = 'mb-6';
