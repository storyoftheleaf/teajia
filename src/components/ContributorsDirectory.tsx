import React from 'react';
import { Person } from '../types';
import { CardContainer } from './shared/CardContainer';

interface ContributorsDirectoryProps {
  contributors: Person[];
  onContributorClick: (contributor: Person) => void;
}

export const ContributorsDirectory: React.FC<ContributorsDirectoryProps> = ({
  contributors,
  onContributorClick,
}) => {
  return (
    <div className="w-full pb-16 animate-[fadeIn_0.5s_ease-out]">
      <div className="max-w-6xl mx-auto px-2 md:px-0">
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-serif text-tea-text mb-3">
            People of Teajia
          </h1>
          <p className="text-lg text-tea-text/60">
            Meet the contributors, collaborators, and voices that shape our editorial and offerings.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {contributors.map((contributor) => (
            <CardContainer
              key={contributor.id}
              variant="dark"
              className="cursor-pointer transition-all duration-300 hover:shadow-lg"
              onClick={() => onContributorClick(contributor)}
            >
              <div className="p-6 flex flex-col gap-4 h-full">
                {/* Avatar */}
                {contributor.avatarUrl && (
                  <div className="w-full aspect-square rounded-xl overflow-hidden bg-white/5">
                    <img
                      src={contributor.avatarUrl}
                      alt={contributor.name}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                )}

                {/* Name & Role */}
                <div>
                  <h2 className="text-xl font-serif text-tea-text mb-1">
                    {contributor.name}
                  </h2>
                  <p className="text-sm text-tea-gold font-medium">{contributor.role}</p>
                </div>

                {/* Bio */}
                <p className="text-sm text-white/70 flex-1 line-clamp-3">
                  {contributor.bio}
                </p>

                {/* CTA */}
                <div className="flex items-center gap-2 text-tea-gold text-sm font-medium pt-2 border-t border-white/10">
                  <span>View Profile</span>
                  <span>→</span>
                </div>
              </div>
            </CardContainer>
          ))}
        </div>
      </div>
    </div>
  );
};
