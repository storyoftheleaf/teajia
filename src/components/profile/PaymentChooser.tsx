import { useState } from 'react';
import { ArrowSquareOut, Check, CopySimple, QrCode } from '@phosphor-icons/react';
import { QRCodeSVG } from 'qrcode.react';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { formatLocalAmount, localAmountNote } from './profileDomain';
import type { PaymentContext, PaymentLocalAmount, PaymentMethod } from './types';

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
    <button type="button" onClick={copy} className="tap-target inline-flex items-center gap-1.5 text-ui-12 text-tea-text-sec transition-colors hover:text-tea-text" aria-label={`Copy ${label}`}>
      {copied ? <Check size={16} aria-hidden="true" /> : <CopySimple size={16} aria-hidden="true" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

export function PaymentChooser({ contributorName, methods, destination, context, local, accountName, resolution }: PaymentChooserProps) {
  const visibleMethods = methods.filter(method => method.is_published).sort((a, b) => a.position - b.position);
  // Only rendered beside a real dollar figure. An approximation floating on its
  // own would become the amount the customer thinks they owe.
  const localFigure = context.amount ? formatLocalAmount(local) : null;
  const localNote = localFigure ? localAmountNote(local, context) : null;
  return (
    <div className="space-y-10">
      {(context.amount || context.currency || context.reference) && (
        <section aria-label="Payment details" className="grid gap-4 border-y border-tea-border py-5 sm:grid-cols-2">
          {context.amount && (
            <div>
              <p className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-dim`}>Amount</p>
              {/* The dollar figure is the debt and is the only one that can be
                  copied. An approximation with a copy button beside it is an
                  invitation to paste it into a transfer. */}
              <div className="mt-2 flex items-center gap-3"><strong data-testid="payment-amount" className="font-mono text-ui-20 font-medium tabular-nums text-tea-text">{context.currency ? `${context.currency} ` : ''}{context.amount}</strong><CopyButton value={`${context.currency ? `${context.currency} ` : ''}${context.amount}`} label="amount" /></div>
              {localFigure && (
                <>
                  {/* Same mono face and the same left edge as the figure above.
                      Every ISO code is three letters, so the digits of the two
                      amounts line up by place value without a second column. */}
                  <p data-testid="payment-local-amount" className="mt-2 font-mono text-ui-14 tabular-nums text-tea-text-sec">
                    About {localFigure}
                  </p>
                  {localNote && (
                    <p data-testid="payment-local-note" className="mt-1.5 max-w-[46ch] text-ui-12 leading-relaxed text-tea-text-dim">
                      {localNote}
                    </p>
                  )}
                </>
              )}
            </div>
          )}
          {context.reference && (
            <div>
              <p className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-dim`}>Reference</p>
              <div className="mt-2 flex items-center gap-3"><strong className="text-ui-14 font-medium text-tea-text">{context.reference}</strong><CopyButton value={context.reference} label="reference" /></div>
            </div>
          )}
        </section>
      )}

      {context.errors.length > 0 && (
        <div role="alert" className="border-y border-tea-border py-4 text-ui-13 text-tea-text-sec">
          Some payment details in this link were invalid and have been left out.
        </div>
      )}

      {visibleMethods.length === 0 ? (
        <section className="border-y border-tea-border py-12">
          <p className={`${TYPOGRAPHY_CLASSES.subtitle} max-w-[48ch] text-tea-text-sec`}>Payment details are not available here yet.</p>
          <p className="mt-3 text-ui-12 text-tea-text-dim">Ask {contributorName} for the appropriate transfer method.</p>
        </section>
      ) : (
        <section aria-labelledby="payment-methods-heading">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="payment-methods-heading" className={`${TYPOGRAPHY_CLASSES.h3} text-tea-text`}>Choose a transfer method</h2>
              <p className="mt-1 text-ui-12 text-tea-text-dim">
                {accountName ? `${accountName} · ` : ''}{resolution === 'default' ? `${contributorName}'s default methods` : `Recipient: ${contributorName}`}
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 text-ui-12 text-tea-text-sec"><ArrowSquareOut size={16} aria-hidden="true" /> External transfer</span>
          </div>
          <ol className="divide-y divide-tea-border border-y border-tea-border">
            {visibleMethods.map(method => (
              <li key={method.id} className="grid gap-5 py-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
                <div className="min-w-0">
                  <p className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-dim`}>{method.method_type.replace(/_/g, ' ')}</p>
                  <h3 className={`${TYPOGRAPHY_CLASSES.h3} mt-1 text-tea-text`}>{method.label}</h3>
                  <p className="mt-2 text-ui-13 text-tea-text-sec">For {method.recipient_name}</p>
                  {method.account_identifier && (
                    <div className="mt-4 flex max-w-full flex-wrap items-center gap-3">
                      <code className="break-all font-mono text-ui-13 text-tea-text">{method.account_identifier}</code>
                      <CopyButton value={method.account_identifier} label={`${method.label} details`} />
                    </div>
                  )}
                  {method.instructions && <p className={`${TYPOGRAPHY_CLASSES.bodyLight} mt-4 max-w-[58ch] whitespace-pre-line text-tea-text-sec`}>{method.instructions}</p>}
                  {method.external_url && (
                    <a href={method.external_url} target="_blank" rel="noopener noreferrer" className="tap-target mt-4 inline-flex items-center gap-2 text-ui-13 text-tea-gold transition-colors hover:text-tea-gold-lt">
                      Open {method.label}<ArrowSquareOut size={16} aria-hidden="true" />
                    </a>
                  )}
                </div>
                {method.qr_image_url && <img src={method.qr_image_url} alt={`${method.label} provider QR code`} className="h-36 w-36 rounded-md border border-tea-border bg-tea-surface object-contain p-2" />}
              </li>
            ))}
          </ol>
        </section>
      )}

      {visibleMethods.length > 0 && <aside className="grid gap-5 border-t border-tea-border pt-6 sm:grid-cols-[112px_minmax(0,1fr)] sm:items-center">
        <div className="flex h-28 w-28 items-center justify-center rounded-md border border-tea-border bg-tea-surface p-2" aria-label="QR code for this Teajia payment page">
          <QRCodeSVG value={destination} size={96} bgColor="transparent" fgColor="var(--tea-text)" level="M" />
        </div>
        <div>
          <p className={`${TYPOGRAPHY_CLASSES.h3} text-tea-text`}>Share this payment page</p>
          <p className="mt-2 max-w-[50ch] text-ui-13 text-tea-text-sec">This QR opens Teajia’s chooser, not a payment provider. The recipient can update their methods without changing the QR.</p>
          <div className="mt-3 inline-flex items-center gap-2"><QrCode size={17} className="text-tea-gold" aria-hidden="true" /><CopyButton value={destination} label="payment page link" /></div>
        </div>
      </aside>}

      <p className="border-t border-tea-border pt-5 text-ui-12 leading-relaxed text-tea-text-dim">
        Teajia displays transfer instructions only. Complete the transfer with the selected provider, then confirm it with the Tea Master. This page does not verify or record payment.
      </p>
    </div>
  );
}
