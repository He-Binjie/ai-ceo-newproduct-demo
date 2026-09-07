import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/ai-ceo-newproduct-demo/',
  server: {
    port: 3003,
  },
})
