/** Where this entry sits in the visit, as React Router's BrowserRouter records it. */
export function historyIndex(): number {
  if (typeof window === 'undefined') return 0;
  const idx = (window.history.state as { idx?: unknown } | null)?.idx;
  return typeof idx === 'number' && idx > 0 ? idx : 0;
}

/**
 * Admin pages that already put their own Back at the top left. The shared
 * back row stays off these so a page never shows two.
 */
const OWN_BACK: RegExp[] = [
  /^\/admin\/(compass|compass-playbook|compass-current)(\/|$)/, // Curate's header back
  /^\/admin\/vendors\/[^/]+/,
  /^\/admin\/people\/[^/]+/,
  /^\/admin\/products\/[^/]+/,
  /^\/admin\/events\/[^/]+/,
  /^\/admin\/tasting-events\/[^/]+/,
  /^\/admin\/collections\/[^/]+/,
  /^\/admin\/platform\/(audit-log|all-stock)/,
];

export function adminRouteHasOwnBack(pathname: string): boolean {
  return OWN_BACK.some(pattern => pattern.test(pathname));
}
