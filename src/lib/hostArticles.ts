// Launch 4, K9. Explicit site or worker settings override the default.
export const HOST_ARTICLES_OPEN = false;

type Env = { HOST_ARTICLES_OPEN?: string } | null | undefined;

export function hostArticlesOpen(env?: Env): boolean {
  if (env?.HOST_ARTICLES_OPEN === 'true') return true;
  if (env?.HOST_ARTICLES_OPEN === 'false') return false;
  let site: string | undefined;
  try {
    site = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_HOST_ARTICLES_OPEN;
  } catch {
    site = undefined;
  }
  if (site === 'true') return true;
  if (site === 'false') return false;
  return HOST_ARTICLES_OPEN;
}
