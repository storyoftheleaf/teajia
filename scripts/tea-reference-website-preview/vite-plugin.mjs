import { loadPublicTransport } from './load-preview.mjs';

const ENDPOINT = '/__tea-reference-preview';
const PUBLIC_PRODUCTS_ENDPOINT = '/api/products/public';
const PUBLIC_PRODUCTS_URL = 'https://www.teajia.com/api/products/public';
const GENERIC_ERROR = Object.freeze({ error: 'Tea Reference preview could not be loaded.' });
const PRODUCTS_ERROR = Object.freeze({ error: 'Public tea catalogue could not be loaded.' });
const READ_ONLY_ERROR = Object.freeze({ error: 'Tea Reference preview is read-only.' });

export function teaReferencePreviewPlugin({ command, mode, handoffPath, fetchPublicProducts = fetch }) {
  if (command !== 'serve' || mode !== 'tea-reference-preview') return null;

  return {
    name: 'tea-reference-teajia-preview',
    configureServer(server) {
      let transportPromise;
      let productsPromise;
      server.middlewares.use(async (request, response, next) => {
        const pathname = request.url?.split('?')[0];
        if (pathname === PUBLIC_PRODUCTS_ENDPOINT) {
          response.setHeader('Cache-Control', 'no-store');
          response.setHeader('Content-Type', 'application/json; charset=utf-8');
          if ((request.method ?? 'GET') !== 'GET') {
            response.statusCode = 405;
            response.end(`${JSON.stringify(READ_ONLY_ERROR)}\n`);
            return;
          }
          try {
            productsPromise ??= fetchPublicProducts(PUBLIC_PRODUCTS_URL, {
              headers: { Accept: 'application/json' },
            }).then(async upstream => {
              if (!upstream.ok) throw new Error('public products request failed');
              const products = await upstream.json();
              if (!Array.isArray(products)) throw new Error('public products response was not an array');
              return products;
            });
            const products = await productsPromise;
            response.statusCode = 200;
            response.end(`${JSON.stringify(products)}\n`);
          } catch {
            productsPromise = undefined;
            response.statusCode = 502;
            response.end(`${JSON.stringify(PRODUCTS_ERROR)}\n`);
          }
          return;
        }

        if (pathname !== ENDPOINT) return next();

        response.setHeader('Cache-Control', 'no-store');
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        try {
          transportPromise ??= loadPublicTransport({ handoffPath });
          const transport = await transportPromise;
          response.statusCode = 200;
          response.end(`${JSON.stringify(transport)}\n`);
        } catch {
          response.statusCode = 422;
          response.end(`${JSON.stringify(GENERIC_ERROR)}\n`);
        }
      });
    },
  };
}
