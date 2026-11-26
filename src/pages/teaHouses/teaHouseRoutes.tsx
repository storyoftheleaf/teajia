import { Suspense, type ComponentType } from 'react';
import { Route } from 'react-router-dom';
import { ErrorBoundary } from '../../admin/components/ErrorBoundary';
import { EmblemLoader } from '../../components/shared/EmblemLoader';
import { lazyWithRetry } from '../../lib/lazyWithRetry';
import { teaHousesOpen } from '../../lib/teaHouses';

/**
 * The Tea Houses section's routes, kept out of App.tsx, which is past its
 * length ceiling. Visit (K5 part one), Overview, Build, Work and each
 * house's portfolio page (K5 part two) are behind TEA_HOUSES_OPEN. Closed,
 * none is registered, so each address answers exactly as an address that
 * does not exist (A4 review, finding 12).
 */
const TeaHousesVisitPage = lazyWithRetry(() => import('../TeaHousesVisitPage'));
const TeaHousesOverviewPage = lazyWithRetry(() => import('./TeaHousesOverviewPage'));
const TeaHousesBuildPage = lazyWithRetry(() => import('./TeaHousesBuildPage'));
const TeaHousesWorkPage = lazyWithRetry(() => import('./TeaHousesWorkPage'));
const TeaHousePortfolioPage = lazyWithRetry(() => import('./TeaHousePortfolioPage'));

const page = (Page: ComponentType) => <ErrorBoundary><Suspense fallback={<EmblemLoader />}><Page /></Suspense></ErrorBoundary>;

/** Called inside the site's <Routes>, as `{teaHouseRoutes()}`. */
export function teaHouseRoutes() {
  if (!teaHousesOpen()) return [];
  return [
    <Route key="visit" path="/tea-houses/visit" element={page(TeaHousesVisitPage)} />,
    <Route key="overview" path="/tea-houses" element={page(TeaHousesOverviewPage)} />,
    <Route key="build" path="/tea-houses/build" element={page(TeaHousesBuildPage)} />,
    <Route key="work" path="/tea-houses/work" element={page(TeaHousesWorkPage)} />,
    <Route key="house" path="/tea-houses/work/:slug" element={page(TeaHousePortfolioPage)} />,
  ];
}
