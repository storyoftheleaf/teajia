import React from 'react';
import type { TeaMenuItem } from '../../types/events';

interface TeaMenuPreviewProps {
  teaMenu: TeaMenuItem[];
  eventDate: string;
  className?: string;
}

function isRevealed(item: TeaMenuItem, eventDate: string): boolean {
  const now = new Date();
  const event = new Date(eventDate);

  // Day-of: all revealed
  if (now.toDateString() === event.toDateString() || now > event) {
    return true;
  }

  // If item has a specific reveal date
  if (item.revealDate) {
    return now >= new Date(item.revealDate);
  }

  return false;
}

const TeaMenuPreview: React.FC<TeaMenuPreviewProps> = ({ teaMenu, eventDate, className = '' }) => {
  const sortedMenu = [...teaMenu].sort((a, b) => (a.brewOrder ?? 0) - (b.brewOrder ?? 0));

  return (
    <div className={`${className}`}>
      <h3 className="font-serif text-xl text-tea-text mb-2">Tea Menu</h3>
      <p className="text-xs text-tea-text-sec uppercase tracking-[0.2em] mb-6">
        {sortedMenu.length} {sortedMenu.length === 1 ? 'selection' : 'selections'} curated for this session
      </p>

      <div className="space-y-4">
        {sortedMenu.map((item, index) => {
          const revealed = isRevealed(item, eventDate);

          return (
            <div
              key={item.id}
              className={`relative p-4 bg-tea-surface border border-tea-border rounded-md transition-all duration-500 ${
                revealed ? 'opacity-100' : 'opacity-70'
              }`}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              {revealed ? (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-ui-10 uppercase tracking-[0.2em] text-tea-gold">
                          {item.productType || `Tea ${index + 1}`}
                        </span>
                      </div>
                      <h4 className="font-serif text-base text-tea-text">
                        {item.customName || item.productName}
                      </h4>
                    </div>
                    <span className="text-tea-gold/30 font-serif text-2xl leading-none shrink-0">
                      {index + 1}
                    </span>
                  </div>
                  {item.customDescription && (
                    <p className="text-sm text-tea-text-sec leading-relaxed mt-3 border-t border-tea-border pt-3">
                      {item.customDescription}
                    </p>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="text-tea-gold/30 font-serif text-2xl leading-none shrink-0">
                    {index + 1}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="h-2 w-16 bg-tea-text-sec/10 rounded-sm" />
                    </div>
                    <p className="font-serif text-sm text-tea-text-sec italic">
                      A special tea awaits...
                    </p>
                    <div className="h-2 w-32 bg-tea-text-sec/5 rounded-sm mt-2" />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TeaMenuPreview;
