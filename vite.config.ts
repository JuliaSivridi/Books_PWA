import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/Books_PWA/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,ico,woff2}'],
        navigateFallback: 'index.html',
        // Don't cache Google API responses
        navigateFallbackDenylist: [/^\/Books_PWA\/api/],
        runtimeCaching: [],
      },
      manifest: false, // keep existing public/manifest.json
    }),
  ],
})
