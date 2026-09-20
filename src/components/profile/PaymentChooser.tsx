import { useState } from 'react';
import type { ReactNode } from 'react';
import { GOLD_OUTLINE, GOLD_OUTLINE_STYLE, GroupHead } from '../people/immersive';
import { PaymentOrderSummary } from './PaymentOrderSummary';
import { formatLocalAmount, localAmountNote } from './profileDomain';
import type { PaymentContext, PaymentLocalAmount, PaymentMethod, PaymentOrderSummaryData } from './types';

// The pay sheet's body, in the Read section's language (Adrian, canvas
// version 25, 2026-09-20): no caps labels. Each method is introduced by the
// page's divider, a spaced word on the left and a hairline, and its facts are
// plain rows, one per line with a hairline under each, Copy on the right where
// a value is meant to be pasted. Nothing says "Recipient" or "Account" beside
// a value; the row is the value. The amount and reference a link carries take
// the same shape above the methods.

interface PaymentChooserProps {
  contributorName: string;
  methods: PaymentMethod[];
  destination: string;
  context: PaymentContext;
  /**
   * The approximate figure in the customer's own currency, already converted
   * and already validated. Null whenever no honest conversion exists, in which
   * case nothing extra is rendered: no placeholder, no line saying a rate was
   * unavailable, no invitation to work it out themselves.
   */
  local?: PaymentLocalAmount | null;
  accountName?: string | null;
  resolution?: 'account' | 'default';
  /**
   * The order behind the tracking token, when the customer arrived from their
   * own order page. Null on every link that carries no token, which is every
   * link a tea master sends by hand, and the page must be identical then.
   */
  summary?: PaymentOrderSummaryData | null;
}

/** The word on the divider above a method. */
function methodWord(method: PaymentMethod): string {
  if (method.method_type === 'bank_transfer') return 'Bank transfer';
  if (method.method_type === 'payment_link') return 'Payment link';
  return method.label;
}

/** What the dek under a method says when the tea master wrote nothing. */
function methodDefaultDek(method: PaymentMethod): string | null {
  if (method.method_type === 'bank_transfer') return 'Put your name and the tea in the reference.';
  if (method.method_type === 'payment_link') return 'Card or wallet, any currency.';
  return null;
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };
  return (
    <button type="button" onClick={copy} className="tap-target shrink-0 font-sans text-ui-12 text-tea-readgold transition-colors hover:text-tea-gold-lt" aria-label={`Copy ${label}`}>
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

/** One plain row: the value on the left, an optional action on the right, a hairline under. */
function Row({ children, action, mono = false, testId }: { children: ReactNode; action?: ReactNode; mono?: boolean; testId?: string }) {
  return (
    <div className="flex min-h-[48px] items-center justify-between gap-4 border-b border-tea-border py-2.5" data-testid={testId}>
      <span className={`min-w-0 break-words ${mono ? 'font-mono text-ui-14 tabular-nums' : 'font-body text-ui-15'} text-tea-text`}>{children}</span>
      {action ?? null}
    </div>
  );
}

function Dek({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`max-w-[46ch] font-body text-ui-13 italic leading-[1.45] text-tea-text-sec ${className}`}>{children}</p>;
}

function Method({ method }: { method: PaymentMethod }) {
  const word = methodWord(method);
  const dek = method.instructions?.trim() || methodDefaultDek(method);
  const openLink = method.external_url ? (
    <a href={method.external_url} target="_blank" rel="noopener noreferrer" className={`${GOLD_OUTLINE} tap-target shrink-0 px-5`} style={GOLD_OUTLINE_STYLE} aria-label={`Open ${method.label}`}>Open</a>
  ) : null;

  if (method.method_type === 'payment_link') {
    return (
      <section aria-label={word} data-testid="pay-method">
        <GroupHead label={word} />
        <Row action={openLink}><span className="font-body text-ui-13 italic leading-[1.45] text-tea-text-sec">{dek}</span></Row>
      </section>
    );
  }

  // Bank transfer, a provider QR, or anything else: the same plain rows.
  const showLabel = method.label.trim().toLowerCase() !== word.toLowerCase();
  return (
    <section aria-label={word} data-testid="pay-method">
      <GroupHead label={word} />
      {method.qr_image_url && <img src={method.qr_image_url} alt={`${method.label} provider QR code`} className="mt-3 h-36 w-36 border border-tea-border bg-tea-surface object-contain p-2" />}
      <Row action={<CopyButton value={method.recipient_name} label="recipient name" />}>{method.recipient_name}</Row>
      {showLabel && <Row>{method.label}</Row>}
      {method.account_identifier && <Row mono action={<CopyButton value={method.account_identifier} label={`${method.label} details`} />}>{method.account_identifier}</Row>}
      {openLink && <Row action={openLink}><span className="font-body text-ui-13 italic leading-[1.45] text-tea-text-sec">Or pay online.</span></Row>}
      {dek && <Dek className="mt-3 whitespace-pre-line">{dek}</Dek>}
    </section>
  );
}

export function PaymentChooser({ contributorName, methods, context, local, summary }: PaymentChooserProps) {
  const visibleMethods = methods.filter(method => method.is_published).sort((a, b) => a.position - b.position);
  // Only rendered beside a real dollar figure. An approximation floating on its
  // own would become the amount the customer thinks they owe.
  const localFigure = context.amount ? formatLocalAmount(local) : null;
  const localNote = localFigure ? localAmountNote(local, context) : null;
  const amountText = context.amount ? `${context.currency ? `${context.currency} ` : ''}${context.amount}` : null;

  return (
    <div>
      {amountText && (
        <section aria-label="Amount">
          <GroupHead label="Amount" />
          {/* The figure is the debt and is the only one that can be copied. An
              approximation with a copy button beside it is an invitation to
              paste it into a transfer. */}
          <Row mono action={<CopyButton value={amountText} label="amount" />}><strong data-testid="payment-amount" className="font-medium">{amountText}</strong></Row>
          {localFigure && (
            <>
              <p data-testid="payment-local-amount" className="mt-2.5 font-mono text-ui-14 tabular-nums text-tea-text-sec">About {localFigure}</p>
              {localNote && <p data-testid="payment-local-note" className="mt-1.5 max-w-[46ch] text-ui-12 leading-relaxed text-tea-text-dim">{localNote}</p>}
            </>
          )}
        </section>
      )}
      {context.reference && (
        <section aria-label="Reference">
          <GroupHead label="Reference" />
          <Row action={<CopyButton value={context.reference} label="reference" />}>{context.reference}</Row>
        </section>
      )}
      {summary && <PaymentOrderSummary summary={summary} />}

      {context.errors.length > 0 && (
        <Dek className="mt-4" >
          <span role="alert">Some payment details in this link were invalid and have been left out.</span>
        </Dek>
      )}

      {visibleMethods.length === 0 ? (
        <Dek className="mt-8">I have not published a way to pay here yet. Ask {contributorName} directly.</Dek>
      ) : (
        visibleMethods.map(method => <Method key={method.id} method={method} />)
      )}

      <p className="mt-8 font-sans text-ui-11 leading-[1.5] text-tea-text-dim">
        Teajia displays transfer instructions only. Complete the transfer with the selected provider, then confirm it with the Tea Master. This page does not verify or record payment.
      </p>
    </div>
  );
}
