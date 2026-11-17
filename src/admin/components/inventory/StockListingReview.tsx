import { useState, type ComponentProps } from 'react';
import { Link } from 'react-router-dom';
import { Camera } from 'lucide-react';
import { CapturePhotoImage } from '../../../components/curate/CapturePhotoImage';
import { Modal } from '../../../components/shared/Modal';
import { Button } from '../../../components/shared/Button';
import { useShopPrice } from '../../../components/shop/shopPrice';
import { TeaCard, TeaCardMeta, TeaCardMetric, TeaCardTitle } from '../../../components/tea/TeaCard';
import { offeredSizes } from '../../../lib/teaPricing';
import { teaPurchaseQuote } from '../../../lib/shopPurchase';
import { sharedTeaRecordHref } from '../../../lib/sharedTeaRecord';
import { fmtNum } from '../../../utils/formatNumber';
import { productToInventoryItem } from '../../utils';
import type { Product } from '../../types';
import { ShopIntroductionReview } from './ShopIntroductionReview';
import { StockPublication, stockPublicationState } from './StockPublication';

type PublicationProps = Omit<ComponentProps<typeof StockPublication>, 'product'>;

export function StockListingReview({ product, entryId, applyWording, ...publication }: PublicationProps & {
  product: Product;
  entryId?: string;
  applyWording: (text: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const status = stockPublicationState(product, publication.canPublish);
  return <section aria-label="Shop publication" className="mx-3 mb-3">
    <TeaCard teaType={product.type}
      title={<TeaCardTitle>Shop listing</TeaCardTitle>}
      meta={<TeaCardMeta primary={status} />}
      actions={<Button type="button" size="sm" onClick={() => setOpen(true)}>Review listing</Button>}
    />
    <Modal isOpen={open} onClose={() => setOpen(false)} title="Review listing" className="!max-w-4xl">
      {open && <ListingContents product={product} entryId={entryId} applyWording={applyWording} publication={publication} />}
    </Modal>
  </section>;
}

function ListingContents({ product, entryId, applyWording, publication }: {
  product: Product;
  entryId?: string;
  applyWording: (text: string) => Promise<void>;
  publication: PublicationProps;
}) {
  const price = useShopPrice();
  const item = productToInventoryItem(product);
  const available = product.stockKnownAt && Number.isFinite(product.stockGrams) ? product.stockGrams : null;
  if (available == null || product.status === 'Sold Out') item.stock_g = 0;
  const [amount, setAmount] = useState(50);
  const [comparing, setComparing] = useState(false);
  const quote = item.category === 'tea' ? teaPurchaseQuote(item, amount) : null;
  const retail = product.fixedRetailPriceUSD ?? product.pricePerGramUSD;
  const units = product.quantityUnits ?? 0;
  const isWare = item.category === 'ware';
  const warePrice = isWare && units > 0 && retail != null && Number.isFinite(retail) ? price.total(retail) : null;
  const weights = quote && retail != null
    ? [...new Set([quote.grams, ...offeredSizes(retail, item.stock_g, quote).map(q => q.grams)])].sort((a, b) => a - b)
    : [];
  const status = stockPublicationState(product, publication.canPublish);

  return <div className="mx-auto max-w-4xl px-3 pb-3">
    <TeaCard teaType={product.type} testId="stock-listing-review"
      title={<TeaCardTitle as="h2">{product.givenName || product.productName}</TeaCardTitle>}
      meta={<TeaCardMeta primary={product.vendor || 'Supplier not recorded'} type={product.type} trailing={status} />}
      metricsLabel="Buyer price"
      metrics={<>
        <TeaCardMetric label="Available">{isWare ? `${fmtNum(units, 0)} units` : available == null ? 'Count needed' : `${fmtNum(available, 0)} g`}</TeaCardMetric>
        {quote && <TeaCardMetric label="Preview amount">
          <select aria-label="Preview amount" value={quote.grams} onChange={event => setAmount(Number(event.target.value))}
            className="tap-target min-h-11 min-w-0 max-w-full bg-tea-surface text-ui-13 text-tea-text">
            {weights.map(grams => <option key={grams} value={grams}>{fmtNum(grams, 0)} g</option>)}
          </select>
        </TeaCardMetric>}
        <TeaCardMetric label="Buyer total">
          <strong data-testid="listing-buyer-total" className="break-words text-ui-16 text-tea-text">{quote ? price.total(quote.totalUsd) : warePrice ?? 'Unavailable'}</strong>
        </TeaCardMetric>
      </>}
      actions={<StockPublication product={product} {...publication} />}
    >
      <div className="space-y-4 px-3 py-3">
        {quote && <p className="text-ui-13 text-tea-text-sec">
          Tea {price.perGramExact(quote.leafUsd)}
          {quote.handlingUsd > 0 ? ` · Handling ${price.perGramExact(quote.handlingUsd)}` : ' · No handling charge'}
        </p>}
        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <div className={comparing ? 'min-w-0 sm:col-span-2' : 'min-w-0'}>
            <ShopIntroductionReview productId={product.id} entryId={entryId} introduction={product.description || ''}
              live={Boolean(product.isPublic && product.shownInShop && ['Active', 'Sold Out'].includes(product.status))}
              onApply={applyWording} onCompareChange={setComparing} />
          </div>
          {!comparing && <section aria-label="Shop photo" className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-x-2">
              <h3 className="text-ui-13 font-medium text-tea-text">Shop photo</h3>
              {entryId && <Link to={sharedTeaRecordHref(entryId)} className="tap-target inline-flex min-h-11 items-center gap-1.5 text-ui-12 text-tea-text-sec hover:text-tea-text">
                <Camera size={14} aria-hidden="true" />Review photos in Library
              </Link>}
            </div>
            {product.imageUrl
              ? <div className={product.additionalImages?.length ? 'alcove-thumb-btn' : 'alcove-thumb-btn-single'} data-shop-frame={product.additionalImages?.length ? undefined : 'page'}>
                <CapturePhotoImage src={product.imageUrl} stockPreview alt="Current Shop photo" className="alcove-thumb-img" />
              </div>
              : <p className="text-ui-13 text-tea-text-sec">No Shop photo selected.</p>}
          </section>}
        </div>
      </div>
    </TeaCard>
  </div>;
}
