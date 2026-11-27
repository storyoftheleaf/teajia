import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { SunHorizon } from '@phosphor-icons/react';
import type { ManageItem } from '../manageNav';

// The Manage rooms for the three slim-rail ideas (railIdea.ts). Each reads the
// same list as today's drawer (manageNav.ts), so no idea can show a room the
// others do not.

export interface RailManageProps {
  today: { label: string; path: string } | null;
  items: ManageItem[];
  /** Whether the person is standing on this path. */
  here: (path: string) => boolean;
}

function roomActive(item: ManageItem, here: (path: string) => boolean): boolean {
  return here(item.path) || (item.children?.some(c => here(c.path)) ?? false);
}

/** Idea A: the rooms as small words in the rail's own type, stacked just above the word manage. */
export const RoomsInRail: React.FC<RailManageProps> = ({ today, items, here }) => (
  <motion.nav
    id="manage-drawer"
    aria-label="Manage"
    initial={{ opacity: 0, height: 0 }}
    animate={{ opacity: 1, height: 'auto' }}
    exit={{ opacity: 0, height: 0 }}
    transition={{ duration: 0.2, ease: 'easeOut' }}
    className="rail-a-rooms"
  >
    {today && (
      <Link to={today.path} className="rail-a-room" aria-current={here(today.path) ? 'page' : undefined}>
        {today.label}
      </Link>
    )}
    {items.map(item => (
      <Link key={item.id} to={item.path} className="rail-a-room" aria-current={roomActive(item, here) ? 'page' : undefined}>
        {item.label}
      </Link>
    ))}
  </motion.nav>
);

/** Idea B: the rail turned over, each room a glyph with its word under it. */
export const RoomsTurnedOver: React.FC<RailManageProps> = ({ today, items, here }) => (
  <motion.nav
    id="manage-drawer"
    aria-label="Manage"
    initial={{ opacity: 0, rotateY: -70 }}
    animate={{ opacity: 1, rotateY: 0 }}
    transition={{ duration: 0.28, ease: 'easeOut' }}
    className="rail-b-rooms"
  >
    {today && (
      <Link to={today.path} className="rail-b-room" aria-current={here(today.path) ? 'page' : undefined}>
        <SunHorizon className="w-5 h-5" weight="light" aria-hidden="true" />
        <span>{today.label}</span>
      </Link>
    )}
    {items.map(item => (
      <Link key={item.id} to={item.path} className="rail-b-room" aria-current={roomActive(item, here) ? 'page' : undefined}>
        <item.Icon className="w-5 h-5" weight="light" aria-hidden="true" />
        <span>{item.label}</span>
      </Link>
    ))}
  </motion.nav>
);

interface RoomCardProps extends RailManageProps {
  onClose: () => void;
}

/** Idea C: a card rising from the word manage, every room with its screens. The rail never widens. */
export const RoomCard: React.FC<RoomCardProps> = ({ today, items, here, onClose }) => {
  const card = useRef<HTMLElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (card.current?.contains(target)) return;
      if ((target as Element).closest?.('[data-rail-manage-word]')) return;
      onClose();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onDown);
    card.current?.querySelector<HTMLElement>('a')?.focus({ preventScroll: true });
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onDown);
    };
  }, [onClose]);

  return (
    <motion.nav
      ref={card}
      id="manage-drawer"
      aria-label="Manage"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="rail-c-card"
    >
      <div className="rail-c-head">
        <span className="rail-c-title">Manage</span>
        {today && (
          <Link to={today.path} onClick={onClose} className="rail-c-today" aria-current={here(today.path) ? 'page' : undefined}>
            {today.label}
          </Link>
        )}
      </div>
      <div className="rail-c-grid">
        {items.map(item => (
          <div key={item.id} className="rail-c-room">
            <Link to={item.path} onClick={onClose} className="rail-c-room-word" aria-current={here(item.path) ? 'page' : undefined}>
              <item.Icon className="w-4 h-4" weight="light" aria-hidden="true" />
              {item.label}
            </Link>
            {item.children?.map(child => (
              <Link key={child.id} to={child.path} onClick={onClose} className="rail-c-screen" aria-current={here(child.path) ? 'page' : undefined}>
                {child.label}
              </Link>
            ))}
          </div>
        ))}
      </div>
    </motion.nav>
  );
};

/** Idea C keeps one trace of Manage on the rail: the room you are in, in gold, above the word. */
export function currentRoomLabel(props: RailManageProps): string | null {
  if (props.today && props.here(props.today.path)) return props.today.label;
  return props.items.find(item => roomActive(item, props.here))?.label ?? null;
}
