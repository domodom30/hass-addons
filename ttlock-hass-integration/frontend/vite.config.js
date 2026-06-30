import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import vuetify from "vite-plugin-vuetify";
import { fileURLToPath, URL } from "node:url";
import { readFileSync } from "node:fs";

// Source of truth for the version badge and GitHub link is the add-on's
// config.yaml (one level up), not package.json. Extract via regex to avoid a
// YAML parser dependency — same approach as scripts/sync_versions.py.
const configYaml = readFileSync(
  new URL("../config.yaml", import.meta.url),
  "utf-8",
);
const readYamlValue = (key) => {
  const m = configYaml.match(new RegExp(`^${key}:\\s*"?([^"\\n]+?)"?\\s*$`, "m"));
  return m ? m[1].trim() : "";
};

export default defineConfig(({ command }) => ({
  base: command === "build" ? "./" : "/",
  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(readYamlValue("version")),
    "import.meta.env.VITE_APP_GITHUB": JSON.stringify(readYamlValue("url")),
  },
  plugins: [vue(), vuetify({ autoImport: true })],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    extensions: [".mjs", ".js", ".json", ".vue"],
  },
  build: {
    chunkSizeWarningLimit: 1100,
    rollupOptions: {
      output: {
        manualChunks: {
          vue: ["vue", "vue-router", "vuex", "vue-i18n"],
          vuetify: ["vuetify"],
          "json-editor": ["json-editor-vue"],
          vendor: ["moment", "reconnecting-websocket"],
        },
      },
    },
  },
  server: {
    proxy: { "/api": { target: "ws://localhost:55099/", ws: true } },
  },
}));
