import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SupplierFaceThumb, supplierFaceFor } from './SupplierSourceLink';
import { toFaceVendor } from './vendorFaces';

describe('supplier face on a tea', () => {
  const vendors = [
    toFaceVendor({ id: '1', name: 'Lao Zhang', face_photo: 'zhang.jpg' }),
    toFaceVendor({ id: '2', name: 'Master Bo', storefront_photo: 'shop.jpg' }),
  ];

  it('finds the supplier by name, ignoring case and spaces', () => {
    expect(supplierFaceFor(vendors, 'Lao Zhang')).toBe('zhang.jpg');
    expect(supplierFaceFor(vendors, '  lao zhang ')).toBe('zhang.jpg');
  });

  it('shows only a face, never a storefront standing in for one', () => {
    expect(supplierFaceFor(vendors, 'Master Bo')).toBeUndefined();
  });

  it('shows nothing for an unknown or empty supplier', () => {
    expect(supplierFaceFor(vendors, 'Yunan Fam')).toBeUndefined();
    expect(supplierFaceFor(vendors, '')).toBeUndefined();
    expect(supplierFaceFor(vendors, undefined)).toBeUndefined();
  });

  it('draws a small round portrait at the size asked for', () => {
    const html = renderToStaticMarkup(<SupplierFaceThumb photo="zhang.jpg" size={40} />);
    expect(html).toContain('class="supplier-face"');
    expect(html).toContain('width:40px');
    expect(html).toContain('zhang.jpg');
  });
});
