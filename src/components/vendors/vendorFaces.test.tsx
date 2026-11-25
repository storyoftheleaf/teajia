import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { fileNameWords, filterFaceVendors, orderFaceVendors, suggestVendorForFile, toFaceVendor, vendorFacePhoto, vendorInitials } from './vendorFaces';
import { VendorFace } from './VendorFace';
import { VendorFaceGallery } from './VendorFaceGallery';

describe('vendor faces', () => {
  it('shows the face first, then the shop, then the business card', () => {
    expect(vendorFacePhoto({ face_photo: 'face.jpg', storefront_photo: 'shop.jpg', business_card_photo: 'card.jpg' })).toBe('face.jpg');
    expect(vendorFacePhoto({ storefront_photo: 'shop.jpg', business_card_photo: 'card.jpg' })).toBe('shop.jpg');
    expect(vendorFacePhoto({ business_card_photo: 'card.jpg' })).toBe('card.jpg');
    expect(vendorFacePhoto({ face_photo: '', storefront_photo: null })).toBeUndefined();
    expect(vendorFacePhoto(undefined)).toBeUndefined();
  });

  it('only counts the vendor\'s own face as a face', () => {
    expect(toFaceVendor({ id: 'a', name: 'Master Bo', storefront_photo: 'shop.jpg' })).toMatchObject({ photo: 'shop.jpg', hasFace: false });
    expect(toFaceVendor({ id: 'a', name: 'Master Bo', face_photo: 'face.jpg' })).toMatchObject({ photo: 'face.jpg', hasFace: true });
  });

  it('narrows by name, shop, Chinese name or country', () => {
    const vendors = [
      toFaceVendor({ id: '1', name: 'Master Bo', company: 'Bo Tea House', country: 'China' }),
      toFaceVendor({ id: '2', name: 'Lin', chinese_name: '林', country: 'Taiwan' }),
    ];
    expect(filterFaceVendors(vendors, 'tea house').map(v => v.id)).toEqual(['1']);
    expect(filterFaceVendors(vendors, '林').map(v => v.id)).toEqual(['2']);
    expect(filterFaceVendors(vendors, 'taiwan').map(v => v.id)).toEqual(['2']);
    expect(filterFaceVendors(vendors, '  ')).toHaveLength(2);
  });

  it('puts the vendors with a photo first, each group in name order', () => {
    const { withPhoto, withoutPhoto } = orderFaceVendors([
      toFaceVendor({ name: 'Zhang' }),
      toFaceVendor({ name: 'Wu', face_photo: 'w.jpg' }),
      toFaceVendor({ name: 'Bo', storefront_photo: 'b.jpg' }),
      toFaceVendor({ name: 'An' }),
    ]);
    expect(withPhoto.map(v => v.name)).toEqual(['Bo', 'Wu']);
    expect(withoutPhoto.map(v => v.name)).toEqual(['An', 'Zhang']);
  });

  it('falls back to initials when there is no photo', () => {
    expect(vendorInitials('Master Bo')).toBe('MB');
    expect(vendorInitials('Lin')).toBe('LI');
    expect(vendorInitials('')).toBe('·');
    const html = renderToStaticMarkup(<VendorFace name="Master Bo" />);
    expect(html).toContain('MB');
    expect(html).not.toContain('<img');
  });

  it('renders the face when there is one', () => {
    const html = renderToStaticMarkup(<VendorFace name="Master Bo" photo="https://img.example/face.jpg" shape="tile" />);
    expect(html).toContain('<img');
    expect(html).toContain('alt="Master Bo"');
  });

  it('lays the gallery out face-first, links each face to its vendor, and offers a camera on every tile', () => {
    const html = renderToStaticMarkup(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <VendorFaceGallery vendors={[
            toFaceVendor({ id: 'v1', name: 'Zhang' }),
            toFaceVendor({ id: 'v2', name: 'Wu', face_photo: 'https://img.example/w.jpg' }),
          ]} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(html.indexOf('Wu')).toBeLessThan(html.indexOf('Zhang'));
    expect(html).toContain('href="/admin/vendors/v1"');
    expect(html).toContain('href="/admin/vendors/v2"');
    expect(html).toContain('No photo yet');
    expect(html).toContain('One vendor has no face photo yet');
    expect(html).toContain('Add face photo: Zhang');
    expect(html).toContain('Change face photo: Wu');
  });

  it('reads a photo file name as words', () => {
    expect(fileNameWords('huang-wei-weeee36.jpeg')).toEqual(['huang', 'wei', 'weeee36']);
    expect(fileNameWords('林 老师.JPG')).toEqual(['林', '老师']);
  });

  it('points a face at the one vendor its file name names, and at nobody when it is unclear', () => {
    const vendors = [
      toFaceVendor({ id: 'hw', name: 'Huang Wei' }),
      toFaceVendor({ id: 'hl', name: 'Huang Li' }),
      toFaceVendor({ id: 'lin', name: 'Teacher Lin', chinese_name: '林老师' }),
    ];
    expect(suggestVendorForFile('huang-wei-weeee36.jpg', vendors)?.id).toBe('hw');
    expect(suggestVendorForFile('林老师.jpg', vendors)?.id).toBe('lin');
    expect(suggestVendorForFile('huang.jpg', vendors)).toBeUndefined();
    expect(suggestVendorForFile('IMG_2041.jpg', vendors)).toBeUndefined();
  });

  it('offers a tray for placing a batch of faces above the vendors', () => {
    const html = renderToStaticMarkup(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <VendorFaceGallery vendors={[toFaceVendor({ id: 'v1', name: 'Zhang' })]} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(html).toContain('data-testid="face-tray"');
    expect(html).toContain('Add photos to place');
    expect(html).toContain('multiple');
    expect(html.indexOf('face-tray')).toBeLessThan(html.indexOf('face-tile-v1'));
  });
});
