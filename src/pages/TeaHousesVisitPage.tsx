import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { Account, NetworkNextSession } from '../types';
import { fetchNetworkStores } from '../lib/storefrontApi';
import { SectionSkeleton } from '../components/shared/SectionSkeleton';
import { TYPOGRAPHY_CLASSES as T } from '../designTokens';
import { useTeaHouseWork } from '../lib/teaHousesApi';
import { teaHousePagePath } from '../lib/teaHousesContract';

/**
 * Visit: the tea houses a person can sit down at. One list from the network
 * directory (GET /api/network/stores), which alone decides who is listed: a
 * public account that chose to be shown. Each house opens its own page at
 * /store/:slug. No map, no distance, no "near you": a list of places, in the
 * directory's own order.
 *
 * A house Adrian worked on, whose portfolio page he has shown, carries one
 * more line under it leading to that page (behind TEA_HOUSES_OPEN). A house
 * he did not work on is here all the same, without it.
 */

function sessionWhen(value: string): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long' });
}

function ComingSession({ session }: { session: NetworkNextSession }) {
  const when = sessionWhen(session.event_date);
  return (
    <p className={`${T.bodyLight} text-tea-text-sec mt-2`} data-testid="house-next-session">
      <span className="text-tea-text-dim">Coming session: </span>
      {session.title}
      {when && <span className="text-tea-text-dim">, {when}</span>}
    </p>
  );
}

function HouseRow({ house, hasPortfolio }: { house: Account; hasPortfolio: boolean }) {
  const place = [house.location_city, house.location_country].filter(Boolean).join(', ');
  return (
    <li className="flex flex-col gap-1">
      <Link
        to={`/store/${encodeURIComponent(house.slug)}`}
        className="group flex flex-col sm:flex-row gap-4 p-4 bg-tea-surface border border-tea-border rounded-xl hover:border-tea-gold focus-visible:border-tea-gold transition-colors"
      >
        {house.cover_image_url && (
          <img
            src={house.cover_image_url}
            alt=""
            loading="lazy"
            className="w-full sm:w-48 aspect-[3/2] object-cover rounded-md bg-tea-elevated flex-shrink-0"
          />
        )}
        <div className="min-w-0 flex-1">
          <h2 className={`${T.h3} text-tea-text break-words`}>{house.name}</h2>
          {place && <p className={`${T.bodyLight} text-tea-text-dim mt-1`}>{place}</p>}
          {house.tagline && <p className={`${T.body} text-tea-text-sec mt-2 break-words`}>{house.tagline}</p>}
          {house.next_session && <ComingSession session={house.next_session} />}
        </div>
      </Link>
      {hasPortfolio && (
        <Link
          to={teaHousePagePath(house.slug)}
          className={`${T.link} tap-target inline-flex items-center self-start px-4`}
          data-testid="house-portfolio-link"
        >
          Adrian's part in this house
        </Link>
      )}
    </li>
  );
}

export default function TeaHousesVisitPage() {
  const { data: houses = [], isLoading, isError } = useQuery<Account[]>({
    queryKey: ['network', 'stores'],
    queryFn: fetchNetworkStores,
    staleTime: 1000 * 60 * 5,
  });
  const work = useTeaHouseWork();
  const withPortfolio = new Set((work.data?.houses ?? []).map(house => house.slug));

  return (
    <div className="w-full max-w-3xl mx-auto pt-12 pb-16" data-testid="tea-houses-visit">
      <Helmet>
        <title>Find a tea house | Teajia</title>
        <meta
          name="description"
          content="Tea houses in the Teajia network, each independent, each with its own character. Choose one to visit."
        />
      </Helmet>

      <header className="text-center mb-8">
        <p className={`${T.label} text-tea-text-dim mb-3`}>Visit</p>
        <h1 className={`${T.h1} mb-4`}>Find a tea house</h1>
        <p className={T.subtitle}>
          Each house is independent, with its own voice and its own table. Choose one to visit.
        </p>
      </header>

      {isLoading && <SectionSkeleton variant="grid" />}

      {isError && (
        <p className={`${T.body} text-center text-tea-text-sec py-12`}>
          The tea houses could not be loaded just now.
        </p>
      )}

      {!isLoading && !isError && houses.length === 0 && (
        <div className="text-center py-12" data-testid="visit-empty">
          <p className={`${T.body} text-tea-text-sec`}>No tea houses are open to visitors yet.</p>
          <Link to="/events" className={`${T.link} inline-flex items-center tap-target mt-3`}>
            See the sessions
          </Link>
        </div>
      )}

      {houses.length > 0 && (
        <ul className="flex flex-col gap-4" aria-label="Tea houses">
          {houses.map(house => <HouseRow key={house.id} house={house} hasPortfolio={withPortfolio.has(house.slug)} />)}
        </ul>
      )}
    </div>
  );
}
