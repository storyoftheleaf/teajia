import React from 'react';
import { Icons } from '../Icons';

type ServiceAvailability = 'by-inquiry' | 'bali-studio' | 'remote' | 'seasonal' | 'now-booking';

const BADGE_CONFIG: Record<ServiceAvailability, { icon: React.FC<{ className?: string }>; label: string; className: string }> = {
  'by-inquiry': { icon: Icons.Seal, label: 'By Inquiry', className: 'text-tea-gold' },
  'bali-studio': { icon: Icons.MapPin, label: 'Bali Studio', className: 'text-tea-green' },
  'remote': { icon: Icons.ExternalLink, label: 'Remote Available', className: 'text-tea-green' },
  'seasonal': { icon: Icons.Leaf, label: 'Seasonal', className: 'text-tea-text/50' },
  'now-booking': { icon: Icons.Check, label: 'Now Booking', className: 'text-tea-green' },
};

interface ServiceBadgeProps {
  type: ServiceAvailability;
}

export const ServiceBadge: React.FC<ServiceBadgeProps> = ({ type }) => {
  const config = BADGE_CONFIG[type];
  if (!config) return null;
  const IconComponent = config.icon;

  return (
    <span className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider ${config.className}`}>
      <IconComponent className="w-3 h-3" />
      {config.label}
    </span>
  );
};
