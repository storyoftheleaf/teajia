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

function requireFinite(name: string, value: number): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${name} must be finite`);
  }
}

function money(value: number): number {
  requireNonNegative('money value', value);
  const cents = value * 100;
  requireFinite('money cents', cents);
  return Math.round(cents) / 100;
}

function requireNonNegative(name: string, value: number): void {
  requireFinite(name, value);
  if (value < 0) {
    throw new RangeError(`${name} must be non-negative`);
  }
}

export function deriveConfirmedInvoiceLine(input: ConfirmedInvoiceLineInput) {
  requireFinite('quantity', input.quantity);
  if (input.recommendedQuantity !== null) {
    requireNonNegative('recommendedQuantity', input.recommendedQuantity);
  }
  if (input.recommendedPriceUsd !== null) {
    requireNonNegative('recommendedPriceUsd', input.recommendedPriceUsd);
  }
  if (input.catalogUnitPriceUsd !== null) {
    requireNonNegative('catalogUnitPriceUsd', input.catalogUnitPriceUsd);
  }

  const quantity = Math.max(1, Math.round(input.quantity));
  const recommendedQuantity = input.recommendedQuantity ?? 0;
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
  requireNonNegative('quantity', quantity);
  requireNonNegative('unitPriceUsd', unitPriceUsd);
  return money(quantity * unitPriceUsd);
}

export function repairCandidate(input: RepairCandidateInput) {
  const corrected = deriveConfirmedInvoiceLine(input);
  requireNonNegative('storedPriceAtSale', input.storedPriceAtSale);
  if (!input.sourceCollectionId || corrected.quantity <= 1) return null;

  const historicalLineTotal = corrected.lineTotalUsd;
  if (money(input.storedPriceAtSale) !== historicalLineTotal) return null;

  const currentLineTotalUsd = invoiceLineTotal(corrected.quantity, input.storedPriceAtSale);
  if (currentLineTotalUsd === historicalLineTotal) return null;

  return {
    correctedUnitPriceUsd: corrected.unitPriceUsd,
    currentLineTotalUsd,
    correctedLineTotalUsd: historicalLineTotal,
  };
}
