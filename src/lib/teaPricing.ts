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
 * SHIPPED DARK. `handlingUsd` is 0, so every price is exactly what it was
 * before this file existed and `sizesG` is the pair the shop already offered.
 * Setting the handling amount and widening the sizes turns the whole ladder on
 * at once, everywhere it is read from.
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
  handlingUsd: 0,
  sizesG: [50, 100],
  minTotalUsd: 0,
};

/** The full ladder, for when the shop is ready to turn it on. */
export const TEA_PRICING_LADDER: TeaPricingConfig = {
  handlingUsd: 2,
  sizesG: [10, 25, 50, 100, 200],
  minTotalUsd: 5,
};

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
 * `wholePieceGrams` is the weight of an unbroken cake, brick or tuo when the
 * tea is sold as one. Asking for exactly that weight is asking for the piece
 * itself, so it ships as it is and carries no handling.
 */
export function quoteGrams(
  pricePerGramUsd: number,
  grams: number,
  opts: { wholePieceGrams?: number; config?: TeaPricingConfig } = {},
): Quote {
  const cfg = opts.config ?? TEA_PRICING;
  const whole = opts.wholePieceGrams != null && grams === opts.wholePieceGrams;
  const totalUsd = pricePerGramUsd * grams + (whole ? 0 : cfg.handlingUsd);
  return {
    grams,
    totalUsd,
    perGramUsd: grams > 0 ? totalUsd / grams : pricePerGramUsd,
    whole,
  };
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
  opts: { wholePieceGrams?: number; config?: TeaPricingConfig } = {},
): Quote[] {
  const cfg = opts.config ?? TEA_PRICING;
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
