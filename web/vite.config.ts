import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  // In dev (npm run dev), send conversions to the Docker server.
  server: { proxy: { '/convert': 'http://localhost:3100', '/health': 'http://localhost:3100' } },
})
