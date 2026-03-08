import React, { useState, useMemo } from 'react';
import { Icons } from '../Icons';
import { CardContainer } from '../shared/CardContainer';
import { COMMUNITY_WISDOM, WISDOM_TYPE_LABELS, type WisdomType, type CommunityWisdomEntry } from '../../data/communityWisdom';

const BACK_BTN = 'flex items-center gap-1.5 mb-8 group min-h-[44px] rounded-md hover:bg-tea-text/5 px-2 -ml-2';

const WISDOM_TYPE_COLORS: Record<string, string> = {
  reflection: 'bg-blue-500/10 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-400/30',
  tip: 'bg-green-500/10 dark:bg-green-500/20 text-green-700 dark:text-green-300 border border-green-400/30',
  ritual: 'bg-purple-500/10 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-400/30',
  photo: 'bg-orange-500/10 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300 border border-orange-400/30',
};

interface CommunityWisdomViewProps {
  onBack: () => void;
}

const getWisdomCardStyle = (entry: CommunityWisdomEntry) => {
  switch (entry.type) {
    case 'tip': return 'border-l-2 border-l-green-400/40';
    case 'ritual': return 'bg-purple-500/[0.02] dark:bg-purple-500/[0.04]';
    case 'photo': return 'border-l-2 border-l-orange-400/40';
    default: return '';
  }
};

export const CommunityWisdomView: React.FC<CommunityWisdomViewProps> = ({ onBack }) => {
  const [wisdomFilter, setWisdomFilter] = useState<WisdomType | 'all'>('all');
  const [expandedWisdom, setExpandedWisdom] = useState<Record<string, boolean>>({});
  const [showAllWisdom, setShowAllWisdom] = useState(false);

  const filteredWisdom = useMemo(() => {
    if (wisdomFilter === 'all') return COMMUNITY_WISDOM;
    return COMMUNITY_WISDOM.filter(e => e.type === wisdomFilter);
  }, [wisdomFilter]);

  const visibleWisdom = showAllWisdom ? filteredWisdom : filteredWisdom.slice(0, 3);
  const hiddenWisdomCount = filteredWisdom.length - 3;

  const toggleWisdomCard = (id: string) => {
    setExpandedWisdom(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="w-full pb-32 animate-[fadeIn_0.3s_ease-out]">
      <button onClick={onBack} className={BACK_BTN}>
        <Icons.Back className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform text-tea-text/70" />
        <span className="font-serif text-sm text-tea-text/70">Learn</span>
      </button>

      <div className="mb-6">
        <h2 className="font-serif text-xl text-tea-text mb-1">Community Wisdom</h2>
        <p className="text-sm text-tea-text/50 font-serif italic">Reflections, tips, and rituals from tea lovers</p>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-5">
        {(['all', 'reflection', 'tip', 'ritual'] as const).map(filter => (
          <button
            key={filter}
            onClick={() => { setWisdomFilter(filter); setShowAllWisdom(false); }}
            className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-all ${
              wisdomFilter === filter
                ? 'bg-tea-gold text-white'
                : 'bg-tea-text/5 text-tea-text/60 hover:bg-tea-text/10'
            }`}
          >
            {filter === 'all' ? 'All' : WISDOM_TYPE_LABELS[filter]}
          </button>
        ))}
      </div>

      {/* Stacked cards */}
      <div className="flex flex-col gap-3">
        {visibleWisdom.map(entry => {
          const isExpanded = expandedWisdom[entry.id] || false;
          return (
            <button
              key={entry.id}
              onClick={() => toggleWisdomCard(entry.id)}
              className={`text-left w-full transition-all duration-300 rounded-lg ${getWisdomCardStyle(entry)}`}
            >
              <CardContainer variant="dark" className="transition-all h-full">
                <div className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-sm ${WISDOM_TYPE_COLORS[entry.type] || ''}`}>
                        {WISDOM_TYPE_LABELS[entry.type]}
                      </span>
                      {entry.teaReferenced && (
                        <span className="text-[10px] text-tea-text/40 italic">
                          {entry.teaReferenced}
                        </span>
                      )}
                    </div>
                    <div
                      className="text-tea-text/30 transition-transform duration-300 shrink-0"
                      style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                    >
                      <Icons.ChevronDown className="w-4 h-4" />
                    </div>
                  </div>
                  <h4 className={`font-serif text-lg text-tea-text mb-2 leading-snug ${entry.type === 'reflection' ? 'italic' : ''}`}>
                    {entry.title}
                  </h4>
                  <p className={`text-sm text-tea-text/70 leading-relaxed whitespace-pre-line transition-all duration-300 ${isExpanded ? '' : 'line-clamp-3'}`}>
                    {entry.body}
                  </p>
                  <div className={`transition-all duration-500 ease-in-out overflow-hidden ${isExpanded ? 'max-h-[500px] opacity-100 mt-4' : 'max-h-0 opacity-0 mt-0'}`}>
                    {entry.teaReferenced && (
                      <div className="flex items-center gap-2 py-2.5 px-3 rounded-lg bg-tea-gold/5 mb-3">
                        <Icons.Leaf className="w-3.5 h-3.5 text-tea-gold" />
                        <span className="text-xs text-tea-text/70">
                          Tea: <span className="font-medium text-tea-text">{entry.teaReferenced}</span>
                        </span>
                      </div>
                    )}
                    {entry.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {entry.tags.map(tag => (
                          <span key={tag} className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-sm bg-tea-text/5 text-tea-text/50">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-tea-border">
                    <div className="w-5 h-5 rounded-full bg-tea-gold/20 flex items-center justify-center">
                      <Icons.User className="w-3 h-3 text-tea-gold" />
                    </div>
                    <span className="text-[11px] text-tea-text/50">
                      {entry.authorName}
                    </span>
                  </div>
                </div>
              </CardContainer>
            </button>
          );
        })}
      </div>

      {!showAllWisdom && hiddenWisdomCount > 0 && (
        <button
          onClick={() => setShowAllWisdom(true)}
          className="w-full mt-4 py-3 text-center text-sm text-tea-gold hover:text-tea-text transition-colors"
        >
          Show {hiddenWisdomCount} more
        </button>
      )}
      {showAllWisdom && filteredWisdom.length > 3 && (
        <button
          onClick={() => setShowAllWisdom(false)}
          className="w-full mt-4 py-3 text-center text-sm text-tea-text/40 hover:text-tea-text transition-colors"
        >
          Show less
        </button>
      )}
    </div>
  );
};
