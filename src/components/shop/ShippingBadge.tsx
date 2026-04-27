import React from 'react';
import { Icons } from '../Icons';
import type { ShippingType } from '../../types/shop';

const BADGE_CONFIG: Record<ShippingType, { icon: React.FC<{ className?: string }>; label: string; className: string }> = {
  international: { icon: Icons.ExternalLink, label: 'Ships Worldwide', className: 'text-tea-green' },
  'bali-only': { icon: Icons.MapPin, label: 'Bali Only', className: 'text-tea-gold' },
  'inquiry-only': { icon: Icons.Seal, label: 'Inquire', className: 'text-tea-text/40' },
};

interface ShippingBadgeProps {
  type: ShippingType;
  size?: 'sm' | 'md';
}

export const ShippingBadge: React.FC<ShippingBadgeProps> = ({ type, size = 'sm' }) => {
  const config = BADGE_CONFIG[type];
  const IconComponent = config.icon;
  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';
  const textSize = size === 'sm' ? 'text-ui-10' : 'text-xs';

  return (
    <span className={`inline-flex items-center gap-1 ${textSize} uppercase tracking-wider ${config.className}`}>
      <IconComponent className={iconSize} />
      <span>{config.label}</span>
    </span>
  );
};
