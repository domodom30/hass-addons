import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// HA ingress serves the UI under a dynamic path prefix, so all asset URLs
// must be RELATIVE (no leading slash). `base: "./"` makes Vite emit
// "./res/<hash>.js" which resolves to <ingress>/res/... at runtime.
// `assetsDir: "res"` places every hashed asset under dist/res/, which the
// aiohttp server exposes via its /res/ static mount. The "res" prefix (not
// "static") is deliberate: HA's frontend service worker hijacks any URL
// containing "/static/" with a CacheFirst strategy. Vite content-hashes
// filenames, so no manual ?v= cache-busting is needed.
export default defineConfig({
  base: "./",
  plugins: [vue()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    assetsDir: "res",
  },
  test: {
    environment: "jsdom",
    globals: true,
  },
});
