import React from 'react';
import { Icons } from '../Icons';
import { CardContainer } from './CardContainer';

interface FeaturedCardMetadata {
  label: string;
  value: string;
}

interface FeaturedCardProps {
  badge: string;
  title: string;
  description: string;
  ctaLabel: string;
  onCtaClick: () => void;
  metadata?: FeaturedCardMetadata[];
  decorativeElement?: React.ReactNode;
  className?: string;
}

export const FeaturedCard: React.FC<FeaturedCardProps> = ({
  badge,
  title,
  description,
  ctaLabel,
  onCtaClick,
  metadata,
  decorativeElement,
  className = '',
}) => {
  return (
    <CardContainer variant="dark" className={className}>
      <div className="flex flex-col md:flex-row">
        {/* Text content */}
        <div className="flex-1 p-6 md:p-8">
          <span className="inline-block text-[10px] uppercase tracking-[0.2em] text-tea-gold font-sans mb-4 px-2 py-1 bg-tea-gold/10 rounded-sm">
            {badge}
          </span>
          <h2 className="font-serif text-[clamp(24px,3.5vw,32px)] text-tea-text leading-[1.2] tracking-[0.01em] mb-4">
            {title}
          </h2>
          <p className="font-serif text-[17px] text-tea-text-sec leading-[1.85] mb-6 max-w-lg">
            {description}
          </p>
          <button
            onClick={onCtaClick}
            className="text-tea-gold text-[13px] font-sans flex items-center gap-1.5 group hover:text-tea-gold/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 rounded-sm pb-0.5"
            style={{ boxShadow: '0 1px 0 rgba(184,146,78,0.3)' }}
          >
            {ctaLabel}
            <Icons.ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>

        {/* Decorative area — visible on all screens */}
        {decorativeElement && (
          <div className="flex items-center justify-center p-4 md:p-6 md:w-2/5" style={{ boxShadow: 'inset 0 1px 0 rgba(184,146,78,0.06), inset 1px 0 0 rgba(184,146,78,0.06)' }}>
            {decorativeElement}
          </div>
        )}
      </div>

      {/* Metadata bar */}
      {metadata && metadata.length > 0 && (
        <div className="px-6 md:px-8 py-3 flex items-center gap-6" style={{ boxShadow: 'inset 0 1px 0 rgba(184,146,78,0.06)' }}>
          {metadata.map((item, i) => (
            <React.Fragment key={item.label}>
              {i > 0 && <span className="w-1 h-1 rounded-full bg-tea-bg/20" />}
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wider text-tea-paper/40 font-sans">
                  {item.label}
                </span>
                <span className="text-xs text-tea-paper/60 font-sans">
                  {item.value}
                </span>
              </div>
            </React.Fragment>
          ))}
        </div>
      )}
    </CardContainer>
  );
};
