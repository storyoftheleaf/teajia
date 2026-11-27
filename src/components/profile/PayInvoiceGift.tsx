import { Leaf } from 'lucide-react';
import { useExactUsd } from './useExactUsd';

/**
 * A discount on an invoice, said at the top as the gift it is (Adrian,
 * 2026-11-27: "make sure you display this in the invoice that it doesn't go
 * unseen. It should be a happy thing."). The sum still shows it as its own
 * line above the total.
 */
export function PayInvoiceGift({ from, discount }: {
  from: string | null;
  discount: { percent: number; amount_usd: number } | null | undefined;
}) {
  const exact = useExactUsd();
  if (!discount || !(discount.amount_usd > 0)) return null;
  const saved = exact(discount.amount_usd);
  return (
    <div className="mt-3 flex items-center gap-3 rounded-md border border-tea-border bg-tea-accent-sub px-3 py-2.5 md:px-4" data-testid="pay-invoice-gift">
      <Leaf size={20} strokeWidth={1.5} className="shrink-0 text-tea-gold" aria-hidden="true" />
      <p className="min-w-0 font-body text-ui-15 leading-[1.4] text-tea-text">
        <span className="font-display text-ui-18 text-tea-gold">{discount.percent}% off</span>
        {from ? <>, a gift from {from}.</> : ', a gift.'}{' '}
        <span className="whitespace-nowrap text-tea-text-sec">You save {saved}.</span>
      </p>
    </div>
  );
}
