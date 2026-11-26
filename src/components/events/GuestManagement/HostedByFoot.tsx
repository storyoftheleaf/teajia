import React from 'react';
import { Link } from 'react-router-dom';
import type { TeaEvent } from '../../../types/events';

/**
 * Who hosts, for the foot of a guest's page: the same rule as "Hosted by" on
 * the session's public page (worker/src/sessionHost.ts). A shop's session
 * that names nobody keeps "Hosted by Teajia"; a person's table that names
 * nobody says nothing. Launch 2, check run H13, finding 4.
 */
export function hostedByWords(event: Pick<TeaEvent, 'host' | 'privateHost'>): { name: string; path: string | null } | null {
  if (event.host) return event.host;
  return event.privateHost ? null : { name: 'Teajia', path: null };
}

const HostedByFoot: React.FC<{ event: TeaEvent; className: string }> = ({ event, className }) => {
  const host = hostedByWords(event);
  if (!host) return null;
  return (
    <p className={className} data-testid="guest-page-host">
      Hosted by{' '}
      {host.path
        ? <Link to={host.path} className="tap-target hover:text-tea-text transition-colors">{host.name}</Link>
        : host.name}
    </p>
  );
};

export default HostedByFoot;
