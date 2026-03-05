import React, { useState } from 'react';
import { Icons } from './Icons';
import { GalleryImage } from './GalleryImage';
import { GALLERY_DATA } from '../data/galleryData';

type GallerySection = 'tea-spaces' | 'tea-vessels' | 'inspiration' | 'our-work';

interface GallerySectionTab {
  id: GallerySection;
  label: string;
  description: string;
}

const GALLERY_SECTIONS: GallerySectionTab[] = [
  { id: 'tea-spaces', label: 'Tea Spaces', description: 'Beautiful tea room and space setups' },
  { id: 'tea-vessels', label: 'Tea & Vessels', description: 'Gorgeous brewing moments and vessels' },
  { id: 'inspiration', label: 'What Inspires Me', description: 'Personal travels and discoveries' },
  { id: 'our-work', label: 'What We Do', description: 'Projects we\'ve created' },
];

export const TeaInspirationGallery: React.FC = () => {
  const [activeSection, setActiveSection] = useState<GallerySection>('tea-spaces');

  // Filter gallery data by active section
  const sectionImages = GALLERY_DATA.filter(img => img.section === activeSection);

  return (
    <div className="w-full">
      {/* Section Tabs */}
      <div className="flex flex-wrap gap-2 mb-10 md:mb-14">
        {GALLERY_SECTIONS.map((section) => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id)}
            className={`px-4 md:px-6 py-2 md:py-3 rounded-sm transition-all duration-300 text-sm md:text-base font-medium uppercase tracking-wider ${
              activeSection === section.id
                ? 'bg-tea-seal text-white shadow-lg'
                : 'bg-white/50 dark:bg-white/5 text-tea-ink dark:text-tea-paper border border-tea-ink/10 dark:border-white/10 hover:bg-white/70 dark:hover:bg-white/10'
            }`}
          >
            {section.label}
          </button>
        ))}
      </div>

      {/* Section Description */}
      <div className="mb-10">
        <p className="text-tea-ink/70 dark:text-tea-paper/70 max-w-2xl">
          {GALLERY_SECTIONS.find(s => s.id === activeSection)?.description}
        </p>
      </div>

      {/* Gallery Grid - Pinterest-style Masonry */}
      <div className="columns-2 md:columns-3 lg:columns-4 gap-4 md:gap-6 space-y-4 md:space-y-6">
        {sectionImages.length > 0 ? (
          sectionImages.map((image) => (
            <div key={image.id} className="break-inside-avoid">
              <GalleryImage image={image} />
            </div>
          ))
        ) : (
          <div className="col-span-full flex flex-col items-center justify-center py-16">
            <Icons.Image className="w-12 h-12 text-tea-paper/30 mb-4" />
            <p className="text-tea-ink/50 dark:text-tea-paper/50 text-sm">
              Gallery coming soon. Check back for inspiration.
            </p>
          </div>
        )}
      </div>

      {/* Submit Your Space CTA */}
      {sectionImages.length > 0 && (
        <div className="mt-14 md:mt-20 flex flex-col items-center text-center bg-white/50 dark:bg-white/5 p-8 md:p-12 rounded-sm">
          <h3 className="font-serif text-2xl md:text-3xl text-tea-ink dark:text-tea-paper mb-3">
            Have a Tea Space to Share?
          </h3>
          <p className="text-tea-ink/70 dark:text-tea-paper/70 mb-6 max-w-md">
            We celebrate community creativity. Share your space and inspire others.
          </p>
          <button className="px-6 md:px-8 py-2 md:py-3 border border-tea-seal text-tea-seal hover:bg-tea-seal hover:text-white uppercase tracking-wider text-xs font-medium rounded-sm transition-colors duration-300">
            Submit Your Space
          </button>
        </div>
      )}
    </div>
  );
};
