import { Link } from 'react-router-dom';
import { LinkTeaPhoto, linkTeaMetaLine, useLinkTeaWriting } from '../shop/linkTea';
import type { PayLinkTeaLine } from './types';

/**
 * The teas on an invoice, at the top of its pay page, drawn as the private
 * collection link draws them: the shop's photo or type illustration, the
 * shop's one line of type and place, the amount and its price, and where to
 * read about the tea in Tea Wisdom. Shown only to a holder of the invoice's
 * own link; the worker decides that before it sends a line.
 */
export function PayInvoiceTeas({ lines }: { lines: readonly PayLinkTeaLine[] }) {
  if (lines.length === 0) return null;
  return (
    <section aria-label="What this pays for" className="mt-5 border-t border-tea-border pt-4" data-testid="pay-invoice-teas">
      <p className="label-caps text-tea-text-dim mb-1">What this pays for</p>
      <ul className="flex flex-col divide-y divide-tea-border">
        {lines.map((line, index) => <PayInvoiceTea key={`${line.product_id ?? line.name}-${index}`} line={line} />)}
      </ul>
    </section>
  );
}

function money(n: number): string {
  return n === 0 ? 'Free' : `$${(Math.round(n * 100) / 100).toFixed(2)}`;
}

function PayInvoiceTea({ line }: { line: PayLinkTeaLine }) {
  const source = {
    productId: line.product_id,
    name: line.name,
    type: line.type,
    form: line.form,
    originRegion: line.origin_region,
    originCountry: line.origin_country,
  };
  const writing = useLinkTeaWriting(source);
  const meta = linkTeaMetaLine({ ...source, year: line.year });
  const amount = line.unit === 'g' ? `${line.quantity}g` : `×${line.quantity}`;
  const read = writing.pages[0];
  return (
    <li className="flex items-start gap-3 py-3">
      <LinkTeaPhoto src={line.image_url} type={line.type} className="h-16 w-16 shrink-0 rounded-md" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="min-w-0 font-display text-ui-17 leading-tight text-tea-text">{line.name}</p>
          <p className="shrink-0 font-body text-ui-14 tabular-nums text-tea-text">{money(line.line_total_usd)}</p>
        </div>
        <p className="mt-1 font-sans text-ui-12 text-tea-text-sec">
          <span className="tabular-nums">{amount}</span>
          {meta && <span className="uppercase tracking-[0.04em]"> · {meta}</span>}
        </p>
        {writing.lead && (
          <p className="mt-1.5 font-body text-ui-13 leading-[1.55] text-tea-text-sec line-clamp-2">{writing.lead}</p>
        )}
        {read && (
          <Link to={read.href} className="tap-target mt-1 inline-flex items-center font-sans text-ui-12 text-tea-text-sec underline decoration-tea-text-dim underline-offset-4 hover:text-tea-gold">
            Read about {read.label} in Tea Wisdom
          </Link>
        )}
      </div>
    </li>
  );
}
