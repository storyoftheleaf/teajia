import React, { useState } from 'react';
import { Icons } from './Icons';
import { InsightOverlay } from './InsightOverlay';

interface Insight {
  type: 'design' | 'curation' | 'layout' | 'material' | 'philosophy' | 'story' | 'work';
  title: string;
  explanation: string;
  relatedLink?: { label: string; href: string };
}

interface Attribution {
  name: string;
  link?: string;
  label: string;
}

export interface GalleryImageData {
  id: string;
  section: 'tea-spaces' | 'tea-vessels' | 'inspiration' | 'our-work';
  imageUrl: string;
  category: string;
  insights: Insight[];
  attribution?: Attribution;
  productLinks?: Array<{ label: string; href: string }>;
}

interface GalleryImageProps {
  image: GalleryImageData;
}

const INSIGHT_COLORS: Record<Insight['type'], string> = {
  design: 'bg-tea-gold',
  curation: 'bg-tea-gold',
  layout: 'bg-tea-gold',
  material: 'bg-tea-gold',
  philosophy: 'bg-tea-gold',
  story: 'bg-tea-gold',
  work: 'bg-tea-gold',
};

const INSIGHT_ICONS: Record<Insight['type'], React.ReactNode> = {
  design: <Icons.Palette className="w-3 h-3" />,
  curation: <Icons.Heart className="w-3 h-3" />,
  layout: <Icons.Grid className="w-3 h-3" />,
  material: <Icons.Box className="w-3 h-3" />,
  philosophy: <Icons.Lightbulb className="w-3 h-3" />,
  story: <Icons.BookOpen className="w-3 h-3" />,
  work: <Icons.Hammer className="w-3 h-3" />,
};

export const GalleryImage: React.FC<GalleryImageProps> = ({ image }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [selectedInsight, setSelectedInsight] = useState<Insight | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  return (
    <>
      <div
        className="relative group overflow-hidden rounded-sm cursor-pointer bg-tea-gold/10"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Image */}
        <div className="relative w-full overflow-hidden bg-tea-bg">
          <img
            src={image.imageUrl}
            alt={image.category}
            onLoad={() => setImageLoaded(true)}
            className={`w-full h-auto object-cover transition-transform duration-500 ${
              isHovered ? 'scale-105' : 'scale-100'
            } ${!imageLoaded ? 'opacity-0' : 'opacity-100'}`}
          />

          {!imageLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-tea-gold/5">
              <div className="w-6 h-6 border-2 border-tea-border border-t-tea-gold rounded-full animate-spin"></div>
            </div>
          )}
        </div>

        {/* Hover Overlay */}
        <div
          className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-all duration-300 flex items-end p-4 ${
            isHovered ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div className="flex flex-wrap gap-2 items-center justify-between w-full">
            {/* Insight Tags */}
            <div className="flex flex-wrap gap-2">
              {image.insights.map((insight, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedInsight(insight)}
                  className={`px-2 py-1 rounded-full ${
                    INSIGHT_COLORS[insight.type]
                  } text-tea-text text-xs font-medium uppercase tracking-wider flex items-center gap-1  transition-all duration-300 `}
                >
                  {INSIGHT_ICONS[insight.type]}
                  {insight.type}
                </button>
              ))}
            </div>

            {/* External Links */}
            {image.attribution?.link && (
              <a
                href={image.attribution.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-tea-text hover:text-tea-gold transition-colors duration-300 p-1"
                title={`Visit ${image.attribution.name}`}
              >
                <Icons.ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>

        {/* Attribution */}
        {image.attribution && isHovered && (
          <div className="absolute bottom-16 left-4 right-4 bg-black/80 backdrop-blur-sm p-3 rounded-sm text-tea-text text-xs">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-tea-text/80 uppercase tracking-[0.15em] text-ui-10 mb-1">
                  {image.attribution.label}
                </p>
                <p className="font-serif text-sm">{image.attribution.name}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Insight Modal */}
      {selectedInsight && (
        <InsightOverlay insight={selectedInsight} onClose={() => setSelectedInsight(null)} />
      )}
    </>
  );
};
