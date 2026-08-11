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

export interface RetailInvoiceLineInput {
  product_id: string | null;
  custom_name: string | null;
  quantity: number;
  price_at_sale: number;
}

export interface RetailInvoiceInput {
  customer_name: string;
  customer_whatsapp: string | null;
  customer_id: string | null;
  display_currency: string;
  shipping_cost_usd: number;
  status: 'Draft' | 'Pending';
  notes: string | null;
  source_event_id: string | null;
  payment_status: 'unpaid';
  lineItems: RetailInvoiceLineInput[];
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

function optionalText(value: unknown, name: string): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new RangeError(`${name} must be text`);
  return value.trim() || null;
}

function requiredText(value: unknown, name: string): string {
  const normalized = optionalText(value, name);
  if (!normalized) throw new RangeError(`${name} is required`);
  return normalized;
}

export function validateRetailInvoiceInput(input: unknown): RetailInvoiceInput {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new RangeError('invoice input is required');
  }
  const raw = input as Record<string, unknown>;
  const customerName = requiredText(raw.customer_name, 'customer_name');
  if (!Array.isArray(raw.lineItems) || raw.lineItems.length === 0) {
    throw new RangeError('lineItems must contain at least one line');
  }

  const shippingCost = raw.shipping_cost_usd ?? 0;
  if (typeof shippingCost !== 'number') throw new RangeError('shipping_cost_usd must be a number');
  requireNonNegative('shipping_cost_usd', shippingCost);

  const rawCurrency = raw.display_currency == null ? 'USD' : requiredText(raw.display_currency, 'display_currency');
  const displayCurrency = rawCurrency.trim();
  if (displayCurrency.length > 12 || !/^[A-Za-z][A-Za-z0-9]*$/.test(displayCurrency)) {
    throw new RangeError('display_currency must be an alphanumeric currency code');
  }

  const status = raw.status ?? 'Pending';
  if (status !== 'Draft' && status !== 'Pending') throw new RangeError('status must be Draft or Pending');
  const paymentStatus = raw.payment_status ?? 'unpaid';
  if (paymentStatus !== 'unpaid') throw new RangeError('payment_status must be unpaid');

  const lineItems = raw.lineItems.map((value, index): RetailInvoiceLineInput => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new RangeError(`lineItems[${index}] must be an object`);
    }
    const line = value as Record<string, unknown>;
    const productId = optionalText(line.product_id, `lineItems[${index}].product_id`);
    const customName = optionalText(line.custom_name, `lineItems[${index}].custom_name`);
    if (!productId && !customName) throw new RangeError(`lineItems[${index}] requires product_id or custom_name`);
    if (typeof line.quantity !== 'number' || !Number.isFinite(line.quantity) || line.quantity <= 0) {
      throw new RangeError(`lineItems[${index}].quantity must be a positive finite number`);
    }
    if (typeof line.price_at_sale !== 'number') throw new RangeError(`lineItems[${index}].price_at_sale must be a number`);
    requireNonNegative(`lineItems[${index}].price_at_sale`, line.price_at_sale);
    return { product_id: productId, custom_name: customName, quantity: line.quantity, price_at_sale: line.price_at_sale };
  });

  return {
    customer_name: customerName,
    customer_whatsapp: optionalText(raw.customer_whatsapp, 'customer_whatsapp'),
    customer_id: optionalText(raw.customer_id, 'customer_id'),
    display_currency: displayCurrency,
    shipping_cost_usd: shippingCost,
    status,
    notes: optionalText(raw.notes, 'notes'),
    source_event_id: optionalText(raw.source_event_id, 'source_event_id'),
    payment_status: paymentStatus,
    lineItems,
  };
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
