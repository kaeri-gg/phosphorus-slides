import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
    publicDir: 'public',
    envPrefix: 'GAME_',
    base: './',
    server: {
        port: 5173
    },
    build: {
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html')
            }
        },
        sourcemap: true,
        assetsDir: './assets',
        emptyOutDir: true,
    }
});
