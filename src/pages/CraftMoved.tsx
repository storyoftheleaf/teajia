import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

/**
 * Craft left the bar (Adrian, 2026-11-27) and became Read's Lessons shelf.
 * An old /craft address lands where its piece went: the glossary in the
 * Wisdom Base, every other view on Lessons at the same ?v=, and the Craft
 * landing on the Lessons landing. Craft's essays were always /read/* articles
 * and the Tea Reference was always /wisdom, so those links never changed.
 */
export function craftMovedTo(search: string): string {
  const view = new URLSearchParams(search).get('v');
  if (view === 'glossary') return '/wisdom/glossary';
  if (view) return `/read/lessons?v=${encodeURIComponent(view)}`;
  return '/read/lessons';
}

const CraftMoved: React.FC = () => {
  const { search } = useLocation();
  return <Navigate to={craftMovedTo(search)} replace />;
};

export default CraftMoved;
