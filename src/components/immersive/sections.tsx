// src/components/immersive/sections.tsx
import type React from 'react';
import type { ArticleBlock } from '../../types';
import { ScrollHighlightText } from './ScrollHighlightText';

// Cover: full-height image backdrop with overlaid title. Phone-first; the same
// markup reads wider on desktop via the responsive measure classes below.
export function CoverSection({ title, subtitle, image, kicker }: {
  title: string; subtitle?: string; image?: string; kicker?: string;
}) {
  return (
    <section className="relative min-h-[100dvh] flex items-end overflow-hidden">
      {image && (
        <img src={image} alt="" className="absolute inset-0 w-full h-full object-cover" />
      )}
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(transparent 28%, rgba(20,18,15,.55) 62%, rgba(20,18,15,.97))' }}
      />
      <div className="relative z-[2] px-6 pb-16 md:px-16 md:pb-24 w-full">
        {kicker && (
          <span className="inline-block font-sans text-ui-10 tracking-[0.22em] uppercase text-tea-gold-lt border border-tea-border rounded-full px-3 py-1 mb-4">
            {kicker}
          </span>
        )}
        <h1 className="font-display font-semibold text-tea-text leading-[0.94] text-[52px] md:text-[88px]">
          {title}
        </h1>
        {subtitle && <p className="font-body text-tea-text-sec mt-4 text-ui-16 md:text-ui-20 max-w-[640px]">{subtitle}</p>}
      </div>
    </section>
  );
}

// Reading column: capped measure even on wide screens (prose never goes full-bleed).
function ReadingColumn({ children }: { children: React.ReactNode }) {
  return <div className="px-6 md:px-0 mx-auto max-w-[680px]">{children}</div>;
}

// Prose: the spine. Uses the scroll-highlight effect on the body text.
export function ProseSection({ text, dropcap }: { text: string; dropcap?: boolean }) {
  return (
    <section className="py-20 md:py-32">
      <ReadingColumn>
        <ScrollHighlightText
          text={text}
          className={`font-body text-[18px] md:text-ui-20 leading-[1.78] ${dropcap ? 'immersive-dropcap' : ''}`}
        />
      </ReadingColumn>
    </section>
  );
}

export function SectionHeading({ text }: { text: string }) {
  return (
    <section className="pt-12 pb-2 md:pt-20">
      <ReadingColumn>
        <h3 className="font-display font-medium text-tea-text leading-[1.05] text-[34px] md:text-[44px]">{text}</h3>
      </ReadingColumn>
    </section>
  );
}

export function PullQuote({ text, attribution }: { text: string; attribution?: string }) {
  return (
    <section className="py-24 md:py-32 text-center px-6">
      <blockquote className="font-display font-medium italic text-tea-gold-lt leading-[1.18] text-[32px] md:text-[46px] max-w-[760px] mx-auto">
        {text}
      </blockquote>
      {attribution && (
        <cite className="block mt-8 font-sans not-italic text-ui-11 tracking-[0.16em] uppercase text-tea-text-dim">{attribution}</cite>
      )}
    </section>
  );
}

// Maps one ArticleBlock to its section. Unmapped block types render nothing in
// AR.0 (added in AR.1/AR.2); they are intentionally skipped, not errored.
export function renderBlock(block: ArticleBlock, index: number) {
  switch (block.type) {
    case 'cover':
      return <CoverSection key={index} title={block.title} subtitle={block.subtitle} image={block.image} kicker={block.kicker} />;
    case 'intro':
      return <ProseSection key={index} text={block.text} dropcap />;
    case 'paragraph':
      return <ProseSection key={index} text={block.text} />;
    case 'section_heading':
      return <SectionHeading key={index} text={block.text} />;
    case 'quote':
      return <PullQuote key={index} text={block.text} attribution={block.attribution} />;
    default:
      return null;
  }
}
