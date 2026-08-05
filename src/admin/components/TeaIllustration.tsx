import React from 'react';
import { ProductType } from '../types';
import { getTeaVividColor } from '../../designTokens';
import { normalizeTeaType, type TeaType } from '../../wisdom';

interface TeaIllustrationProps {
  type: ProductType;
  className?: string;
}

// Illustration shape grouped by canonical tea type. Record<TeaType, ...> means
// a missing or extra type key is a compile error. Teaware and Misc are not tea
// types so they're handled outside the record; legacy stored spellings are
// normalized before lookup so old records still render.
type IllustrationShape = 'cake' | 'oolong' | 'leaf';

const SHAPE_BY_TYPE: Record<TeaType, IllustrationShape> = {
  Sheng: 'cake',
  Shou: 'cake',
  Dark: 'cake',
  Oolong: 'oolong',
  Green: 'leaf',
  Yellow: 'leaf',
  White: 'leaf',
  Red: 'leaf',
  Herbal: 'leaf',
};

export const TeaIllustration: React.FC<TeaIllustrationProps> = ({ type, className = "w-full h-full" }) => {
  const color = getTeaVividColor(type);
  const normalized = normalizeTeaType(type);
  const shape: IllustrationShape | 'teapot' | null =
    type === 'Teaware' ? 'teapot'
    : type === 'Misc' ? 'leaf'
    : normalized ? SHAPE_BY_TYPE[normalized] : null;

  const renderPath = () => {
    switch (shape) {
      case 'cake':
        return (
          <g stroke={color} fill="none" opacity="0.9">
             {/* Tea Cake (Bing) */}
             <circle cx="100" cy="100" r="60" />
             <circle cx="100" cy="100" r="8" opacity="0.6" />
             {/* Wrapper Texture */}
             <path d="M100 40 Q 140 60 160 100" opacity="0.4" />
             <path d="M100 160 Q 60 140 40 100" opacity="0.4" />
             <path d="M40 100 Q 60 60 100 40" opacity="0.4" />
             <path d="M160 100 Q 140 140 100 160" opacity="0.4" />
             {/* Rustic details */}
             <path d="M95 95 L 105 105 M105 95 L 95 105" strokeWidth="0.5" opacity="0.3" />
          </g>
        );
      case 'oolong':
        return (
           <g stroke={color} fill="none" opacity="0.9">
              {/* Rolled Tea Shape */}
              <path d="M90 70 C 130 60, 160 100, 130 140 C 100 170, 50 150, 40 110 C 35 80, 60 75, 90 70 Z" />
              <path d="M90 70 C 80 100, 100 130, 130 140" opacity="0.5"/>
              <path d="M50 120 C 70 110, 80 90, 90 70" opacity="0.5"/>
           </g>
        );
      case 'leaf':
        return (
            <g stroke={color} fill="none" opacity="0.9">
                {/* Elegant Leaf */}
                <path d="M100 170 Q 100 100 50 50 Q 100 60 150 50 Q 120 100 100 170" />
                <path d="M100 170 Q 100 110 100 60" />
                <path d="M100 120 L 70 90" opacity="0.5"/>
                <path d="M100 100 L 130 80" opacity="0.5"/>
                <path d="M100 140 L 120 120" opacity="0.5"/>
            </g>
        );
       case 'teapot':
         return (
             <g stroke={color} fill="none" opacity="0.9">
                {/* Clay Teapot */}
                <path d="M60 80 Q 50 150 100 150 Q 150 150 140 80 Z" />
                <path d="M65 80 Q 100 55 135 80" /> {/* Lid */}
                <circle cx="100" cy="65" r="6" /> {/* Knob */}
                <path d="M140 90 Q 175 80 175 110 Q 165 140 135 130" /> {/* Handle */}
                <path d="M60 90 Q 25 70 25 60" /> {/* Spout */}
             </g>
         );
      default:
        return null;
    }
  };

  return (
    <svg viewBox="0 0 200 200" className={className} xmlns="http://www.w3.org/2000/svg">
       {/* Background Watermark */}
       <circle cx="100" cy="100" r="90" stroke={color} strokeWidth="0.5" opacity="0.1" fill="none" />
       <circle cx="100" cy="100" r="82" stroke={color} strokeWidth="0.5" opacity="0.05" fill="none" />

       {renderPath()}

       {/* Traditional Seal (Chop) Effect */}
       <g opacity="0.3" transform="translate(145, 145)">
          <rect width="24" height="24" stroke={color} fill="none" />
          <path d="M6 6 L 18 18 M18 6 L 6 18" stroke={color} />
       </g>
    </svg>
  );
};
