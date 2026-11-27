import { useShopPrice } from '../shop/shopPrice';

/**
 * An invoice owes cents, so dollars read to the cent; another currency reads
 * as the shop quotes it, the near figure.
 */
export function useExactUsd(): (usd: number) => string {
  const shopPrice = useShopPrice();
  return (usd: number) => (shopPrice.code === 'USD'
    ? `$${Number.isInteger(usd) ? usd : usd.toFixed(2)}`
    : shopPrice.symbolTotal(usd));
}
