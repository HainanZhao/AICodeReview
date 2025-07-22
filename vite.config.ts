import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
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
            '@': path.resolve(__dirname, '.'),
        }
    }
});
