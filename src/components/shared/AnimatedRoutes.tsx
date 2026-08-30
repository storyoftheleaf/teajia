import React from 'react';
import { useLocation, type Location } from 'react-router-dom';

interface AnimatedRoutesProps {
  children: React.ReactNode;
  /**
   * The location the inner <Routes> actually render (defaults to the router
   * location). App.tsx passes the background location while a product modal
   * is open so the crossfade keys off the page underneath. Otherwise opening
   * the modal would remount the shop and destroy its scroll/filter state.
   */
  location?: Location;
}

/**
 * Renders route content. No fade.
 *
 * This was a 120ms crossfade, first driven by framer-motion and then by a CSS
 * keyframe, and both forms start the page at opacity 0. Anything that starts a
 * page invisible and relies on an animation completing to reveal it will
 * eventually not complete: an interrupted frame, a throttled background tab, a
 * device under load. It was found stalled twice, once at 0.49 and once at 0.11,
 * and both times the whole page read as washed out grey while every colour on
 * it was correct.
 *
 * A tenth of a second of crossfade is not worth a page that can fail to
 * appear. Route content is simply visible. The component stays because
 * App.tsx passes it the background location while a product modal is open,
 * and because keying on the pathname still remounts the tree on a real
 * navigation, which is the part that mattered.
 */
export const AnimatedRoutes: React.FC<AnimatedRoutesProps> = ({ children, location: locationProp }) => {
  const routerLocation = useLocation();
  const location = locationProp ?? routerLocation;
  return <div key={location.pathname}>{children}</div>;
};
