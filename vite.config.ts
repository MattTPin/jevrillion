import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { readBackendPort, readSettings } from './server/settings.ts'

// https://vite.dev/config/
const backendPort = readBackendPort(readSettings())
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Keep Vite's env loader disabled so future secrets cannot leak through it.
  envDir: false,
  envPrefix: [],
  server: {
    host: '127.0.0.1',
    port: Number(process.env.E2E_WEB_PORT ?? '5173'),
    strictPort: true,
    proxy: {
      '/api': `http://127.0.0.1:${process.env.E2E_API_PORT ?? backendPort}`,
    },
  },
  preview: {
    host: '127.0.0.1',
    proxy: { '/api': `http://127.0.0.1:${backendPort}` },
  },
})
