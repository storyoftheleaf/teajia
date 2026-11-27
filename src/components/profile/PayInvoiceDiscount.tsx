import { useState } from 'react';
import { setPayInvoiceDiscount } from '../../lib/payInvoiceKeepApi';
import { Button } from '../shared/Button';

/**
 * A percent off, offered from the shop's own view of the sheet (Adrian,
 * 2026-11-27: "I should have a place where I can offer a discount on this
 * sheet"). The buyer sees it as its own line above the total.
 */
export function PayInvoiceDiscount({ slug, token, percent, onChanged }: {
  slug: string;
  token: string;
  percent: number | null;
  onChanged?: () => void;
}) {
  const [value, setValue] = useState(percent ? String(percent) : '');
  const [state, setState] = useState<'idle' | 'saving' | 'error'>('idle');
  const apply = async (next: number) => {
    setState('saving');
    try {
      await setPayInvoiceDiscount(slug, token, next);
      setState('idle');
      if (next === 0) setValue('');
      onChanged?.();
    } catch {
      setState('error');
    }
  };
  const asked = Number(value);
  const valid = value.trim() !== '' && Number.isFinite(asked) && asked > 0 && asked < 100;
  return (
    <form
      className="mt-3 flex flex-wrap items-center gap-2 border-t border-tea-border pt-3"
      onSubmit={event => { event.preventDefault(); if (valid) void apply(asked); }}
      data-testid="pay-discount-offer"
    >
      <label htmlFor="pay-discount" className="font-sans text-ui-13 text-tea-text-sec">Offer a discount</label>
      <span className="inline-flex items-center gap-1">
        <input
          id="pay-discount"
          inputMode="decimal"
          value={value}
          onChange={event => setValue(event.target.value.replace(/[^\d.]/g, ''))}
          placeholder="10"
          className="h-10 w-16 rounded-md border border-tea-border bg-tea-surface px-2 text-right font-sans text-ui-14 text-tea-text focus:border-tea-gold focus:outline-none"
        />
        <span className="font-sans text-ui-13 text-tea-text-sec">%</span>
      </span>
      <Button type="submit" variant="secondary" disabled={!valid || state === 'saving'} className="tap-target">
        {state === 'saving' ? 'Saving' : percent ? 'Change' : 'Offer'}
      </Button>
      {percent ? (
        <Button type="button" variant="plain" onClick={() => void apply(0)} disabled={state === 'saving'} className="tap-target font-sans text-ui-12 text-tea-text-sec hover:text-tea-text">
          Take it off
        </Button>
      ) : null}
      {state === 'error' && <p role="alert" className="basis-full font-sans text-ui-12 text-tea-text-sec">That did not save. Try again.</p>}
    </form>
  );
}
