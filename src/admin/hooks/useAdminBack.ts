import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { historyIndex } from '../components/adminHistory';

/**
 * Back inside the admin.
 *
 * `navigate(-1)` alone strands anyone who arrived on a page directly (a link, a
 * new tab, the first page of a visit): there is no earlier entry in this site,
 * so the button either does nothing or leaves the site. When there is an
 * earlier entry it steps back to it; otherwise it goes to `fallback`.
 */
export function useAdminBack(fallback = '/admin/compass') {
  const navigate = useNavigate();
  return useCallback(() => {
    if (historyIndex() > 0) navigate(-1);
    else navigate(fallback);
  }, [navigate, fallback]);
}
