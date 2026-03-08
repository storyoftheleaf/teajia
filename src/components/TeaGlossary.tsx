import React, { useState, useMemo } from 'react';
import { GLOSSARY_TERMS, GLOSSARY_CATEGORIES, GlossaryTerm, GlossaryCategory } from '../data/glossary';
import { Icons } from './Icons';

interface TeaGlossaryProps {
  initialTermCount?: number; // Number of terms to show initially (undefined = show all)
  onExpandClick?: () => void; // Callback when "View Full Glossary" is clicked
  isFullView?: boolean; // Whether this is the full glossary view
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

  // Get all unique first letters from terms
  const alphabet = useMemo(() => {
    const letters = new Set(GLOSSARY_TERMS.map(t => t.term[0].toUpperCase()));
    return Array.from(letters).sort();
  }, []);

  // Filter terms based on search, category, and letter
  const filteredTerms = useMemo(() => {
    let terms = GLOSSARY_TERMS;

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      terms = terms.filter(t =>
        t.term.toLowerCase().includes(query) ||
        t.definition.toLowerCase().includes(query) ||
        t.chineseCharacters?.includes(query)
      );
    }

    // Filter by category
    if (activeCategory !== 'all') {
      terms = terms.filter(t => t.category === activeCategory);
    }

    // Filter by letter
    if (activeLetter) {
      terms = terms.filter(t => t.term[0].toUpperCase() === activeLetter);
    }

    // Sort alphabetically
    terms = [...terms].sort((a, b) => a.term.localeCompare(b.term));

    // Limit if initialTermCount is set
    if (initialTermCount && !searchQuery && activeCategory === 'all' && !activeLetter) {
      terms = terms.slice(0, initialTermCount);
    }

    return terms;
  }, [searchQuery, activeCategory, activeLetter, initialTermCount]);

  // Group terms by first letter for display
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
        <div className="mb-8">
          <h2 className="font-serif text-3xl md:text-4xl text-tea-text mb-3">
            Tea Glossary
          </h2>
          <p className="text-tea-text/70 text-base md:text-lg leading-relaxed max-w-2xl">
            Essential terminology for understanding tea culture, processing, and appreciation.
          </p>
        </div>
      )}

      {/* Search Bar */}
      <div className="relative mb-6">
        <Icons.Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-tea-text/40" />
        <input
          type="text"
          placeholder="Search terms..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setActiveLetter(null); // Clear letter filter when searching
          }}
          className="w-full pl-12 pr-4 py-3 bg-tea-text/5 border border-tea-border rounded-lg text-tea-text placeholder-tea-text-dim placeholder-tea-text-dim focus:outline-none focus:ring-2 focus:ring-tea-gold/50"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-tea-text/40 hover:text-tea-text"
          >
            <Icons.Close className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Category Filters */}
      <div className="mb-6 overflow-x-auto no-scrollbar">
        <div className="flex gap-2 pb-2">
          {categoryButtons.map((cat) => (
            <button
              key={cat.id}
              onClick={() => {
                setActiveCategory(cat.id);
                setActiveLetter(null);
              }}
              className={`px-4 py-2.5 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-300
                ${activeCategory === cat.id
                  ? 'bg-tea-gold text-white'
                  : 'bg-tea-text/5 text-tea-text/70 hover:bg-tea-text/10'
                }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Alphabetical Index */}
      {isFullView && (
        <div className="mb-8 overflow-x-auto no-scrollbar">
          <div className="flex gap-1 pb-2">
            <button
              onClick={() => setActiveLetter(null)}
              className={`w-9 h-9 flex items-center justify-center rounded text-sm font-medium transition-all
                ${!activeLetter
                  ? 'bg-tea-elevated text-tea-text'
                  : 'text-tea-text/60 hover:bg-tea-text/10'
                }`}
            >
              All
            </button>
            {alphabet.map((letter) => (
              <button
                key={letter}
                onClick={() => setActiveLetter(activeLetter === letter ? null : letter)}
                className={`w-9 h-9 flex items-center justify-center rounded text-sm font-medium transition-all
                  ${activeLetter === letter
                    ? 'bg-tea-elevated text-tea-text'
                    : 'text-tea-text/60 hover:bg-tea-text/10'
                  }`}
              >
                {letter}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Terms Display */}
      <div className="space-y-6">
        {Object.keys(groupedTerms).length > 0 ? (
          Object.entries(groupedTerms).map(([letter, terms]) => (
            <div key={letter}>
              {/* Letter Header */}
              {isFullView && (
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-3xl font-serif text-tea-gold">{letter}</span>
                  <div className="flex-1 h-px bg-tea-text/10" />
                </div>
              )}

              {/* Terms Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {terms.map((term) => (
                  <button
                    key={term.id}
                    onClick={() => handleTermClick(term.id)}
                    className={`text-left p-4 rounded-lg border transition-all duration-300
                      ${expandedTermId === term.id
                        ? 'bg-tea-gold/8 border-tea-gold/25'
                        : 'bg-tea-text/5 border-tea-border hover:bg-tea-text/10'
                      }`}
                  >
                    {/* Term Header */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <h3 className="text-lg font-serif text-tea-text">
                            {term.term}
                          </h3>
                          {term.chineseCharacters && (
                            <span className="text-tea-text/50 text-sm">
                              {term.chineseCharacters}
                            </span>
                          )}
                        </div>
                        {term.pronunciation && (
                          <p className="text-tea-text/50 text-sm italic">
                            /{term.pronunciation}/
                          </p>
                        )}
                      </div>
                      <span className="px-2 py-0.5 bg-tea-text/10 text-tea-text/60 text-[10px] uppercase tracking-wider rounded flex-shrink-0">
                        {GLOSSARY_CATEGORIES[term.category].label}
                      </span>
                    </div>

                    {/* Definition */}
                    <p className={`text-tea-text/70 text-sm leading-relaxed
                      ${expandedTermId === term.id ? '' : 'line-clamp-2'}`}
                    >
                      {term.definition}
                    </p>

                    {/* Expanded Content */}
                    {expandedTermId === term.id && (
                      <div className="mt-4 pt-4 border-t border-tea-border space-y-3 animate-[fadeIn_0.3s_ease-out]">
                        {/* Audio Pronunciation */}
                        {term.audioUrl && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const audio = new Audio(term.audioUrl);
                                audio.play();
                              }}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-tea-gold/8 text-tea-gold rounded-full text-xs font-medium hover:bg-tea-gold/15 dark:hover:bg-tea-gold/25 transition-colors"
                            >
                              <Icons.Audio className="w-3.5 h-3.5" />
                              <span>Listen</span>
                            </button>
                          </div>
                        )}

                        {/* Deep Dive Extended Description */}
                        {term.deepDive?.extendedDescription && (
                          <div>
                            <p className="text-tea-text/50 text-xs uppercase tracking-wider mb-1">
                              Deep Dive
                            </p>
                            <p className="text-tea-text/70 text-sm leading-relaxed">
                              {term.deepDive.extendedDescription}
                            </p>
                          </div>
                        )}

                        {/* Cultural Context */}
                        {term.deepDive?.culturalContext && (
                          <div>
                            <p className="text-tea-text/50 text-xs uppercase tracking-wider mb-1">
                              Cultural Context
                            </p>
                            <p className="text-tea-text/70 text-sm leading-relaxed">
                              {term.deepDive.culturalContext}
                            </p>
                          </div>
                        )}

                        {/* Try This Suggestions */}
                        {term.deepDive?.tryThis && term.deepDive.tryThis.length > 0 && (
                          <div>
                            <p className="text-tea-text/50 text-xs uppercase tracking-wider mb-2">
                              Try This
                            </p>
                            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
                              {term.deepDive.tryThis.map(suggestion => (
                                <div
                                  key={suggestion.id}
                                  className="min-w-[200px] max-w-[240px] shrink-0 p-3 rounded-lg bg-tea-text/5 border border-tea-border"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <div className="flex items-center gap-2 mb-1.5">
                                    <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm ${
                                      suggestion.difficulty === 'easy' ? 'bg-green-500/10 text-green-700 dark:text-green-300 border border-green-400/30' :
                                      suggestion.difficulty === 'moderate' ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-400/30' :
                                      'bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-400/30'
                                    }`}>
                                      {suggestion.difficulty}
                                    </span>
                                    {suggestion.timeRequired && (
                                      <span className="text-[10px] text-tea-text/40">
                                        {suggestion.timeRequired}
                                      </span>
                                    )}
                                  </div>
                                  <h5 className="font-serif text-sm text-tea-text mb-1">
                                    {suggestion.title}
                                  </h5>
                                  <p className="text-[11px] text-tea-text/60 leading-relaxed">
                                    {suggestion.description}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Example Usage */}
                        {term.exampleUsage && (
                          <div>
                            <p className="text-tea-text/50 text-xs uppercase tracking-wider mb-1">
                              Example
                            </p>
                            <p className="text-tea-text/80 text-sm italic">
                              "{term.exampleUsage}"
                            </p>
                          </div>
                        )}

                        {/* Related Terms */}
                        {term.relatedTerms && term.relatedTerms.length > 0 && (
                          <div>
                            <p className="text-tea-text/50 text-xs uppercase tracking-wider mb-2">
                              Related Terms
                            </p>
                            <div className="flex flex-wrap gap-2.5">
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
                                    className="px-2.5 py-1.5 bg-tea-gold/15 text-tea-gold text-xs rounded cursor-pointer hover:bg-tea-gold/25 transition-colors"
                                  >
                                    {related.term}
                                  </span>
                                ) : null;
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Icons.Search className="w-10 h-10 text-tea-text/20 mb-4" />
            <p className="text-tea-text/50 text-sm">
              No terms found matching your search.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setActiveCategory('all');
                setActiveLetter(null);
              }}
              className="mt-3 text-tea-gold text-sm hover:underline"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* Expand Button (for embedded view) */}
      {initialTermCount && !searchQuery && activeCategory === 'all' && !activeLetter && onExpandClick && (
        <div className="mt-8 text-center">
          <button
            onClick={onExpandClick}
            className="inline-flex items-center gap-2 px-6 py-3 bg-tea-text/5 text-tea-text rounded-lg hover:bg-tea-text/10 transition-colors text-sm font-medium"
          >
            View Full Glossary
            <Icons.ChevronRight className="w-4 h-4" />
          </button>
          <p className="mt-2 text-tea-text/50 text-xs">
            {GLOSSARY_TERMS.length} terms total
          </p>
        </div>
      )}
    </div>
  );
};
