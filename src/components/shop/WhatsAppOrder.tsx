import React from 'react';
import { Icons } from '../Icons';
import { Button } from '../shared/Button';

const PLACEHOLDER_PHONE = '6281234567890';

interface WhatsAppOrderProps {
  productName?: string;
  cartItems?: { name: string; quantity: string }[];
  phone?: string;
}

function buildWhatsAppUrl(items: string[], phone: string): string {
  let message = "Hi, I'd like to order:\n\n";
  items.forEach(item => { message += `- ${item}\n`; });
  message += "\nPlease let me know about pickup/delivery. Thank you!";
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

export const WhatsAppOrder: React.FC<WhatsAppOrderProps> = ({
  productName,
  cartItems,
  phone = PLACEHOLDER_PHONE,
}) => {
  const handleClick = () => {
    const items = cartItems
      ? cartItems.map(i => `${i.name} (${i.quantity})`)
      : productName
        ? [productName]
        : [];

    if (items.length === 0) return;
    window.open(buildWhatsAppUrl(items, phone), '_blank');
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
