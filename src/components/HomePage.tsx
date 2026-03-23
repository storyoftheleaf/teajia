import React from 'react';
import { Helmet } from 'react-helmet-async';
import { motion, type Variants } from 'framer-motion';
import { LogoEmblem } from './Logos/LogoEmblem';
import { LogoText } from './Logos/LogoText';

interface HomePageProps {
  onNavigateToSection: (section: 'MAGAZINE' | 'LEARN' | 'SHOP' | 'OFFERINGS', magazineTab?: 'articles' | 'visual' | 'tea-inspire') => void;
  savedStoryIds?: Record<string, boolean>;
  watchedStoryIds?: Record<string, boolean>;
  onCardClick?: (story: any) => void;
  onToggleSave?: (id: string) => void;
  onShare?: (story: any) => void;
  onCartClick?: () => void;
  onAccountClick?: () => void;
  cartItemCount?: number;
}

const charVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 1.0 + i * 0.15, duration: 0.6, ease: [0.4, 0, 0.2, 1] },
  }),
};

export const HomePage: React.FC<HomePageProps> = ({
  onNavigateToSection,
}) => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-8 pb-24 text-center">
      <Helmet>
        <title>Teajia — Fine Tea & Teaware</title>
        <meta name="description" content="Every culture brings wisdom to the table. Teajia is where it is served." />
      </Helmet>

      {/* Brand — emblem then wordmark */}
      <motion.div
        className="flex flex-col items-center gap-4 mb-14"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.1 }}
      >
        <LogoEmblem
          size={56}
          color="var(--tea-gold)"
          className="opacity-70"
        />
        <LogoText
          size="md"
          color="var(--tea-text-sec)"
        />
      </motion.div>

      {/* Statement */}
      <motion.h1
        className="text-tea-text max-w-[440px] text-[34px] md:text-[42px] leading-[1.3] tracking-[0.005em] font-normal"
        style={{ fontFamily: 'var(--font-display)' }}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.3, ease: [0.4, 0, 0.2, 1] }}
      >
        Tea deepens with what you bring to the table and what you leave behind.
      </motion.h1>

      {/* Characters intro */}
      <motion.p
        className="font-sans font-light text-[12px] tracking-[0.15em] text-tea-text-sec mt-14 mb-7"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.8 }}
      >
        three characters &middot; one sound &middot; jia
      </motion.p>

      {/* Characters */}
      <div className="flex justify-center gap-10 md:gap-16">
        {[
          { char: '家', meaning: 'home, devotion' },
          { char: '佳', meaning: 'beauty, excellence' },
          { char: '嘉', meaning: 'celebration, praise' },
        ].map((item, i) => (
          <motion.div
            key={item.char}
            className="flex flex-col items-center gap-2"
            custom={i}
            initial="hidden"
            animate="visible"
            variants={charVariants}
          >
            <span
              className="text-tea-gold text-[32px] md:text-[38px] leading-none"
              style={{ fontFamily: 'var(--font-serif)' }}
            >
              {item.char}
            </span>
            <span className="font-serif font-light italic text-sm md:text-[15px] text-tea-text-sec">
              {item.meaning}
            </span>
          </motion.div>
        ))}
      </div>

      {/* Grounding */}
      <motion.p
        className="font-serif text-base md:text-[17px] text-tea-text-sec leading-[1.8] max-w-[380px] mt-11"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 1.9 }}
      >
        <span className="block">Source your tea.</span>
        <span className="block">Grow with the culture.</span>
        <span className="block">Create the spaces to share it.</span>
      </motion.p>


    </div>
  );
};
