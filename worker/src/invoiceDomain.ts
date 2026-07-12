export interface ConfirmedInvoiceLineInput {
  quantity: number;
  recommendedQuantity: number | null;
  recommendedPriceUsd: number | null;
  catalogUnitPriceUsd: number | null;
}

export interface RepairCandidateInput extends ConfirmedInvoiceLineInput {
  sourceCollectionId: string | null;
  storedPriceAtSale: number;
}

const money = (value: number): number => Math.round(value * 100) / 100;

export function deriveConfirmedInvoiceLine(input: ConfirmedInvoiceLineInput) {
  const quantity = Math.max(1, Math.round(Number(input.quantity) || 1));
  const recommendedQuantity = Number(input.recommendedQuantity);
  let lineTotalUsd = 0;

  if (input.recommendedPriceUsd !== null && Number.isFinite(recommendedQuantity) && recommendedQuantity > 0) {
    lineTotalUsd = money((input.recommendedPriceUsd / recommendedQuantity) * quantity);
  } else if (input.recommendedPriceUsd !== null) {
    lineTotalUsd = money(input.recommendedPriceUsd);
  } else if (input.catalogUnitPriceUsd !== null) {
    lineTotalUsd = money(input.catalogUnitPriceUsd * quantity);
  }

  return {
    quantity,
    unitPriceUsd: lineTotalUsd / quantity,
    lineTotalUsd,
  };
}

export function invoiceLineTotal(quantity: number, unitPriceUsd: number): number {
  return money(quantity * unitPriceUsd);
}

export function repairCandidate(input: RepairCandidateInput) {
  if (!input.sourceCollectionId || input.quantity <= 1) return null;

  const corrected = deriveConfirmedInvoiceLine(input);
  const historicalLineTotal = corrected.lineTotalUsd;
  if (money(input.storedPriceAtSale) !== historicalLineTotal) return null;

  const currentLineTotalUsd = invoiceLineTotal(input.quantity, input.storedPriceAtSale);
  if (currentLineTotalUsd === historicalLineTotal) return null;

  return {
    correctedUnitPriceUsd: corrected.unitPriceUsd,
    currentLineTotalUsd,
    correctedLineTotalUsd: historicalLineTotal,
  };
}
