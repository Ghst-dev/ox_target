import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss(), svelte()],
  // Relative asset paths -- NUI's Chromium loads the page from nui://, not a web root.
  base: './',
  server: {
    port: 3001,
  },
  build: {
    // fxmanifest declares ui_page 'web/build/index.html' and globs web/**, so this must
    // stay 'build'. ox_target previously had no build step at all and pointed ui_page
    // straight at web/index.html.
    outDir: 'build',
    target: 'esnext',
    emptyOutDir: true,
  },
});
