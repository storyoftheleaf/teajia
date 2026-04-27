import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';

import { useAppStore, selectHasBundle } from '../../lib/store';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';

// Marker the sidebar reads to shortcut the Network parent link straight to
// the catalog after a partner has visited the landing once. Per-account so
// switching accounts shows the landing again on first visit.
export const NETWORK_LANDING_SEEN_KEY = 'teajia.network.landingSeen';

const seenKeyFor = (accountId: string | null | undefined): string =>
  `${NETWORK_LANDING_SEEN_KEY}.${accountId ?? 'none'}`;

export const hasSeenNetworkLanding = (accountId: string | null | undefined): boolean => {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(seenKeyFor(accountId)) === '1';
  } catch {
    return true;
  }
};

const markSeen = (accountId: string | null | undefined): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(seenKeyFor(accountId), '1');
  } catch {
    // localStorage unavailable; the sidebar shortcut just won't activate
  }
};

export const NetworkLanding: React.FC = () => {
  const { memberships, activeAccountId, platformRole } = useAppStore(
    useShallow(s => ({
      memberships: s.memberships,
      activeAccountId: s.activeAccountId,
      platformRole: s.platformRole,
    })),
  );

  const hasCatalog = selectHasBundle({ memberships, activeAccountId, platformRole }, 'catalog');
  const hasSell = selectHasBundle({ memberships, activeAccountId, platformRole }, 'sell');
  const isPlatform = !!platformRole;

  // Mark the landing as visited so the sidebar Network parent shortcuts to
  // the catalog on subsequent visits. Re-readable any time via the catalog
  // header link.
  useEffect(() => {
    markSeen(activeAccountId);
  }, [activeAccountId]);

  return (
    <div className="px-4 md:px-8 pt-10 pb-nav-gap-lg max-w-2xl mx-auto">

      {/* Page heading */}
      <header className="mb-10">
        <p className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-sec mb-3`}>
          The network
        </p>
        <h1 className={`${TYPOGRAPHY_CLASSES.h1} text-tea-text mb-5`}>
          One catalog, many houses.
        </h1>
        <p className="font-body text-[17px] text-tea-text-sec leading-[1.7] italic">
          Teajia is the shared root. Each house carries the teas it knows.
        </p>
      </header>

      {/* Role-adaptive editorial body */}
      <section className="space-y-6 font-body text-[16px] text-tea-text leading-[1.75] mb-12">

        {/* Universal opening — the model */}
        <p>
          A tea on the network has one canonical record. Origin, varietal,
          harvest year, description, photos. That record lives with the
          curator who sources it. Other houses can <em>carry</em> the tea —
          set their own stock, their own retail price, their own store note —
          while the canonical content stays anchored.
        </p>

        <p>
          When a partner sees a typo, an outdated note, or a clearer way to
          describe a tea, they edit the canonical content in place on the
          card. The change goes to the curator's queue. The curator decides,
          field by field. Accepted changes apply everywhere immediately.
        </p>

        {/* Platform / curator perspective */}
        {isPlatform && (
          <p>
            You are the curator behind most of the canonical content here.
            Partners carrying your teas will surface edits in your
            suggestions queue. Tea Masters who originated profiles can offer
            their teas up for the wider network — those land in your
            adoption queue. Wholesale runs the other direction: partners
            order from you when they need stock.
          </p>
        )}

        {/* Partner perspective — has Catalog bundle but not platform */}
        {hasCatalog && !isPlatform && (
          <p>
            For your house, the network means two things. You can carry
            anything Adrian curates without re-entering the canonical
            content yourself — pick a tea, set your stock and price, your
            shop has it. You can also propose edits to any canonical field
            on any tea you carry. Adrian sees them, decides per field, and
            accepted changes update on your storefront automatically.
          </p>
        )}

        {/* Wholesale perspective — has Sell bundle */}
        {hasSell && !isPlatform && (
          <p>
            Wholesale orders move stock between houses. Draft an order from
            the catalog, submit it, the supplier confirms and ships. When
            received, your stock and theirs adjust together, and bilateral
            invoices generate on both sides. The whole exchange is one
            timeline both parties can read.
          </p>
        )}

        {/* No-bundle fallback (rare — sidebar usually hides this destination) */}
        {!hasCatalog && !hasSell && !isPlatform && (
          <p className="italic text-tea-text-sec">
            Your account doesn't yet have the bundles that open the
            network's working surfaces. Ask your owner about Catalog or Sell.
          </p>
        )}
      </section>

      {/* Destination index — woven as text-links, not a card grid */}
      <section className="border-t border-tea-border pt-8">
        <p className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-sec mb-5`}>
          Where to go
        </p>

        <ul className="space-y-5">
          {hasCatalog && (
            <li>
              <Link
                to="/admin/network/catalog"
                className="group block"
              >
                <span className="font-display text-[20px] text-tea-text group-hover:text-tea-gold transition-colors">
                  Carry from network
                  <span className="font-body text-tea-text-sec group-hover:text-tea-gold ml-1">→</span>
                </span>
                <p className="font-body text-[14px] text-tea-text-sec leading-[1.6] mt-1">
                  Browse the catalog. Pick what belongs in your house.
                </p>
              </Link>
            </li>
          )}

          {hasCatalog && (
            <li>
              <Link
                to="/admin/network/suggestions"
                className="group block"
              >
                <span className="font-display text-[20px] text-tea-text group-hover:text-tea-gold transition-colors">
                  Suggestions
                  <span className="font-body text-tea-text-sec group-hover:text-tea-gold ml-1">→</span>
                </span>
                <p className="font-body text-[14px] text-tea-text-sec leading-[1.6] mt-1">
                  {isPlatform
                    ? 'Edits partners have proposed to your canonical content. Decide field by field.'
                    : 'Edits you have proposed, and edits coming back from your own canonical.'}
                </p>
              </Link>
            </li>
          )}

          {hasSell && (
            <li>
              <Link
                to="/admin/network/wholesale"
                className="group block"
              >
                <span className="font-display text-[20px] text-tea-text group-hover:text-tea-gold transition-colors">
                  Wholesale
                  <span className="font-body text-tea-text-sec group-hover:text-tea-gold ml-1">→</span>
                </span>
                <p className="font-body text-[14px] text-tea-text-sec leading-[1.6] mt-1">
                  Orders moving stock between houses. Drafts, in flight, received.
                </p>
              </Link>
            </li>
          )}

          {isPlatform && (
            <li>
              <Link
                to="/admin/network/adoptions"
                className="group block"
              >
                <span className="font-display text-[20px] text-tea-text group-hover:text-tea-gold transition-colors">
                  Adoptions
                  <span className="font-body text-tea-text-sec group-hover:text-tea-gold ml-1">→</span>
                </span>
                <p className="font-body text-[14px] text-tea-text-sec leading-[1.6] mt-1">
                  Tea Masters offering their profiles up for the wider network.
                  Adopt to publish, decline with a note.
                </p>
              </Link>
            </li>
          )}
        </ul>
      </section>
    </div>
  );
};

export default NetworkLanding;
