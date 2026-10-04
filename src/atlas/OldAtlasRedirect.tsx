import { Navigate, useLocation } from 'react-router-dom';
import { ATLAS_ROOT, OLD_ATLAS_ROOT } from './atlasPaths';

/** Sends an old /tea-atlas link to the same page under /atlas. */
export default function OldAtlasRedirect() {
  const { pathname, search, hash } = useLocation();
  return <Navigate to={ATLAS_ROOT + pathname.slice(OLD_ATLAS_ROOT.length) + search + hash} replace />;
}
