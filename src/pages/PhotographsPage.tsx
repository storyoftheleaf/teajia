import React from 'react';
import { Helmet } from 'react-helmet-async';

export const PHOTOGRAPH_SECTIONS: Array<{ title: string; body: string[] }> = [
  {
    title: 'What may be shown',
    body: [
      'A photograph you add to a tasting may be shown on Teajia, with your name. It appears on your own page if you choose to share it, and Teajia may choose it for a tea page, where your name stays beside it and links to your page.',
      'A photograph stays private until you share it. Your score and your private notes are never shown.',
    ],
  },
  {
    title: 'Taking one off your page',
    body: [
      'On your own page, each photograph has Remove from my page. It leaves your page and your view at once.',
      'Teajia keeps the file, so a photograph it has already chosen to use can stay where it is. If you want one taken down everywhere, ask and we will do it.',
    ],
  },
  {
    title: 'Asking us to take one down',
    body: [
      'Write to hello@teajia.com with the tea and the photograph, and we will take it down. We answer within thirty days, and usually much sooner.',
    ],
  },
  {
    title: 'What the photograph carries',
    body: [
      'Every photograph is rewritten on your phone before it is sent, which removes the place and time your camera recorded. Only the picture goes to Teajia.',
    ],
  },
];

/** The short page the photograph notice in the tasting links to. Not in any menu. */
export default function PhotographsPage() {
  return (
    <div className="animate-[fadeIn_0.6s_ease-out] max-w-3xl mx-auto px-4 md:px-6 pt-12 pb-24 pb-nav-gap-lg">
      <Helmet>
        <title>How we use photographs · Teajia</title>
        <meta name="description" content="How Teajia uses the photographs you add to a tasting, how to remove one, and how to ask for one to be taken down." />
      </Helmet>
      <header className="mb-12 text-center">
        <p className="label-caps mb-3">Photographs</p>
        <h1 className="h1 mb-4">How we use photographs</h1>
      </header>
      <div className="space-y-12">
        {PHOTOGRAPH_SECTIONS.map((s) => (
          <section key={s.title} className="space-y-4 border-t border-tea-border pt-8">
            <h2 className="h3">{s.title}</h2>
            {s.body.map((p) => <p key={p.slice(0, 32)} className="body-light">{p}</p>)}
          </section>
        ))}
      </div>
    </div>
  );
}
