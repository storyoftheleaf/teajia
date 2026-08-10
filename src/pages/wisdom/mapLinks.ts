export interface MapSearchLink {
  label: string;
  url: string;
}

/**
 * Opens a provider search rather than pretending the reference holds precise
 * coordinates. Apple Maps is the dependable choice for Chinese places;
 * elsewhere the familiar cross-platform Google Maps URL is used.
 */
export function mapSearchLink(parts: readonly (string | undefined)[], country: string): MapSearchLink {
  const query = [...new Set([...parts, country].filter((value): value is string => Boolean(value?.trim())))]
    .join(', ');
  if (country === 'China') {
    return { label: 'Open in Apple Maps', url: `https://maps.apple.com/?q=${encodeURIComponent(query)}` };
  }
  return {
    label: 'Open in Google Maps',
    url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`,
  };
}
