/**
 * PurchaseOrderPdf: the printable purchase order, rendered by @react-pdf/renderer.
 *
 * @color-literals Same claim as InvoicePdf, and for the same reason. This is a
 * document sent to a vendor, not a surface in the app. @react-pdf/renderer has
 * no browser and therefore no CSS custom properties to resolve, so tokens do
 * not merely fail to adapt here, they do not resolve. The palette is a document
 * palette (white stock, near-black body, grey meta) chosen to survive a
 * monochrome printer at a supplier's office.
 */
import React from 'react';
import { Page, Text, View, Document, StyleSheet, Font } from '@react-pdf/renderer';
import { CartItem, ExchangeRate, Currency } from '../types';
import { isoCurrencyCode, rateToUsd } from '../../lib/currency';

Font.register({
  family: 'Plus Jakarta Sans',
  // Self-hosted (converted from the repo's woff2 by fontTools), the old
  // fonts.gstatic.com URL is blocked in mainland China, which killed PDF
  // generation exactly where the ledger gets used.
  src: '/fonts/PlusJakartaSans-Regular.ttf'
});

const styles = StyleSheet.create({
  page: {
    padding: 50,
    backgroundColor: '#ffffff',
    fontFamily: 'Plus Jakarta Sans',
    fontSize: 10,
    color: '#1a1a1a'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 40,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
    paddingBottom: 20
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4
  },
  subtitle: {
    fontSize: 10,
    color: '#666666',
    textTransform: 'uppercase',
    letterSpacing: 2
  },
  poDetails: {
    textAlign: 'right'
  },
  section: {
    marginBottom: 20
  },
  table: {
    marginTop: 20
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
    paddingBottom: 8,
    marginBottom: 8,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    fontSize: 8
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5'
  },
  colProduct: { flex: 4 },
  colQty: { flex: 1, textAlign: 'right' },
  colRate: { flex: 1, textAlign: 'right' },
  colTotal: { flex: 1, textAlign: 'right' },
  totals: {
    marginTop: 20,
    alignItems: 'flex-end'
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 200,
    paddingVertical: 4
  },
  grandTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 200,
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
    marginTop: 8,
    paddingTop: 8,
    fontWeight: 'bold',
    fontSize: 12
  },
  noteSection: {
    marginTop: 30,
    borderTopWidth: 1,
    borderTopColor: '#e5e5e5',
    paddingTop: 15
  },
  noteText: {
    fontSize: 9,
    color: '#666',
    lineHeight: 1.6
  }
});

/* Through the ISO code, because the shop keys yuan as 'Yuan' and the Taiwan
   dollar as 'NT', and Intl throws a RangeError on both. That threw inside the
   PDF renderer, so the operator got no purchase order at all. */
const format = (num: number, currency: string) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: isoCurrencyCode(currency) }).format(num);

interface PurchaseOrderPdfProps {
  poNumber: string;
  vendorName: string;
  vendorContact?: string;
  cart: CartItem[];
  rates: ExchangeRate[];
  currency: Currency;
  shipping: number;
}

export const PurchaseOrderPdfDocument: React.FC<PurchaseOrderPdfProps> = ({
  poNumber, vendorName, vendorContact, cart, rates, currency, shipping,
}) => {
  /* A rate of 1 for a currency the shop cannot resolve prints dollar figures
     under a foreign label, on a document that goes to a vendor. So the lookup
     canonicalises ('CNY' is the 'Yuan' row) and, where there really is no rate,
     the order is drawn in USD rather than mislabelled. */
  const rate = rateToUsd(rates, currency);
  const drawnIn: string = rate === null ? 'USD' : currency;
  const subtotal = cart.reduce((acc, item) => acc + (item.quantity * item.priceAtSale), 0);
  const total = subtotal + shipping;
  const conv = (usd: number) => (rate === null || drawnIn === 'USD' ? usd : usd * rate);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>TEAJIA</Text>
            <Text style={styles.subtitle}>Fine Tea & Wares</Text>
          </View>
          <View style={styles.poDetails}>
            <Text style={{ fontWeight: 'bold' }}>PURCHASE ORDER</Text>
            <Text>{poNumber}</Text>
            <Text>{new Date().toLocaleDateString()}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={{ color: '#666', fontSize: 8, textTransform: 'uppercase', marginBottom: 4 }}>Vendor</Text>
          <Text style={{ fontSize: 12 }}>{vendorName}</Text>
          {vendorContact ? <Text style={{ fontSize: 9, color: '#666', marginTop: 2 }}>{vendorContact}</Text> : null}
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.colProduct}>Item</Text>
            <Text style={styles.colQty}>Qty</Text>
            <Text style={styles.colRate}>Rate</Text>
            <Text style={styles.colTotal}>Total</Text>
          </View>
          {cart.map((item, i) => (
            <View key={i} style={styles.tableRow}>
              <View style={styles.colProduct}>
                <Text style={{ fontWeight: 'bold' }}>{item.product.givenName}</Text>
                <Text style={{ color: '#666', fontSize: 8 }}>{item.product.productName}</Text>
              </View>
              <Text style={styles.colQty}>{item.quantity} {item.product.type === 'Teaware' ? 'u' : 'g'}</Text>
              <Text style={styles.colRate}>{format(conv(item.priceAtSale), drawnIn)}</Text>
              <Text style={styles.colTotal}>{format(conv(item.quantity * item.priceAtSale), drawnIn)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text>Subtotal</Text>
            <Text>{format(conv(subtotal), drawnIn)}</Text>
          </View>
          {shipping > 0 && (
            <View style={styles.totalRow}>
              <Text>Shipping</Text>
              <Text>{format(conv(shipping), drawnIn)}</Text>
            </View>
          )}
          <View style={styles.grandTotal}>
            <Text>Total</Text>
            <Text>{format(conv(total), drawnIn)}</Text>
          </View>
        </View>

        <View style={styles.noteSection}>
          <Text style={styles.noteText}>Please confirm availability and pricing at your earliest convenience.</Text>
        </View>

        <View style={{ position: 'absolute', bottom: 30, left: 50, right: 50 }}>
          <Text style={{ fontSize: 8, color: '#999', textAlign: 'center' }}>
            Teajia · teajia.com
          </Text>
        </View>
      </Page>
    </Document>
  );
};
