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

/** Crossfades route content on path change. */
export const AnimatedRoutes: React.FC<AnimatedRoutesProps> = ({ children, location: locationProp }) => {
  const routerLocation = useLocation();
  const location = locationProp ?? routerLocation;

  /*
   * A CSS animation, deliberately, and no opacity driven from JavaScript.
   *
   * This was a keyed motion.div fading from opacity 0 to 1 over 120ms. When
   * that animation does not run to completion the element keeps the inline
   * opacity: 0 it started with and the whole page is left painted at part
   * strength: the label went grey, the type went grey, everything went grey,
   * and nothing about the page's own colours was wrong. Found in the wild at
   * 0.49 and holding, not animating.
   *
   * The comment this replaces recorded the same failure once already, under
   * AnimatePresence, and the fix was a different way of driving the same
   * JavaScript animation. It came back. So the animation stops being driven
   * from JavaScript: a keyframe cannot stall part way and leave an element
   * stuck, because the element's resting state is its own, and if the
   * animation never runs at all the content is simply visible.
   *
   * The key still forces a remount on a path change, so the fade still plays.
   */
  return (
    <div key={location.pathname} className="animate-[fadeIn_0.12s_ease-out]">
      {children}
    </div>
  );
};
