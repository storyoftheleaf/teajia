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

/** The page title. Cormorant, 32px at 390 and 48px on a wide screen. */
export const TITLE = TYPOGRAPHY_CLASSES.h1;

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
