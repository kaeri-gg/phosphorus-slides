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
                // index.html is the 2-minute pitch deck; engine.html is the markdown slide engine (conference.md).
                main: resolve(__dirname, 'index.html'),
                engine: resolve(__dirname, 'engine.html')
            }
        }
    }
});
