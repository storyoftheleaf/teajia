import React, { useState } from 'react';
import { Icons } from '../Icons';
import { CardContainer } from '../shared/CardContainer';
import { TEA_SPACES, SPACE_TYPE_LABELS } from '../../data/teaSpaces';

const BACK_BTN = 'flex items-center gap-1.5 mb-8 group min-h-[44px] rounded-md hover:bg-tea-text/5 px-2 -ml-2';

interface TeaSpacesViewProps {
  onBack: () => void;
  onNavigateToAdvise?: () => void;
}

export const TeaSpacesView: React.FC<TeaSpacesViewProps> = ({ onBack, onNavigateToAdvise }) => {
  const [expandedSpace, setExpandedSpace] = useState<string | null>(null);

  const toggleSpace = (id: string) => {
    setExpandedSpace(prev => prev === id ? null : id);
  };

  return (
    <div className="w-full pb-32 animate-[fadeIn_0.3s_ease-out]">
      <button onClick={onBack} className={BACK_BTN}>
        <Icons.Back className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform text-tea-text-sec" />
        <span className="font-serif text-sm text-tea-text-sec">Learn</span>
      </button>

      <div className="mb-6">
        <h2 className="font-serif text-xl text-tea-text mb-1">Tea Space Inspiration</h2>
        <p className="text-sm text-tea-text/50 font-serif italic">Ideas for creating your own ceremony environment</p>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        {TEA_SPACES.map(space => (
          <div key={space.id}>
            <button
              onClick={() => toggleSpace(space.id)}
              className="text-left w-full"
            >
              <CardContainer className={`transition-all h-full ${expandedSpace === space.id ? '' : ''}`}>
                <div className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-ui-9 uppercase tracking-wider px-1.5 py-0.5 rounded-sm bg-tea-gold/8 text-tea-gold border border-tea-border">
                      {SPACE_TYPE_LABELS[space.spaceType]}
                    </span>
                    <div
                      className="text-tea-text/30 transition-transform duration-300"
                      style={{ transform: expandedSpace === space.id ? 'rotate(180deg)' : 'rotate(0deg)' }}
                    >
                      <Icons.ChevronDown className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <h4 className="font-serif text-sm text-tea-text mb-1 leading-snug">
                    {space.title}
                  </h4>
                  <p className="text-ui-11 text-tea-text/50 line-clamp-2">
                    {space.description}
                  </p>
                </div>
              </CardContainer>
            </button>

            <div className={`transition-all duration-500 ease-in-out overflow-hidden ${expandedSpace === space.id ? 'max-h-[500px] opacity-100 mt-2' : 'max-h-0 opacity-0 mt-0'}`}>
              <div className="px-3 pb-2">
                <p className="text-xs text-tea-text/60 leading-relaxed mb-3">
                  {space.description}
                </p>
                <div className="space-y-2">
                  {space.tips.map((tip, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <div className="w-4 h-4 rounded-full bg-tea-gold/8 flex items-center justify-center shrink-0 mt-0.5">
                        <Icons.Check className="w-2.5 h-2.5 text-tea-gold" />
                      </div>
                      <p className="text-xs text-tea-text/60 leading-relaxed">
                        {tip}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {onNavigateToAdvise && (
        <button
          onClick={onNavigateToAdvise}
          className="flex items-center justify-between w-full py-3 px-4 rounded-lg bg-tea-gold/5/8 hover:bg-tea-gold/8 dark:hover:bg-tea-gold/12 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <Icons.Sparkles className="w-4 h-4 text-tea-gold" />
            <div className="text-left">
              <span className="text-sm font-medium text-tea-text">
                Want a Custom Tea Space?
              </span>
              <p className="text-ui-11 text-tea-text/50">
                Explore our design consultation services
              </p>
            </div>
          </div>
          <Icons.Next className="w-4 h-4 text-tea-gold group-hover:translate-x-0.5 transition-transform" />
        </button>
      )}
    </div>
  );
};
