import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { adminRouteHasOwnBack, historyIndex } from './adminHistory';

/**
 * Back and forward for the admin, in the page itself.
 *
 * Adrian, 2026-11-25: "I don't see the place where I can actually click back."
 * On the phone there is no browser bar, and the admin's sections had no back
 * control of their own. This row shows Back once there is somewhere in the site
 * to go back to, and Forward after a Back, reading the position React Router
 * keeps in each history entry. Pages that already carry their own Back at the
 * top left (a vendor, a customer, Curate's header) keep theirs and skip this.
 */

// The furthest entry reached, so Forward knows it has somewhere to go. A new
// step (PUSH) drops everything ahead of it, as the browser does.
let furthestIndex = 0;

export const AdminHistoryBar: React.FC = () => {
  const location = useLocation();
  const navigationType = useNavigationType();
  const navigate = useNavigate();
  const [index, setIndex] = useState(historyIndex);

  useEffect(() => {
    const now = historyIndex();
    if (navigationType === 'PUSH') furthestIndex = now;
    else furthestIndex = Math.max(furthestIndex, now);
    setIndex(now);
  }, [location.key, navigationType]);

  const canBack = index > 0;
  const canForward = index < furthestIndex;
  if (adminRouteHasOwnBack(location.pathname) || (!canBack && !canForward)) return null;

  return (
    <div className="flex-shrink-0 flex items-center gap-1 px-2 md:px-4 lg:px-8 pt-1">
      <button
        type="button"
        onClick={() => navigate(-1)}
        disabled={!canBack}
        aria-label="Back"
        className="tap-target inline-flex items-center gap-1.5 px-2 text-ui-12 text-tea-text-sec hover:text-tea-text disabled:opacity-40 disabled:hover:text-tea-text-sec transition-colors"
      >
        <ArrowLeft size={15} aria-hidden="true" />
        <span>Back</span>
      </button>
      {canForward && (
        <button
          type="button"
          onClick={() => navigate(1)}
          aria-label="Forward"
          className="tap-target inline-flex items-center gap-1.5 px-2 text-ui-12 text-tea-text-sec hover:text-tea-text transition-colors"
        >
          <span>Forward</span>
          <ArrowRight size={15} aria-hidden="true" />
        </button>
      )}
    </div>
  );
};
