import React from 'react';
import { Icons } from './Icons';

interface Insight {
  type: 'design' | 'curation' | 'layout' | 'material' | 'philosophy' | 'story' | 'work';
  title: string;
  explanation: string;
  relatedLink?: { label: string; href: string };
}

interface InsightOverlayProps {
  insight: Insight;
  onClose: () => void;
}

const INSIGHT_COLORS: Record<Insight['type'], string> = {
  design: 'bg-tea-gold',
  curation: 'bg-tea-gold',
  layout: 'bg-tea-gold',
  material: 'bg-tea-gold',
  philosophy: 'bg-tea-gold',
  story: 'bg-tea-gold',
  work: 'bg-tea-gold',
};

export const InsightOverlay: React.FC<InsightOverlayProps> = ({ insight, onClose }) => {
  return (
    <div
      className="fixed inset-0 z-[150] bg-black/90 backdrop-blur-sm flex items-center justify-center p-6 animate-[fadeIn_0.3s_ease-out]"
      onClick={onClose}
    >
      <div
        className="bg-white max-w-md w-full p-8 rounded-lg relative shadow-2xl animate-[scaleIn_0.3s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-tea-text/40 hover:text-tea-gold transition-colors duration-300"
        >
          <Icons.Close className="w-5 h-5" />
        </button>

        {/* Category Badge */}
        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${INSIGHT_COLORS[insight.type]} text-white text-xs font-medium uppercase tracking-widest mb-6`}>
          <span>{insight.type}</span>
        </div>

        {/* Title */}
        <h3 className="font-serif text-2xl text-tea-text mb-4">
          {insight.title}
        </h3>

        {/* Explanation */}
        <p className="text-tea-text/80 mb-6 leading-relaxed">
          {insight.explanation}
        </p>

        {/* Related Link */}
        {insight.relatedLink && (
          <a
            href={insight.relatedLink.href}
            className="inline-flex items-center gap-2 text-tea-gold hover:text-tea-gold/80 transition-colors duration-300 font-medium uppercase tracking-widest text-xs"
          >
            {insight.relatedLink.label}
            <Icons.ChevronRight className="w-4 h-4" />
          </a>
        )}

        {/* Footer */}
        <button
          onClick={onClose}
          className="w-full mt-8 px-6 py-3 bg-tea-gold/8 hover:bg-tea-gold/15 text-tea-gold uppercase tracking-wider text-xs font-medium rounded-sm transition-colors duration-300"
        >
          Close
        </button>
      </div>
    </div>
  );
};
