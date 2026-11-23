import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { VendorFace } from './VendorFace';
import { VendorFacePhotoButton } from './VendorFacePhotoButton';
import { orderFaceVendors, type FaceVendor } from './vendorFaces';

/**
 * Every vendor as a face, in People > Suppliers. Tap a face for the vendor's
 * page (contacts, teas, purchases); the camera on each tile adds or changes
 * the face photo there and then, so the gallery fills in as Adrian goes.
 *
 * Takes the list the Suppliers tab has already searched and filtered, so the
 * search box and "need info" filter work here too.
 */
export const VendorFaceGallery: React.FC<{ vendors: FaceVendor[] }> = ({ vendors }) => {
  const { withPhoto, withoutPhoto } = useMemo(() => orderFaceVendors(vendors), [vendors]);
  const missingFaces = vendors.filter(v => !v.hasFace).length;

  if (vendors.length === 0) {
    return <p className="px-4 py-8 text-center text-ui-13 text-tea-text-sec">No vendors match.</p>;
  }

  const tile = (v: FaceVendor) => (
    <li key={v.id ?? v.name} className="relative">
      {v.id ? (
        <Link to={`/admin/vendors/${v.id}`} className="group block rounded-xl p-1.5 transition-colors hover:bg-tea-accent-sub focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50">
          <VendorFace name={v.name} photo={v.photo} shape="tile" className="group-hover:border-tea-gold" />
          <span className="mt-1.5 block truncate text-ui-14 text-tea-text">{v.name}</span>
          <span className="block truncate text-ui-12 text-tea-text-sec">{[v.company, v.country].filter(Boolean).join(' · ') || 'Vendor'}</span>
        </Link>
      ) : (
        <div className="p-1.5">
          <VendorFace name={v.name} photo={v.photo} shape="tile" />
          <span className="mt-1.5 block truncate text-ui-14 text-tea-text">{v.name}</span>
        </div>
      )}
      {v.id && (
        <VendorFacePhotoButton
          vendorId={v.id}
          vendorName={v.name}
          hasFace={v.hasFace}
          look="badge"
          className="absolute top-3 right-3"
        />
      )}
    </li>
  );

  const grid = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-2';
  return (
    <div className="px-3 md:px-2 py-4 space-y-5 pb-nav-gap md:pb-6" data-testid="vendor-face-gallery">
      {missingFaces > 0 && (
        <p className="text-ui-13 text-tea-text-sec px-1.5">
          {missingFaces === 1 ? 'One vendor has' : `${missingFaces} vendors have`} no face photo yet. Tap the camera on a tile to add one.
        </p>
      )}
      {withPhoto.length > 0 && <ul className={grid}>{withPhoto.map(tile)}</ul>}
      {withoutPhoto.length > 0 && (
        <section className="space-y-2">
          {withPhoto.length > 0 && <h3 className="type-label text-tea-text-sec px-1.5">No photo yet</h3>}
          <ul className={grid}>{withoutPhoto.map(tile)}</ul>
        </section>
      )}
    </div>
  );
};
