import React, { useState, useMemo } from 'react';
import { GLOSSARY_TERMS, GLOSSARY_CATEGORIES, GlossaryTerm, GlossaryCategory } from '../data/glossary';
import { Icons } from './Icons';

interface TeaGlossaryProps {
  initialTermCount?: number;
  onExpandClick?: () => void;
  isFullView?: boolean;
}

export const TeaGlossary: React.FC<TeaGlossaryProps> = ({
  initialTermCount,
  onExpandClick,
  isFullView = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<GlossaryCategory | 'all'>('all');
  const [expandedTermId, setExpandedTermId] = useState<string | null>(null);
  const [activeLetter, setActiveLetter] = useState<string | null>(null);

  const alphabet = useMemo(() => {
    const letters = new Set(GLOSSARY_TERMS.map(t => t.term[0].toUpperCase()));
    return Array.from(letters).sort();
  }, []);

  const filteredTerms = useMemo(() => {
    let terms = GLOSSARY_TERMS;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      terms = terms.filter(t =>
        t.term.toLowerCase().includes(query) ||
        t.definition.toLowerCase().includes(query) ||
        t.chineseCharacters?.includes(query)
      );
    }

    if (activeCategory !== 'all') {
      terms = terms.filter(t => t.category === activeCategory);
    }

    if (activeLetter) {
      terms = terms.filter(t => t.term[0].toUpperCase() === activeLetter);
    }

    terms = [...terms].sort((a, b) => a.term.localeCompare(b.term));

    if (initialTermCount && !searchQuery && activeCategory === 'all' && !activeLetter) {
      terms = terms.slice(0, initialTermCount);
    }

    return terms;
  }, [searchQuery, activeCategory, activeLetter, initialTermCount]);

  const groupedTerms = useMemo(() => {
    const groups: Record<string, GlossaryTerm[]> = {};
    filteredTerms.forEach(term => {
      const letter = term.term[0].toUpperCase();
      if (!groups[letter]) groups[letter] = [];
      groups[letter].push(term);
    });
    return groups;
  }, [filteredTerms]);

  const handleTermClick = (termId: string) => {
    setExpandedTermId(expandedTermId === termId ? null : termId);
  };

  const getRelatedTerm = (id: string): GlossaryTerm | undefined => {
    return GLOSSARY_TERMS.find(t => t.id === id);
  };

  const categoryButtons: { id: GlossaryCategory | 'all'; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'tea-type', label: 'Tea Types' },
    { id: 'processing', label: 'Processing' },
    { id: 'tasting', label: 'Tasting' },
    { id: 'ceremony', label: 'Ceremony' },
    { id: 'equipment', label: 'Equipment' },
    { id: 'origin', label: 'Origin' },
  ];

  return (
    <div className="w-full">
      {/* Header */}
      {isFullView && (
        <div className="mb-10">
          <h2 className="font-serif text-3xl md:text-4xl text-tea-text mb-3">
            Tea Glossary
          </h2>
          <p className="text-tea-text-sec text-sm md:text-base leading-relaxed max-w-xl">
            Essential terminology for understanding tea culture, processing, and appreciation.
          </p>
        </div>
      )}

      {/* Search Bar — dark, blends with theme */}
      <div className="relative mb-6">
        <Icons.Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-tea-text-sec" />
        <input
          type="text"
          placeholder="search"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setActiveLetter(null);
          }}
          className="w-full pl-11 pr-4 py-3 bg-tea-surface rounded-[1px] text-tea-text text-sm placeholder-tea-text-sec focus:outline-none focus:ring-1 focus:ring-tea-gold/20 transition-colors"
          style={{ boxShadow: 'inset 0 1px 3px rgba(24,19,14,0.2), inset 0 1px 0 var(--tea-accent-sub)' }}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-tea-text-sec hover:text-tea-text"
          >
            <Icons.Close className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Category Filters — refined pills */}
      <div className="relative z-0 mb-5 overflow-x-auto hide-scrollbar">
        <div className="flex gap-1.5 pb-1">
          {categoryButtons.map((cat) => (
            <button
              key={cat.id}
              onClick={() => {
                setActiveCategory(cat.id);
                setActiveLetter(null);
              }}
              className={`pill whitespace-nowrap ${activeCategory === cat.id ? 'pill-active' : ''}`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Alphabetical Index */}
      {isFullView && (
        <div className="relative z-0 mb-8 overflow-x-auto hide-scrollbar">
          <div className="flex gap-0.5 pb-1">
            <button
              onClick={() => setActiveLetter(null)}
              className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-sans transition-all
                ${!activeLetter
                  ? 'bg-tea-gold/10 text-tea-text ring-1 ring-inset ring-tea-gold/40'
                  : 'text-tea-text-sec hover:text-tea-text-sec'
                }`}
            >
              All
            </button>
            {alphabet.map((letter) => (
              <button
                key={letter}
                onClick={() => setActiveLetter(activeLetter === letter ? null : letter)}
                className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-mono transition-all
                  ${activeLetter === letter
                    ? 'bg-tea-gold/10 text-tea-text ring-1 ring-inset ring-tea-gold/40'
                    : 'text-tea-text-sec hover:text-tea-text-sec'
                  }`}
              >
                {letter}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Terms Display */}
      <div className="relative z-[1] space-y-8">
        {Object.keys(groupedTerms).length > 0 ? (
          Object.entries(groupedTerms).map(([letter, terms]) => (
            <div key={letter}>
              {/* Letter Header */}
              {isFullView && (
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-2xl font-serif text-tea-gold/70">{letter}</span>
                  <div className="flex-1 h-px bg-gradient-to-r from-tea-gold/15 to-transparent" />
                </div>
              )}

              {/* Terms Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {terms.map((term) => (
                  <button
                    key={term.id}
                    onClick={() => handleTermClick(term.id)}
                    className={`text-left rounded-[2px] transition-all duration-300
                      ${expandedTermId === term.id
                        ? 'bg-tea-gold/[0.06]'
                        : 'bg-tea-text/[0.03] hover:bg-tea-text/[0.06]'
                      }`}
                    style={{ boxShadow: expandedTermId === term.id
                        ? 'inset 0 1px 0 var(--tea-border), 0 1px 3px rgba(24,19,14,0.2)'
                        : 'inset 0 1px 0 var(--tea-accent-sub), 0 1px 2px rgba(24,19,14,0.15)'
                    }}
                  >
                    <div className="p-4">
                      {/* Term Header */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <h3 className="text-base font-serif text-tea-text leading-tight">
                              {term.term}
                            </h3>
                            {term.chineseCharacters && (
                              <span className="text-tea-gold/50 text-ui-13 font-serif">
                                {term.chineseCharacters}
                              </span>
                            )}
                          </div>
                          {term.pronunciation && (
                            <p className="text-tea-text-sec text-xs font-mono italic mt-0.5">
                              /{term.pronunciation}/
                            </p>
                          )}
                        </div>
                        <span className="text-ui-9 uppercase tracking-[0.15em] text-tea-text-sec font-sans flex-shrink-0 mt-1">
                          {GLOSSARY_CATEGORIES[term.category].label}
                        </span>
                      </div>

                      {/* Definition */}
                      <p className={`text-tea-text-sec text-ui-13 leading-relaxed
                        ${expandedTermId === term.id ? '' : 'line-clamp-2'}`}
                      >
                        {term.definition}
                      </p>

                      {/* Expanded Content */}
                      {expandedTermId === term.id && (
                        <div className="mt-4 pt-4 space-y-4 animate-[fadeIn_0.3s_ease-out]" style={{ boxShadow: 'inset 0 1px 0 var(--tea-border)' }}>
                          {/* Audio */}
                          {term.audioUrl && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const audio = new Audio(term.audioUrl);
                                audio.play();
                              }}
                              className="flex items-center gap-1.5 text-tea-gold text-xs hover:text-tea-gold/80 transition-colors"
                            >
                              <Icons.Audio className="w-3.5 h-3.5" />
                              <span>Listen to pronunciation</span>
                            </button>
                          )}

                          {/* Extended Description */}
                          {term.deepDive?.extendedDescription && (
                            <p className="text-tea-text-sec text-ui-13 leading-relaxed">
                              {term.deepDive.extendedDescription}
                            </p>
                          )}

                          {/* Cultural Context */}
                          {term.deepDive?.culturalContext && (
                            <div className="pl-3" style={{ boxShadow: 'inset 2px 0 0 var(--tea-border)' }}>
                              <p className="text-tea-text-sec text-ui-13 leading-relaxed italic font-serif">
                                {term.deepDive.culturalContext}
                              </p>
                            </div>
                          )}

                          {/* Example Usage */}
                          {term.exampleUsage && (
                            <p className="text-tea-text/60 text-ui-13 italic">
                              "{term.exampleUsage}"
                            </p>
                          )}

                          {/* Related Terms */}
                          {term.relatedTerms && term.relatedTerms.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {term.relatedTerms.map((relatedId) => {
                                const related = getRelatedTerm(relatedId);
                                return related ? (
                                  <span
                                    key={relatedId}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setExpandedTermId(relatedId);
                                      setSearchQuery('');
                                      setActiveCategory('all');
                                      setActiveLetter(null);
                                    }}
                                    className="px-2 py-1 text-tea-gold/80 text-ui-11 font-sans bg-tea-gold/[0.06] rounded-lg cursor-pointer hover:bg-tea-gold/[0.12] transition-colors"
                                  >
                                    {related.term}
                                    {related.chineseCharacters && (
                                      <span className="ml-1 text-tea-gold/40">{related.chineseCharacters}</span>
                                    )}
                                  </span>
                                ) : null;
                              })}
                            </div>
                          )}

                          {/* Related lessons link */}
                          {term.relatedLessonIds && term.relatedLessonIds.length > 0 && (
                            <div className="flex items-center gap-1.5 text-tea-gold text-xs">
                              <Icons.BookOpen className="w-3.5 h-3.5" />
                              <span>{term.relatedLessonIds.length} related {term.relatedLessonIds.length === 1 ? 'lesson' : 'lessons'}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Icons.Search className="w-8 h-8 text-tea-text-dim mb-3" />
            <p className="text-tea-text-sec text-sm">
              No terms found matching your search.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setActiveCategory('all');
                setActiveLetter(null);
              }}
              className="mt-3 text-tea-gold text-xs hover:underline"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* Expand Button (embedded view) */}
      {initialTermCount && !searchQuery && activeCategory === 'all' && !activeLetter && onExpandClick && (
        <div className="mt-10 text-center">
          <button
            onClick={onExpandClick}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-tea-text/[0.04] text-tea-text-sec rounded-lg hover:bg-tea-gold/10 hover:text-tea-gold transition-colors text-xs uppercase tracking-[0.12em] font-sans"
          >
            View Full Glossary
            <Icons.ChevronRight className="w-3.5 h-3.5" />
          </button>
          <p className="mt-2 text-tea-text-sec text-ui-10 font-mono">
            {GLOSSARY_TERMS.length} terms
          </p>
        </div>
      )}
    </div>
  );
};
