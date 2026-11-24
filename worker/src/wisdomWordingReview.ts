import entries from './wisdomWordingEntries.json';
import packets from './wisdomWordingReview.json';

const repairLots = new Set(packets.filter(packet => packet.wasLive).map(packet => packet.id));

const wording: Readonly<Record<string, string>> = entries;

/** These exact public lots carry the reviewed story wherever legacy fields would be read. */
export function applyReviewedWordingFallback(product: Record<string, unknown>) {
  if (typeof product.id !== 'string' || !repairLots.has(product.id)) return;
  product.description = wording[product.id] ?? null;
  product.lore = null;
  product.terroir = null;
  product.processing_notes = null;
}

async function contentRevision(text: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function serveWisdomWordingReview(request: Request, accessStatus: () => Promise<number>) {
  const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response(null, { status: 405, headers });
  const status = await accessStatus();
  if (status !== 200 || request.method === 'HEAD') return new Response(null, { status, headers });
  const rows = await Promise.all(packets.map(async ({ approvedRevision, ...packet }) => {
    const proposed = wording[packet.id] ?? null;
    const revision = proposed === null ? null : await contentRevision(proposed);
    return { ...packet, proposed, revision, approved: revision === approvedRevision };
  }));
  return Response.json(rows, { headers });
}
