import { loadPublicTransport } from './load-preview.mjs';

const ENDPOINT = '/__tea-reference-preview';
const GENERIC_ERROR = Object.freeze({ error: 'Tea Reference preview could not be loaded.' });

export function teaReferencePreviewPlugin({ command, mode, handoffPath }) {
  if (command !== 'serve' || mode !== 'tea-reference-preview') return null;

  return {
    name: 'tea-reference-teajia-preview',
    configureServer(server) {
      let transportPromise;
      server.middlewares.use(async (request, response, next) => {
        if (request.url?.split('?')[0] !== ENDPOINT) return next();

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
