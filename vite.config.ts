import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // registramos el service worker a mano en main.tsx (via
      // virtual:pwa-register) para poder revisar actualizaciones cada hora
      // y loguear que esta pasando -- si el plugin TAMBIEN auto-inyecta su
      // propio registro (comportamiento default), pueden pisarse entre si
      injectRegister: false,
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectManifest: {
        swSrc: 'src/sw.ts',
        swDest: 'dist/sw.js',
      },
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: 'Quiniela NFL',
        short_name: 'Quiniela',
        description: 'Predicciones NFL entre amigos',
        theme_color: '#0A0E13',
        background_color: '#0A0E13',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ],
})
