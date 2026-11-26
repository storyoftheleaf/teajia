import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Section } from '../types';
import { homeBarOpen } from '../lib/homeBar';
import { sectionKeyPaths } from '../components/navSections';

/** Today's keys 1 to 5: Home, Read, Craft, Advise, Shop. */
const TODAY_KEYS: readonly Section[] = ['HOME', 'MAGAZINE', 'LEARN', 'OFFERINGS', 'SHOP'];

/**
 * Desktop keyboard shortcuts: keys 1 to 5 open Home and then the four words in
 * bar order. With the new bar (HOME_BAR_OPEN) they follow its words, read from
 * navSections.ts; closed, they are today's five sections. Never while typing.
 */
export function useSectionKeys(setActiveSection: (section: Section) => void): void {
  const navigate = useNavigate();
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      if (!(e.key >= '1' && e.key <= '5')) return;
      e.preventDefault();
      const index = parseInt(e.key, 10) - 1;
      if (!homeBarOpen()) {
        setActiveSection(TODAY_KEYS[index]);
        return;
      }
      // Home, Read and Shop keep the section route, which also closes Your Table.
      if (index === 0) { setActiveSection('HOME'); return; }
      if (index === 1) { setActiveSection('MAGAZINE'); return; }
      if (index === 4) { setActiveSection('SHOP'); return; }
      navigate(sectionKeyPaths()[index]);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setActiveSection, navigate]);
}
