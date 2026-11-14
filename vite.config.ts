import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const base = process.env.BASE_PATH || '/';

export default defineConfig({
  base,
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three']
        }
      }
    }
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.svg',
        'pwa-192x192.png',
        'pwa-512x512.png',
        'maskable-icon-512x512.png'
      ],
      manifest: {
        name: 'Танчики 3D — Battle City',
        short_name: 'Танчики 3D',
        description: 'Класична танкова битва Battle City у 3D! Захищай штаб, трощи стіни, збирай бонуси та грай офлайн.',
        theme_color: '#11161f',
        background_color: '#0a0d13',
        display: 'standalone',
        orientation: 'any',
        lang: 'uk',
        start_url: base,
        scope: base,
        categories: ['games', 'action', 'arcade'],
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true
      },
      devOptions: {
        enabled: true,
        suppressWarnings: true
      }
    })
  ]
});
