import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { resolve } from "node:path";
import fs from "node:fs";

// Dynamically find all HTML files in the root directory
const htmlFiles = fs
  .readdirSync(__dirname)
  .filter((file) => file.endsWith(".html"))
  .reduce((entries, file) => {
    const name = file.replace(".html", "");
    // Vite expects the main entry to be named 'main'
    entries[name === "index" ? "main" : name] = resolve(__dirname, file);
    return entries;
  }, {});

export default defineConfig({
  // Base URL for GitHub Pages
  base: "/emom-timer/",
  build: {
    outDir: "dist",
    sourcemap: true,
    rollupOptions: {
      input: htmlFiles,
    },
  },
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      manifest: {
        name: "EMOM Timer",
        short_name: "EMOM",
        description: "Timer for EMOM, Tabata, and Walk/Jog/Run workflows.",
        theme_color: "#121212",
        background_color: "#121212",
        display: "standalone",
        icons: [
          {
            src: "favicon.png",
            sizes: "192x192",
            type: "image/png",
          },
        ],
      },
      devOptions: {
        enabled: true
      }
    }),
  ],
  server: {
    port: 3000,
    open: true,
  },
  test: {
    environment: "jsdom",
    setupFiles: ["fake-indexeddb/auto"],
    exclude: ["tests/e2e/**", "node_modules/**"],
  },
});
