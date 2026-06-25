<template>
  <v-dialog v-model="localShow" persistent max-width="640px" transition="dialog-bottom-transition">
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
        <v-textarea
          v-model="configText"
          rows="14"
          variant="outlined"
          :error="!configValid"
          :error-messages="configValid ? [] : [$t('common.invalidJson')]"
          @update:modelValue="validateJson"
          style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px;"
          hide-details="auto"
        />
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
export default {
  name: "ConfigDlg",
  props: ["show"],
  data() {
    return {
      localShow: false,
      busy: false,
      configText: "",
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
    validateJson(val) {
      this.configValid = this.isValidJson(val)
    },
    isValidJson(val) {
      if (!val) return false
      try { JSON.parse(val); return true } catch { return false }
    },
    async saveConfig() {
      if (this.busy || !this.configValid) return
      this.busy = true
      try {
        const data = JSON.parse(this.configText)
        await this.$store.dispatch("saveConfig", JSON.stringify(data))
      } finally {
        this.busy = false
      }
    },
    cancelConfig() {
      this.$store.commit("setConfig", "")
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
        this.configText = JSON.stringify(parsed, null, 2)
        this.configValid = true
      } catch (e) {
        console.error(e)
        this.configText = newVal
        this.configValid = false
      } finally {
        this.busy = false
      }
    },
    waitingConfig(newVal) {
      if (newVal === false && this.busy === true) {
        this.$emit("cancel")
        this.busy = false
      }
    },
  },
}
</script>
