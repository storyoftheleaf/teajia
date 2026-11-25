import type { Product } from '../types';

/** Only recorded stock facts become tasks. A missing count is not low stock. */
export function dashboardStockSignals(products: readonly Product[]) {
  const holdings = products.filter(p => p.status !== 'Archived');
  return {
    recheck: holdings.filter(p => p.recheckStock || !p.stockKnownAt),
    low: holdings.filter(p => p.status === 'Active' && p.type !== 'Teaware' && !p.recheckStock && !!p.stockKnownAt && p.stockGrams > 0 && p.lowStockThreshold > 0 && p.stockGrams <= p.lowStockThreshold),
    incoming: holdings.filter(p => p.inTransit),
  };
}

export type TeaQuestionKind = 'cost' | 'weight';

export interface TeaQuestion {
  kind: TeaQuestionKind;
  product: Product;
}

/**
 * Teas the shop cannot price until Adrian answers one thing. The price is
 * cost per gram, so it needs the cost and the grams that cost bought.
 *
 * A blank cost is a question; a typed 0 is an answer and is left alone
 * (CLAUDE.md: "Anything entered is the number, zero included"). A bag of
 * 0 g is never a real purchase, so it is asked about like a blank one.
 * Cost is asked first: a weight without a cost still gives no price.
 */
export function teaQuestions(products: readonly Product[]): TeaQuestion[] {
  const questions: TeaQuestion[] = [];
  for (const product of products) {
    if (product.status === 'Archived' || product.type === 'Teaware') continue;
    if (product.costAmount == null) questions.push({ kind: 'cost', product });
    else if (!(Number(product.quantityPurchased) > 0)) questions.push({ kind: 'weight', product });
  }
  return questions;
}
