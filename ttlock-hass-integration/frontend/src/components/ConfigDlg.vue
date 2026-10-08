<template>
  <v-dialog v-model="localShow" persistent max-width="960px" transition="dialog-bottom-transition">
    <v-card>
      <div class="d-flex align-center pa-5 pb-4 ga-3">
        <v-avatar size="36" color="primary" variant="tonal">
          <v-icon size="20">mdi-puzzle-edit-outline</v-icon>
        </v-avatar>
        <div>
          <div class="text-subtitle-1 font-weight-bold">{{ $t('app.editConfig') }}</div>
          <div class="text-caption text-medium-emphasis">JSON</div>
        </div>
      </div>

      <v-divider />

      <v-card-text class="pa-5">
        <JsonEditorVue
          v-if="localShow && content"
          class="config-editor"
          :class="{ 'jse-theme-dark': isDark }"
          :content="content"
          :onChange="onEditorChange"
          v-model:mode="editorMode"
          :readOnly="busy"
          :navigationBar="false"
        />
        <div v-if="!configValid" class="text-caption text-error mt-2">{{ $t('common.invalidJson') }}</div>
      </v-card-text>

      <v-progress-linear v-if="busy" indeterminate color="primary" height="2" />
      <v-divider v-else />

      <v-card-actions class="px-4 py-3">
        <v-btn variant="text" :disabled="busy" @click="cancelConfig">{{ $t('common.close') }}</v-btn>
        <v-spacer />
        <v-btn
          variant="flat"
          color="primary"
          prepend-icon="mdi-content-save-outline"
          :disabled="busy || !configValid"
          @click="saveConfig"
        >{{ $t('common.save') }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import { defineAsyncComponent } from "vue"
import "vanilla-jsoneditor/themes/jse-theme-dark.css"
import { useTheme } from "@/composables/useTheme"

export default {
  name: "ConfigDlg",
  // Chargé à la demande : l'éditeur (chunk « json-editor ») ne pèse rien tant que le
  // dialogue n'est pas ouvert.
  components: {
    JsonEditorVue: defineAsyncComponent(() => import("json-editor-vue")),
  },
  props: ["show"],
  setup() {
    const { isDark } = useTheme()
    return { isDark }
  },
  data() {
    return {
      localShow: false,
      busy: false,
      // Format svelte-jsoneditor ({ text } ou { json }) : reste cohérent quel que soit le
      // mode (texte/arbre), contrairement au v-model qui bascule entre chaîne et objet.
      content: null,
      editorMode: "text",
      configValid: true,
    }
  },
  computed: {
    storeConfig() {
      return this.$store.state.config
    },
    waitingConfig() {
      return this.$store.state.waitingConfig
    },
  },
  methods: {
    onEditorChange(updatedContent, _previousContent, { contentErrors }) {
      this.content = updatedContent
      this.configValid = !contentErrors
    },
    contentToJson() {
      if (!this.content) return undefined
      if (this.content.json !== undefined) return this.content.json
      try { return JSON.parse(this.content.text) } catch { return undefined }
    },
    async saveConfig() {
      if (this.busy || !this.configValid) return
      const data = this.contentToJson()
      if (data === undefined) {
        this.configValid = false
        return
      }
      this.busy = true
      this._errorCount = this.$store.state.errors.length
      await this.$store.dispatch("saveConfig", JSON.stringify(data))
    },
    cancelConfig() {
      this.$store.commit("setConfig", "")
      this.content = null
      this.$emit("cancel")
    },
  },
  watch: {
    show(newVal) {
      this.localShow = newVal
      if (newVal === true) {
        this.busy = true
        this.$store.dispatch("loadConfig")
      }
    },
    storeConfig(newVal) {
      if (!newVal) return
      try {
        const parsed = JSON.parse(newVal)
        this.content = { text: JSON.stringify(parsed, null, 2) }
        this.configValid = true
      } catch (e) {
        console.error(e)
        this.content = { text: newVal }
        this.configValid = false
      } finally {
        this.busy = false
      }
    },
    waitingConfig(newVal) {
      if (newVal === false && this.busy === true) {
        this.busy = false
        if (this.$store.state.errors.length === this._errorCount) {
          this.$emit("cancel")
        }
      }
    },
  },
}
</script>

<style scoped>
.config-editor {
  height: 60vh;
  --jse-font-size-mono: 12px;
  --jse-theme-color: rgb(var(--v-theme-primary));
  --jse-theme-color-highlight: rgb(var(--v-theme-primary));
}
</style>
