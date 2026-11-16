/**
 * Legacy admin redirects keep the incoming query string. The target's own
 * params win, so a redirect to "?tab=orders" stays on Orders whatever the old
 * link carried, and nothing is repeated.
 */
export function carryQuery(target: string, incoming: string): string {
  const [path, own = ''] = target.split('?');
  const merged = new URLSearchParams(own);
  new URLSearchParams(incoming).forEach((value, key) => {
    if (!merged.has(key)) merged.append(key, value);
  });
  const query = merged.toString();
  return query ? `${path}?${query}` : path;
}
