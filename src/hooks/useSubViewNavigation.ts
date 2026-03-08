import { useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * useSubViewNavigation — URL-synced sub-view state with browser history support
 *
 * Replaces local `useState<View>` for sections that have sub-views.
 * Each sub-view gets a real URL search param (?v=glossary), so:
 *   - Browser back button goes to the parent view, not the previous section
 *   - Deep links work (/learn?v=glossary opens glossary directly)
 *   - Refreshing preserves the current sub-view
 *
 * Usage:
 *   const { currentView, navigateTo, navigateBack, isSubView } = useSubViewNavigation('v', 'overview');
 */
export function useSubViewNavigation<T extends string>(
  paramKey: string = 'v',
  defaultView: T = 'overview' as T,
): {
  currentView: T;
  navigateTo: (view: T) => void;
  navigateBack: () => void;
  isSubView: boolean;
} {
  const [searchParams, setSearchParams] = useSearchParams();
  const isInitialMount = useRef(true);

  // Derive current view from URL
  const rawView = searchParams.get(paramKey);
  const currentView = (rawView || defaultView) as T;
  const isSubView = currentView !== defaultView;

  // Navigate to a sub-view — pushes a new history entry
  const navigateTo = useCallback((view: T) => {
    if (view === defaultView) {
      // Going back to default: remove the param
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete(paramKey);
        return next;
      }, { replace: false });
    } else {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set(paramKey, view);
        return next;
      }, { replace: false });
    }
    window.scrollTo(0, 0);
  }, [paramKey, defaultView, setSearchParams]);

  // Navigate back to the default view
  const navigateBack = useCallback(() => {
    // Use history.back() if we came from a sub-view, so the browser
    // back stack stays clean. Otherwise just navigate directly.
    if (isSubView) {
      window.history.back();
    }
  }, [isSubView]);

  // Scroll to top on initial sub-view load (deep link)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      if (isSubView) {
        window.scrollTo(0, 0);
      }
    }
  }, []);

  return { currentView, navigateTo, navigateBack, isSubView };
}
