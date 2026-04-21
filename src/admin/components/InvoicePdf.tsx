import React from 'react';
import { Page, Text, View, Document, StyleSheet, Font } from '@react-pdf/renderer';
import { InvoiceDisplayItem, ExchangeRate, Currency } from '../types';

// Register a font that supports nice typography
Font.register({
  family: 'Plus Jakarta Sans',
  src: 'https://fonts.gstatic.com/s/plusjakartasans/v8/LDIbaomQNQcsA88c7O9yZ4KMCoOg4IA6-91aHEjcWuA_qU79TR_V.ttf'
});

export type InvoiceTemplateStyle = 'classic' | 'compact' | 'detailed';

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
  invoiceDetails: {
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
  }
});

// Compact template — minimal spacing, smaller text, no descriptions
const compactStyles = StyleSheet.create({
  page: { ...styles.page, padding: 30, fontSize: 9 },
  header: { ...styles.header, marginBottom: 20, paddingBottom: 10 },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 2 },
  tableRow: { ...styles.tableRow, paddingVertical: 4 },
});

// Detailed template — includes product descriptions and notes
const detailedStyles = StyleSheet.create({
  page: { ...styles.page, padding: 40 },
  noteSection: { marginTop: 30, borderTopWidth: 1, borderTopColor: '#e5e5e5', paddingTop: 15 },
  noteText: { fontSize: 9, color: '#666', lineHeight: 1.6 },
});

const format = (num: number, currency: string) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(num);

interface InvoicePdfProps {
  invoiceNumber: string;
  customerName: string;
  cart: InvoiceDisplayItem[];
  rates: ExchangeRate[];
  currency: Currency;
  shipping: number;
  template?: InvoiceTemplateStyle;
  notes?: string;
}

export const InvoicePdfDocument: React.FC<InvoicePdfProps> = ({
  invoiceNumber, customerName, cart, rates, currency, shipping, template = 'classic', notes
}) => {
  const rate = rates.find(r => r.currency === currency)?.rateToUSD || 1;
  const subtotal = cart.reduce((acc, item) => acc + (item.quantity * item.priceAtSale), 0);
  const total = subtotal + shipping;
  const conv = (usd: number) => usd * (currency === 'USD' ? 1 : rate);

  const isCompact = template === 'compact';
  const isDetailed = template === 'detailed';

  const pageStyle = isCompact ? compactStyles.page : styles.page;
  const headerStyle = isCompact ? compactStyles.header : styles.header;
  const titleStyle = isCompact ? compactStyles.title : styles.title;
  const rowStyle = isCompact ? compactStyles.tableRow : styles.tableRow;

  return (
    <Document>
      <Page size="A4" style={pageStyle}>
        <View style={headerStyle}>
          <View>
            <Text style={titleStyle}>TEAJIA</Text>
            <Text style={styles.subtitle}>Fine Tea & Wares</Text>
          </View>
          <View style={styles.invoiceDetails}>
            <Text style={{fontWeight: 'bold'}}>INVOICE</Text>
            <Text>{invoiceNumber}</Text>
            <Text>{new Date().toLocaleDateString()}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={{color: '#666', fontSize: 8, textTransform: 'uppercase', marginBottom: 4}}>Bill To</Text>
          <Text style={{fontSize: 12}}>{customerName}</Text>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.colProduct}>Item</Text>
            <Text style={styles.colQty}>Qty</Text>
            <Text style={styles.colRate}>Rate</Text>
            <Text style={styles.colTotal}>Total</Text>
          </View>
          {cart.map((item, i) => (
            <View key={i} style={rowStyle}>
              <View style={styles.colProduct}>
                <Text style={{fontWeight: 'bold'}}>{item.product?.givenName ?? item.customName ?? 'Custom Item'}</Text>
                {!isCompact && item.product?.productName && <Text style={{color: '#666', fontSize: 8}}>{item.product.productName}</Text>}
                {isDetailed && item.product?.description && (
                  <Text style={{color: '#999', fontSize: 7, marginTop: 2}}>{item.product.description.slice(0, 120)}</Text>
                )}
              </View>
              <Text style={styles.colQty}>{item.quantity} {item.unit ?? (item.product?.type === 'Teaware' ? 'u' : 'g')}</Text>
              <Text style={styles.colRate}>{format(conv(item.priceAtSale), currency)}</Text>
              <Text style={styles.colTotal}>{format(conv(item.quantity * item.priceAtSale), currency)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text>Subtotal</Text>
            <Text>{format(conv(subtotal), currency)}</Text>
          </View>
          {shipping > 0 && (
            <View style={styles.totalRow}>
              <Text>Shipping</Text>
              <Text>{format(conv(shipping), currency)}</Text>
            </View>
          )}
          <View style={styles.grandTotal}>
            <Text>Total</Text>
            <Text>{format(conv(total), currency)}</Text>
          </View>
        </View>

        {/* Notes section — detailed template or when notes provided */}
        {(isDetailed || notes) && notes && (
          <View style={detailedStyles.noteSection}>
            <Text style={{fontSize: 8, textTransform: 'uppercase', color: '#666', marginBottom: 6}}>Notes</Text>
            <Text style={detailedStyles.noteText}>{notes}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={{ position: 'absolute', bottom: 30, left: 50, right: 50 }}>
          <Text style={{ fontSize: 8, color: '#999', textAlign: 'center' }}>
            Thank you for choosing Teajia. — teajia.com
          </Text>
        </View>
      </Page>
    </Document>
  );
};
