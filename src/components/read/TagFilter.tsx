import React, { useState } from 'react';
import { TAG_SECTIONS, Tag, TagSection } from '../../data/tags';

interface TagFilterProps {
  selectedTags: Tag[];
  onTagToggle: (tag: Tag) => void;
  onClear: () => void;
}

export const TagFilter: React.FC<TagFilterProps> = ({
  selectedTags,
  onTagToggle,
  onClear,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const hasSelection = selectedTags.length > 0;

  return (
    <div className="relative">
      {/* Filter Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-1.5 text-xs uppercase tracking-[0.15em] font-sans border transition-colors duration-300 ${
          hasSelection
            ? 'border-tea-gold text-tea-gold'
            : 'border-tea-border text-tea-text-sec'
        } hover:border-tea-gold hover:text-tea-gold`}
      >
        <svg
          className="w-3.5 h-3.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
          />
        </svg>
        Filter
        {hasSelection && (
          <span className="bg-tea-gold text-tea-text text-[10px] w-4 h-4 flex items-center justify-center rounded-full">
            {selectedTags.length}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Panel */}
          <div className="absolute top-full right-0 mt-2 z-50 w-80 max-h-[70vh] overflow-y-auto bg-tea-surface border border-tea-text/10  shadow-lg animate-[fadeIn_0.15s_ease-out]">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-tea-text/10 ">
              <span className="text-xs uppercase tracking-[0.15em] font-sans text-tea-text/60">
                Filter by Tag
              </span>
              {hasSelection && (
                <button
                  onClick={onClear}
                  className="text-[10px] uppercase tracking-wider font-sans text-tea-gold hover:text-tea-gold/80 transition-colors"
                >
                  Clear all
                </button>
              )}
            </div>

            {/* Tag Sections */}
            <div className="p-4 space-y-4">
              {(Object.entries(TAG_SECTIONS) as [TagSection, typeof TAG_SECTIONS[TagSection]][]).map(
                ([sectionKey, section]) => (
                  <div key={sectionKey}>
                    <h4 className="text-[10px] uppercase tracking-[0.2em] font-sans text-tea-text/40 mb-2">
                      {section.label}
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {section.tags.map(tag => {
                        const isSelected = selectedTags.includes(tag);
                        return (
                          <button
                            key={tag}
                            onClick={() => onTagToggle(tag)}
                            className={`px-2.5 py-1 text-[11px] font-sans transition-all duration-150 ${
                              isSelected
                                ? 'bg-tea-gold text-tea-text'
                                : 'bg-tea-text/5/5 text-tea-text/70 hover:bg-tea-text/10 dark:hover:bg-tea-bg/10'
                            }`}
                          >
                            {tag}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-tea-text/10 ">
              <button
                onClick={() => setIsOpen(false)}
                className="w-full py-2 text-xs uppercase tracking-[0.15em] font-sans text-tea-text hover:text-tea-gold dark:hover:text-tea-gold transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
