import { Suspense, type ComponentType } from 'react';
import { Navigate, Route } from 'react-router-dom';
import { ErrorBoundary } from '../../admin/components/ErrorBoundary';
import { EmblemLoader } from '../../components/shared/EmblemLoader';
import { lazyWithRetry } from '../../lib/lazyWithRetry';
import { teaHousesOpen } from '../../lib/teaHouses';

/**
 * The Tea Houses section's routes, kept out of App.tsx, which is past its
 * length ceiling. Visit (K5 part one) is always there. Overview, Build, Work
 * and each house's portfolio page (K5 part two) are behind TEA_HOUSES_OPEN;
 * closed, they forward to Visit.
 */
const TeaHousesVisitPage = lazyWithRetry(() => import('../TeaHousesVisitPage'));
const TeaHousesOverviewPage = lazyWithRetry(() => import('./TeaHousesOverviewPage'));
const TeaHousesBuildPage = lazyWithRetry(() => import('./TeaHousesBuildPage'));
const TeaHousesWorkPage = lazyWithRetry(() => import('./TeaHousesWorkPage'));
const TeaHousePortfolioPage = lazyWithRetry(() => import('./TeaHousePortfolioPage'));

const page = (Page: ComponentType) => <ErrorBoundary><Suspense fallback={<EmblemLoader />}><Page /></Suspense></ErrorBoundary>;
const portfolio = (Page: ComponentType) => (teaHousesOpen() ? page(Page) : <Navigate to="/tea-houses/visit" replace />);

/** Called inside the site's <Routes>, as `{teaHouseRoutes()}`. */
export function teaHouseRoutes() {
  return [
    <Route key="visit" path="/tea-houses/visit" element={page(TeaHousesVisitPage)} />,
    <Route key="overview" path="/tea-houses" element={portfolio(TeaHousesOverviewPage)} />,
    <Route key="build" path="/tea-houses/build" element={portfolio(TeaHousesBuildPage)} />,
    <Route key="work" path="/tea-houses/work" element={portfolio(TeaHousesWorkPage)} />,
    <Route key="house" path="/tea-houses/work/:slug" element={portfolio(TeaHousePortfolioPage)} />,
  ];
}
