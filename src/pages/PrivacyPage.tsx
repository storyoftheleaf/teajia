import React from 'react';
import { Helmet } from 'react-helmet-async';

const SECTIONS: Array<{ title: string; body: string[] }> = [
  {
    title: 'What we keep',
    body: [
      'If you make an account: your name, your email address, and a password stored only as a scrambled hash. If you sign in with Google, we receive your name and email from Google and nothing else from your account.',
      'If you order: what you ordered, the address you give us for delivery, and how the order was paid and sent. Orders are arranged with you personally, usually over WhatsApp, so the messages you send there stay in WhatsApp.',
      'If you RSVP to a session, ask a question, or save favourites and tasting notes: what you wrote and when.',
    ],
  },
  {
    title: 'What we use it for',
    body: [
      'To run your account, fill your orders, reply to you, and remember what you asked us to remember. We do not sell or rent your information, we do not show you advertising, and we do not run tracking or analytics scripts on this site.',
    ],
  },
  {
    title: 'Who helps us run it',
    body: [
      'Cloudflare hosts the site and stores its data. Resend sends the sign-in codes we email you. WhatsApp carries order messages. Google provides "Continue with Google". Each receives only what it needs to do that one job.',
      'When the shop reads a photo of a tea label or turns a voice note into text, that photo or recording is sent to an AI service (Anthropic or Groq) to read it. These are the shop’s own sourcing notes, not customer information.',
    ],
  },
  {
    title: 'Google Drive',
    body: [
      'The shop’s owner can connect the shop’s own Google Drive so sourcing photos are kept in folders there. Teajia asks only for the files it creates itself and cannot see anything else in that Drive. This applies to the shop’s Drive only; Teajia never asks for access to a customer’s Drive.',
    ],
  },
  {
    title: 'Stored on your device',
    body: [
      'The site keeps a few things in your browser so it works smoothly: that you are signed in, your cart, your currency, and your light or dark setting. Clearing your browser’s data for teajia.com removes them.',
    ],
  },
  {
    title: 'Your choices',
    body: [
      'You can ask to see what we hold about you, to correct it, or to delete your account and what belongs to it. Write to hello@teajia.com and we will answer within thirty days. Records of completed orders may be kept as long as the law requires for accounts.',
    ],
  },
];

/** What the site keeps about people, in plain words. Linked from Google's sign-in screen. */
export default function PrivacyPage() {
  return (
    <div className="animate-[fadeIn_0.6s_ease-out] max-w-3xl mx-auto px-4 md:px-6 pt-12 pb-24 pb-nav-gap-lg">
      <Helmet>
        <title>Privacy · Teajia</title>
        <meta name="description" content="What Teajia keeps about you, why, who helps run it, and how to have it changed or removed." />
      </Helmet>
      <header className="mb-12 text-center">
        <p className="label-caps mb-3">Privacy</p>
        <h1 className="h1 mb-4">What we keep, and why</h1>
        <p className="subtitle">Updated 8 October 2026</p>
      </header>
      <div className="space-y-12">
        {SECTIONS.map((s) => (
          <section key={s.title} className="space-y-4 border-t border-tea-border pt-8">
            <h2 className="h3">{s.title}</h2>
            {s.body.map((p) => <p key={p.slice(0, 32)} className="body-light">{p}</p>)}
          </section>
        ))}
      </div>
    </div>
  );
}
