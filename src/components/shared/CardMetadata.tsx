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
        <div className="text-ui-10 uppercase tracking-display text-tea-text-sec mb-1">
          {type}
        </div>
      )}
      <h3 className="font-serif text-ui-17 text-tea-text leading-snug group-hover:text-tea-gold transition-colors mb-1">
        {title}
      </h3>
      {subtitle && (
        <p className="text-ui-10 uppercase tracking-display text-tea-text-sec mb-2">
          {subtitle}
        </p>
      )}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.map((tag, idx) => (
            <span
              key={idx}
              className="text-ui-9 uppercase tracking-wider text-tea-text/40 px-1.5 py-0.5 bg-tea-text-sec/[0.04] rounded-lg"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
