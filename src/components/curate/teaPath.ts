import type { Product } from '../../admin/types';
import type { CuratePurchaseReceipt } from '../../lib/api';
import type { LibraryPurchaseState } from '../../lib/libraryPurchaseState';
import { sharedStockRecordId } from '../../lib/sharedTeaRecord';
import { entryHasBeenTasted, entryIsSample, type TeaCompassEntry } from '../TeaCompass/types';

// One tea's path from the Library to a written-up, costed tea in Stock
// (Adrian, 2026-11-27: "a lot of parts but they're not fluidly all
// connected"). It only reads what is already stored: the tea, its arrivals and
// its Stock record. Nothing here writes, and a sample is never asked to be
// weighed (Adrian, 2026-11-27: "the sample doesn't need to be weighed").

export type TeaPathStepId = 'arrival' | 'taste' | 'decide' | 'stock' | 'amount' | 'cost' | 'writeup';

export interface TeaPathStep {
  id: TeaPathStepId;
  /** What the step is called once it is done. */
  doneLabel: string;
  /** What the step asks for while it is still to do. */
  todoLabel: string;
  done: boolean;
}

export interface TeaPath {
  steps: TeaPathStep[];
  /** The first step still to do, or null when the tea is all the way through. */
  next: TeaPathStep | null;
  /** Rejected: the path stops at the decision. */
  passed: boolean;
}

type StockFacts = Pick<Product, 'costAmount' | 'stockGrams' | 'stockVerifiedAt' | 'quantityUnits' | 'description' | 'status'>;

export interface TeaPathInput {
  entry: Pick<TeaCompassEntry, 'category' | 'decision' | 'status' | 'sampleState' | 'isSample' | 'tasting'>;
  purchaseStatus?: LibraryPurchaseState['status'];
  /** An arrival is waiting for Adrian's yes. */
  arrivalWaiting?: boolean;
  /** The tea's own Stock record, when it has one. */
  stock?: StockFacts | null;
}

const BOUGHT: ReadonlyArray<LibraryPurchaseState['status']> = ['draft', 'ordered', 'partially_received', 'received'];

export function teaPath({ entry, purchaseStatus, arrivalWaiting = false, stock }: TeaPathInput): TeaPath {
  const steps: TeaPathStep[] = [];
  const bought = BOUGHT.includes(purchaseStatus ?? 'none') || entry.status === 'incoming' || entry.status === 'in_stock';
  const inStock = !!stock && stock.status !== 'Archived';
  if (arrivalWaiting) steps.push({ id: 'arrival', doneLabel: 'Arrived', todoLabel: 'Arrival to approve', done: false });
  if (entry.category !== 'teaware') {
    steps.push({ id: 'taste', doneLabel: 'Tasted', todoLabel: 'Taste it', done: entryHasBeenTasted(entry) });
  }
  const passed = entry.decision === 'passed_on' && !bought && !inStock;
  steps.push({ id: 'decide', doneLabel: passed ? 'Rejected' : 'Chosen', todoLabel: 'Want it?', done: passed || entry.decision === 'selected' || bought || inStock });
  if (!passed) {
    steps.push({ id: 'stock', doneLabel: 'In Stock', todoLabel: 'Add to Stock', done: inStock });
    // A new Stock record starts at a zero nobody counted, so zero only counts
    // once someone has checked the shelf, or the tea has sold out.
    const amountKnown = inStock && (stock!.stockGrams > 0 || (stock!.quantityUnits ?? 0) > 0
      || stock!.stockVerifiedAt != null || stock!.status === 'Sold Out');
    steps.push({ id: 'amount', doneLabel: 'Amount known', todoLabel: 'How much is there', done: amountKnown });
    steps.push({ id: 'cost', doneLabel: 'Cost recorded', todoLabel: 'What it cost', done: inStock && stock!.costAmount != null });
    steps.push({ id: 'writeup', doneLabel: 'Written up', todoLabel: 'Write it up', done: inStock && !!stock!.description?.trim() });
  }
  return { steps, next: passed ? null : steps.find(step => !step.done) ?? null, passed };
}

export type WaitingGroupId = 'arrival' | 'taste' | 'decide' | 'stock' | 'amount' | 'cost' | 'writeup';

export interface WaitingGroup {
  id: WaitingGroupId;
  title: string;
  entries: TeaCompassEntry[];
}

const GROUP_TITLES: Record<WaitingGroupId, string> = {
  arrival: 'Arrivals to approve',
  taste: 'Samples to taste',
  decide: 'Tasted, want it?',
  stock: 'Chosen, not in Stock yet',
  amount: 'In Stock, how much is there?',
  cost: 'In Stock, what did it cost?',
  writeup: 'To write up',
};

const GROUP_ORDER: WaitingGroupId[] = ['arrival', 'taste', 'decide', 'stock', 'amount', 'cost', 'writeup'];

/** What is waiting on Adrian across the Library, each tea once, under its next step.
 *  A tea that is still waiting on its supplier (ordered, on the way) waits on
 *  nobody here, and neither does a tea nobody has decided to taste or buy. */
export function libraryWaiting({ entries, products, proposals, purchaseStatusFor }: {
  entries: readonly TeaCompassEntry[];
  products: readonly Product[];
  proposals: readonly CuratePurchaseReceipt[];
  purchaseStatusFor: (entry: TeaCompassEntry, productId?: string) => LibraryPurchaseState['status'];
}): WaitingGroup[] {
  const waitingArrivals = new Set(proposals.filter(p => p.status === 'pending' && p.compass_entry_id).map(p => p.compass_entry_id as string));
  const byId = new Map(products.map(product => [product.id, product]));
  const groups = new Map<WaitingGroupId, TeaCompassEntry[]>();
  for (const entry of entries) {
    if (entry.status === 'pass') continue;
    const productId = sharedStockRecordId(entry, products);
    const stock = productId ? byId.get(productId) ?? null : null;
    const purchaseStatus = purchaseStatusFor(entry, productId);
    const arrivalWaiting = waitingArrivals.has(entry.id);
    const path = teaPath({ entry, purchaseStatus, arrivalWaiting, stock });
    const { next } = path;
    if (!next) continue;
    let group: WaitingGroupId | null = next.id;
    // Untasted teas only wait on Adrian when they are samples in hand.
    if (group === 'taste' && !(entryIsSample(entry) && entry.sampleState !== 'requested')) group = null;
    // A tea no one has tasted or chosen is just in the Library, not waiting.
    if (group === 'decide' && !entryHasBeenTasted(entry)) group = null;
    // Ordered or on the way: the supplier owes the next move, not Adrian.
    if (group === 'stock' && ['ordered', 'partially_received'].includes(purchaseStatus)) group = null;
    if (!group) {
      // Bought teas still show their Stock gaps even before they are tasted.
      const later = path.steps.find(step => !step.done && ['amount', 'cost', 'writeup'].includes(step.id) && !!stock);
      if (!later) continue;
      group = later.id;
    }
    const list = groups.get(group) ?? [];
    list.push(entry);
    groups.set(group, list);
  }
  return GROUP_ORDER.filter(id => groups.has(id)).map(id => ({ id, title: GROUP_TITLES[id], entries: groups.get(id)! }));
}
