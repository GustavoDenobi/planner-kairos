/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { inviteOgPlugin } from './src/og/inviteOgPlugin';
import { pdfjsAssetsPlugin } from './vite.pdfjs-assets';

const pwaManifest = JSON.parse(
  readFileSync(path.resolve(__dirname, 'public/manifest.webmanifest'), 'utf-8'),
);

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react(),
      tailwindcss(),
      inviteOgPlugin(env),
      pdfjsAssetsPlugin(),
      VitePWA({
        registerType: 'prompt',
        includeAssets: [
          'logo.svg',
          'logo.png',
          'fonts/BravuraText-smufl.woff2',
          'fonts/BravuraText-smufl.woff',
        ],
        manifest: pwaManifest,
        workbox: {
          globPatterns: ['**/*.{js,mjs,css,html,ico,png,svg,woff,woff2,webmanifest,wasm}'],
          maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
          navigateFallback: 'index.html',
          navigateFallbackDenylist: [/^\/api\//, /^\/pdfjs\//],
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
    },
  };
});
