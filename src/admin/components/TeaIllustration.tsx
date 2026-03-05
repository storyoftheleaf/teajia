import React from 'react';
import { ProductType } from '../types';

interface TeaIllustrationProps {
  type: ProductType;
  className?: string;
}

export const TeaIllustration: React.FC<TeaIllustrationProps> = ({ type, className = "w-full h-full" }) => {
  const getColor = (t: ProductType) => {
    switch (t) {
      case 'Green': return '#86efac'; // green-300
      case 'Yellow': return '#fde047'; // yellow-300
      case 'White': return '#e5e5e5'; // neutral-200
      case 'Oolong': return '#6ee7b7'; // emerald-300
      case 'Red': return '#fda4af'; // rose-300
      case 'Dark': return '#a8a29e'; // stone-400
      case 'Shou': return '#78716c'; // stone-500
      case 'Sheng': return '#bef264'; // lime-300
      case 'Herbal': return '#f9a8d4'; // pink-300
      case 'Matcha': return '#4ade80'; // green-400
      case 'Flower': return '#e879f9'; // fuchsia-400
      case 'Teaware': return '#fdba74'; // orange-300
      default: return '#d4d4d8';
    }
  };

  const color = getColor(type);

  const renderPath = () => {
    switch (type) {
      case 'Sheng':
      case 'Shou':
      case 'Dark':
        return (
          <g stroke={color} strokeWidth="1" fill="none" opacity="0.9">
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
      case 'Oolong':
        return (
           <g stroke={color} strokeWidth="1" fill="none" opacity="0.9">
              {/* Rolled Tea Shape */}
              <path d="M90 70 C 130 60, 160 100, 130 140 C 100 170, 50 150, 40 110 C 35 80, 60 75, 90 70 Z" />
              <path d="M90 70 C 80 100, 100 130, 130 140" opacity="0.5"/>
              <path d="M50 120 C 70 110, 80 90, 90 70" opacity="0.5"/>
           </g>
        );
      case 'Green':
      case 'Yellow':
      case 'White':
      case 'Red':
      case 'Herbal':
      case 'Misc':
        return (
            <g stroke={color} strokeWidth="1" fill="none" opacity="0.9">
                {/* Elegant Leaf */}
                <path d="M100 170 Q 100 100 50 50 Q 100 60 150 50 Q 120 100 100 170" />
                <path d="M100 170 Q 100 110 100 60" />
                <path d="M100 120 L 70 90" opacity="0.5"/>
                <path d="M100 100 L 130 80" opacity="0.5"/>
                <path d="M100 140 L 120 120" opacity="0.5"/>
            </g>
        );
      case 'Matcha':
         return (
             <g stroke={color} strokeWidth="1" fill="none" opacity="0.9">
                 {/* Bowl */}
                 <path d="M40 100 Q 40 160 100 160 Q 160 160 160 100" />
                 <path d="M35 100 L 165 100" />
                 {/* Whisk top */}
                 <path d="M85 100 L 85 60 L 115 60 L 115 100" opacity="0.8" />
                 <path d="M100 60 L 100 40" strokeWidth="2" />
                 {/* Froth */}
                 <circle cx="70" cy="85" r="4" opacity="0.4" fill={color} stroke="none" />
                 <circle cx="130" cy="90" r="3" opacity="0.4" fill={color} stroke="none" />
             </g>
         );
       case 'Flower':
         return (
             <g stroke={color} strokeWidth="1" fill="none" opacity="0.9">
                 {/* Stylized Lotus */}
                 <path d="M100 100 Q 60 60 100 20 Q 140 60 100 100" />
                 <path d="M100 100 Q 140 140 180 100 Q 140 60 100 100" />
                 <path d="M100 100 Q 140 140 100 180 Q 60 140 100 100" />
                 <path d="M100 100 Q 60 60 20 100 Q 60 140 100 100" />
                 <circle cx="100" cy="100" r="4" fill={color} opacity="0.6" stroke="none" />
             </g>
         );
       case 'Teaware':
         return (
             <g stroke={color} strokeWidth="1" fill="none" opacity="0.9">
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
          <rect width="24" height="24" stroke={color} strokeWidth="1" fill="none" />
          <path d="M6 6 L 18 18 M18 6 L 6 18" stroke={color} strokeWidth="1" />
       </g>
    </svg>
  );
};