import React from 'react';
import { useScrollDirection } from '../../hooks/useScrollDirection';

interface StickyInquiryBarProps {
  onOpenInquiry: () => void;
  label?: string;
}

export const StickyInquiryBar: React.FC<StickyInquiryBarProps> = ({
  onOpenInquiry,
  label = 'Start a Conversation',
}) => {
  const { isAtTop } = useScrollDirection();

  // Only show after scrolling past the hero
  if (isAtTop) return null;

  return (
    <div className="fixed bottom-16 md:bottom-0 left-0 right-0 z-40 bg-tea-paper/95 dark:bg-[#242424]/95 backdrop-blur-xl border-t border-tea-ink/10 dark:border-white/10 px-6 py-3">
      <button
        onClick={onOpenInquiry}
        className="w-full bg-tea-seal hover:bg-tea-seal/90 text-white text-xs uppercase tracking-[0.2em] font-medium py-3 rounded-sm transition-colors duration-200"
      >
        {label}
      </button>
    </div>
  );
};
