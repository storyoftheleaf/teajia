import React from 'react';
import { ReadArticle, CrossLink } from '../../types/read';

interface EndOfArticleProps {
  article: ReadArticle;
  relatedArticles: CrossLink[];
  onNavigateToArticle: (id: string) => void;
}

/**
 * End-of-article section shown after reader content.
 * Displays guest/author info, related articles, and optional CTA.
 */
export const EndOfArticle: React.FC<EndOfArticleProps> = ({
  article,
  relatedArticles,
  onNavigateToArticle,
}) => {
  const author = article.author;
  const interviewee = article.interviewee;
  const guest = interviewee || author;
  const cta = article.endOfArticleCTA;

  return (
    <div className="w-full max-w-lg mx-auto px-6 py-12 space-y-10">
      {/* Divider */}
      <div className="flex justify-center">
        <div className="w-12 h-px bg-tea-text/20/20" />
      </div>

      {/* Guest / Author Bio */}
      {guest && (
        <div className="flex flex-col items-center text-center space-y-3">
          {guest.avatarUrl && (
            <img
              src={guest.avatarUrl}
              alt={guest.name}
              className="w-16 h-16 rounded-full object-cover grayscale-[0.2]"
            />
          )}
          <div>
            <p className="font-serif text-lg text-tea-text">
              {guest.name}
            </p>
            <p className="text-xs text-tea-text/50 uppercase tracking-[0.15em] font-sans mt-1">
              {guest.role}
            </p>
          </div>
          <p className="text-sm text-tea-text/70 font-sans leading-relaxed max-w-sm">
            {guest.bio}
          </p>
        </div>
      )}

      {/* Continue Reading */}
      {relatedArticles.length > 0 && (
        <div className="space-y-4">
          <div className="flex justify-center">
            <div className="w-8 h-px bg-tea-text/10/10" />
          </div>
          <p className="text-xs uppercase tracking-[0.2em] font-sans text-tea-text/40 text-center">
            Continue Reading
          </p>
          <div className="space-y-2">
            {relatedArticles.map(link => (
              <button
                key={link.id}
                onClick={() => onNavigateToArticle(link.id)}
                className="w-full text-left group flex items-center gap-3 py-2 px-3 hover:bg-tea-text/5 dark:hover:bg-tea-bg/5 transition-colors"
              >
                <span className="text-tea-gold text-sm font-sans">&rarr;</span>
                <span className="font-serif text-sm text-tea-text group-hover:text-tea-gold transition-colors">
                  {link.title}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Subtle CTA */}
      {cta && (
        <div className="text-center pt-4">
          <div className="flex justify-center mb-4">
            <div className="w-8 h-px bg-tea-text/10/10" />
          </div>
          <p className="text-xs font-sans text-tea-text/50 italic">
            {cta.text}
          </p>
        </div>
      )}
    </div>
  );
};
