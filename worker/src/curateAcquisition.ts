/**
 * How much was bought, in what, and where it is - one reading, two doors.
 *
 * `curate_add_tea` (a tea entered as Adrian says it) and the manual intake
 * items door (a draft whose analysis failed, rebuilt by hand) both need the
 * same three facts: a quantity, the unit it was said in, and whether the tea
 * is ordered, travelling, or already here. Two readings of that would be the
 * four-freight-rates shape again, so there is one.
 *
 * Nothing here guesses. A unit nobody named is refused; a cake, can or piece
 * of TEA with no stated pack weight is refused rather than converted at some
 * assumed weight, because a cake is not a number of grams until somebody says
 * how many grams it is. The refusals are sentences an agent can read out.
 */

/** What a quantity may be said in, and what one of them weighs in grams. */
const ACQUISITION_UNIT_GRAMS: Record<string, number | null> = {
  g: 1,
  gram: 1,
  kg: 1000,
  jin: 500,
  piece: null,
  can: null,
  cake: null,
};

export const ACQUISITION_UNITS = ['g', 'kg', 'jin', 'piece', 'can', 'cake'] as const;

/**
 * Where a bought tea is. `ordered` and `in_transit` are both "bought, not here
 * yet" and both wait as a pending arrival; `received` is here and goes into
 * stock through the same service the app's own arrivals screen uses.
 */
export const ACQUISITION_STATES = ['ordered', 'in_transit', 'received'] as const;
export type AcquisitionState = (typeof ACQUISITION_STATES)[number];

export const ACQUISITION_PURPOSES = ['working', 'sample', 'personal'] as const;
export type AcquisitionPurpose = (typeof ACQUISITION_PURPOSES)[number];

export function isAcquisitionState(value: unknown): value is AcquisitionState {
  return typeof value === 'string' && (ACQUISITION_STATES as readonly string[]).includes(value);
}

export function isAcquisitionPurpose(value: unknown): value is AcquisitionPurpose {
  return typeof value === 'string' && (ACQUISITION_PURPOSES as readonly string[]).includes(value);
}

/** Ordered and in transit wait to be approved; received is already here. */
export function waitsAsArrival(state: AcquisitionState): boolean {
  return state === 'ordered' || state === 'in_transit';
}

export function acquisitionStateSaid(state: AcquisitionState): string {
  if (state === 'ordered') return 'ordered, not shipped yet';
  return state === 'in_transit' ? 'on the way' : 'here, going into stock';
}

export interface AcquiredQuantity {
  /** What one pack weighs, in `weightUnit`. */
  packWeight: number;
  weightUnit: 'g' | 'kg' | 'count';
  packCount: number;
  /** Total grams, or null when the quantity is a count of pieces. */
  grams: number | null;
  /** Total pieces, or null when the quantity is a weight. */
  units: number | null;
  said: string;
}

export interface AcquiredQuantityContext {
  category: 'tea' | 'teaware';
  /** What one piece, can or cake weighs, when somebody has said. */
  packSizeGrams?: number | null;
}

const round = (value: number) => Math.round(value * 1000) / 1000;

/**
 * Read "two kilos", "four cakes", "500 g" into the pack facts the import
 * record and the receipt already speak. The amount is the TOTAL bought: a
 * count unit means that many pieces, a weight unit means that much weight.
 */
export function readAcquiredQuantity(raw: unknown, context: AcquiredQuantityContext): AcquiredQuantity {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`quantity must be an object: {amount, unit}, unit one of ${ACQUISITION_UNITS.join(', ')}`);
  }
  const input = raw as Record<string, unknown>;
  const amount = typeof input.amount === 'number' ? input.amount : Number(String(input.amount ?? '').replace(/[,\s]/g, ''));
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('quantity.amount must be a number greater than zero');
  const unit = typeof input.unit === 'string' ? input.unit.trim().toLowerCase() : '';
  if (!unit || !Object.hasOwn(ACQUISITION_UNIT_GRAMS, unit)) {
    throw new Error(`quantity.unit must be one of ${ACQUISITION_UNITS.join(', ')} (piece, can and cake are counts, not weights)`);
  }
  const gramsEach = ACQUISITION_UNIT_GRAMS[unit];
  if (gramsEach != null) {
    if (context.category === 'teaware') throw new Error('Teaware is counted in pieces, not weighed: use piece for quantity.unit');
    const grams = round(amount * gramsEach);
    return {
      packWeight: unit === 'jin' ? grams : amount,
      weightUnit: unit === 'kg' ? 'kg' : 'g',
      packCount: 1,
      grams,
      units: null,
      said: `${amount} ${unit} (${grams} g)`,
    };
  }
  const plural = amount === 1 ? '' : 's';
  if (!Number.isInteger(amount)) throw new Error(`A count of ${unit}${plural} must be a whole number`);
  const stated = context.packSizeGrams;
  const packSizeGrams = stated != null && Number.isFinite(Number(stated)) && Number(stated) > 0 ? Number(stated) : null;
  if (context.category === 'tea' && packSizeGrams == null) {
    throw new Error(`${amount} ${unit}${plural} of tea is not a weight until somebody says what one weighs. Give pack_size_grams, or say the quantity in g, kg or jin.`);
  }
  if (packSizeGrams == null) {
    return { packWeight: 1, weightUnit: 'count', packCount: amount, grams: null, units: amount, said: `${amount} ${unit}${plural}` };
  }
  const grams = round(packSizeGrams * amount);
  return {
    packWeight: packSizeGrams,
    weightUnit: 'g',
    packCount: amount,
    grams,
    units: null,
    said: `${amount} x ${packSizeGrams} g ${unit}${plural} (${grams} g)`,
  };
}

/**
 * The arrival row a bought tea waits in, which is the row the app's own
 * arrivals screen already reads. Written in one place so the direct door
 * cannot invent a second shape for it. `acquisition_state` is the one fact
 * the table had no column for before migration `0044`, and a fact with no
 * field is the thing that ends up in notes.
 */
export interface AcquisitionProposal {
  id: string;
  account_id: string;
  compass_entry_id: string | null;
  product_id: string | null;
  product_name: string | null;
  product_type: string | null;
  purpose: AcquisitionPurpose;
  quantity: number;
  unit: 'g' | 'unit';
  acquisition_kind: 'purchase' | 'free_sample' | 'gift' | 'transfer' | 'other';
  acquisition_state: AcquisitionState;
  idempotency_key: string;
  proposed_by_user_id: string;
}

export function acquisitionProposalColumns(input: {
  id: string;
  accountId: string;
  userId: string;
  compassEntryId: string | null;
  productId?: string | null;
  name: string | null;
  type: string | null;
  purpose: AcquisitionPurpose;
  quantity: AcquiredQuantity;
  state: AcquisitionState;
  kind?: AcquisitionProposal['acquisition_kind'];
  idempotencyKey: string;
}): AcquisitionProposal {
  const quantity = input.quantity.grams ?? input.quantity.units;
  if (quantity == null || !(quantity > 0)) throw new Error('An arrival needs a quantity greater than zero');
  return {
    id: input.id,
    account_id: input.accountId,
    compass_entry_id: input.compassEntryId,
    product_id: input.productId ?? null,
    product_name: input.name,
    product_type: input.type,
    purpose: input.purpose,
    quantity,
    unit: input.quantity.grams != null ? 'g' : 'unit',
    acquisition_kind: input.kind ?? 'purchase',
    acquisition_state: input.state,
    idempotency_key: input.idempotencyKey,
    proposed_by_user_id: input.userId,
  };
}
