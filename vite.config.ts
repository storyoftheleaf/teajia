import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'fs';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_');
  return {
    base: '/',
    server: {
      port: 7777,
      strictPort: true,
      host: 'localhost',
      cors: true,
      watch: {
        usePolling: true,
        interval: 500,
      },
    },
    preview: {
      port: 4173,
      host: 'localhost',
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        workbox: {
          // Precache ONLY the tiny shell (entry page, icon, fonts) — NOT the
          // multi-MB JS/CSS chunks. A small precache finishes installing even on
          // a firewalled/jumpy connection, so the service worker actually updates
          // to each new build instead of leaving a browser pinned on an old one
          // (which was surfacing as "Failed to fetch dynamically imported module
          // .../AdminApp-*.js"). The hashed /assets/* files are cached on demand
          // by the runtime rules below (fonts included).
          globPatterns: ['**/*.html'],
          // Drop superseded precaches when a new service worker activates.
          cleanupOutdatedCaches: true,
          // Never serve the SPA shell for API paths — they must always hit the
          // network (and the edge proxy / Worker), including the Google OAuth
          // top-level navigation to /api/auth/google.
          navigateFallbackDenylist: [/^\/api\//, /^\/media\//, /^\/mcp/, /^\/oauth/, /^\/\.well-known/],
          runtimeCaching: [
            {
              // Hashed app scripts + styles. Content-hashed per build, so once a
              // given file is cached it never changes — CacheFirst is safe and
              // fast. A new build ships new filenames (via the freshly-updated
              // index), which simply miss and fetch once. Deliberately NOT
              // precached so the install stays tiny and always completes.
              urlPattern: ({ url }) => url.pathname.startsWith('/assets/') || url.pathname.startsWith('/fonts/'),
              handler: 'CacheFirst',
              options: {
                cacheName: 'assets-cache',
                expiration: { maxEntries: 250, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
            {
              // Same-origin API reads (the app now calls /api/* on its own
              // origin via the China-reachable Pages proxy). NetworkFirst lets
              // a jumpy/firewalled GET fall back to the last-good response
              // instead of failing outright. POSTs (login etc.) are never
              // cached by Workbox, so auth always goes to the network.
              urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-cache',
                expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 },
              },
            },
            {
              urlPattern: /^https:\/\/media\.teajia\.co\//,
              handler: 'CacheFirst',
              options: {
                cacheName: 'media-cache',
                expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
            {
              // Same-origin media proxy (China-reachable path for R2 uploads —
              // see functions/media/[[path]].ts). Objects are immutable, so
              // CacheFirst: once a photo lands it never re-fetches, which also
              // papers over GFW flakiness on revisits.
              urlPattern: ({ url }) => url.pathname.startsWith('/media/'),
              handler: 'CacheFirst',
              options: {
                cacheName: 'media-cache',
                expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//,
              handler: 'CacheFirst',
              options: {
                cacheName: 'font-cache',
                expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              },
            },
          ],
        },
        manifest: false,
      }),
      {
        name: 'copy-cloudflare-files',
        writeBundle() {
          for (const file of ['_redirects', '_headers']) {
            const src = path.resolve(__dirname, file);
            const dest = path.resolve(__dirname, 'dist', file);
            if (fs.existsSync(src)) {
              fs.copyFileSync(src, dest);
            }
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: 'hidden',
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true,
        },
      },
      target: 'esnext',
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) {
              return 'vendor';
            }
            if (id.includes('node_modules/react-router')) {
              return 'router';
            }
            if (id.includes('node_modules/@tanstack/react-query')) {
              return 'query';
            }
          },
        },
      },
    },
  };
});
