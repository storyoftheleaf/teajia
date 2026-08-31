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


/**
 * The weight of one unbroken piece, by the form a tea is pressed into.
 *
 * Lives here rather than in the commerce footer because the pricing curve is
 * what needs it: a whole piece is the one amount that carries no handling fee,
 * so the cart, the card and the bar all have to agree on how heavy one is.
 * Kept as a small table rather than read from the tea-wisdom module, which
 * would pull that whole module into the customer bundle.
 */
export const WHOLE_PIECE: Record<string, { label: string; grams: number }> = {
  Cake: { label: 'Cake', grams: 357 },
  Brick: { label: 'Brick', grams: 250 },
  Tuo: { label: 'Tuo', grams: 100 },
  Ball: { label: 'Ball', grams: 100 },
};
