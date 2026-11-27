import { useState } from 'react';
import type { ReactNode } from 'react';
import { Check, Copy } from 'lucide-react';
import { GOLD_TEXT_INLINE, GOLD_TEXT_STYLE } from '../people/immersive';
import { useAppStore } from '../../lib/store';
import { canonicalCurrency, isoCurrencyCode } from '../../lib/currency';
import type { Currency } from '../../admin/types';
import { PaymentOrderSummary } from './PaymentOrderSummary';
import { looksLikePastedDetails, methodCurrency, pastedLines } from './pastedPayment';
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

/** Copy, as an icon on the right of a value, the way Wise draws it. */
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
    <button type="button" onClick={copy} className="tap-target shrink-0 text-tea-gold hover:text-tea-gold-lt" aria-label={copied ? `Copied ${label}` : `Copy ${label}`}>
      {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
    </button>
  );
}

/** One field: a small label over its value, Copy on the right. No rule under it. */
function Field({ label, value, copy = true, mono = false, testId, children }: {
  label: string; value: string; copy?: boolean; mono?: boolean; testId?: string; children?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5" data-testid={testId}>
      <div className="min-w-0">
        <span className="block font-sans text-ui-12 text-tea-text-sec">{label}</span>
        <span className={`block break-words font-medium text-tea-text ${mono ? 'font-mono text-ui-14 tabular-nums' : 'font-body text-ui-15'}`}>{children ?? value}</span>
      </div>
      {copy && <CopyButton value={value} label={label.toLowerCase()} />}
    </div>
  );
}

/** One rounded panel: a title line, then its fields. */
function Panel({ title, sub, action, children, label, testId }: {
  title?: ReactNode; sub?: ReactNode; action?: ReactNode; children: ReactNode; label: string; testId?: string;
}) {
  return (
    <section aria-label={label} className="mt-3 rounded-md bg-tea-elevated px-4 py-3 first:mt-0" data-testid={testId}>
      {title && (
        <div className="flex items-center justify-between gap-3 pb-1">
          <div className="min-w-0">
            <h3 className="font-body text-ui-15 font-medium text-tea-text">{title}</h3>
            {sub && <p className="font-sans text-ui-12 text-tea-text-sec">{sub}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

function Dek({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`max-w-[46ch] font-sans text-ui-12 leading-[1.45] text-tea-text-sec ${className}`}>{children}</p>;
}

function Method({ method }: { method: PaymentMethod }) {
  const word = methodWord(method);
  const dek = method.instructions?.trim() || methodDefaultDek(method);
  const openLink = method.external_url ? (
    <a href={method.external_url} target="_blank" rel="noopener noreferrer" className={`${GOLD_TEXT_INLINE} tap-target`} style={GOLD_TEXT_STYLE} aria-label={`Open ${method.label}`}>Open</a>
  ) : null;

  if (method.method_type === 'payment_link') {
    return (
      <Panel label={word} title={method.label} sub={dek} action={openLink} testId="pay-method"><></></Panel>
    );
  }

  // Bank transfer, a provider QR, or anything else. Details pasted as the bank
  // or Wise gives them become fields of their own, each with a Copy, in the
  // order they were pasted; a heading line in the paste becomes a small hint.
  const pasted = looksLikePastedDetails(method.instructions) ? pastedLines(method.instructions) : null;
  const pasteNamesRecipient = Boolean(pasted?.some(line => line.kind === 'value' && line.value === method.recipient_name));
  const currency = methodCurrency(method);
  const values = [
    ...(!pasteNamesRecipient ? [`Name: ${method.recipient_name}`] : []),
    ...(method.account_identifier ? [method.account_identifier] : []),
    ...(pasted ?? []).filter(line => line.kind === 'value').map(line => line.kind === 'value' ? `${line.label}: ${line.value}` : ''),
  ];
  const title = currency ? `${currency} account details` : method.label;
  const sub = [currency ? method.label : null, word.toLowerCase() !== method.label.trim().toLowerCase() ? word : null].filter(Boolean).join(' · ');
  return (
    <Panel
      label={word}
      title={title}
      sub={sub || undefined}
      testId="pay-method"
      action={values.length > 1 ? <CopyAll text={values.join('\n')} /> : undefined}
    >
      {method.qr_image_url && <img src={method.qr_image_url} alt={`${method.label} provider QR code`} className="my-2 h-36 w-36 border border-tea-border bg-tea-surface object-contain p-2" />}
      {!pasteNamesRecipient && <Field label="Name" value={method.recipient_name} />}
      {method.account_identifier && <Field label="Account" value={method.account_identifier} mono />}
      {pasted?.map((line, index) => line.kind === 'value' ? (
        <Field key={index} testId="pay-pasted-value" label={line.label} value={line.value} />
      ) : line.kind === 'heading' ? (
        <Dek key={index} className="pt-1.5">{line.text}</Dek>
      ) : (
        <Dek key={index} className="pt-1">{line.text}</Dek>
      ))}
      {openLink && <div className="flex items-center justify-between gap-3 py-1.5"><Dek>Or pay online.</Dek>{openLink}</div>}
      {!pasted && dek && <Dek className="mt-1 whitespace-pre-line">{dek}</Dek>}
      {pasted && <Dek className="mt-1">{methodDefaultDek(method)}</Dek>}
    </Panel>
  );
}

/** Every value of a method at once, for pasting into a bank app's notes. */
function CopyAll({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };
  return (
    <button type="button" onClick={copy} className={`${GOLD_TEXT_INLINE} tap-target shrink-0`} style={GOLD_TEXT_STYLE}>
      {copied ? 'Copied' : 'Copy all'}
    </button>
  );
}

export function PaymentChooser({ contributorName, methods, context, local, summary }: PaymentChooserProps) {
  const visibleMethods = methods.filter(method => method.is_published).sort((a, b) => a.position - b.position);
  // Several accounts in different currencies (Wise USD and Wise IDR): show the
  // one for the currency the page is in, with a switch between them. The
  // switch is the shop's own currency, so the teas reprice with it.
  const storeCurrency = useAppStore(state => state.currency);
  const setCurrency = useAppStore(state => state.setCurrency);
  const accountCurrencies = Array.from(new Set(visibleMethods.map(methodCurrency).filter((code): code is string => Boolean(code))));
  const chosenCurrency = accountCurrencies.length > 1
    ? accountCurrencies.find(code => code === isoCurrencyCode(storeCurrency))
      ?? accountCurrencies.find(code => code === context.currency)
      ?? accountCurrencies[0]
    : null;
  const shownMethods = chosenCurrency
    ? visibleMethods.filter(method => { const code = methodCurrency(method); return !code || code === chosenCurrency; })
    : visibleMethods;
  // Only rendered beside a real dollar figure. An approximation floating on its
  // own would become the amount the customer thinks they owe.
  const localFigure = context.amount ? formatLocalAmount(local) : null;
  const localNote = localFigure ? localAmountNote(local, context) : null;
  const amountText = context.amount ? `${context.currency ? `${context.currency} ` : ''}${context.amount}` : null;

  return (
    <div>
      {(amountText || context.reference) && (
        <Panel label="Amount">
          <div className="grid grid-cols-1 gap-x-6 min-[420px]:grid-cols-2">
            {/* The figure is the debt and is the only one that can be copied. An
                approximation with a copy button beside it is an invitation to
                paste it into a transfer. */}
            {amountText && (
              <Field label="Amount" value={amountText} mono>
                <strong data-testid="payment-amount" className="font-medium">{amountText}</strong>
              </Field>
            )}
            {context.reference && <Field label="Reference" value={context.reference} />}
          </div>
          {localFigure && (
            <>
              <p data-testid="payment-local-amount" className="pt-1 font-mono text-ui-13 tabular-nums text-tea-text-sec">About {localFigure}</p>
              {localNote && <p data-testid="payment-local-note" className="mt-1 max-w-[46ch] text-ui-12 leading-relaxed text-tea-text-dim">{localNote}</p>}
            </>
          )}
        </Panel>
      )}
      {summary && <PaymentOrderSummary summary={summary} />}

      {context.errors.length > 0 && (
        <Dek className="mt-3">
          <span role="alert">Some payment details in this link were invalid and have been left out.</span>
        </Dek>
      )}

      {chosenCurrency && (
        <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="Pay in">
          <span className="font-sans text-ui-12 text-tea-text-sec">Pay in</span>
          {accountCurrencies.map(code => (
            <button
              key={code}
              type="button"
              aria-pressed={code === chosenCurrency}
              onClick={() => setCurrency((canonicalCurrency(code) ?? code) as Currency)}
              className={`tap-target rounded-md px-3 py-1 font-sans text-ui-12 ${code === chosenCurrency ? 'bg-tea-accent-sub text-tea-gold' : 'bg-tea-elevated text-tea-text-sec hover:text-tea-text'}`}
            >
              {code}
            </button>
          ))}
        </div>
      )}

      {visibleMethods.length === 0 ? (
        <Dek className="mt-6">I have not published a way to pay here yet. Ask {contributorName} directly.</Dek>
      ) : (
        shownMethods.map(method => <Method key={method.id} method={method} />)
      )}

    </div>
  );
}
