import React from 'react';

export default function AboutPage() {
  return (
    <div className="animate-[fadeIn_0.6s_ease-out] pb-nav-gap">
      <div className="max-w-3xl mx-auto px-4 md:px-6 pt-12 pb-24">
        {/* Header */}
        <header className="mb-12">
          <p className="label-caps text-tea-text-dim mb-3">About</p>
          <h1 className="h2 mb-3">Adrian Stone</h1>
          <p className="subtitle">Twenty years on the road, one quiet practice.</p>
        </header>

        {/* Photo placeholder */}
        <div className="aspect-[4/3] bg-tea-surface border border-tea-border rounded-xl mb-12 flex items-center justify-center">
          <span className="label-caps text-tea-text-dim">Photo</span>
        </div>

        {/* About Adrian */}
        <section className="mb-16">
          <div className="space-y-6 body-prose">
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
          <h2 className="h3 mb-6">The Story</h2>
          <p className="body-light">
            The full story of TeajiA and the journey that created it. This section will be
            expanded with Adrian's personal narrative — the years on the road, the people and
            places that shaped the vision, and the path from tea student to guide.
          </p>
        </section>

        {/* Art Studio link */}
        <section className="py-12 border-t border-tea-border">
          <p className="body-light mb-4">
            Adrian is also a visual artist creating laser-cut work, oracle cards, and more.
          </p>
          <a
            href="#"
            className="inline-flex items-center gap-2 text-tea-text-sec hover:text-tea-text transition-colors text-xs font-semibold"
          >
            Explore the full studio
            <span aria-hidden="true">&rarr;</span>
          </a>
        </section>
      </div>
    </div>
  );
}
