import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'BIZUDPGothic-Regular.ttf',
        'BIZUDPGothic-Bold.ttf',
        'pwa-512.png',
        'pwa-192.png',
        'apple-touch-icon.png',
      ],
      workbox: {
        // 15MB まで（フォントファイル対応）
        maximumFileSizeToCacheInBytes: 15728640,
        globPatterns: [
          '**/*.{js,css,html,ico,png,jpg,svg,ttf,woff,woff2}',
        ],
        // offline フォールバック
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api/],
      },
      manifest: {
        name: 'ピット作業記録',
        short_name: 'PitRecord',
        description: 'モータースポーツのピット作業を記録するアプリ',
        theme_color: '#1e3a5f',
        background_color: '#f3f4f6',
        display: 'standalone',
        orientation: 'portrait',
        scope: './',
        start_url: './',
        lang: 'ja',
        icons: [
          {
            src: 'pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {},
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        // @react-pdf/renderer は巨大なので分割
        manualChunks(id) {
          if (id.includes('@react-pdf')) return 'react-pdf';
          if (id.includes('zustand')) return 'zustand';
        },
      },
    },
  },
});
