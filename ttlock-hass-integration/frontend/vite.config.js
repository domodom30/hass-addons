import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vuetify from 'vite-plugin-vuetify'
import { fileURLToPath, URL } from 'node:url'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))

export default defineConfig(({ command }) => ({
  base: command === 'build' ? './' : '/',
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version),
  },
  plugins: [
    vue(),
    vuetify({ autoImport: true })
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    extensions: ['.mjs', '.js', '.json', '.vue']
  },
  build: {
    chunkSizeWarningLimit: 1100,
    rollupOptions: {
      output: {
        manualChunks: {
          vue: ['vue', 'vue-router', 'vuex', 'vue-i18n'],
          vuetify: ['vuetify'],
          'json-editor': ['json-editor-vue'],
          vendor: ['moment', 'reconnecting-websocket']
        }
      }
    }
  },
  server: {
    proxy: { '/api': { target: 'ws://localhost:55099/', ws: true } }
  }
}))
