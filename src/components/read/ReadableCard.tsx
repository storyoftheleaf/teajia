import React from 'react';
import { Story } from '../../types';
import { Card } from '../Card';

interface ReadableCardProps {
  article: Story;
  isRead: boolean;
  isSaved?: boolean;
  onClick: (story: Story) => void;
  onToggleSave?: (id: string) => void;
  onShare?: (story: Story) => void;
}

/**
 * Wraps the existing Card component with read/unread visual indicators.
 * - Unread: full opacity, small filled dot indicator
 * - Read: slightly reduced opacity, small checkmark indicator
 */
export const ReadableCard: React.FC<ReadableCardProps> = ({
  article,
  isRead,
  isSaved,
  onClick,
  onToggleSave,
  onShare,
}) => {
  return (
    <div className="relative">
      {/* Read/Unread indicator dot */}
      <div className="absolute top-3 right-3 z-30">
        {isRead ? (
          <div className="w-5 h-5 rounded-full bg-tea-green/80 flex items-center justify-center" title="Read">
            <svg className="w-3 h-3 text-tea-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        ) : (
          <div
            className="w-2.5 h-2.5 rounded-full bg-tea-gold shadow-sm"
            title="Unread"
          />
        )}
      </div>

      {/* Card wrapper with opacity adjustment for read articles */}
      <div className={`transition-opacity duration-300 ${isRead ? 'opacity-[0.87]' : 'opacity-100'}`}>
        <Card
          story={article}
          onClick={onClick}
          isSaved={isSaved}
          isWatched={isRead}
          onToggleSave={onToggleSave}
          onShare={onShare}
        />
      </div>
    </div>
  );
};
