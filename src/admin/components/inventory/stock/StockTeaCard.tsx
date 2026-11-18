import { ArrowUpRight } from 'lucide-react';
import { TeaCard, TeaCardMeta, TeaCardMetric, TeaCardTitle } from '../../../../components/tea/TeaCard';
import type { Product } from '../../../types';
import { productToInventoryItem } from '../../../utils';
import { useShopPrice } from '../../../../components/shop/shopPrice';
import { teaPurchaseQuote } from '../../../../lib/shopPurchase';
import { effectivePurpose, onHandQuantity, type IncomingInventorySummary, type InventoryStage } from '../domain';
import { fmtNum } from '../../../../utils/formatNumber';

export function StockTeaCard({ product, stage, incoming, onOpen, onAction }: {
  product: Product;
  stage: InventoryStage;
  incoming?: IncomingInventorySummary;
  onOpen: (product: Product) => void;
  onAction: (product: Product, stage: InventoryStage) => void;
}) {
  const price = useShopPrice();
  const name = product.givenName || product.productName || 'Unnamed tea';
  const isWare = product.type === 'Teaware';
  const isSample = effectivePurpose(product) !== 'working';
  const stock = onHandQuantity(product);
  const retail = product.fixedRetailPriceUSD ?? product.pricePerGramUSD;
  const low = !isWare && stock > 0 && stock <= product.lowStockThreshold;
  const item = productToInventoryItem(product);
  if (!product.stockKnownAt || product.status === 'Sold Out') item.stock_g = 0;
  const quote = !isWare && !isSample ? teaPurchaseQuote(item, 50) : null;
  const buyerTotal = quote ? price.total(quote.totalUsd) : isWare && stock > 0 && retail != null ? price.total(retail) : 'Unavailable';
  const action = isSample ? 'Open holding'
    : stage === 'published' || stage === 'ready_private' ? 'Review listing'
    : stage === 'needs_preparation' ? 'Develop tea'
    : 'Open tea';

  return <TeaCard
    teaType={product.type}
    testId={`stock-card-${product.id}`}
    className="stock-tea-card"
    title={<TeaCardTitle><button type="button" className="w-full text-left" aria-label={`Open ${name}`} onClick={() => onOpen(product)}>{name}</button></TeaCardTitle>}
    trailing={product.year ? <span className="stock-card-year">{product.year}</span> : undefined}
    meta={<TeaCardMeta primary={product.vendor || 'Source not recorded'} type={product.type} trailing={product.form && !isWare ? product.form : undefined} />}
    metrics={<>
      <TeaCardMetric label={isWare ? 'Units' : 'On hand · g'}><strong className={low ? 'text-ui-16 text-tea-gold' : 'text-ui-16 text-tea-text'}>{product.stockKnownAt || isWare ? fmtNum(stock, 0) : 'Count'}</strong></TeaCardMetric>
      <TeaCardMetric label={isWare ? 'Retail / piece' : 'Retail / g'}>{retail == null ? '—' : retail.toFixed(2)}</TeaCardMetric>
      {stage === 'incoming' && incoming?.hasOpenIncoming
        ? <TeaCardMetric label="Coming · g">{fmtNum(incoming.remainingQuantity, 0)}</TeaCardMetric>
        : !isSample && <TeaCardMetric label={quote ? `Buyer · ${quote.grams} g` : 'Buyer total'}>{buyerTotal}</TeaCardMetric>}
    </>}
    actions={<button type="button" className="stock-tea-open tap-target" onClick={() => onAction(product, stage)}>{action} <ArrowUpRight size={14} aria-hidden="true" /></button>}
  />;
}
