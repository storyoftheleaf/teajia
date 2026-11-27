import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useStepParam } from '../../hooks/useStepParam';
import { API_URL } from '../../lib/api';
import { teaTableOpen } from '../../lib/teaTable';

// Tea spaces, step 4 (todo/plans/tea-spaces.md): "Serves at tables" is a tap.
// It opens a short list on the person's page: their own tea spaces first, then
// other spaces they have served in. Names only: no count, no dates. A private
// space shows by its area alone (worker/src/servesAt.ts). Opening the list is
// a step in the address (?serves=open), so back closes it.

export type ServesAtSpace = { label: string; house_slug?: string };
export type ServesAtAnswer = { own: ServesAtSpace[]; served: ServesAtSpace[] };

export const SERVES_AT_STEP = 'serves';

export function servesAtPath(slug: string) {
  return `/people/${encodeURIComponent(slug)}?${SERVES_AT_STEP}=open`;
}

async function fetchServesAt(slug: string, signal?: AbortSignal): Promise<ServesAtAnswer | null> {
  const response = await fetch(`${API_URL}/api/public/people/${encodeURIComponent(slug)}/spaces`, { signal });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Could not load where they serve.');
  return response.json();
}

function SpaceList({ label, spaces, testId }: { label: string; spaces: ServesAtSpace[]; testId: string }) {
  if (!spaces.length) return null;
  return (
    <div className="mt-3" data-testid={testId}>
      <p className="text-ui-12 text-tea-text-sec">{label}</p>
      <ul className="mt-1 space-y-1">
        {spaces.map(space => (
          <li key={space.label} className="text-ui-14 text-tea-text">
            {space.house_slug
              ? <Link to={`/tea-houses/work/${encodeURIComponent(space.house_slug)}`} className="tap-target underline decoration-tea-border underline-offset-4 hover:text-tea-text-sec">{space.label}</Link>
              : space.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ServesAt(props: { slug: string; className?: string }) {
  // Closed with the line itself: renders nothing and asks the worker nothing.
  if (!teaTableOpen()) return null;
  return <ServesAtOpen {...props} />;
}

function ServesAtOpen({ slug, className = '' }: { slug: string; className?: string }) {
  const [step, setStep] = useStepParam(SERVES_AT_STEP);
  const answer = useQuery({
    queryKey: ['person-serves-at', slug],
    queryFn: ({ signal }) => fetchServesAt(slug, signal),
    staleTime: 5 * 60_000,
    retry: false,
  });
  const own = answer.data?.own ?? [];
  const served = answer.data?.served ?? [];
  if (!own.length && !served.length) return null;
  const open = step === 'open';

  return (
    <div className={className} data-testid="serves-at">
      <button
        type="button"
        className="tap-target font-sans text-ui-13 text-tea-text-sec underline decoration-tea-border underline-offset-4 hover:text-tea-text"
        aria-expanded={open}
        aria-controls="serves-at-list"
        onClick={() => setStep(open ? null : 'open')}
      >
        Serves at tables
      </button>
      {open && (
        <div id="serves-at-list" data-testid="serves-at-list">
          <SpaceList label="Their tea spaces" spaces={own} testId="serves-at-own" />
          <SpaceList label="Has also served at" spaces={served} testId="serves-at-served" />
        </div>
      )}
    </div>
  );
}
