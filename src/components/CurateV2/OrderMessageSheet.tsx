import React, { useEffect, useState } from 'react';
import { BottomSheet } from '../shared/BottomSheet';
import { api, hasToken } from '../../lib/api';
import type { LedgerTransaction } from '../../lib/ledgerStore';
import { orderMessage, whatsappLink } from './orderMessage';

interface OrderMessageSheetProps {
  tx: LedgerTransaction | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * Message the vendor about an order. The text is written from the order and
 * can be edited; Copy is one tap and says so; WhatsApp opens to the vendor's
 * own number when their card has one.
 */
export const OrderMessageSheet: React.FC<OrderMessageSheetProps> = ({ tx, onOpenChange }) => {
  const [text, setText] = useState('');
  const [copied, setCopied] = useState(false);
  const [number, setNumber] = useState<string | null>(null);

  useEffect(() => {
    if (!tx) return;
    setText(orderMessage(tx).both);
    setCopied(false);
    setNumber(null);
    if (tx.counterpartyId && hasToken()) {
      api.customers.get(tx.counterpartyId)
        .then((c: any) => setNumber(c?.whatsapp || c?.phone || null))
        .catch(() => {});
    }
  }, [tx]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      const area = document.getElementById('order-message-text') as HTMLTextAreaElement | null;
      area?.focus();
      area?.select();
    }
  };

  return (
    <BottomSheet open={!!tx} onOpenChange={onOpenChange} title={tx?.counterpartyName && !/^unknown vendor$/i.test(tx.counterpartyName.trim()) ? `Message ${tx.counterpartyName}` : 'Message the vendor'} description="Written from the order. Edit it before you send." large>
      <div className="grid gap-3 px-4 pb-nav-gap">
        <textarea
          id="order-message-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
          className="w-full rounded-[3px] border border-tea-border bg-transparent p-3 font-body text-ui-15 leading-relaxed text-tea-text outline-none focus:border-tea-gold"
        />
        <button type="button" onClick={() => void copy()} className="curate-v2-frame is-on is-tall is-wide uppercase tracking-[0.14em]">
          {copied ? 'Copied' : 'Copy for WeChat'}
        </button>
        <a
          href={whatsappLink(text, number)}
          target="_blank"
          rel="noreferrer"
          className="curate-v2-frame is-tall is-wide normal-case tracking-normal"
        >
          {number ? 'Open WhatsApp to this vendor' : 'Open WhatsApp'}
        </a>
      </div>
    </BottomSheet>
  );
};
