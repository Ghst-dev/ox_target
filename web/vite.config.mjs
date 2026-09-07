import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss(), svelte()],
  // Relative asset paths -- NUI's Chromium loads the page from nui://, not a web root.
  base: './',
  server: {
    // PORT wins where it is set, because two chats previewing the same resource is two vite
    // servers wanting one port, and the second one loses. The preview manager assigns a free
    // port and hands it over this way; the constant is what `pnpm run dev` in a terminal gets.
    //
    // strictPort either way, so a busy port is an error rather than vite quietly binding a
    // different one and leaving whoever asked watching the wrong address.
    port: Number(process.env.PORT) || 3001,
    strictPort: true,
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
