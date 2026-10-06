/**
 * The message for a vendor, written from an order: every tea on it, one line
 * each, in Chinese then English, ready to copy into WeChat or open in WhatsApp.
 */
import type { LedgerTransaction, LedgerLineItem } from '../../lib/ledgerStore';

const ZH_UNIT: Record<string, string> = { Cake: '饼', Brick: '砖', Tuo: '沱', Teaware: '件' };
const EN_UNIT: Record<string, [string, string]> = { Cake: ['cake', 'cakes'], Brick: ['brick', 'bricks'], Tuo: ['tuo', 'tuo'], Teaware: ['piece', 'pieces'] };

function amount(item: LedgerLineItem, lang: 'zh' | 'en'): string {
  if (!item.priceIsPerGram && item.quantityUnits) {
    const key = item.type === 'Teaware' ? 'Teaware' : (item.form ?? '');
    if (lang === 'zh') return `${item.quantityUnits}${ZH_UNIT[key] ?? '件'}`;
    const [one, many] = EN_UNIT[key] ?? ['piece', 'pieces'];
    return `${item.quantityUnits} ${item.quantityUnits === 1 ? one : many}`;
  }
  if (item.quantityGrams) return `${item.quantityGrams}g`;
  return lang === 'zh' ? '1件' : '1';
}

export function orderMessage(tx: Pick<LedgerTransaction, 'counterpartyName' | 'items' | 'direction'>): { zh: string; en: string; both: string } {
  const who = tx.counterpartyName?.trim() || '';
  const items = tx.items.filter((i) => i.name?.trim());
  const zhLines = items.map((i) => `${i.chineseName?.trim() || i.name.trim()}${i.year ? ` ${i.year}` : ''} ${amount(i, 'zh')}`);
  const enLines = items.map((i) => `${i.name.trim()}${i.year ? ` ${i.year}` : ''}, ${amount(i, 'en')}`);
  const zh = `${who ? `${who}您好！` : '您好！'}我想订：\n${zhLines.join('\n')}\n谢谢！`;
  const en = `Hello${who ? ` ${who}` : ''}, I'd like to order:\n${enLines.join('\n')}\nThank you!`;
  return { zh, en, both: `${zh}\n\n${en}` };
}

/** A wa.me link: to the vendor's number when there is one, else to WhatsApp's own picker. */
export function whatsappLink(text: string, number?: string | null): string {
  const digits = (number ?? '').replace(/[^\d]/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
