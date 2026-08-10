#!/usr/bin/env node
import path from 'node:path';
import react from '@vitejs/plugin-react';
import { createServer } from 'vite';
import { parsePreviewArgs } from './args.mjs';
import { loadReceivingPreview, REPO_ROOT } from './load-preview.mjs';

try {
  const options = parsePreviewArgs(process.argv.slice(2));
  const preview = await loadReceivingPreview(options);
  const publicPayload = `${JSON.stringify(preview.publicPreview)}\n`;
  const server = await createServer({
    root: REPO_ROOT,
    configFile: false,
    appType: 'mpa',
    plugins: [
      react(),
      {
        name: 'tea-reference-public-preview-data',
        configureServer(viteServer) {
          viteServer.middlewares.use((request, response, next) => {
            if (request.url?.split('?')[0] !== '/__tea-reference-preview.json') return next();
            response.statusCode = 200;
            response.setHeader('Content-Type', 'application/json; charset=utf-8');
            response.setHeader('Cache-Control', 'no-store');
            response.end(publicPayload);
          });
        },
      },
    ],
    resolve: { alias: { '@': path.join(REPO_ROOT, 'src') } },
    server: {
      host: 'localhost',
      port: options.port,
      strictPort: true,
      open: options.open ? '/scripts/tea-reference-website-preview/index.html' : false,
    },
  });
  await server.listen();
  server.printUrls();

  const close = async () => {
    await server.close();
    process.exit(0);
  };
  process.once('SIGINT', close);
  process.once('SIGTERM', close);
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
