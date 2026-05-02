import React from 'react';
import { Page, Text, View, Document, StyleSheet, Font } from '@react-pdf/renderer';
import type { LedgerTransaction, LedgerLineItem } from '../../lib/ledgerStore';
import type { Currency } from '../../admin/types';

Font.register({
  family: 'Plus Jakarta Sans',
  src: 'https://fonts.gstatic.com/s/plusjakartasans/v8/LDIbaomQNQcsA88c7O9yZ4KMCoOg4IA6-91aHEjcWuA_qU79TR_V.ttf',
});

const CURRENCY_SYMBOLS: Record<Currency, string> = {
  USD: '$', NT: 'NT$', Yuan: '¥', IDR: 'Rp', JPY: '¥', MYR: 'RM', HKD: 'HK$', AUD: 'A$', UNK: '',
};

function fmtPrice(amount: number, currency: Currency): string {
  const sym = CURRENCY_SYMBOLS[currency] || '';
  const decimals = ['NT', 'IDR', 'JPY'].includes(currency) ? 0 : 2;
  return `${sym}${amount.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

function lineTotal(item: LedgerLineItem): number {
  if (item.priceIsPerGram) {
    return item.pricePerUnit * (item.quantityGrams ?? 0);
  }
  return item.pricePerUnit * (item.quantityUnits ?? 1);
}

// PDFs render with literal hex (no CSS variables in @react-pdf/renderer). These
// mirror the Parchment light-theme tokens — print medium is always paper, never
// dark, regardless of app theme.
const PDF_COLORS = {
  paper:       '#f4ece0',  // tea-bg light
  ink:         '#2a2218',  // tea-text light
  inkDim:      '#8b7b65',  // tea-text-dim light
  inkVeryDim:  '#b5a892',  // tea-text-sec dark (used for footer/id chrome)
  rule:        '#d4c9b8',  // tea-border light
  ruleSoft:    '#e4dace',  // row dividers
} as const;

const s = StyleSheet.create({
  page: {
    padding: 50,
    backgroundColor: PDF_COLORS.paper,
    fontFamily: 'Plus Jakarta Sans',
    fontSize: 10,
    color: PDF_COLORS.ink,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
    borderBottomWidth: 1,
    borderBottomColor: PDF_COLORS.rule,
    paddingBottom: 16,
  },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 4, color: PDF_COLORS.ink },
  subtitle: { fontSize: 9, color: PDF_COLORS.inkDim, textTransform: 'uppercase', letterSpacing: 2 },
  meta: { textAlign: 'right' as const },
  metaLine: { fontSize: 9, color: PDF_COLORS.inkDim, marginBottom: 2 },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: PDF_COLORS.ink,
    paddingBottom: 6,
    marginBottom: 6,
    fontWeight: 'bold',
    fontSize: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: PDF_COLORS.ruleSoft,
  },
  colName: { flex: 3 },
  colQty: { flex: 1, textAlign: 'right' as const },
  colPrice: { flex: 1, textAlign: 'right' as const },
  colTotal: { flex: 1, textAlign: 'right' as const },
  itemName: { fontSize: 10, color: PDF_COLORS.ink },
  itemSub: { fontSize: 8, color: PDF_COLORS.inkDim, marginTop: 1 },
  totalRow: {
    flexDirection: 'row',
    borderTopWidth: 2,
    borderTopColor: PDF_COLORS.ink,
    paddingTop: 10,
    marginTop: 10,
  },
  totalLabel: { flex: 5, textAlign: 'right' as const, fontWeight: 'bold', fontSize: 11, paddingRight: 8 },
  totalValue: { flex: 1, textAlign: 'right' as const, fontWeight: 'bold', fontSize: 13 },
  footer: { marginTop: 40, fontSize: 8, color: PDF_COLORS.inkVeryDim, textAlign: 'center' as const },
});

interface LedgerPdfProps {
  transaction: LedgerTransaction;
}

export const LedgerPdf: React.FC<LedgerPdfProps> = ({ transaction }) => {
  const isPurchase = transaction.direction === 'purchase';
  const grandTotal = transaction.items.reduce((sum, item) => sum + lineTotal(item), 0);
  const date = new Date(transaction.createdAt).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.title}>
              {isPurchase ? 'Purchase Order' : 'Sales Order'}
            </Text>
            <Text style={s.subtitle}>Teajia</Text>
          </View>
          <View style={s.meta}>
            <Text style={s.metaLine}>{date}</Text>
            <Text style={s.metaLine}>
              {isPurchase ? 'From' : 'To'}: {transaction.counterpartyName || 'Unknown'}
            </Text>
            <Text style={s.metaLine}>
              Status: {transaction.status === 'confirmed' ? 'Confirmed' : 'Draft'}
            </Text>
            <Text style={{ ...s.metaLine, fontSize: 7, color: PDF_COLORS.inkVeryDim }}>
              #{transaction.id.slice(0, 8)}
            </Text>
          </View>
        </View>

        {/* Table header */}
        <View style={s.tableHeader}>
          <Text style={s.colName}>Item</Text>
          <Text style={s.colQty}>Qty</Text>
          <Text style={s.colPrice}>Price</Text>
          <Text style={s.colTotal}>Total</Text>
        </View>

        {/* Line items */}
        {transaction.items.map((item) => {
          const total = lineTotal(item);
          const isUnitBased = !item.priceIsPerGram;
          const qty = isUnitBased
            ? `${item.quantityUnits ?? 1}×`
            : `${item.quantityGrams ?? 0}g`;
          const tags = [item.type, item.form, item.year].filter(Boolean).join(' · ');

          return (
            <View key={item.id} style={s.row}>
              <View style={s.colName}>
                <Text style={s.itemName}>
                  {item.chineseName ? `${item.chineseName}  ` : ''}{item.name || 'Unnamed'}
                </Text>
                {tags && <Text style={s.itemSub}>{tags}</Text>}
              </View>
              <Text style={s.colQty}>{qty}</Text>
              <Text style={s.colPrice}>
                {fmtPrice(item.pricePerUnit, item.currency)}
                {item.priceIsPerGram ? '/g' : ''}
              </Text>
              <Text style={s.colTotal}>{fmtPrice(total, item.currency)}</Text>
            </View>
          );
        })}

        {/* Grand total */}
        <View style={s.totalRow}>
          <Text style={s.totalLabel}>Total</Text>
          <Text style={s.totalValue}>
            {fmtPrice(grandTotal, transaction.currency)}
          </Text>
        </View>

        {/* Footer */}
        <Text style={s.footer}>
          Generated by Teajia Tea Compass
        </Text>
      </Page>
    </Document>
  );
};

export default LedgerPdf;
