import { useRef, useState } from 'react';
import type { Product } from '../../types';

type Gate = 'isPublic' | 'shownInShop';
type ListingStock = Pick<Product, 'status' | 'isPublic' | 'shownInShop'>;

export function stockPublicationState({ status, isPublic, shownInShop }: ListingStock, canPublish: boolean): string {
  if (status === 'Archived') return 'Archived';
  if (status === 'Draft') return canPublish ? 'Private draft' : 'Private draft · details needed';
  if (!isPublic) return 'Private · listing off';
  if (!shownInShop) return 'Waiting for the shop owner';
  return status === 'Sold Out' ? 'Visible · sold out' : 'Visible to customers';
}

export function StockPublication({ product, isOwner, canList, canPublish, problem, save, markReady }: {
  product: ListingStock;
  isOwner: boolean;
  canList: boolean;
  canPublish: boolean;
  problem?: string | null;
  save: (gate: Gate, value: boolean) => Promise<void>;
  markReady: () => Promise<void>;
}) {
  const saving = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const { isPublic, shownInShop, status } = product;
  const available = status === 'Active' || status === 'Sold Out';
  const visible = available && isPublic && shownInShop;


  const update = async (write: () => Promise<void>) => {
    if (saving.current) return;
    saving.current = true;
    setPending(true);
    setError('');
    try {
      await write();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save Shop visibility. Try again.');
    } finally {
      saving.current = false;
      setPending(false);
    }
  };

  const action = (label: string, gate: Gate, value: boolean, primary = false) => (
    <button type="button"
      className={`tap-target min-h-11 rounded px-3 text-ui-13 disabled:cursor-not-allowed disabled:opacity-50 ${primary ? 'cta-solid' : 'text-tea-text-sec hover:text-tea-text'}`}
      disabled={pending || (value && (!canPublish || !available))}
      onClick={() => void update(() => save(gate, value))}>
      {label}
    </button>
  );

  return (
    <section aria-label="Listing controls" className="w-full space-y-1.5 p-2">
      {pending && <p role="status" className="text-ui-13 text-tea-text-sec">Saving Shop visibility…</p>}
      {error && <p role="alert" className="text-ui-12 text-tea-text-sec">{error}</p>}
      {!visible && !pending && !error && (problem || status === 'Archived' || isPublic && !shownInShop && !isOwner || !isPublic && !canList) && (
        <p className="text-ui-12 text-tea-text-sec">
          {problem || (status === 'Archived' ? 'Restore the tea before listing it.'
            : isPublic ? 'Only a shop owner can make this listing visible.' : 'Someone with publishing access must enable this listing.')}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-end gap-x-2">
        {status === 'Draft' && canList && (
          <button type="button" className="tap-target min-h-11 rounded px-3 text-ui-13 cta-solid disabled:opacity-50"
            disabled={pending || !canPublish} onClick={() => void update(markReady)}>
            {isPublic && shownInShop ? 'Activate Shop listing' : 'Mark ready'}
          </button>
        )}
        {available && !isPublic && canList && action(shownInShop ? 'List in Shop' : 'Approve listing', 'isPublic', true, true)}
        {available && isPublic && !shownInShop && isOwner && action('Show in this shop', 'shownInShop', true, true)}
        {visible && isOwner && action('Hide from this shop', 'shownInShop', false)}
        {isPublic && canList && action('Turn off listing', 'isPublic', false)}
        {!isPublic && shownInShop && isOwner && action('Hold at this shop', 'shownInShop', false)}
      </div>
    </section>
  );
}
