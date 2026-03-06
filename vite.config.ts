import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_');
  return {
    server: {
      port: 3000,
      host: 'localhost',
      cors: true,
    },
    preview: {
      port: 4173,
      host: 'localhost',
    },
    plugins: [
      react(),
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
