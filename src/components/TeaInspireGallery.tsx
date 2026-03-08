import React, { useState, useMemo } from 'react';
import { TEA_INSPIRE_IMAGES, TeaInspireImage, TeaMomentCategory } from '../data/teaInspire';
import { COMMUNITY_MEMBERS } from '../data/communityMembers';
import { Icons } from './Icons';
import { ContributorProfile } from './ContributorProfile';
import { Person } from '../types';

// Category configuration
const CATEGORY_CONFIG: Record<TeaMomentCategory, { label: string; icon: React.ReactNode }> = {
  morning: { label: 'Morning', icon: <Icons.Coffee className="w-4 h-4" /> },
  travel: { label: 'Travel', icon: <Icons.MapPin className="w-4 h-4" /> },
  seasonal: { label: 'Seasonal', icon: <Icons.Leaf className="w-4 h-4" /> },
  setup: { label: 'Setup', icon: <Icons.Grid className="w-4 h-4" /> },
  ritual: { label: 'Ritual', icon: <Icons.Star className="w-4 h-4" /> },
};

type FilterCategory = 'all' | TeaMomentCategory;

export const TeaInspireGallery: React.FC = () => {
  const [selectedMember, setSelectedMember] = useState<Person | null>(null);
  const [selectedImage, setSelectedImage] = useState<TeaInspireImage | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('all');

  // Create a map of community members by ID for easy lookup - memoized to prevent recreation
  const memberMap = useMemo(() =>
    new Map(COMMUNITY_MEMBERS.map(m => [m.id, m])),
    []
  );

  // Get featured moment (first featured image or most recent)
  const featuredMoment = useMemo(() => {
    return TEA_INSPIRE_IMAGES.find(img => img.featured) || TEA_INSPIRE_IMAGES[0];
  }, []);

  // Filter images based on active filter (exclude featured from grid)
  const filteredImages = useMemo(() => {
    let images = TEA_INSPIRE_IMAGES.filter(img => img.id !== featuredMoment?.id);
    if (activeFilter !== 'all') {
      images = images.filter(img => img.category === activeFilter);
    }
    return images;
  }, [activeFilter, featuredMoment]);

  const handleImageClick = (image: TeaInspireImage) => {
    setSelectedImage(image);
  };

  const handleMemberClick = (e: React.MouseEvent, communityMemberId: string) => {
    e.stopPropagation();
    const member = memberMap.get(communityMemberId);
    if (member) {
      setSelectedMember({
        id: member.id,
        name: member.name,
        role: 'Community Member',
        bio: member.bio,
        avatarUrl: member.photo,
      });
    }
  };

  const navigateImage = (direction: 'prev' | 'next') => {
    if (!selectedImage) return;
    const allImages = TEA_INSPIRE_IMAGES;
    const currentIndex = allImages.findIndex(img => img.id === selectedImage.id);
    const newIndex = direction === 'next'
      ? (currentIndex + 1) % allImages.length
      : (currentIndex - 1 + allImages.length) % allImages.length;
    setSelectedImage(allImages[newIndex]);
  };

  const filterButtons: { id: FilterCategory; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'morning', label: 'Morning' },
    { id: 'travel', label: 'Travel' },
    { id: 'seasonal', label: 'Seasonal' },
    { id: 'setup', label: 'Setup' },
    { id: 'ritual', label: 'Ritual' },
  ];

  return (
    <div className="w-full animate-[fadeIn_0.6s_ease-out]">
      {/* Header */}
      <div className="mb-8 md:mb-10">
        <h2 className="font-serif text-3xl md:text-4xl text-tea-text mb-3">
          Tea Moments
        </h2>
        <p className="text-tea-text/70 text-base md:text-lg leading-relaxed max-w-2xl">
          Beautiful tea moments from around the world. Discover setups, rituals, and daily practices that inspire mindful tea drinking.
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="mb-8 overflow-x-auto no-scrollbar">
        <div className="flex gap-2 pb-2">
          {filterButtons.map((filter) => (
            <button
              key={filter.id}
              onClick={() => setActiveFilter(filter.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-300
                ${activeFilter === filter.id
                  ? 'bg-tea-gold text-white'
                  : 'bg-tea-text/5 text-tea-text/70 hover:bg-tea-text/10'
                }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Featured Moment */}
      {featuredMoment && activeFilter === 'all' && (
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <Icons.Star className="w-4 h-4 text-tea-gold" />
            <span className="text-xs uppercase tracking-[0.15em] text-tea-gold font-medium">Moment of the Week</span>
          </div>
          <button
            onClick={() => handleImageClick(featuredMoment)}
            className="group relative w-full aspect-[21/9] md:aspect-[3/1] rounded-[1px] overflow-hidden bg-tea-text/5 cursor-pointer"
          >
            <img
              src={featuredMoment.imageUrl}
              alt={featuredMoment.caption}
              className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

            {/* Featured Content Overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
              <div className="flex items-center gap-3 mb-3">
                {featuredMoment.designedByTeajia && (
                  <span className="px-2 py-1 bg-tea-gold text-white text-[10px] uppercase tracking-[0.15em] rounded">
                    Designed by Teajia
                  </span>
                )}
                <span className="px-2 py-1 bg-tea-gold/15 text-white text-[10px] uppercase tracking-[0.15em] rounded backdrop-blur-sm">
                  {CATEGORY_CONFIG[featuredMoment.category].label}
                </span>
              </div>
              <p className="text-white text-lg md:text-2xl font-serif leading-relaxed max-w-2xl">
                {featuredMoment.caption}
              </p>
              {featuredMoment.location && (
                <div className="flex items-center gap-2 mt-3 text-white/70 text-sm">
                  <Icons.MapPin className="w-4 h-4" />
                  <span>{featuredMoment.location}</span>
                </div>
              )}
            </div>
          </button>
        </div>
      )}

      {/* Gallery Grid - Larger cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-12">
        {filteredImages.length > 0 ? (
          filteredImages.map((image) => {
            const member = memberMap.get(image.communityMemberId);
            return (
              <button
                key={image.id}
                onClick={() => handleImageClick(image)}
                className="group relative w-full aspect-[4/3] rounded-[1px] overflow-hidden bg-tea-text/5 hover:shadow-xl transition-all duration-300 cursor-pointer text-left"
              >
                {/* Image */}
                <img
                  src={image.imageUrl}
                  alt={image.caption}
                  className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                />

                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity duration-300" />

                {/* Category Badge */}
                <div className="absolute top-3 left-3 flex gap-2">
                  <span className="px-2 py-1 bg-tea-gold/15 text-white text-[10px] uppercase tracking-[0.15em] rounded backdrop-blur-sm flex items-center gap-1.5">
                    {CATEGORY_CONFIG[image.category].icon}
                    {CATEGORY_CONFIG[image.category].label}
                  </span>
                  {image.designedByTeajia && (
                    <span className="px-2 py-1 bg-tea-gold text-white text-[10px] uppercase tracking-[0.15em] rounded">
                      Teajia Design
                    </span>
                  )}
                </div>

                {/* Content Overlay */}
                <div className="absolute bottom-0 inset-x-0 p-4 md:p-5">
                  <p className="text-white text-sm md:text-base font-medium leading-snug line-clamp-2 mb-3">
                    {image.caption}
                  </p>

                  {/* Contributor */}
                  {member && (
                    <div
                      onClick={(e) => handleMemberClick(e, image.communityMemberId)}
                      className="flex items-center gap-2 group/member hover:gap-3 transition-all"
                    >
                      <div className="w-6 h-6 rounded-full overflow-hidden bg-tea-gold/15 ring-1 ring-white/30 flex-shrink-0">
                        <img
                          src={member.photo}
                          alt={member.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <span className="text-white/80 text-xs group-hover/member:text-white transition-colors">{member.name}</span>
                    </div>
                  )}
                </div>
              </button>
            );
          })
        ) : (
          <div className="col-span-full flex flex-col items-center justify-center py-16">
            <Icons.Image className="w-12 h-12 text-tea-text/20 mb-4" />
            <p className="text-tea-text/50 text-sm">
              No moments found in this category.
            </p>
          </div>
        )}
      </div>

      {/* Community CTA */}
      {TEA_INSPIRE_IMAGES.length > 0 && (
        <div className="mt-16 md:mt-20 pt-12 md:pt-16 border-t border-tea-border text-center">
          <h3 className="font-serif text-3xl md:text-4xl text-tea-text mb-4">
            Share Your Tea Moment
          </h3>
          <p className="text-tea-text/70 mb-8 max-w-xl mx-auto text-base md:text-lg leading-relaxed">
            We celebrate the beautiful, everyday moments of tea practice. Share your space, your setup, your ritual with our community.
          </p>
          <button className="px-8 py-3 border-2 border-tea-gold text-tea-gold hover:bg-tea-gold hover:text-white rounded-lg font-medium transition-all duration-300 text-sm uppercase tracking-wider">
            Submit Your Photo
          </button>
        </div>
      )}

      {/* Image Detail Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center animate-[fadeIn_0.2s_ease-out]"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative w-full h-full flex flex-col md:flex-row" onClick={(e) => e.stopPropagation()}>
            {/* Image Section */}
            <div className="flex-1 relative flex items-center justify-center p-4 md:p-8">
              <img
                src={selectedImage.imageUrl}
                alt={selectedImage.caption}
                className="max-w-full max-h-[60vh] md:max-h-[85vh] object-contain rounded-lg"
              />

              {/* Navigation Arrows */}
              <button
                onClick={() => navigateImage('prev')}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 md:w-12 md:h-12 rounded-full bg-tea-gold/10 hover:bg-tea-gold/15 backdrop-blur-sm flex items-center justify-center transition-colors"
                aria-label="Previous image"
              >
                <Icons.ChevronLeft className="w-5 h-5 md:w-6 md:h-6 text-white" />
              </button>
              <button
                onClick={() => navigateImage('next')}
                className="absolute right-4 md:right-auto md:left-auto top-1/2 -translate-y-1/2 w-10 h-10 md:w-12 md:h-12 rounded-full bg-tea-gold/10 hover:bg-tea-gold/15 backdrop-blur-sm flex items-center justify-center transition-colors md:hidden"
                aria-label="Next image"
              >
                <Icons.ChevronRight className="w-5 h-5 md:w-6 md:h-6 text-white" />
              </button>
            </div>

            {/* Details Panel */}
            <div className="w-full md:w-96 bg-tea-elevated/50 backdrop-blur-md p-6 md:p-8 overflow-y-auto md:h-full">
              {/* Close Button */}
              <button
                onClick={() => setSelectedImage(null)}
                className="absolute top-4 right-4 w-10 h-10 rounded-full bg-tea-gold/10 hover:bg-tea-gold/15 backdrop-blur-sm flex items-center justify-center transition-colors"
                aria-label="Close"
              >
                <Icons.Close className="w-5 h-5 text-white" />
              </button>

              {/* Category & Badges */}
              <div className="flex flex-wrap gap-2 mb-6">
                <span className="px-3 py-1.5 bg-tea-gold/10 text-white text-xs uppercase tracking-[0.15em] rounded-full flex items-center gap-2">
                  {CATEGORY_CONFIG[selectedImage.category].icon}
                  {CATEGORY_CONFIG[selectedImage.category].label}
                </span>
                {selectedImage.season && (
                  <span className="px-3 py-1.5 bg-tea-gold/10 text-white/80 text-xs uppercase tracking-[0.15em] rounded-full">
                    {selectedImage.season}
                  </span>
                )}
                {selectedImage.designedByTeajia && (
                  <span className="px-3 py-1.5 bg-tea-gold text-white text-xs uppercase tracking-[0.15em] rounded-full">
                    Designed by Teajia
                  </span>
                )}
              </div>

              {/* Caption */}
              <p className="text-white text-xl font-serif leading-relaxed mb-6">
                {selectedImage.caption}
              </p>

              {/* Location */}
              {selectedImage.location && (
                <div className="flex items-center gap-2 text-white/70 text-sm mb-6">
                  <Icons.MapPin className="w-4 h-4" />
                  <span>{selectedImage.location}</span>
                </div>
              )}

              {/* Contributor */}
              {memberMap.get(selectedImage.communityMemberId) && (
                <div className="mb-8">
                  <h4 className="text-white/50 text-xs uppercase tracking-[0.15em] mb-3">Shared by</h4>
                  <button
                    onClick={(e) => handleMemberClick(e, selectedImage.communityMemberId)}
                    className="flex items-center gap-3 group"
                  >
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-tea-gold/15 ring-1 ring-white/30">
                      <img
                        src={memberMap.get(selectedImage.communityMemberId)?.photo}
                        alt={memberMap.get(selectedImage.communityMemberId)?.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="text-left">
                      <p className="text-white font-medium group-hover:text-tea-gold transition-colors">
                        {memberMap.get(selectedImage.communityMemberId)?.name}
                      </p>
                      <p className="text-white/50 text-sm">View Profile</p>
                    </div>
                  </button>
                </div>
              )}

              {/* What's in this setup? */}
              {(selectedImage.teaFeatured || selectedImage.teawareIdentified?.length) && (
                <div className="mb-8">
                  <h4 className="text-white/50 text-xs uppercase tracking-[0.15em] mb-3">What's in this moment?</h4>
                  <div className="space-y-2">
                    {selectedImage.teaFeatured && (
                      <div className="flex items-center gap-2 text-white/80">
                        <Icons.Leaf className="w-4 h-4 text-tea-gold" />
                        <span>{selectedImage.teaFeatured}</span>
                      </div>
                    )}
                    {selectedImage.teawareIdentified?.map((item, i) => (
                      <div key={i} className="flex items-center gap-2 text-white/80">
                        <Icons.Coffee className="w-4 h-4 text-white/40" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Insights */}
              {selectedImage.insights && selectedImage.insights.length > 0 && (
                <div className="mb-8">
                  <h4 className="text-white/50 text-xs uppercase tracking-[0.15em] mb-3">Insights</h4>
                  <div className="space-y-4">
                    {selectedImage.insights.map((insight, i) => (
                      <div key={i} className="border-l-2 border-tea-gold/50 pl-4">
                        <p className="text-white font-medium text-sm mb-1">{insight.title}</p>
                        <p className="text-white/60 text-sm leading-relaxed">{insight.explanation}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tags */}
              {selectedImage.tags && selectedImage.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedImage.tags.map((tag, i) => (
                    <span key={i} className="px-2 py-1 bg-tea-gold/5 text-white/50 text-xs rounded">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Navigation for Desktop */}
              <div className="hidden md:flex justify-between mt-8 pt-6 border-t border-tea-gold/10">
                <button
                  onClick={() => navigateImage('prev')}
                  className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
                >
                  <Icons.ChevronLeft className="w-4 h-4" />
                  <span className="text-sm">Previous</span>
                </button>
                <button
                  onClick={() => navigateImage('next')}
                  className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
                >
                  <span className="text-sm">Next</span>
                  <Icons.ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Community Member Profile Modal */}
      {selectedMember && (
        <ContributorProfile person={selectedMember} onClose={() => setSelectedMember(null)} />
      )}
    </div>
  );
};
