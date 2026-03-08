import { defineConfig } from 'vite';
import { resolve } from 'path';
import fs from 'fs';

// Dynamically find all HTML files in the root directory
const htmlFiles = fs.readdirSync(__dirname)
    .filter(file => file.endsWith('.html'))
    .reduce((entries, file) => {
        const name = file.replace('.html', '');
        // Vite expects the main entry to be named 'main'
        entries[name === 'index' ? 'main' : name] = resolve(__dirname, file);
        return entries;
    }, {});


export default defineConfig({
    // Base URL for GitHub Pages
    base: '/emom-timer/',
    build: {
        outDir: 'dist',
        sourcemap: true,
        rollupOptions: {
            input: htmlFiles
        }
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
