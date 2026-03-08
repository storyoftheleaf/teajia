import React from 'react';
import { Icons } from './components/Icons';


export default function AboutPage() {
  return (
    <div className="animate-[fadeIn_0.6s_ease-out] pb-24 md:pb-24 max-w-4xl mx-auto px-6">
      {/* Header */}
      <div className="pt-16 md:pt-24 mb-12 md:mb-16">
        <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-light text-tea-ink dark:text-tea-paper mb-4">
          About TeajiA
        </h1>
        <div className="w-12 h-[1px] bg-tea-seal" />
      </div>

      {/* Photo placeholder */}
      <div className="aspect-[3/2] bg-tea-beige dark:bg-tea-moss/30 rounded-lg mb-12 md:mb-16" />

      {/* What TeajiA is */}
      <div className="mb-16 md:mb-20">
        <p className="font-serif text-lg md:text-xl text-tea-ink dark:text-tea-paper leading-relaxed mb-6">
          TeajiA is a space for tea culture — the stories, the craft, the knowledge, and the people who carry it forward. It grew out of more than twenty years spent inside the world of Chinese tea: sourcing from farmers, learning from masters, and building relationships with the artisans who shape the vessels, the leaf, and the practice.
        </p>
        <p className="text-tea-ink/80 dark:text-tea-paper/80 leading-relaxed mb-6">
          What lives here is the result of that accumulated experience — a magazine for long-form stories and photo essays, a curriculum built from real knowledge passed down through practice, a shop stocked only with teas and teaware we know deeply, and a design practice for creating tea spaces that serve the ritual.
        </p>
        <p className="text-tea-ink/80 dark:text-tea-paper/80 leading-relaxed">
          The work is rooted in Taiwan and mainland China but draws from everywhere tea is taken seriously. Based between Bali and Santa Cruz, TeajiA brings together design, education, and commerce into a single place — not as separate categories, but as parts of the same conversation about how tea fits into a considered life.
        </p>
      </div>

      {/* The approach */}
      <div className="mb-16 md:mb-20 bg-white/50 dark:bg-tea-gold/5 p-8 md:p-12 rounded-lg">
        <h2 className="font-serif text-2xl md:text-3xl text-tea-ink dark:text-tea-paper mb-4">
          The Approach
        </h2>
        <div className="w-12 h-[1px] bg-tea-seal mb-6" />
        <p className="text-tea-ink/70 dark:text-tea-paper/70 leading-relaxed mb-4">
          Everything here comes from direct experience — teas sourced in person, stories told by the people who live them, courses built from decades of study and practice. Nothing is aggregated or abstracted. If it's on the site, someone here has touched it, tasted it, or spent real time understanding it.
        </p>
        <p className="text-tea-ink/70 dark:text-tea-paper/70 leading-relaxed">
          The full story of TeajiA — the pivotal moments, the teachers, the places — is still being written. This section will grow as the work continues.
        </p>
      </div>

      {/* Studio link */}
      <div className="mb-16 md:mb-20 border-t border-tea-ink/10 dark:border-tea-gold/10 pt-8">
        <p className="text-tea-ink/80 dark:text-tea-paper/80 leading-relaxed mb-4">
          TeajiA shares roots with a visual art practice — laser-cut work, oracle cards, and objects that come from the same quiet attention as the tea itself.
        </p>
        <a
          href="#"
          className="text-tea-seal hover:text-tea-seal/80 uppercase tracking-widest text-xs font-medium inline-flex items-center gap-2 transition-colors duration-300"
        >
          Explore the studio
          <Icons.ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

    </div>
  );
}
