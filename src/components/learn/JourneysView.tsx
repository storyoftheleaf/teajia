import React, { useState } from 'react';
import { Icons } from '../Icons';
import { CardContainer } from '../shared/CardContainer';
import { CURATED_COLLECTIONS, DIFFICULTY_COLORS } from '../../data/curatedCollections';

const BACK_BTN = 'flex items-center gap-1.5 mb-8 group min-h-[44px] rounded-md hover:bg-tea-text/5 px-2 -ml-2';

interface JourneysViewProps {
  onBack: () => void;
}

export const JourneysView: React.FC<JourneysViewProps> = ({ onBack }) => {
  const [expandedJourneys, setExpandedJourneys] = useState<Record<string, boolean>>({
    [CURATED_COLLECTIONS[0]?.id || '']: true,
  });

  const toggleJourney = (id: string) => {
    setExpandedJourneys(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="w-full pb-32 animate-[fadeIn_0.3s_ease-out]">
      <button onClick={onBack} className={BACK_BTN}>
        <Icons.Back className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform text-tea-text-sec" />
        <span className="font-serif text-sm text-tea-text-sec">Craft</span>
      </button>

      <div className="mb-6">
        <h2 className="font-serif text-xl text-tea-text mb-1">Tea Journeys</h2>
        <p className="text-sm text-tea-text/50 font-serif italic">Guided tasting experiences to deepen your practice</p>
      </div>

      <div className="flex flex-col gap-4">
        {CURATED_COLLECTIONS.map((collection, index) => {
          const isExpanded = expandedJourneys[collection.id] || false;

          return (
            <div key={collection.id}>
              <button onClick={() => toggleJourney(collection.id)} className="text-left w-full">
                <CardContainer
                  className={`cursor-pointer overflow-hidden transition-all duration-500 ease-out ${isExpanded ? 'shadow-lg' : ''}`}
                >
                  <div className="p-5 flex items-start gap-5">
                    <div className="font-serif text-5xl text-tea-text/5 leading-none shrink-0 select-none">
                      0{index + 1}
                    </div>
                    <div className="flex-1 pt-1">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-serif text-xl text-tea-text leading-tight">
                          {collection.title}
                        </h3>
                        <div
                          className="text-tea-text/30 transition-transform duration-500 shrink-0 ml-2"
                          style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                        >
                          <Icons.ChevronDown className="w-5 h-5" />
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`text-ui-10 uppercase tracking-wider px-2 py-0.5 rounded-md ${DIFFICULTY_COLORS[collection.difficulty]}`}>
                          {collection.difficulty}
                        </span>
                        <span className="text-ui-11 text-tea-text/40">
                          {collection.estimatedDuration}
                        </span>
                        <span className="text-ui-11 text-tea-text/40">
                          {collection.guideSteps.length} steps
                        </span>
                      </div>
                      <p className="text-xs text-tea-text/50 leading-relaxed">
                        {collection.subtitle}
                      </p>
                    </div>
                  </div>
                </CardContainer>
              </button>

              <div className={`transition-all duration-700 ease-in-out overflow-hidden ${isExpanded ? 'max-h-[2000px] opacity-100 mt-3' : 'max-h-0 opacity-0 mt-0'}`}>
                <div className="pl-6 md:pl-20 pr-2 md:pr-4">
                  <p className="font-serif italic text-sm text-tea-text/60 /70 leading-relaxed mb-5 max-w-lg">
                    {collection.description}
                  </p>
                  <div className="space-y-0">
                    {collection.guideSteps.map((step, stepIndex) => (
                      <div key={step.order} className="relative pl-8 pb-5 last:pb-0">
                        {stepIndex < collection.guideSteps.length - 1 && (
                          <div className="absolute left-[11px] top-6 bottom-0 w-px bg-tea-gold/20" />
                        )}
                        <div className="absolute left-0 top-0 w-6 h-6 rounded-full bg-tea-gold/10 flex items-center justify-center">
                          <span className="text-ui-10 font-medium text-tea-gold">{step.order}</span>
                        </div>
                        <div>
                          <h4 className="font-serif text-base text-tea-text mb-1">
                            {step.teaName}
                          </h4>
                          <p className="text-sm text-tea-text/60 leading-relaxed">
                            {step.instruction}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  {collection.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-5 pt-4" style={{ boxShadow: 'inset 0 1px 0 var(--tea-accent-sub)' }}>
                      {collection.tags.map(tag => (
                        <span key={tag} className="text-ui-10 uppercase tracking-wider px-2 py-0.5 rounded-md bg-tea-text/5 text-tea-text/50">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
