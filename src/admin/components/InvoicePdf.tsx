import React from 'react';
import { Page, Text, View, Document, StyleSheet, Font } from '@react-pdf/renderer';
import { CartItem, ExchangeRate, Currency } from '../types';

// Register a font that supports nice typography
Font.register({
  family: 'Inter',
  src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hjp-Ek-_EeA.ttf'
});

const styles = StyleSheet.create({
  page: {
    padding: 50,
    backgroundColor: '#ffffff',
    fontFamily: 'Inter',
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

const format = (num: number, currency: string) => 
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(num);

interface InvoicePdfProps {
  invoiceNumber: string;
  customerName: string;
  cart: CartItem[];
  rates: ExchangeRate[];
  currency: Currency;
  shipping: number;
}

export const InvoicePdfDocument: React.FC<InvoicePdfProps> = ({ 
  invoiceNumber, customerName, cart, rates, currency, shipping 
}) => {
  const rate = rates.find(r => r.currency === currency)?.rateToUSD || 1;
  const subtotal = cart.reduce((acc, item) => acc + (item.quantity * item.priceAtSale), 0);
  const total = subtotal + shipping;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>TEAJIA</Text>
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
            <View key={i} style={styles.tableRow}>
              <View style={styles.colProduct}>
                <Text style={{fontWeight: 'bold'}}>{item.product.givenName}</Text>
                <Text style={{color: '#666', fontSize: 8}}>{item.product.productName}</Text>
              </View>
              <Text style={styles.colQty}>{item.quantity} {item.product.type === 'Teaware' ? 'u' : 'g'}</Text>
              <Text style={styles.colRate}>{format(item.priceAtSale * (currency === 'USD' ? 1 : rate), currency)}</Text>
              <Text style={styles.colTotal}>{format(item.quantity * item.priceAtSale * (currency === 'USD' ? 1 : rate), currency)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text>Subtotal</Text>
            <Text>{format(subtotal * (currency === 'USD' ? 1 : rate), currency)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text>Shipping</Text>
            <Text>{format(shipping * (currency === 'USD' ? 1 : rate), currency)}</Text>
          </View>
          <View style={styles.grandTotal}>
            <Text>Total</Text>
            <Text>{format(total * (currency === 'USD' ? 1 : rate), currency)}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
};