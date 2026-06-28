import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import vuetify from "vite-plugin-vuetify";
import { fileURLToPath, URL } from "node:url";
import { readFileSync } from "node:fs";
import { mockApiPlugin } from "./dev/mock-api.js";

const pkg = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf-8"),
);

// HA ingress serves the UI under a dynamic path prefix, so production asset
// URLs must be RELATIVE (base "./"). `assetsDir: "res"` places hashed assets
// under dist/res/, which the aiohttp server exposes via its /res/ static mount
// — deliberately not "/static/" to avoid HA's frontend service worker.
export default defineConfig(({ command, mode }) => ({
  base: command === "build" ? "./" : "/",
  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(pkg.version),
  },
  plugins: [
    vue(),
    vuetify({ autoImport: true }),
    ...(mode === "mock" ? [mockApiPlugin()] : []),
  ],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    extensions: [".mjs", ".js", ".json", ".vue"],
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    assetsDir: "res",
    chunkSizeWarningLimit: 1100,
    rollupOptions: {
      output: {
        manualChunks: {
          vue: ["vue", "vue-router", "vuex", "vue-i18n"],
          vuetify: ["vuetify"],
          vendor: ["moment", "reconnecting-websocket"],
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
  },
}));
