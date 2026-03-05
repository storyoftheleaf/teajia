import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      cors: true,
    },
    preview: {
      port: 4173,
      host: '0.0.0.0',
    },
    plugins: [
      react(),
      {
        name: 'copy-redirects',
        writeBundle() {
          const redirectsPath = path.resolve(__dirname, '_redirects');
          const distPath = path.resolve(__dirname, 'dist', '_redirects');
          if (fs.existsSync(redirectsPath)) {
            fs.copyFileSync(redirectsPath, distPath);
          }
        },
      },
    ],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY || ''),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || ''),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      minify: 'terser',
      target: 'esnext',
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            router: ['react-router-dom'],
            query: ['@tanstack/react-query'],
            supabase: ['@supabase/supabase-js'],
          },
        },
      },
    },
  };
});
