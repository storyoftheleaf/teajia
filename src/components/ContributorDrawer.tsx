import React, { useEffect } from 'react';
import { Person, Story } from '../types';
import { Icons } from './Icons';

interface ContributorDrawerProps {
  person: Person;
  stories: Story[];
  onClose: () => void;
  onStoryClick: (story: Story) => void;
}

export const ContributorDrawer: React.FC<ContributorDrawerProps> = ({
  person,
  stories,
  onClose,
  onStoryClick,
}) => {
  // Articles by this author
  const authorStories = stories.filter(
    s =>
      s.author?.name === person.name &&
      s.status === 'published'
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-modal flex items-end sm:items-center justify-center animate-[fadeIn_0.2s_ease-out]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-tea-bg/90 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-md bg-tea-surface border border-tea-border shadow-2xl flex flex-col max-h-[85vh] overflow-hidden rounded-t-2xl sm:rounded-2xl animate-[slideUp_0.3s_ease-out]">
        {/* Header */}
        <div className="flex items-start gap-4 p-6 border-b border-tea-border">
          <div className="w-14 h-14 rounded-full overflow-hidden border border-tea-border shrink-0 bg-tea-elevated flex items-center justify-center">
            {person.avatarUrl ? (
              <img
                src={person.avatarUrl}
                alt={person.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <Icons.Seal className="w-7 h-7 text-tea-text-dim" />
            )}
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <h2
              className="text-xl text-tea-text mb-0.5"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {person.name}
            </h2>
            {person.role && (
              <p className="text-[10px] uppercase tracking-[0.2em] text-tea-gold mb-2">
                {person.role}
              </p>
            )}
            {person.bio && (
              <p className="text-sm text-tea-text-sec leading-relaxed line-clamp-3">
                {person.bio}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-tea-text-sec hover:text-tea-text transition-colors shrink-0"
            aria-label="Close"
          >
            <Icons.Close className="w-5 h-5" />
          </button>
        </div>

        {/* Articles by author */}
        {authorStories.length > 0 && (
          <div className="flex-1 overflow-y-auto overscroll-contain">
            <p className="text-[9px] uppercase tracking-[0.25em] text-tea-text-dim px-6 pt-5 pb-3">
              Articles by {person.name}
            </p>
            <ul className="divide-y divide-tea-border/50">
              {authorStories.map(story => (
                <li key={story.id}>
                  <button
                    type="button"
                    onClick={() => { onClose(); onStoryClick(story); }}
                    className="w-full text-left px-6 py-3.5 hover:bg-tea-elevated/40 transition-colors group flex items-center gap-3"
                  >
                    {story.thumbnailUrl && (
                      <img
                        src={story.thumbnailUrl}
                        alt=""
                        className="w-12 h-12 object-cover rounded shrink-0 opacity-80"
                      />
                    )}
                    <span
                      className="text-[15px] text-tea-text group-hover:text-tea-gold transition-colors leading-snug line-clamp-2"
                      style={{ fontFamily: 'var(--font-display)' }}
                    >
                      {story.title}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {authorStories.length === 0 && (
          <p className="px-6 py-8 text-sm text-tea-text-dim italic text-center">
            No published articles yet.
          </p>
        )}
      </div>
    </div>
  );
};

export default ContributorDrawer;
