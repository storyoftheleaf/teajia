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
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-tea-text/80 backdrop-blur-sm p-4 print:bg-white print:p-0">
      <div role="dialog" aria-modal="true" aria-label="QR code" className="bg-tea-surface border border-tea-border rounded-lg w-full max-w-sm p-8 shadow-lg relative print:border-none print:shadow-none print:w-full print:max-w-none print:bg-white">
        <button onClick={onClose} className="absolute top-4 right-4 text-tea-text-sec hover:text-tea-text transition-colors print:hidden focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:outline-none rounded-lg" aria-label="Close">
          <X size={20} />
        </button>
        
        <div className="text-center space-y-4">
          <h3 className="text-xl font-serif text-tea-text print:text-black">{product.givenName}</h3>
          <p className="text-tea-text-sec text-sm font-serif italic print:text-tea-text-sec">{product.productName} ({product.year})</p>
          
          <div className="flex justify-center p-4 bg-white rounded-xl mx-auto w-fit border border-tea-border shadow-sm">
            <QRCodeCanvas value={qrValue} size={200} />
          </div>
          
          <div className="pt-4 text-[10px] text-tea-text-sec font-mono uppercase tracking-[0.2em] print:text-black">
            ID: {product.id}
          </div>

          <button 
            onClick={handlePrint}
            className="w-full flex items-center justify-center gap-2 py-3 bg-tea-accent text-tea-bg font-bold text-xs uppercase tracking-[0.2em] rounded-lg hover:bg-tea-accent/90 transition-colors print:hidden mt-6"
          >
            <Printer size={16} /> Print Label
          </button>
        </div>
      </div>
    </div>
  );
};