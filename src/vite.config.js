import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3005',
        changeOrigin: true,
      },
      '/peerjs': {
        target: 'http://localhost:3005',
        ws: true,
      },
      '/socket.io': {
        target: 'http://localhost:3005',
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    server: {
      deps: {
        // @mediapipe/tasks-vision is loaded dynamically at runtime via CDN;
        // exclude it from Vite's static import analysis during tests.
        external: ['@mediapipe/tasks-vision']
      }
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/', 'server.test.js'],
    },
  },
});
