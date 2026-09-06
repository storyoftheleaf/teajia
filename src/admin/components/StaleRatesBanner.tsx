import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useRates } from '../hooks/useAdminData';

/**
 * Says out loud when the exchange rates have stopped being refreshed.
 *
 * The shop deliberately keeps selling on an old rate: yesterday's rate beats no
 * price at all, and the difference is a fraction of a percent. What that trade
 * needs is a floor, because the property that makes it safe for a day makes it
 * invisible for a month. A rate carries no sign of its own age, every price on
 * the site converts through one, and the last time this went wrong the shop
 * priced Indonesia 8% under the market for months with nothing on any screen to
 * say so.
 *
 * Three days, because the refresh runs hourly. One missed hour is nothing and
 * one missed day is a bad afternoon at the feed; three days is a thing that has
 * stopped and will not start on its own.
 *
 * Actionable rather than decorative: it opens the screen where a rate can be
 * corrected by hand, which is the whole reason to be told.
 */

/** Past this many days without a refresh, the rates are a problem worth naming. */
export const STALE_RATES_AFTER_DAYS = 3;

/** Days since a rate was refreshed. Null when it has never been, or cannot be read. */
function ageInDays(lastUpdated: string | null | undefined): number | null {
  if (!lastUpdated) return null;
  const at = new Date(/[Z+]/.test(lastUpdated) ? lastUpdated : `${lastUpdated.replace(' ', 'T')}Z`).getTime();
  if (!Number.isFinite(at)) return null;
  return (Date.now() - at) / 86400000;
}

export const StaleRatesBanner: React.FC = () => {
  const navigate = useNavigate();
  const { data: rates = [] } = useRates();

  // No rates at all is a different condition, and the surfaces handle it by
  // quoting the shop's own USD. This is about rates that exist and have stopped.
  if (rates.length === 0) return null;

  const ages = rates.map(r => ageInDays(r.lastUpdated));
  const neverRefreshed = ages.filter(a => a === null).length;
  const oldest = ages.reduce<number>((max, a) => (a !== null && a > max ? a : max), 0);
  if (neverRefreshed === 0 && oldest <= STALE_RATES_AFTER_DAYS) return null;

  const days = Math.round(oldest);
  const detail = neverRefreshed > 0 && oldest <= STALE_RATES_AFTER_DAYS
    ? `${neverRefreshed} ${neverRefreshed === 1 ? 'rate has' : 'rates have'} never been refreshed.`
    : `The oldest was last refreshed ${days} ${days === 1 ? 'day' : 'days'} ago.`;

  return (
    <div
      role="alert"
      className="flex items-start gap-3 px-4 py-2.5 bg-tea-elevated border-b border-tea-border"
    >
      <AlertTriangle size={16} className="text-tea-error mt-0.5 shrink-0" aria-hidden />
      <p className="text-ui-13 text-tea-text-sec leading-[1.5] flex-1 min-w-0">
        <span className="text-tea-text">Exchange rates have stopped refreshing.</span>{' '}
        {detail} Every price on the site converts through these, so the shop is quoting an old dollar.
      </p>
      <button
        type="button"
        onClick={() => navigate('/admin/currency')}
        className="tap-target shrink-0 text-ui-13 text-tea-text-sec hover:text-tea-text underline underline-offset-2"
      >
        Check rates
      </button>
    </div>
  );
};
