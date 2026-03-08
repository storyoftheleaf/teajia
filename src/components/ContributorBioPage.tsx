import React from 'react';
import { Person } from '../types';
import { Icons } from './Icons';

interface ContributorBioPageProps {
  contributor: Person;
  onClose: () => void;
  authoredArticles?: any[];
  offerings?: any[];
}

export const ContributorBioPage: React.FC<ContributorBioPageProps> = ({
  contributor,
  onClose,
  authoredArticles = [],
  offerings = [],
}) => {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-[fadeIn_0.3s_ease-out] overflow-y-auto">
      <div className="bg-tea-surface  rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto my-8 animate-[slideUp_0.4s_ease-out]">
        {/* Header with Close Button */}
        <div className="sticky top-0 bg-tea-surface  border-b border-tea-border p-6 flex items-start justify-between">
          <h2 className="text-2xl font-serif text-tea-text pr-4">{contributor.name}</h2>
          <button
            onClick={onClose}
            className="flex-shrink-0 p-2 hover:bg-tea-text/10 rounded-lg transition-colors"
            aria-label="Close profile"
          >
            <Icons.Close className="w-5 h-5 text-tea-text/60" />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-8">
          {/* Avatar & Role */}
          <div className="flex gap-8 md:flex-row flex-col">
            {contributor.avatarUrl && (
              <div className="w-48 h-48 md:w-40 md:h-40 rounded-xl overflow-hidden bg-white/5 flex-shrink-0">
                <img
                  src={contributor.avatarUrl}
                  alt={contributor.name}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div className="flex-1">
              <p className="text-lg text-tea-gold font-medium mb-4">{contributor.role}</p>
              <p className="text-base text-white/80 leading-relaxed mb-6">
                {contributor.bio}
              </p>

              {/* External Links (if available) */}
              {/* This can be extended with social links from the PEOPLE_DIRECTORY data */}
              <div className="flex items-center gap-4">
                <span className="text-sm text-tea-text/60">Share</span>
                <button className="p-2 hover:bg-tea-text/10 rounded-lg transition-colors" title="Share on X">
                  <Icons.Share2 className="w-4 h-4 text-tea-text/60" />
                </button>
              </div>
            </div>
          </div>

          {/* Authored Articles */}
          {authoredArticles.length > 0 && (
            <div>
              <h3 className="text-lg font-serif text-tea-text mb-4 flex items-center gap-2">
                <Icons.Book className="w-5 h-5 text-tea-gold" />
                Authored Pieces ({authoredArticles.length})
              </h3>
              <div className="space-y-3">
                {authoredArticles.map((article: any) => (
                  <div
                    key={article.id}
                    className="p-4 border border-tea-border rounded-xl hover:bg-white/50 cursor-pointer transition-colors"
                  >
                    <h4 className="font-serif text-tea-text mb-1">{article.title}</h4>
                    <p className="text-xs text-tea-text/60">
                      {article.durationOrTime} • {article.subtitle}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Offerings */}
          {offerings.length > 0 && (
            <div>
              <h3 className="text-lg font-serif text-tea-text mb-4 flex items-center gap-2">
                <Icons.Sparkles className="w-5 h-5 text-tea-gold" />
                Offerings ({offerings.length})
              </h3>
              <div className="space-y-3">
                {offerings.map((offering: any) => (
                  <div
                    key={offering.id}
                    className="p-4 border border-tea-gold/20 bg-tea-gold/10 rounded-lg hover:bg-tea-gold/20 cursor-pointer transition-colors"
                  >
                    <h4 className="font-serif text-tea-text mb-1">{offering.title}</h4>
                    <p className="text-sm text-white/70 mb-2">{offering.description}</p>
                    {offering.category && (
                      <span className="text-[8px] uppercase tracking-wider px-2 py-1 rounded-sm bg-tea-gold/30 text-tea-gold border border-tea-gold/50">
                        {offering.category}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty State Message */}
          {authoredArticles.length === 0 && offerings.length === 0 && (
            <div className="py-8 text-center text-tea-text/60">
              <p className="text-sm">Profile information and work samples coming soon.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
