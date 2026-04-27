import React from 'react';
import type { InventoryItem } from '../../types';
import type { ContributorCollection } from '../../data/contributorCollections';
import type { CommunityMember } from '../../data/communityMembers';
import { TeaPlaceholder } from './TeaPlaceholder';

interface ContributorPicksProps {
  collection: ContributorCollection;
  contributor: CommunityMember;
  items: InventoryItem[];
  onItemSelect?: (item: InventoryItem) => void;
}

/**
 * Displays a contributor's curated tea picks as a horizontal scroll section.
 * Designed to slot into the Shop page between the main grid and footer.
 */
export const ContributorPicks: React.FC<ContributorPicksProps> = ({
  collection,
  contributor,
  items,
  onItemSelect,
}) => {
  if (items.length === 0) return null;

  return (
    <div className="py-6">
      {/* Contributor header */}
      <div className="flex items-center gap-3 mb-4">
        <img
          src={contributor.photo}
          alt={contributor.name}
          className="w-10 h-10 rounded-full object-cover border border-tea-border"
        />
        <div>
          <h3 className="text-sm font-medium text-tea-text" style={{ fontFamily: 'var(--font-display)' }}>
            {collection.title}
          </h3>
          <p className="text-ui-10 text-tea-text-sec">
            Curated by {contributor.name}
            {collection.theme && <span className="ml-1.5 text-tea-text-dim">· {collection.theme}</span>}
          </p>
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-tea-text-sec italic mb-4 px-1" style={{ fontFamily: 'var(--font-body)' }}>
        {collection.description}
      </p>

      {/* Horizontal scroll of picks */}
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
        {items.map(item => (
          <button
            key={item.id}
            onClick={() => onItemSelect?.(item)}
            className="shrink-0 w-32 text-left group"
          >
            <div className="w-32 h-32 rounded-lg overflow-hidden bg-tea-surface border border-tea-border mb-2">
              {item.image ? (
                <img
                  src={item.image}
                  alt={item.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <TeaPlaceholder type={item.type} size={32} />
                </div>
              )}
            </div>
            <p className="text-xs text-tea-text truncate font-medium">{item.name}</p>
            <p className="text-ui-10 text-tea-text-sec truncate">{item.type}</p>
          </button>
        ))}
      </div>
    </div>
  );
};
