/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { inviteOgPlugin } from './src/og/inviteOgPlugin';

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
      VitePWA({
        registerType: 'prompt',
        includeAssets: ['logo.svg', 'logo.png'],
        manifest: pwaManifest,
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,webmanifest}'],
          navigateFallback: 'index.html',
          navigateFallbackDenylist: [/^\/api\//],
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
