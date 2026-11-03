/** All authentication entries share one destination rule. Never use browser
 * history as a return destination: it may point to another authentication page. */
export function safeAuthReturnTo(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return undefined;
  try {
    const decoded = decodeURIComponent(value);
    if (/[\\\u0000-\u001f\u007f]/.test(decoded) || decoded.startsWith('//')) return undefined;
    const url = new URL(value, 'https://teajia.com');
    if (url.origin !== 'https://teajia.com') return undefined;
    const path = decodeURIComponent(url.pathname).replace(/\/+$/, '').toLowerCase();
    if (['/signin', '/signup', '/login', '/reset-password'].includes(path)) return undefined;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return undefined;
  }
}

export function authReturnTo(...candidates: unknown[]): string {
  for (const candidate of candidates) {
    const safe = safeAuthReturnTo(candidate);
    if (safe) return safe;
  }
  return '/account';
}

export function authPagePath(mode: 'signin' | 'signup', returnTo?: unknown): string {
  const safe = safeAuthReturnTo(returnTo);
  return `/${mode}${safe ? `?${new URLSearchParams({ returnTo: safe })}` : ''}`;
}
