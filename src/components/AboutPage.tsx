import React from 'react';

export default function AboutPage() {
  return (
    <div className="animate-[fadeIn_0.6s_ease-out] pb-24 md:pb-24">
      <div className="max-w-2xl mx-auto px-4">
        {/* Header */}
        <header className="pt-12 mb-12">
          <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-light text-tea-text mb-4">
            About
          </h1>
          <div className="w-12 h-[1px] bg-tea-gold"></div>
        </header>

        {/* Photo placeholder */}
        <div className="aspect-[4/3] bg-tea-text/5 rounded-lg mb-12 flex items-center justify-center">
          <span className="text-sm text-tea-text/30 uppercase tracking-caps">
            Photo
          </span>
        </div>

        {/* About Adrian */}
        <section className="mb-16">
          <div className="font-serif text-lg md:text-xl leading-relaxed text-tea-text space-y-6">
            <p>
              Adrian has spent more than twenty years immersed in Chinese tea culture, traveling through
              Taiwan and China, sourcing tea and building relationships with farmers, masters, and
              artisans. His background in design and visual art shapes everything he creates — from the
              way tea is presented to the spaces where it is shared.
            </p>
            <p>
              Based between Bali and Santa Cruz, Adrian is a maker of tea tables, art, oracle cards,
              and incense. Two decades of journeying through the tea mountains have deepened his
              understanding of craft, terroir, and the quiet rituals that connect us to place.
            </p>
            <p>
              TeajiA grew from a desire to share this world more widely — not just the tea itself,
              but the stories, the knowledge, and the sense of community that surrounds it.
            </p>
          </div>
        </section>

        {/* Your Story section */}
        <section className="mb-16">
          <h2 className="font-serif text-2xl md:text-3xl text-tea-text mb-6">
            The Story
          </h2>
          <div className="w-12 h-[1px] bg-tea-gold mb-6"></div>
          <p className="text-tea-text/70 leading-relaxed">
            The full story of TeajiA and the journey that created it. This section will be
            expanded with Adrian's personal narrative — the years on the road, the people and
            places that shaped the vision, and the path from tea student to guide.
          </p>
        </section>

        {/* Art Studio link */}
        <section className="py-12 border-t border-tea-border">
          <p className="text-tea-text/70 mb-4">
            Adrian is also a visual artist creating laser-cut work, oracle cards, and more.
          </p>
          <a
            href="#"
            className="text-tea-gold hover:text-tea-gold/80 transition-colors duration-300 uppercase tracking-wider text-xs font-medium inline-flex items-center gap-2"
          >
            Explore the full studio
            <span aria-hidden="true">&rarr;</span>
          </a>
        </section>
      </div>

    </div>
  );
}
