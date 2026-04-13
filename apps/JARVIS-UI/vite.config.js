import { defineConfig } from 'vite';

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
  },
});
