import React, { useEffect, useMemo, useState } from 'react';
import { ScanFace } from 'lucide-react';
import { Modal } from '../shared/Modal';
import { Button } from '../shared/Button';
import { VendorFace } from './VendorFace';
import { filterFaceVendors, orderFaceVendors, type FaceVendor } from './vendorFaces';

/**
 * Pick a vendor by face. Every vendor as a big photo with the name under it;
 * one tap picks. The search narrows by name, shop, Chinese name or country,
 * for when part of it comes back.
 *
 * Opened from beside every vendor picker. It only chooses: whatever the picker
 * does with a chosen vendor (link it, save it on the tea) happens there.
 */
export const VendorFaceSheet: React.FC<{
  open: boolean;
  onClose: () => void;
  vendors: FaceVendor[];
  onPick: (vendor: FaceVendor) => void;
  /** The vendor already chosen, marked in the grid. */
  selectedName?: string;
  loading?: boolean;
}> = ({ open, onClose, vendors, onPick, selectedName, loading }) => {
  const [query, setQuery] = useState('');
  useEffect(() => { if (open) setQuery(''); }, [open]);

  const { withPhoto, withoutPhoto } = useMemo(
    () => orderFaceVendors(filterFaceVendors(vendors, query)),
    [vendors, query],
  );
  const selected = selectedName?.trim().toLowerCase();

  const tile = (v: FaceVendor) => {
    const isSelected = !!selected && v.name.trim().toLowerCase() === selected;
    return (
      <li key={v.id ?? v.name}>
        <Button
          type="button"
          variant="plain"
          onClick={() => { onPick(v); onClose(); }}
          aria-pressed={isSelected}
          data-testid="vendor-face-option"
          className={`group w-full text-left rounded-xl p-1.5 transition-colors hover:bg-tea-accent-sub focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 ${isSelected ? 'bg-tea-accent-sub' : ''}`}
        >
          <VendorFace name={v.name} photo={v.photo} shape="tile" className={isSelected ? 'border-tea-gold' : 'group-hover:border-tea-gold'} />
          <span className={`mt-1.5 block truncate text-ui-13 ${isSelected ? 'text-tea-gold' : 'text-tea-text'}`}>{v.name}</span>
          {v.company && <span className="block truncate text-ui-12 text-tea-text-sec">{v.company}</span>}
        </Button>
      </li>
    );
  };

  return (
    <Modal isOpen={open} onClose={onClose} title="Pick a vendor by face" variant="sheet" className="sm:max-w-2xl" initialFocus="container">
      <div className="px-4 sm:px-6 pt-4 pb-nav-gap lg:pb-6 space-y-4">
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Name, shop or country"
          aria-label="Narrow the vendors"
          autoComplete="off"
          className="input-field min-h-tap w-full px-3 py-2 text-ui-16"
        />
        {loading && vendors.length === 0 ? (
          <p role="status" className="text-ui-13 text-tea-text-sec">Looking up vendors…</p>
        ) : withPhoto.length + withoutPhoto.length === 0 ? (
          <p className="text-ui-13 text-tea-text-sec">{query.trim() ? 'No vendor matches that.' : 'No vendors yet.'}</p>
        ) : (
          <>
            {withPhoto.length > 0 && (
              <ul className="grid grid-cols-3 sm:grid-cols-4 gap-2">{withPhoto.map(tile)}</ul>
            )}
            {withoutPhoto.length > 0 && (
              <section className="space-y-2">
                {withPhoto.length > 0 && <h3 className="type-label text-tea-text-sec">No photo yet</h3>}
                <ul className="grid grid-cols-3 sm:grid-cols-4 gap-2">{withoutPhoto.map(tile)}</ul>
              </section>
            )}
          </>
        )}
      </div>
    </Modal>
  );
};

/** The button that opens the face grid, for beside a vendor field. */
export const VendorFacesButton: React.FC<{ onClick: () => void; className?: string; label?: string }> = ({ onClick, className = '', label = 'Faces' }) => (
  <Button
    type="button"
    variant={label ? 'quiet' : 'icon'}
    onMouseDown={e => e.preventDefault()}
    onClick={onClick}
    aria-label="Pick a vendor by face"
    title="Pick a vendor by face"
    data-testid="vendor-faces-button"
    className={`shrink-0 ${className}`}
    icon={<ScanFace size={16} strokeWidth={1.5} aria-hidden="true" />}
  >
    {label || undefined}
  </Button>
);
