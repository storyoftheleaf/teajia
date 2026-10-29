import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { LogisticsAddress, LogisticsShipment } from '../../../lib/logisticsTypes';
import { AddressPicker, availableLogisticsAddresses, logisticsAddressText } from './LogisticsAddresses';
import { shipmentManifest } from './LogisticsControls';
import { manifestMessage } from './logisticsManifest';
import { LogisticsShipmentCard } from './LogisticsShipmentCard';
vi.mock('./TrackingTask', () => ({ TrackingTask: ({ open, children }: { open: boolean; children: React.ReactNode }) => open ? <section>{children}</section> : null }));
const destination: LogisticsAddress = { id: 'studio', label: 'Ubud studio', role: 'destination', recipient: 'Studio receiving', address_lines: '12 Studio Road', city: 'Ubud', region: 'Bali', postal_code: '80571', country_code: 'ID', phone: '+62 000', archived: false };
const warehouse: LogisticsAddress = { ...destination, id: 'warehouse', label: 'Guangzhou warehouse', role: 'warehouse', logistics_company_id: 'company-a', country_code: 'CN' };
const shipment: LogisticsShipment = { id: 's1', logistics_company_id: 'company-a', logistics_company_name: 'Forwarder', mode: 'sea', state: 'in_transit', outbound_courier: null, tracking_number: 'BOAT1', eta: null, created_at: '2026-10-29', dispatched_at: '2026-10-29', freight: null, freight_total: null, freight_estimated: true, freight_issue: null, lines: [], delivery_address_id: destination.id, delivery_address: destination };
describe('saved logistics destination selection', () => {
  it('offers only active addresses for the selected role and warehouse company', () => {
    const addresses = [destination, warehouse, { ...warehouse, id: 'other', logistics_company_id: 'company-b' }, { ...warehouse, id: 'shared', logistics_company_id: null }, { ...destination, id: 'archived', archived: true }];
    expect(availableLogisticsAddresses(addresses, 'warehouse', 'company-a').map(address => address.id)).toEqual(['warehouse', 'shared']);
    expect(availableLogisticsAddresses(addresses, 'destination').map(address => address.id)).toEqual(['studio']);
  });
  it('keeps an archived recorded snapshot readable without offering it as a new address', () => {
    const recorded = { ...destination, archived: true, address_lines: 'Original address' };
    const html = renderToStaticMarkup(<AddressPicker addresses={[recorded]} current={recorded} role="destination" value="keep" onChange={() => {}} busy={false} label="Deliver to"/>);
    expect(html).toContain('Keep Ubud studio as recorded');
    expect(html).toContain('Original address');
    expect(html).not.toContain('value="studio"');
    expect(html).not.toContain('use current saved version');
  });
  it('shows the original destination on the card and exports it even when the address book was changed', () => {
    const changed = { ...destination, label: 'New studio', address_lines: 'New address' };
    const html = renderToStaticMarkup(<LogisticsShipmentCard shipment={shipment} addresses={[changed]} orders={[]} accountId="shop" busy={false} mutate={async action => { await action(); }} openPurchase={() => {}}/>);
    expect(html).toContain('Forwarder → Ubud studio');
    expect(html).toContain('12 Studio Road');
    expect(html).not.toContain('New address');
    const text = manifestMessage(shipmentManifest(shipment, []));
    expect(text).toContain('12 Studio Road');
    expect(text).toContain('Ubud studio');
    expect(text).not.toContain('delivery address not recorded');
  });
  it('offers an explicit updated-version choice while preserving a recorded snapshot by default', () => {
    const updated = { ...destination, address_lines: 'New address' };
    const html = renderToStaticMarkup(<AddressPicker addresses={[updated]} current={destination} role="destination" value="keep" onChange={() => {}} busy={false} label="Deliver to"/>);
    expect(html).toContain('value="keep" selected=""');
    expect(html).toContain('use current saved version');
    expect(html).toContain('12 Studio Road');
    expect(logisticsAddressText(undefined)).toBe('');
  });
});
