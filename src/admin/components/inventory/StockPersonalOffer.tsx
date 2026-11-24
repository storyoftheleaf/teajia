import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Modal } from '../../../components/shared/Modal';
import { Button } from '../../../components/shared/Button';
import { TeaChestMoneyFields, emptyMoneyFields } from '../../../components/AccountPanel/TeaChestMoneyFields';
import { TeaCard, TeaCardMeta, TeaCardMetric, TeaCardTitle } from '../../../components/tea/TeaCard';
import type { ShelfOfferInput, TeaChestAccount } from '../../../lib/api';
import { personalStockOfferApi } from '../../../lib/personalStockOfferApi';
import { formatPersonalTeaMoney, readPersonalTeaMoney } from '../../../lib/personalTeaMoney';
import { buildPublicProductHref } from '../../../lib/publicProductNavigation';
import { refreshCommerceQueries } from '../../../lib/refreshCommerce';
import { INVENTORY_TEA_TYPES } from '../../../wisdom';
import { enteredNumber } from '../../productUpdatePayload';
import type { Product } from '../../types';
import { PERSONAL_SELLER_WAITING } from '../../../../shared/personalSeller';

const field = 'block w-full min-w-0 rounded-md border border-tea-border bg-tea-bg px-3 py-2 text-ui-14 text-tea-text focus:border-tea-gold';
const label = 'block min-w-0 space-y-1 text-ui-13 text-tea-text-sec';

export function StockPersonalOffer({ product, account }: { product: Product; account: TeaChestAccount }) {
  const client = useQueryClient();
  const key = ['stock-personal-offer', account.id, product.id];
  const [open, setOpen] = useState(false);
  const { data, isPending, error, refetch } = useQuery({
    queryKey: key,
    queryFn: () => personalStockOfferApi.get(product.id),
    retry: false,
  });
  const offer = data?.offer;
  const refresh = async (changedProductId: string) => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ['contributor'] }),
      refreshCommerceQueries(client, account.id, { changedProductIds: [product.id, changedProductId] }),
    ]);
  };
  const preview = useMutation({ mutationFn: (draft: ShelfOfferInput) => personalStockOfferApi.preview(product.id, draft) });
  const publish = useMutation({
    mutationFn: ({ draft, price }: { draft: ShelfOfferInput; price: number }) => personalStockOfferApi.publish(product.id, draft, price),
    onSuccess: async ({ offer: published }) => {
      client.setQueryData(key, { offer: published });
      setOpen(false);
      await refresh(published.product_id);
    },
  });
  const withdraw = useMutation({
    mutationFn: (_offeredProductId: string) => personalStockOfferApi.withdraw(product.id),
    onSuccess: async (_, offeredProductId) => {
      client.setQueryData(key, { offer: null });
      await refresh(offeredProductId);
    },
  });
  const waiting = preview.isPending || publish.isPending || withdraw.isPending;
  const status = isPending ? 'Checking availability…' : error ? 'Offer status unavailable'
    : offer ? (offer.available_grams > 0 ? `${offer.grams} g available` : 'Sold out') : 'Private stock';
  return (
    <section aria-label="Seller offer" className="mx-3 mb-3">
      <TeaCard teaType={product.type} title={<TeaCardTitle>Shop offer</TeaCardTitle>}
        meta={<TeaCardMeta primary={status} trailing={offer && formatPersonalTeaMoney(offer.price_usd, 'USD')} />}
        actions={<>
          {error && <Button type="button" variant="quiet" onClick={() => void refetch()}>Retry</Button>}
          {!error && !isPending && !offer && account.seller_approved === 1 && <Button type="button" disabled={waiting} onClick={() => {
            preview.reset(); publish.reset(); setOpen(true);
          }}>Offer for sale</Button>}
          {offer && <>
            <Link className="btn-secondary" to={buildPublicProductHref({ id: offer.product_id }, account.slug)}>View offer</Link>
            <Button type="button" variant="quiet" disabled={waiting} onClick={() => withdraw.mutate(offer.product_id)}>{withdraw.isPending ? 'Withdrawing…' : 'Withdraw offer'}</Button>
          </>}
        </>} />
      {/* Only people Teajia approved may sell; everyone else keeps a private record. */}
      {!error && !isPending && !offer && account.seller_approved !== 1 && (
        <p className="mt-2 text-ui-13 text-tea-text-sec" data-testid="seller-waiting">{PERSONAL_SELLER_WAITING}</p>
      )}
      {withdraw.error && <p role="alert" className="text-ui-13 text-tea-text-sec">{withdraw.error.message}</p>}
      <Modal isOpen={open} onClose={() => { if (!waiting) setOpen(false); }} title={preview.data ? 'Review your offer' : 'Offer for sale'}>
        {open && <div className="px-4 pb-4">
          <OfferForm type={product.type} availableGrams={product.stockGrams} waiting={waiting}
            draft={preview.variables} priceUsd={preview.data?.price_usd}
            error={publish.error ?? preview.error}
            onPreview={draft => preview.mutate(draft)} onCancel={() => setOpen(false)} onBack={() => { preview.reset(); publish.reset(); }}
            onPublish={(draft, price) => publish.mutate({ draft, price })} />
        </div>}
      </Modal>
    </section>
  );
}

export function StockOfferSource({ product, titleId }: { product: Product; titleId?: string }) {
  return <section className="p-3">
    <TeaCard teaType={product.type} title={<TeaCardTitle id={titleId}>{product.givenName || product.productName}</TeaCardTitle>}
      meta={<TeaCardMeta primary="Shop offer" />}
      actions={<Link className="btn-secondary" to={`/admin/stock?panel=${encodeURIComponent(product.personalOfferSourceId!)}`}>Open private holding</Link>}
    />
  </section>;
}

type OfferFormProps = {
  type: Product['type'];
  availableGrams: number;
  waiting: boolean;
  draft?: ShelfOfferInput;
  priceUsd?: number;
  error: Error | null;
  onPreview: (draft: ShelfOfferInput) => void;
  onPublish: (draft: ShelfOfferInput, price: number) => void;
  onBack: () => void;
  onCancel: () => void;
};

function OfferForm({ type, availableGrams, waiting, draft, priceUsd, error, onPreview, onPublish, onBack, onCancel }: OfferFormProps) {
  const [name, setName] = useState('');
  const [grams, setGrams] = useState('');
  const [teaType, setTeaType] = useState<string>(type);
  const [year, setYear] = useState('');
  const [origin, setOrigin] = useState('');
  const [moneyFields, setMoneyFields] = useState(emptyMoneyFields);
  const gramsValue = enteredNumber(grams);
  const money = readPersonalTeaMoney(enteredNumber(moneyFields.amount), moneyFields.currency);
  const valid = name.trim() && teaType && gramsValue != null && Number.isInteger(gramsValue) && gramsValue > 0 && gramsValue <= Math.min(9999, availableGrams)
    && money && money.amount > 0 && (!year || /^[1-9]\d{3}$/.test(year));
  const errorLine = error && <p role="alert" className="text-ui-13 text-tea-text-sec">{error.message}</p>;

  if (draft && priceUsd != null) return (
    <div className="space-y-3">
      <TeaCard teaType={draft.type ?? ''} title={<TeaCardTitle>{draft.name}</TeaCardTitle>}
        meta={<TeaCardMeta primary={[draft.origin, draft.year].filter(Boolean).join(' · ')} type={draft.type} />}
        metricsLabel="Buyer price" metrics={<>
          <TeaCardMetric label="Pack">{draft.grams} g</TeaCardMetric>
          <TeaCardMetric label="Price">{formatPersonalTeaMoney(priceUsd, 'USD')}</TeaCardMetric>
        </>} />
      <p className="text-ui-13 text-tea-text-sec">Buyers order this pack through your shop and pay you directly.</p>
      {errorLine}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button type="button" variant="secondary" disabled={waiting} onClick={onBack}>Back to details</Button>
        <Button type="button" disabled={waiting} onClick={() => onPublish(draft, priceUsd)}>{waiting ? 'Publishing…' : 'Publish offer'}</Button>
      </div>
    </div>
  );

  return (
    <form className="space-y-3" onSubmit={event => {
      event.preventDefault();
      if (valid && money && gramsValue != null) onPreview({
        name: name.trim(), grams: gramsValue, type: teaType, year: year ? Number(year) : null, origin: origin.trim() || null,
        price_amount: money.amount, price_currency: money.currency,
      });
    }}>
      <label className={label}>Public tea name<input className={field} required maxLength={120} value={name} onChange={event => setName(event.target.value)} /></label>
      <label className={label}>Pack weight (g)<input className={field} required type="number" inputMode="numeric" min={1} step={1} max={Math.min(9999, availableGrams)} value={grams} onChange={event => setGrams(event.target.value)} /><span>{availableGrams} g in private Stock</span></label>
      <TeaChestMoneyFields required positive label="Pack price" fieldClass={field} value={moneyFields} onChange={setMoneyFields} />
      <div className="grid grid-cols-2 gap-2">
        <label className={label}>Tea type<select className={field} required value={teaType} onChange={event => setTeaType(event.target.value)}>
          <option value="">Select type</option>
          {INVENTORY_TEA_TYPES.map(option => <option key={option} value={option}>{option}</option>)}
        </select></label>
        <label className={label}>Year (optional)<input className={field} inputMode="numeric" maxLength={4} value={year} onChange={event => setYear(event.target.value)} /></label>
      </div>
      <label className={label}>Broad origin (optional)<input className={field} maxLength={100} value={origin} onChange={event => setOrigin(event.target.value)} /></label>
      {errorLine}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={waiting}>Cancel</Button>
        <Button type="submit" disabled={!valid || waiting}>{waiting ? 'Checking price…' : 'Preview offer'}</Button>
      </div>
    </form>
  );
}
