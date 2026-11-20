import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '#workspace-entry': fileURLToPath(new URL('./src/App.jsx', import.meta.url)),
      '#workspace-edition': fileURLToPath(new URL('./src/desktop-edition.js', import.meta.url)),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: { '/api': { target: 'http://127.0.0.1:3001', changeOrigin: false } },
  },
});
