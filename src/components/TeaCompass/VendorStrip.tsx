import React from 'react';
import { MapPin, X } from 'lucide-react';

interface VendorStripProps {
  vendorName?: string;
  onVendorChange: () => void;
  onClear: () => void;
}

export const VendorStrip: React.FC<VendorStripProps> = ({
  vendorName,
  onVendorChange,
  onClear,
}) => {
  return (
    <div className="flex items-center gap-2 text-xs text-tea-text-sec">
      <MapPin size={12} className="text-tea-text-dim flex-shrink-0" />
      {vendorName ? (
        <>
          <button
            type="button"
            onClick={onVendorChange}
            className="truncate hover:text-tea-gold transition-colors"
          >
            {vendorName}
          </button>
          <button
            type="button"
            onClick={onClear}
            className="text-tea-text-dim hover:text-tea-text-sec transition-colors flex-shrink-0"
          >
            <X size={12} />
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={onVendorChange}
          className="text-tea-text-dim hover:text-tea-text-sec transition-colors"
        >
          No vendor
        </button>
      )}
    </div>
  );
};

export default VendorStrip;
