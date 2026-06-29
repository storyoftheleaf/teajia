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
          globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
          // Never serve the SPA shell for API paths — they must always hit the
          // network (and the edge proxy / Worker), including the Google OAuth
          // top-level navigation to /api/auth/google.
          navigateFallbackDenylist: [/^\/api\//, /^\/mcp/, /^\/oauth/, /^\/\.well-known/],
          runtimeCaching: [
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
