import React from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { X, Printer } from 'lucide-react';
import { Product } from '../types';

interface QrCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
}

export const QrCodeModal: React.FC<QrCodeModalProps> = ({ isOpen, onClose, product }) => {
  if (!isOpen || !product) return null;

  const qrValue = `https://teajia.co/shop/${product.id}`;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4 print:bg-white print:p-0">
      <button
        type="button"
        aria-hidden
        onClick={onClose}
        className="absolute inset-0 bg-tea-bg/70 backdrop-blur-[2px] print:hidden"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="QR code"
        className="relative bg-tea-surface border border-tea-border rounded-xl shadow-2xl w-full max-w-sm print:border-none print:shadow-none print:w-full print:max-w-none print:bg-white"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-tea-text-sec hover:text-tea-text transition-colors print:hidden focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:outline-none rounded-md p-1.5 tap-target"
          aria-label="Close"
        >
          <X size={16} />
        </button>

        <div className="px-6 pt-6 pb-3 text-center">
          <h3 className="h3 text-tea-text print:text-black">{product.givenName}</h3>
          <p className="text-ui-13 text-tea-text-sec mt-1 font-serif italic print:text-tea-text-sec">
            {product.productName} ({product.year})
          </p>
        </div>

        <div className="px-6 pb-6 space-y-4">
          <div className="flex justify-center bg-tea-bg p-4 rounded-md mx-auto w-fit border border-tea-border">
            <QRCodeCanvas value={qrValue} size={192} />
          </div>

          <div className="label-caps text-tea-text-dim text-center print:text-black">
            ID: {product.id}
          </div>
        </div>

        <div className="flex justify-between gap-2 px-6 py-4 border-t border-tea-border print:hidden">
          <button
            type="button"
            onClick={onClose}
            className="px-2 py-1 text-xs text-tea-text-sec hover:text-tea-text transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 transition-colors shadow-lg shadow-tea-gold/10"
          >
            <Printer size={13} /> Print Label
          </button>
        </div>
      </div>
    </div>
  );
};
