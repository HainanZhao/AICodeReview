import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  build: {
    outDir: '../dist/public',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
  server: {
    port: 5960,
    proxy: {
      '/api': {
        target: 'http://localhost:5959',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, '/api'),
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  define: {
    // Define globals for browser compatibility
    global: 'globalThis',
  },
  optimizeDeps: {
    exclude: [
      // Exclude Node.js specific modules from optimization
      'aicodereview-shared/dist/services/geminiCliCore.js',
      'aicodereview-shared/dist/services/aiProviderCore.js',
    ],
  },
  test: {
    globals: true,
  },
});
