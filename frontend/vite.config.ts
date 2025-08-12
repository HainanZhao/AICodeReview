import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // Load env file based on mode
  const env = loadEnv(mode, process.cwd(), '');
  const subPath = env.AICR_SUB_PATH || '';

  return {
    base: `/${subPath}`,
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
      'process.env.AICR_SUB_PATH': JSON.stringify(subPath),
    },
    test: {
      globals: true,
    },
  };
});
