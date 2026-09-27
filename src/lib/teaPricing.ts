/**
 * What an amount of a tea costs, and which amounts are worth offering.
 *
 * The shop's intent is that the rate a gram comes down as the amount goes up.
 * That is not a percentage: a percentage scales with the tea, so a fine tea at
 * five dollars a gram would climb to seven for a small bag, which is
 * indefensible. The cost being recovered does not scale with the tea at all.
 * An order takes the same work whatever is in it: finding it, weighing it,
 * sealing it, writing it up, sending it. Someone taking 200 g once instead of
 * 50 g four times is three fewer of those.
 *
 * So it is ONE fixed amount per weighed order, spread across however many
 * grams are in it. Twenty-five grams carries all of it; two hundred barely
 * notices; a whole unbroken cake skips it entirely, because nothing is opened
 * or repacked. That is what makes the cake honestly the best rate rather than
 * a claim.
 *
 * Because it is a line rather than a table, any amount someone types prices
 * itself on the same curve, with no separate custom rule to keep in step.
 *
 * LIVE. Two dollars an order, spread. On this shop's inexpensive tea that is
 * twenty-eight cents a gram at twenty-five grams easing to twenty at a whole
 * cake, a spread of forty percent; on a tea at five dollars a gram the same
 * two dollars is one and a half percent, which is the whole reason it is a
 * fixed amount and not a percentage.
 *
 * Every price on the site reads through here, so changing these three numbers
 * moves the ladder everywhere at once.
 */

export interface TeaPricingConfig {
  /**
   * The fixed amount a weighed order carries, in the record currency (USD).
   * Raise it and the discounts steepen, lower it and the ladder flattens.
   * It bites hardest on inexpensive tea, which is where a small order costs
   * the most relative to what it is worth.
   */
  handlingUsd: number;
  /** The sizes offered, smallest first. A whole pressed piece is added separately. */
  sizesG: number[];
  /**
   * Hide any size whose total falls below this. On a cheap tea that drops the
   * smallest rungs on their own; on a fine tea they survive, because ten grams
   * of it is already real money.
   */
  minTotalUsd: number;
}

export const TEA_PRICING: TeaPricingConfig = {
  handlingUsd: 2,
  sizesG: [10, 25, 50, 100, 200],
  minTotalUsd: 5,
};

/**
 * How many whole units a unit-sold tea offers before the reader is left to
 * type a number. Four covers one to four boxes, which is the range anybody
 * picks off a strip; beyond that they are buying by the case and should say
 * how many.
 */
const UNIT_RUNGS = 4;

export interface Quote {
  grams: number;
  /** Total in the record currency, before any display rounding. */
  totalUsd: number;
  /** What that works out to a gram. Falls as grams rise. */
  perGramUsd: number;
  /** True when this amount skipped the handling amount by being one whole piece. */
  whole: boolean;
}

/**
 * Price one amount of one tea.
 *
 * `wholePieceGrams` is the weight of one whole thing: an unbroken cake, brick
 * or tuo, or a sealed box. It is where the discount curve STOPS.
 *
 * The curve exists to spread one fixed handling amount across however many
 * grams are in the order, so the rate eases as the amount grows. That reasoning
 * runs out at the whole piece. Nothing is weighed, opened or repacked to send
 * one cake, so one cake is the cheapest a gram of that tea can be, and two
 * cakes is two of those: the same rate, twice. Letting the curve keep falling
 * past the piece was discounting the shop for work it never does, which is how
 * the 100 g box came to cost more per gram than two of itself.
 *
 * So: whole pieces carry no handling, at any number of them. A remainder on top
 * of them is a weighed amount and carries the handling, once. Below one piece,
 * and for loose leaf that has no piece at all, the curve is unchanged.
 */
export function quoteGrams(
  pricePerGramUsd: number,
  grams: number,
  opts: { wholePieceGrams?: number; config?: TeaPricingConfig } = {},
): Quote {
  const cfg = opts.config ?? TEA_PRICING;
  const piece = opts.wholePieceGrams;
  const pieces = piece != null && piece > 0 ? Math.floor(grams / piece) : 0;
  const remainder = pieces > 0 ? grams - pieces * piece! : grams;
  // Whole means nothing had to be opened for this order, which is what the
  // handling amount pays for. One piece, or four, or none plus a remainder.
  const whole = pieces > 0 && remainder === 0;
  const totalUsd = pricePerGramUsd * grams + (whole ? 0 : cfg.handlingUsd);
  return {
    grams,
    totalUsd,
    perGramUsd: grams > 0 ? totalUsd / grams : pricePerGramUsd,
    whole,
  };
}

/**
 * The smallest amount of this tea anyone can order.
 *
 * One unit when it is sold in units; otherwise the smallest rung the shop
 * offers, which is what every weight control on the site already assumed.
 */
export function minimumOrderGrams(unitGrams?: number, config: TeaPricingConfig = TEA_PRICING): number {
  return unitGrams && unitGrams > 0 ? unitGrams : Math.min(...config.sizesG);
}

/**
 * Round an amount to something the shop can actually send.
 *
 * Rounds UP to the next whole unit, never down: rounding down would quietly
 * hand back less tea than was asked for. Never above what is in stock, and
 * never below one unit.
 */
export function snapToUnit(grams: number, unitGrams: number, stockG: number): number {
  if (!unitGrams || unitGrams <= 0) return grams;
  const units = Math.max(1, Math.ceil(grams / unitGrams));
  const wanted = units * unitGrams;
  const affordableUnits = Math.max(1, Math.floor(stockG / unitGrams));
  return Math.min(wanted, affordableUnits * unitGrams);
}

/**
 * Which sizes this tea should show, smallest first.
 *
 * Sizes above what is in stock are dropped, as are sizes whose total is too
 * small to be worth anyone's postage. The whole piece is appended last when
 * there is enough leaf to press one and it is not already in the list.
 */
export function offeredSizes(
  pricePerGramUsd: number,
  stockG: number,
  opts: { wholePieceGrams?: number; unitGrams?: number; config?: TeaPricingConfig } = {},
): Quote[] {
  const cfg = opts.config ?? TEA_PRICING;

  // A tea sold in whole units has no ladder of its own: the rungs ARE the
  // units, because half a sealed box is not a thing the shop can send. The
  // minimum-total rule is skipped here on purpose. One box is the smallest
  // order that exists, so dropping it for being cheap would leave the tea
  // listed with nothing to buy.
  if (opts.unitGrams && opts.unitGrams > 0) {
    const unit = opts.unitGrams;
    const affordable = Math.floor(stockG / unit);
    const rungs = Math.min(affordable, UNIT_RUNGS);
    return Array.from({ length: Math.max(0, rungs) }, (_, i) =>
      quoteGrams(pricePerGramUsd, unit * (i + 1), opts));
  }

  const quotes = cfg.sizesG
    .filter(g => g <= stockG)
    .map(g => quoteGrams(pricePerGramUsd, g, opts))
    .filter(q => q.totalUsd >= cfg.minTotalUsd);

  const wholeG = opts.wholePieceGrams;
  if (wholeG != null && wholeG <= stockG && !quotes.some(q => q.grams === wholeG)) {
    quotes.push(quoteGrams(pricePerGramUsd, wholeG, opts));
  }
  return quotes;
}


/**
 * What a pressed form is CALLED. Not what it weighs.
 *
 * This table used to carry a weight per form too: a Cake was 357 g, a Brick
 * 250 g, a Tuo 100 g. Those are the common sizes of each, and the shop
 * presented them as facts about the tea in front of the reader. The 1998 Small
 * Tuo is pressed in 5 g pieces, so its page offered "The tuo, 100 g, unbroken,
 * keeps ageing", an amount that does not exist, at a price the curve had
 * already discounted, because a whole piece is the one amount exempt from the
 * handling fee. A guessed weight is a guessed price.
 *
 * The weight is `pieceWeightG` on the tea now, entered by whoever bought it.
 * When nobody has entered one there is no whole-piece amount, which is the
 * honest state: the shop does not know.
 */
export const PRESSED_FORM_LABEL: Record<string, string> = {
  Cake: 'Cake',
  Brick: 'Brick',
  Tuo: 'Tuo',
  Ball: 'Ball',
};

/**
 * The whole piece a reader can actually buy, if there is one.
 *
 * A piece lighter than the smallest amount on the ladder is not an amount, it
 * is how the tea is packed: nobody buys one 5 g tuo, they buy 25 g and receive
 * five of them. So it earns a row only when one piece is at least the smallest
 * thing the shop sells.
 */
export function wholePieceOf(
  form: string | undefined,
  pieceWeightG: number | undefined,
  config: TeaPricingConfig = TEA_PRICING,
): { label: string; grams: number } | undefined {
  const label = form ? PRESSED_FORM_LABEL[form] : undefined;
  if (!label || !pieceWeightG || pieceWeightG <= 0) return undefined;
  const smallestOffered = Math.min(...config.sizesG);
  if (pieceWeightG < smallestOffered) return undefined;
  return { label, grams: pieceWeightG };
}

/**
 * A tea that leaves the shop only as whole units, and what one unit weighs.
 *
 * Most tea is weighed out: any amount is a real amount, and the ladder below
 * offers the sizes worth offering. Some tea is not. The 1993 Y562 is a sealed
 * 100 g box and the shop has no way to open one, so 25 g of it was an amount
 * that could be chosen, priced and ordered, and then could not be sent. That
 * is a worse failure than a wrong price: the reader is told they can have
 * something they cannot.
 *
 * `soldInWholeUnits` is the operator saying so, and `pieceWeightG` is what one
 * unit weighs, the same column the pressed forms already use, because a box
 * and a cake are the same fact from the shop's side: one indivisible thing.
 * Without a weight there is no unit, which is the honest state rather than a
 * guess.
 */
export const WHOLE_UNIT_LABEL: Record<string, string> = {
  ...PRESSED_FORM_LABEL,
  Box: 'Box',
  Bag: 'Bag',
  Basket: 'Basket',
};

export function sellUnitOf(
  form: string | undefined,
  pieceWeightG: number | undefined,
  soldInWholeUnits: boolean | undefined,
): { label: string; grams: number } | undefined {
  if (!soldInWholeUnits || !pieceWeightG || pieceWeightG <= 0) return undefined;
  return { label: (form && WHOLE_UNIT_LABEL[form]) || 'Unit', grams: pieceWeightG };
}

/**
 * The one figure a reader sees for a chosen weight, wherever it is shown.
 *
 * The product page's own ladder, its add-to-order total, and the shop grid
 * all name a weight and want the same total back for it. Getting there takes
 * two steps in order: work out whether this tea has a whole piece (a sealed
 * unit counts as one), then round the weight up to that piece before pricing
 * it, exactly as the product page's own slider does. A tea sold in sealed
 * units has no arbitrary gram amount to price, so a chosen weight that falls
 * between units is rounded up to the next one it can actually send, never
 * down. Skipping that step is how the grid used to charge for grams nobody
 * could buy, on top of leaving out the handling fee entirely.
 */
export function quoteForDisplay(
  pricePerGramUsd: number,
  chosenGrams: number,
  opts: {
    form?: string;
    pieceWeightG?: number;
    soldInWholeUnits?: boolean;
    stockG?: number;
    config?: TeaPricingConfig;
  } = {},
): Quote {
  const sellUnit = sellUnitOf(opts.form, opts.pieceWeightG, opts.soldInWholeUnits);
  const wholePiece = sellUnit ?? wholePieceOf(opts.form, opts.pieceWeightG, opts.config);
  const unitGrams = sellUnit?.grams;
  const stockG = opts.stockG ?? 0;
  const grams = unitGrams
    ? snapToUnit(chosenGrams, unitGrams, Math.max(unitGrams, Math.floor(stockG)))
    : chosenGrams;
  return quoteGrams(pricePerGramUsd, grams, { wholePieceGrams: wholePiece?.grams, config: opts.config });
}
