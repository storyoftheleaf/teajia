/** Only these query families may survive a browser restart. Private admin data stays in memory. */
export function shouldPersistQueryKey(queryKey: readonly unknown[]): boolean {
  const [family, audience] = queryKey;
  if (family === 'products') return audience === 'public';
  if (family === 'events') return audience === 'public';
  return family === 'rates' || family === 'public-catalogue';
}
