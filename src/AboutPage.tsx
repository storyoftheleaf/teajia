import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { Icons } from './components/Icons';


export default function AboutPage() {
  return (
    <div className="animate-[fadeIn_0.6s_ease-out] max-w-3xl mx-auto px-4 md:px-6 pt-12 pb-24 pb-nav-gap-lg">
      <Helmet>
        <title>About — Teajia</title>
        <meta name="description" content="The story behind Teajia — twenty years of tea culture, sourcing, and design practice rooted in Taiwan and mainland China." />
      </Helmet>
      {/* Header */}
      <header className="mb-12 md:mb-16">
        <p className="label-caps mb-3">About Teajia</p>
        <h1 className="h2 mb-4">
          139 teas. One curator.
        </h1>
        <p className="subtitle">Twenty years of tea, distilled into a single curated practice.</p>
      </header>

      {/* Hero image — full-width editorial strip */}
      <div className="aspect-[3/2] md:aspect-[16/7] bg-tea-elevated rounded-xl mb-12 md:mb-16 overflow-hidden border border-tea-border">
        <img
          src=""
          alt="TeajiA — the practice"
          className="w-full h-full object-cover"
        />
      </div>

      {/* What TeajiA is */}
      <section className="mb-16 md:mb-20 space-y-6">
        <p className="body-prose">
          TeajiA is a space for tea culture — the stories, the craft, the knowledge, and the people who carry it forward. It grew out of more than twenty years spent inside the world of Chinese tea: sourcing from farmers, learning from masters, and building relationships with the artisans who shape the vessels, the leaf, and the practice.
        </p>
        <p className="body-light">
          What lives here is the result of that accumulated experience — a magazine for long-form stories and photo essays, a curriculum built from real knowledge passed down through practice, a shop stocked only with teas and teaware we know deeply, and a design practice for creating tea spaces that serve the ritual.
        </p>
        <p className="body-light">
          The work is rooted in Taiwan and mainland China but draws from everywhere tea is taken seriously. Based between Bali and Santa Cruz, TeajiA brings together design, education, and commerce into a single place — not as separate categories, but as parts of the same conversation about how tea fits into a considered life.
        </p>
      </section>

      {/* Editorial image pair — sourcing / origin context */}
      <div className="mb-16 md:mb-20 grid grid-cols-2 gap-3 md:gap-4">
        <div className="aspect-[4/3] bg-tea-elevated rounded-xl overflow-hidden border border-tea-border">
          <img
            src=""
            alt="Origin sourcing"
            className="w-full h-full object-cover"
          />
        </div>
        <div className="aspect-[4/3] bg-tea-elevated rounded-xl overflow-hidden border border-tea-border">
          <img
            src=""
            alt="Tea session"
            className="w-full h-full object-cover"
          />
        </div>
      </div>

      {/* Founder story */}
      <section className="mb-16 md:mb-20 border-t border-tea-border pt-12 md:pt-16">
        <p className="label-caps mb-3">The Founder</p>
        <h2 className="h2 mb-2">
          Adrian Rasmussen
        </h2>
        <p className="subtitle mb-8">Twenty years in tea culture. Taiwan, China, Bali, and beyond.</p>

        <div className="flex flex-col md:flex-row gap-8 md:gap-12">
          {/* Photo */}
          <img
            src="https://images.unsplash.com/photo-1545239351-ef35f43d514b?w=600&q=80&auto=format"
            alt="Adrian Rasmussen"
            className="w-full md:w-[280px] aspect-[3/2] md:aspect-[4/5] object-cover bg-tea-elevated rounded-xl border border-tea-border shrink-0"
            loading="lazy"
          />

          {/* Bio */}
          <div className="flex flex-col justify-center space-y-4">
            <p className="body-prose">
              Adrian's path into tea began in Taiwan in the early 2000s, studying under traditional masters who opened the door to a world most outsiders never see. Over two decades, that initial curiosity grew into a full practice: sourcing directly from farmers across Fujian, Yunnan, Wuyi, and Alishan; developing relationships with artisan potters and teaware makers; and building a deep understanding of the terroir, process, and history that gives each tea its character.
            </p>
            <p className="body-light">
              His background in design and visual art shapes everything he creates — from the way tea is presented to the spaces where it is shared. The intersection of craft and aesthetics is central: a tea room, a curated collection, even a simple tasting session are all exercises in attention and intention.
            </p>
            <p className="body-light">
              Today the practice is based between Bali and the United States, with regular sourcing trips to Taiwan and mainland China. Whether designing a tea room for a hospitality client, curating a private collection, or leading a sourcing journey through origin regions, the approach is always the same: listen first, then create something that lasts.
            </p>
          </div>
        </div>
      </section>

      {/* Wide contextual image */}
      <div className="mb-16 md:mb-20 aspect-[3/1] bg-tea-elevated rounded-xl overflow-hidden border border-tea-border">
        <img
          src=""
          alt="The practice"
          className="w-full h-full object-cover"
        />
      </div>

      {/* Pull quote */}
      <section className="mb-16 md:mb-20 border-t border-tea-border pt-10">
        <blockquote className="border-l-2 border-tea-gold pl-4 italic text-tea-text-sec">
          <p className="font-display text-ui-20 md:text-[26px] leading-relaxed">
            "Tea is not a product to be optimized. It is a relationship — between farmer, season, and the hands that prepare it."
          </p>
          <footer className="label-caps mt-4 not-italic">Adrian — founder</footer>
        </blockquote>
      </section>

      {/* Brand philosophy */}
      <section className="mb-16 md:mb-20 bg-tea-surface border border-tea-border p-6 md:p-8 rounded-xl">
        <p className="label-caps mb-3">Philosophy</p>
        <h2 className="h2 mb-4">
          The Approach
        </h2>
        <div className="space-y-4">
          <p className="body-light">
            Everything here comes from direct experience — teas sourced in person, stories told by the people who live them, courses built from decades of study and practice. Nothing is aggregated or abstracted. If it is on the site, someone here has touched it, tasted it, or spent real time understanding it.
          </p>
          <p className="body-light">
            The sourcing philosophy is simple: go to origin, taste widely, choose carefully. Every tea in the collection has been selected for its character, not just its category. We work directly with small producers — family farms in Wuyi, single-estate gardens in Alishan, artisan workshops in Jingdezhen — because the best teas come from people who care about what they make.
          </p>
          <p className="body-light">
            The same rigor applies to teaware, to education, and to design work. Premium does not mean precious. It means considered — a respect for materials, process, and the accumulated knowledge of the people who came before.
          </p>
        </div>
      </section>

      {/* What we do — pillars */}
      <section className="mb-16 md:mb-20 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-tea-surface border border-tea-border rounded-xl p-5">
          <h3 className="h3 mb-2">Magazine</h3>
          <p className="body-light">
            Long-form stories, photo essays, and profiles from inside tea culture. The people, the places, the craft — told with the depth they deserve.
          </p>
        </div>
        <div className="bg-tea-surface border border-tea-border rounded-xl p-5">
          <h3 className="h3 mb-2">Craft</h3>
          <p className="body-light">
            A practitioner toolkit. Courses, glossary, videos, journeys, and shared wisdom built from real experience. Not internet summaries, knowledge passed down through practice.
          </p>
        </div>
        <div className="bg-tea-surface border border-tea-border rounded-xl p-5">
          <h3 className="h3 mb-2">Shop</h3>
          <p className="body-light">
            A curated collection of teas and teaware sourced directly from artisan producers. Every item chosen for quality and character.
          </p>
        </div>
        <div className="bg-tea-surface border border-tea-border rounded-xl p-5">
          <h3 className="h3 mb-2">Advise</h3>
          <p className="body-light">
            Tea space design, sourcing guidance, ceremony training, and origin journeys. Twenty years of practice offered to those who take tea seriously.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="mb-16 md:mb-20 border-t border-tea-border pt-12 md:pt-16 text-center">
        <h2 className="h2 mb-4">
          Explore the collection
        </h2>
        <p className="body-light max-w-md mx-auto mb-8">
          Browse our teas and teaware — each one sourced directly and selected for quality, character, and story.
        </p>
        <Link
          to="/shop"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 active:bg-tea-gold/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-2 focus-visible:ring-offset-tea-bg"
        >
          Browse Our Teas
          <Icons.ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </section>

      {/* Studio link */}
      <section className="mb-16 md:mb-20 border-t border-tea-border pt-8">
        <p className="body-light mb-4">
          TeajiA shares roots with a visual art practice — laser-cut work, oracle cards, and objects that come from the same quiet attention as the tea itself.
        </p>
        <a
          href="https://adrianrasmussen.com"
          target="_blank"
          rel="noopener noreferrer"
          className="link-text inline-flex items-center gap-2 hover:text-tea-gold-lt transition-colors"
        >
          Explore the studio
          <Icons.ExternalLink className="w-3.5 h-3.5" />
        </a>
      </section>

    </div>
  );
}
