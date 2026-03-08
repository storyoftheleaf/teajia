import React from 'react';
import { Icons } from '../Icons';

interface QuickActionMenuProps {
  x: number;
  y: number;
  isSaved?: boolean;
  onSave?: () => void;
  onShare?: () => void;
  onClose: () => void;
}

export const QuickActionMenu: React.FC<QuickActionMenuProps> = ({
  x,
  y,
  isSaved,
  onSave,
  onShare,
  onClose,
}) => {
  // Keep menu within viewport
  const adjustedX = Math.min(x, window.innerWidth - 160);
  const adjustedY = Math.min(y, window.innerHeight - 120);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[200]" onClick={onClose} />
      {/* Menu */}
      <div
        className="fixed z-[201] bg-tea-ink dark:bg-tea-elevated shadow-2xl rounded-lg overflow-hidden animate-[scaleIn_0.15s_ease-out] border border-white/10"
        style={{
          left: adjustedX,
          top: adjustedY,
          transformOrigin: 'top left',
          minWidth: 150,
        }}
      >
        {onSave && (
          <button
            onClick={() => { onSave(); onClose(); }}
            className="flex items-center gap-3 w-full px-4 py-3 text-tea-paper text-sm hover:bg-white/10 transition-colors"
          >
            <Icons.Heart filled={isSaved} className="w-4 h-4 text-tea-seal" />
            <span>{isSaved ? 'Unsave' : 'Save'}</span>
          </button>
        )}
        {onShare && (
          <button
            onClick={() => { onShare(); onClose(); }}
            className="flex items-center gap-3 w-full px-4 py-3 text-tea-paper text-sm hover:bg-white/10 transition-colors border-t border-white/5"
          >
            <Icons.Share className="w-4 h-4 text-tea-paper/60" />
            <span>Share</span>
          </button>
        )}
      </div>
    </>
  );
};
