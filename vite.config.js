import { defineConfig } from 'vite';

export default defineConfig({
    // Base URL for GitHub Pages
    base: '/emom-timer/',
    build: {
        outDir: 'dist',
        sourcemap: true
    },
    server: {
        port: 3000,
        open: true
    },
    test: {
        environment: 'jsdom',
        setupFiles: ['fake-indexeddb/auto']
    }
});
