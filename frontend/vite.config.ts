import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'EcoTrack Carbon Intelligence',
        short_name: 'EcoTrack',
        description: 'AI-powered personal carbon footprint tracker',
        theme_color: '#0a0a0a',
        background_color: '#050505',
        display: 'standalone',
        icons: [
          {
            src: 'eco-icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'eco-icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/setupTests.ts',
        'src/main.tsx',
        'src/vite-env.d.ts'
      ]
    }
  }
})
