import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // also reachable from your phone on the same Wi-Fi (for testing mobile)
    // The browser only ever talks to OUR backend. In dev, Vite forwards /api to it.
    proxy: { '/api': 'http://localhost:4000' },
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: { vendor: ['react', 'react-dom', 'react-router', '@tanstack/react-query'] },
      },
    },
  },
});
