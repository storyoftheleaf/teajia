import React, { useState } from 'react';
import { LayoutGroup, motion } from 'framer-motion';

const TABS = ['Read', 'Learn', 'Consult', 'Shop'];

// ─── Style 1: Whisper Capsule — frosted gold outline ───────────────────────
function Style1({ tabs }: { tabs: string[] }) {
  const [active, setActive] = useState(tabs[0]);
  return (
    <LayoutGroup id="s1">
      <div className="flex items-center gap-1">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActive(tab)}
            className="relative px-3 py-1.5 text-[13px] tracking-widest uppercase"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {active === tab && (
              <motion.span
                layoutId="s1-pill"
                className="absolute inset-0 rounded-full"
                style={{
                  border: '1px solid rgb(var(--tea-gold-rgb) / 0.3)',
                  background: 'rgb(var(--tea-gold-rgb) / 0.07)',
                  boxShadow: '0 0 10px 1px rgb(var(--tea-gold-rgb) / 0.1)',
                }}
                transition={{ type: 'spring', stiffness: 280, damping: 28 }}
              />
            )}
            <span
              className="relative transition-colors duration-300"
              style={{ color: active === tab ? 'var(--tea-gold)' : 'var(--tea-text-dim)' }}
            >
              {tab.toLowerCase()}
            </span>
          </button>
        ))}
      </div>
    </LayoutGroup>
  );
}

// ─── Style 2: Ink-Wash Underline ───────────────────────────────────────────
function Style2({ tabs }: { tabs: string[] }) {
  const [active, setActive] = useState(tabs[0]);
  return (
    <LayoutGroup id="s2">
      <div className="flex items-center gap-6">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActive(tab)}
            className="relative pb-2 text-[13px] tracking-widest uppercase"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            <span
              className="relative transition-colors duration-400"
              style={{ color: active === tab ? 'var(--tea-gold)' : 'var(--tea-text-dim)', transitionDuration: '350ms' }}
            >
              {tab.toLowerCase()}
            </span>
            {active === tab && (
              <motion.span
                layoutId="s2-line"
                className="absolute bottom-0 left-0 right-0 h-px"
                style={{ background: 'var(--tea-gold)', transformOrigin: 'center' }}
                initial={{ scaleX: 0, opacity: 0 }}
                animate={{ scaleX: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 30 }}
              />
            )}
          </button>
        ))}
      </div>
    </LayoutGroup>
  );
}

// ─── Style 3: Recessed Press ───────────────────────────────────────────────
function Style3({ tabs }: { tabs: string[] }) {
  const [active, setActive] = useState(tabs[0]);
  return (
    <LayoutGroup id="s3">
      <div className="flex items-center gap-1">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActive(tab)}
            className="relative px-3 py-1.5 text-[13px] tracking-widest uppercase"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {active === tab && (
              <motion.span
                layoutId="s3-pill"
                className="absolute inset-0 rounded-full"
                style={{ background: 'rgb(0 0 0 / 0.18)' }}
                transition={{ type: 'tween', ease: [0.25, 0.1, 0.25, 1], duration: 0.22 }}
              />
            )}
            <motion.span
              className="relative block"
              animate={
                active === tab
                  ? { scale: 0.94, color: 'var(--tea-gold)', textShadow: '0 1px 3px rgba(0,0,0,0.5)' }
                  : { scale: 1, color: 'var(--tea-text-dim)', textShadow: 'none' }
              }
              transition={{ type: 'tween', ease: [0.25, 0.1, 0.25, 1], duration: 0.2 }}
            >
              {tab.toLowerCase()}
            </motion.span>
          </button>
        ))}
      </div>
    </LayoutGroup>
  );
}

// ─── Style 4: Bronze Dust Glow ─────────────────────────────────────────────
function Style4({ tabs }: { tabs: string[] }) {
  const [active, setActive] = useState(tabs[0]);
  return (
    <LayoutGroup id="s4">
      <div className="flex items-center gap-4">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActive(tab)}
            className="relative px-2 py-1.5 text-[13px] tracking-widest uppercase"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {active === tab && (
              <motion.span
                layoutId="s4-glow"
                className="absolute inset-0 rounded-full pointer-events-none"
                style={{ background: 'transparent' }}
                transition={{ type: 'spring', stiffness: 300, damping: 32 }}
              />
            )}
            <motion.span
              className="relative block"
              animate={
                active === tab
                  ? {
                      color: 'var(--tea-gold)',
                      filter: 'drop-shadow(0 0 6px rgb(var(--tea-gold-rgb) / 0.5)) drop-shadow(0 0 14px rgb(var(--tea-gold-rgb) / 0.2))',
                    }
                  : {
                      color: 'var(--tea-text-dim)',
                      filter: 'drop-shadow(0 0 0px transparent)',
                    }
              }
              transition={{ duration: 0.45, ease: 'easeOut' }}
            >
              {tab.toLowerCase()}
            </motion.span>
          </button>
        ))}
      </div>
    </LayoutGroup>
  );
}

// ─── Style 5: Weight-Shift Only ────────────────────────────────────────────
function Style5({ tabs }: { tabs: string[] }) {
  const [active, setActive] = useState(tabs[0]);
  return (
    <div className="flex items-center gap-6">
      {tabs.map((tab) => (
        <button
          key={tab}
          onClick={() => setActive(tab)}
          className="relative pb-2 text-[13px] uppercase"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          <motion.span
            className="block"
            animate={
              active === tab
                ? {
                    color: 'var(--tea-gold)',
                    letterSpacing: '0.05em',
                    fontWeight: 600,
                  }
                : {
                    color: 'var(--tea-text-dim)',
                    letterSpacing: '0.2em',
                    fontWeight: 400,
                  }
            }
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            {tab.toLowerCase()}
          </motion.span>
          <motion.span
            className="absolute bottom-0 left-1/2 h-px"
            animate={
              active === tab
                ? { width: '100%', x: '-50%', opacity: 1 }
                : { width: '0%', x: '-50%', opacity: 0 }
            }
            style={{ background: 'var(--tea-gold)', transformOrigin: 'center' }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          />
        </button>
      ))}
    </div>
  );
}

// ─── Demo Page ─────────────────────────────────────────────────────────────
const VARIANTS = [
  {
    id: 1,
    name: 'Whisper Capsule',
    desc: 'Frosted gold outline — barely-there border with a warm haze. Spring morph between tabs.',
    Component: Style1,
  },
  {
    id: 2,
    name: 'Ink-Wash Underline',
    desc: 'Line fans out from center like a brushstroke placed. No pill background at all.',
    Component: Style2,
  },
  {
    id: 3,
    name: 'Recessed Press',
    desc: 'Active word sinks slightly — dark tint capsule + subtle text-shadow gives depth not surface.',
    Component: Style3,
  },
  {
    id: 4,
    name: 'Bronze Dust Glow',
    desc: 'No container. Active word radiates a warm ambient glow, fades in slowly over 450ms.',
    Component: Style4,
  },
  {
    id: 5,
    name: 'Weight-Shift Only',
    desc: 'Typography alone does the work. Active: tight tracking + heavier weight + line fans out from center.',
    Component: Style5,
  },
];

export default function TabStyleDemo() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-start py-16 px-6 gap-16"
      style={{ background: 'var(--tea-bg)', color: 'var(--tea-text)' }}
    >
      <div className="text-center space-y-2">
        <p
          className="text-[10px] uppercase tracking-[0.3em] opacity-40"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Tab Style Exploration
        </p>
        <h1
          className="text-2xl font-light"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--tea-text)' }}
        >
          Active Indicator
        </h1>
      </div>

      <div className="w-full max-w-lg flex flex-col gap-14">
        {VARIANTS.map(({ id, name, desc, Component }) => (
          <div key={id} className="flex flex-col gap-5">
            <div className="space-y-1">
              <p
                className="text-[10px] uppercase tracking-[0.25em] opacity-50"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {id} / {VARIANTS.length}
              </p>
              <h2
                className="text-base font-medium"
                style={{ fontFamily: 'var(--font-display)', color: 'var(--tea-text)' }}
              >
                {name}
              </h2>
              <p className="text-[12px] leading-relaxed opacity-50">{desc}</p>
            </div>

            {/* Preview bar — mimics the bottom nav width */}
            <div
              className="rounded-xl flex items-center justify-center py-4 px-6"
              style={{
                background: 'rgb(var(--tea-bg-rgb) / 0.95)',
                boxShadow: '0 -1px 0 rgb(var(--tea-gold-rgb) / 0.1), 0 4px 24px rgb(0 0 0 / 0.15)',
              }}
            >
              <Component tabs={TABS} />
            </div>
          </div>
        ))}
      </div>

      <p
        className="text-[10px] uppercase tracking-[0.25em] opacity-25 pb-8"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        tap any tab to see the animation
      </p>
    </div>
  );
}
