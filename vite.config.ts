import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [
    react(),
    // PWA (RNF-09 · sin conexión): la app se instala y abre aunque no haya internet.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'AlertaCiudadana · MININTER / PNP',
        short_name: 'AlertaCiudadana',
        description: 'Pide ayuda policial en 3 toques con tu cuenta verificada.',
        lang: 'es-PE',
        start_url: '/app',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#0F2027',
        background_color: '#0F2027',
        icons: [
          { src: '/icons/icono-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icono-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icono-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App shell: HTML, JS, CSS, fuentes de íconos e imágenes propias (no los modelos de 7 MB).
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Modelos de face-api.js: se guardan la primera vez que se usan.
            urlPattern: ({ url }) => url.pathname.startsWith('/modelos/'),
            handler: 'CacheFirst',
            options: { cacheName: 'modelos-rostro', expiration: { maxEntries: 20 } },
          },
          {
            // Teselas de OpenStreetMap ya vistas: el mapa se ve aunque se corte la señal.
            urlPattern: ({ url }) => url.hostname === 'tile.openstreetmap.org',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'mapa-teselas', expiration: { maxEntries: 400, maxAgeSeconds: 7 * 24 * 3600 } },
          },
          {
            urlPattern: ({ url }) => url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'fuentes', expiration: { maxEntries: 30 } },
          },
        ],
      },
    }),
  ],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { port: 5173 },
  // face-api.js (~660 kB) va en un chunk propio que solo se descarga en la verificación facial.
  build: { chunkSizeWarningLimit: 700 },
});
