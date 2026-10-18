import { defineConfig } from 'vite'

export default defineConfig({
  // The frontend is plain HTML, CSS, and JavaScript — no React/JSX plugin.
  publicDir: 'public',
  server: {
    host: '0.0.0.0',
    proxy: { '/api': 'http://localhost:3000' }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
})
