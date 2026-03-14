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
  );
};
