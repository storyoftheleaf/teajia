import React from 'react';

interface CardMetadataProps {
  title: string;
  subtitle?: string;
  tags?: string[];
  type?: string;
  className?: string;
}

/**
 * Standardized metadata display for list mode items
 * Used by Teaware, Tea, and Education list views
 */
export const CardMetadata: React.FC<CardMetadataProps> = ({
  title,
  subtitle,
  tags = [],
  type,
  className = ''
}) => {
  return (
    <div className={`flex-1 min-w-0 ${className}`}>
      {type && (
        <div className="text-[10px] uppercase tracking-[0.2em] text-tea-text-dim mb-1">
          {type}
        </div>
      )}
      <h3 className="font-serif text-[17px] text-tea-text leading-[1.2] group-hover:text-tea-gold transition-colors mb-1">
        {title}
      </h3>
      {subtitle && (
        <p className="text-[10px] uppercase tracking-[0.2em] text-tea-text-dim mb-2">
          {subtitle}
        </p>
      )}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.map((tag, idx) => (
            <span
              key={idx}
              className="text-[9px] uppercase tracking-wider text-tea-text/40 px-1.5 py-0.5 bg-tea-text-dim/[0.04] rounded-lg"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
