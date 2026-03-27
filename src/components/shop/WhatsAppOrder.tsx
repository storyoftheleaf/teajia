import React from 'react';
import { Icons } from '../Icons';
import { Button } from '../shared/Button';
import { buildWhatsAppUrl } from '../../lib/whatsapp';

const DEFAULT_PHONE = import.meta.env.VITE_WHATSAPP_NUMBER || '';

interface WhatsAppOrderProps {
  productName?: string;
  cartItems?: { name: string; quantity: string }[];
  phone?: string;
}

export const WhatsAppOrder: React.FC<WhatsAppOrderProps> = ({
  productName,
  cartItems,
  phone = DEFAULT_PHONE,
}) => {
  const handleClick = () => {
    const items = cartItems
      ? cartItems.map(i => `${i.name} (${i.quantity})`)
      : productName
        ? [productName]
        : [];

    if (items.length === 0) return;
    let message = "Hi, I'd like to order:\n\n";
    items.forEach(item => { message += `- ${item}\n`; });
    message += "\nPlease let me know about pickup/delivery. Thank you!";
    window.open(buildWhatsAppUrl(phone, message), '_blank');
  };

  return (
    <Button
      variant="secondary"
      size="sm"
      icon={<Icons.Message className="w-4 h-4" />}
      onClick={handleClick}
    >
      Arrange via WhatsApp
    </Button>
  );
};
