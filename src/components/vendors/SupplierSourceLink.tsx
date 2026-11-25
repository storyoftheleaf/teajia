import React from 'react';
import { mediaUrl } from '../../lib/mediaUrl';
import { usePrivateQueryScope } from '../../admin/hooks/usePrivateQueryScope';
import { useFaceVendors, type FaceVendor } from './vendorFaces';

/**
 * The supplier's face beside their name on a tea.
 *
 * Adrian, 2026-11-25: "See how you have the tea shop owner? Can you put a
 * little thumbnail of what the owner looks like there, but make it look
 * classy?"
 *
 * Only the supplier's own face is shown, never their storefront or business
 * card, because the line is about the person. A supplier with no face on
 * their card keeps the plain line it had before.
 */
export function supplierFaceFor(vendors: FaceVendor[], supplier: string | undefined): string | undefined {
  const name = supplier?.trim().toLowerCase();
  if (!name) return undefined;
  const match = vendors.find(v => v.hasFace && v.name.trim().toLowerCase() === name);
  return match?.photo;
}

/** A small round portrait in a hairline gold ring, set a little off the photo. */
export const SupplierFaceThumb: React.FC<{ photo: string; size?: number }> = ({ photo, size = 30 }) => (
  <span className="supplier-face" style={{ width: size, height: size }} aria-hidden="true" data-testid="supplier-face">
    <img src={mediaUrl(photo)} alt="" loading="lazy" decoding="async" />
  </span>
);

/** Admin-only "Source" line on a tea page, with the supplier's face when their card has one. */
export const SupplierSourceLink: React.FC<{ supplier: string; onClick: () => void }> = ({ supplier, onClick }) => {
  const scope = usePrivateQueryScope();
  const { vendors } = useFaceVendors({ enabled: scope.ready });
  const face = supplierFaceFor(vendors, supplier);
  return (
    <button type="button" onClick={onClick} className={`alcove-source-link${face ? ' alcove-source-link--face' : ''}`}>
      {face && <SupplierFaceThumb photo={face} />}
      <span className="alcove-source-name">Source: {supplier}</span>
    </button>
  );
};
