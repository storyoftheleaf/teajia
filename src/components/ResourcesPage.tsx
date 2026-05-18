import React, { useState, useMemo } from 'react';
import { Resource } from '../types';
import { Icons } from './Icons';
import { PageHeader } from './shared/PageHeader';
import { PageHeaderTabs } from './shared/PageHeaderTabs';
import { CardContainer } from './shared/CardContainer';

interface ResourcesPageProps {
  resources: Resource[];
}

type ResourceTab = 'playlists' | 'guides' | 'restaurants' | 'travel' | 'collections' | 'community';

export const ResourcesPage: React.FC<ResourcesPageProps> = ({ resources }) => {
  const [activeTab, setActiveTab] = useState<ResourceTab>('playlists');
  const [communitySearchLocation, setCommunitySearchLocation] = useState<string>('');

  // Mock community members
  const communityMembers = [
    {
      id: 'member-1',
      name: 'Mei Chen',
      location: 'Hangzhou, China',
      interests: ['Oolong', 'Gongfu Tea', 'Ceramics'],
      expertise: 'Advanced',
      avatar: 'https://picsum.photos/200/200?random=201'
    },
    {
      id: 'member-2',
      name: 'James Park',
      location: 'Seoul, South Korea',
      interests: ['Korean Green Tea', 'Meditation', 'Community'],
      expertise: 'Intermediate',
      avatar: 'https://picsum.photos/200/200?random=202'
    },
    {
      id: 'member-3',
      name: 'Sophia Lima',
      location: 'São Paulo, Brazil',
      interests: ['Tea Tastings', 'Mindfulness', 'Brewing'],
      expertise: 'Beginner',
      avatar: 'https://picsum.photos/200/200?random=203'
    },
    {
      id: 'member-4',
      name: 'Kenji Tanaka',
      location: 'Kyoto, Japan',
      interests: ['Matcha', 'Tea Ceremony', 'Pottery'],
      expertise: 'Advanced',
      avatar: 'https://picsum.photos/200/200?random=204'
    },
    {
      id: 'member-5',
      name: 'Sarah Williams',
      location: 'London, United Kingdom',
      interests: ['Black Tea', 'Tea Blending', 'Writing'],
      expertise: 'Intermediate',
      avatar: 'https://picsum.photos/200/200?random=205'
    },
    {
      id: 'member-6',
      name: 'Li Wei',
      location: 'Chaoshan, China',
      interests: ['Puerh Tea', 'Tea Trading', 'History'],
      expertise: 'Advanced',
      avatar: 'https://picsum.photos/200/200?random=206'
    },
  ];

  // Filter resources by type
  const playlists = resources.filter(r => r.type === 'playlist');
  const guides = resources.filter(r => r.type === 'guide');
  const restaurants = resources.filter(r => r.type === 'restaurant');
  const travel = resources.filter(r => r.type === 'travel');
  const collections = resources.filter(r => r.type === 'collection');

  // Filter community members by location search
  const filteredCommunity = useMemo(() => {
    if (!communitySearchLocation) return communityMembers;
    return communityMembers.filter(member =>
      member.location.toLowerCase().includes(communitySearchLocation.toLowerCase()) ||
      member.name.toLowerCase().includes(communitySearchLocation.toLowerCase()) ||
      member.interests.some(interest => interest.toLowerCase().includes(communitySearchLocation.toLowerCase()))
    );
  }, [communitySearchLocation]);

  const tabs = [
    { id: 'playlists' as ResourceTab, label: 'Playlists', count: playlists.length },
    { id: 'guides' as ResourceTab, label: 'Guides', count: guides.length },
    { id: 'restaurants' as ResourceTab, label: 'Tea Cities', count: restaurants.length },
    { id: 'travel' as ResourceTab, label: 'Travel', count: travel.length },
    { id: 'collections' as ResourceTab, label: 'Collections', count: collections.length },
    { id: 'community' as ResourceTab, label: 'Community', count: communityMembers.length },
  ];

  const getCurrentResources = () => {
    switch (activeTab) {
      case 'playlists': return playlists;
      case 'guides': return guides;
      case 'restaurants': return restaurants;
      case 'travel': return travel;
      case 'collections': return collections;
      case 'community': return filteredCommunity as any;
      default: return [];
    }
  };

  const renderResourceCard = (resource: Resource) => (
    <a
      key={resource.id}
      href={resource.content || '#'}
      target={resource.content ? '_blank' : undefined}
      rel={resource.content ? 'noopener noreferrer' : undefined}
      className="group relative bg-tea-bg rounded-xl overflow-hidden transition-all duration-300 flex flex-col h-full"
    >
      {/* Image */}
      {resource.image && (
        <div className="w-full h-40 md:h-48 overflow-hidden bg-tea-text/5">
          <img
            src={resource.image}
            alt={resource.title}
            className="w-full h-full object-cover transition-transform duration-300"
          />
        </div>
      )}

      {/* Content */}
      <div className="p-4 md:p-5 flex-1 flex flex-col">
        <h3 className="text-lg text-tea-text mb-2 line-clamp-2 group-hover:text-tea-gold transition-colors" style={{ fontFamily: 'var(--font-display)' }}>
          {resource.title}
        </h3>

        {resource.location && (
          <p className="text-sm text-tea-text/60 mb-2 flex items-center gap-1">
            <Icons.Info className="w-4 h-4" />
            {resource.location}
          </p>
        )}

        {resource.category && (
          <p className="text-xs uppercase tracking-[0.15em] text-tea-gold mb-2">
            {resource.category}
          </p>
        )}

        <p className="text-sm text-tea-text/70 line-clamp-3 flex-1">
          {resource.description}
        </p>

        {resource.content && (
          <div className="mt-3 pt-3 border-t border-tea-border flex items-center gap-2 text-tea-gold text-sm font-medium">
            <Icons.ExternalLink className="w-4 h-4" />
            View Resource
          </div>
        )}
      </div>
    </a>
  );

  const currentResources = getCurrentResources();

  return (
    <div className="w-full animate-[fadeIn_0.6s_ease-out]">
      <PageHeader title="Curated Resources">
        <PageHeaderTabs tabs={tabs} activeTab={activeTab} onChange={(id) => setActiveTab(id as ResourceTab)} />
      </PageHeader>

      {/* Community Directory - Search Bar */}
      {activeTab === 'community' && (
        <div className="mt-8 px-4 mb-8">
          <div className="max-w-md">
            <div className="relative">
              <input
                type="text"
                placeholder="Search by location, name, or interest..."
                value={communitySearchLocation}
                onChange={(e) => setCommunitySearchLocation(e.target.value)}
                className="w-full px-4 py-3 bg-tea-bg border border-tea-border rounded-xl text-tea-text placeholder-tea-text-sec focus:outline-none focus:ring-2 focus:ring-tea-gold"
              />
              <Icons.Search className="absolute right-3 top-3.5 w-5 h-5 text-tea-text/40" />
            </div>
          </div>
        </div>
      )}

      {/* Content Grid */}
      <div className="mt-8 mb-24 px-4">
        {currentResources.length > 0 ? (
          activeTab === 'community' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {(filteredCommunity as any).map((member: any) => (
                <CardContainer
                  key={member.id}
                  className="flex flex-col h-full cursor-pointer transition-all duration-300"
                >
                  <div className="p-6 flex flex-col h-full">
                    {/* Avatar */}
                    <div className="flex justify-center mb-4">
                      <img
                        src={member.avatar}
                        alt={member.name}
                        className="w-20 h-20 rounded-full object-cover border-2 border-tea-border"
                      />
                    </div>

                    {/* Name & Location */}
                    <h3 className="text-lg text-tea-text text-center mb-1" style={{ fontFamily: 'var(--font-display)' }}>
                      {member.name}
                    </h3>
                    <div className="flex items-center justify-center gap-1 text-xs text-tea-text/60 mb-3">
                      <Icons.Location className="w-3.5 h-3.5" />
                      {member.location}
                    </div>

                    {/* Expertise Badge */}
                    <div className="flex justify-center mb-4">
                      <span className={`text-ui-10 uppercase tracking-wider px-3 py-1 rounded-md ${
                        member.expertise === 'Advanced' ? 'bg-tea-gold/20 text-tea-gold border border-tea-border' :
                        member.expertise === 'Intermediate' ? 'bg-tea-elevated/20 text-tea-text-sec border border-tea-border/40' :
                        'bg-tea-green/20 text-tea-green border border-tea-green/40'
                      }`}>
                        {member.expertise}
                      </span>
                    </div>

                    {/* Interests */}
                    <div className="flex-1 mb-4">
                      <p className="text-ui-11 uppercase tracking-[0.15em] text-tea-text/50 mb-2">Interests</p>
                      <div className="flex flex-wrap gap-2">
                        {member.interests.map((interest: string) => (
                          <span
                            key={interest}
                            className="text-xs px-2 py-1 bg-tea-gold/5 border border-tea-border rounded text-tea-text/70"
                          >
                            {interest}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Action */}
                    <button className="w-full py-2 px-3 bg-tea-gold/20 border border-tea-gold text-tea-gold text-sm font-medium rounded hover:bg-tea-gold/30 transition-colors">
                      Connect
                    </button>
                  </div>
                </CardContainer>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {currentResources.map(renderResourceCard)}
            </div>
          )
        ) : (
          <div className="flex flex-col items-center justify-center py-32">
            <div className="w-16 h-16 bg-tea-text/5 rounded-full flex items-center justify-center mb-4">
              <Icons.Grid className="w-8 h-8 text-tea-text/40" />
            </div>
            <p className="text-lg text-tea-text/60" style={{ fontFamily: 'var(--font-display)' }}>
              {activeTab === 'community' ? 'No community members found' : 'No resources in this category yet'}
            </p>
            <p className="text-sm text-tea-text/40 mt-2">
              {activeTab === 'community' ? 'Try adjusting your search' : 'Check back soon for curated recommendations'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
