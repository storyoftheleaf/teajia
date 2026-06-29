// Cloudflare Pages Function — same-origin API proxy (mainland-China reachability).
//
// The Great Firewall blocks/resets the `api.teajia.com` hostname while
// `teajia.com` itself stays reachable: the SPA shell loads but every API call
// dies with "Couldn't reach the server". It's the subdomain/SNI that's filtered,
// NOT Cloudflare's edge IPs (if those were blocked the page wouldn't load at
// all). So we let the app call the API on its OWN origin (`teajia.com/api/*`)
// and forward each request to the Worker from the edge — where the firewall
// never sits between Cloudflare Pages and the Worker. Customers in China get a
// working API over the one hostname that already works.
//
// The frontend points its API base at `window.location.origin` (see
// `src/lib/api.ts` / `src/lib/storefrontApi.ts`); this catch-all handles every
// `/api/*` request that results.
//
// `redirect: 'manual'` is essential: handleGoogleAuth answers with a 302 to
// accounts.google.com, and we must hand that 302 back to the browser rather
// than follow it edge-side (which would return Google's HTML under /api/...).

const WORKER_ORIGIN = 'https://teajia-api.lightcodes.workers.dev';

export const onRequest: PagesFunction = async ({ request }) => {
  const incoming = new URL(request.url);
  const target = new URL(incoming.pathname + incoming.search, WORKER_ORIGIN);
  try {
    // Passing the original Request as init copies method, headers, and body
    // (including streamed upload bodies) faithfully; only the destination host
    // changes. The fetch init then forces manual redirect handling.
    return await fetch(new Request(target.toString(), request), { redirect: 'manual' });
  } catch {
    return new Response(
      JSON.stringify({ error: 'Upstream API unreachable. Please try again.' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    );
  }
};
