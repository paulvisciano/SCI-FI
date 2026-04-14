import { defineConfig } from 'vite';

const apiTarget = process.env.VITE_API_TARGET || 'https://localhost:18922';

export default defineConfig({
  root: '.',
  publicDir: 'assets',
  build: {
    outDir: 'dist-vite',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        app: 'vite.html',
      },
    },
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': { target: apiTarget, secure: false, changeOrigin: true },
      '/upload': { target: apiTarget, secure: false, changeOrigin: true },
      '/transcript': { target: apiTarget, secure: false, changeOrigin: true },
      '/health': { target: apiTarget, secure: false, changeOrigin: true },
    },
  },
});
