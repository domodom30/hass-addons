<template>
  <v-dialog v-model="show" max-width="520" scrollable>
    <v-card>
      <div class="d-flex align-center ga-3 px-5 py-3">
        <v-avatar size="36" color="info" variant="tonal">
          <v-icon size="20">mdi-tune-variant</v-icon>
        </v-avatar>
        <div class="text-subtitle-1 font-weight-bold flex-grow-1">{{ $t("settings.title") }}</div>
        <v-btn icon="mdi-close" variant="text" size="small" @click="show = false" />
      </div>
      <v-divider />
      <v-card-text class="pa-5">
        <v-text-field
          v-model.number="form.scan_duration_seconds"
          type="number"
          :label="$t('settings.scanDuration')"
          :hint="$t('settings.scanDurationHint')"
          persistent-hint
          min="5"
          max="120"
          class="mb-4"
        />
        <v-switch
          v-model="form.auto_reconnect"
          :label="$t('settings.autoReconnect')"
          :messages="$t('settings.autoReconnectHint')"
          color="primary"
          class="mb-2"
        />
        <v-text-field
          v-model.number="form.reconnect_interval_seconds"
          type="number"
          :label="$t('settings.reconnectInterval')"
          :hint="$t('settings.reconnectIntervalHint')"
          persistent-hint
          min="5"
          max="600"
          class="mb-4"
        />
        <v-text-field
          v-model.number="form.reconnect_max_backoff_seconds"
          type="number"
          :label="$t('settings.maxBackoff')"
          :hint="$t('settings.maxBackoffHint')"
          persistent-hint
          min="60"
          max="3600"
        />
      </v-card-text>
      <v-divider />
      <v-card-actions class="px-4 py-3">
        <v-btn variant="text" @click="show = false">{{ $t("common.cancel") }}</v-btn>
        <v-spacer />
        <v-btn color="primary" variant="flat" prepend-icon="mdi-content-save" @click="save">
          {{ $t("common.save") }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
export default {
  name: "AppSettingsDialog",
  data() {
    return {
      form: {
        scan_duration_seconds: 30,
        auto_reconnect: true,
        reconnect_interval_seconds: 30,
        reconnect_max_backoff_seconds: 300,
      },
    };
  },
  computed: {
    show: {
      get() {
        return this.$store.state.ui.overlay === "appSettings";
      },
      set(v) {
        if (!v) this.$store.commit("clearOverlay");
      },
    },
  },
  watch: {
    show(open) {
      if (open) this.form = { ...this.$store.state.settings };
    },
  },
  methods: {
    async save() {
      await this.$store.dispatch("saveSettings", {
        auto_reconnect: this.form.auto_reconnect,
        reconnect_interval_seconds: parseInt(this.form.reconnect_interval_seconds, 10),
        reconnect_max_backoff_seconds: parseInt(this.form.reconnect_max_backoff_seconds, 10),
        scan_duration_seconds: parseInt(this.form.scan_duration_seconds, 10),
      });
      this.show = false;
    },
  },
};
</script>
