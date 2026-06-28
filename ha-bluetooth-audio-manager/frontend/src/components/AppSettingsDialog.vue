<template>
  <v-dialog v-model="show" max-width="520" scrollable>
    <v-card>
      <DialogHeader
        icon="mdi-tune-variant"
        color="info"
        :title="$t('settings.title')"
        @close="show = false"
      />
      <v-divider />
      <v-card-text class="pa-5">
        <DialogSection :title="$t('settings.sectionScan')" first>
          <div>
            <v-text-field
              v-model.number="form.scan_duration_seconds"
              type="number"
              :label="$t('settings.scanDuration')"
              min="5"
              max="120"
              hide-details
            />
            <div class="text-caption font-italic text-medium-emphasis mt-1 px-1">
              {{ $t("settings.scanDurationHint") }}
            </div>
          </div>
        </DialogSection>

        <DialogSection :title="$t('settings.sectionReconnect')">
          <div>
            <v-switch
              v-model="form.auto_reconnect"
              :label="$t('settings.autoReconnect')"
              color="primary"
              density="comfortable"
              hide-details
            />
            <div class="text-caption font-italic text-medium-emphasis px-1">
              {{ $t("settings.autoReconnectHint") }}
            </div>
          </div>
          <div>
            <v-text-field
              v-model.number="form.reconnect_interval_seconds"
              type="number"
              :label="$t('settings.reconnectInterval')"
              :disabled="!form.auto_reconnect"
              min="5"
              max="600"
              hide-details
            />
            <div class="text-caption font-italic text-medium-emphasis mt-1 px-1">
              {{ $t("settings.reconnectIntervalHint") }}
            </div>
          </div>
          <div>
            <v-text-field
              v-model.number="form.reconnect_max_backoff_seconds"
              type="number"
              :label="$t('settings.maxBackoff')"
              :disabled="!form.auto_reconnect"
              min="60"
              max="3600"
              hide-details
            />
            <div class="text-caption font-italic text-medium-emphasis mt-1 px-1">
              {{ $t("settings.maxBackoffHint") }}
            </div>
          </div>
        </DialogSection>
      </v-card-text>
      <v-divider />
      <v-card-actions class="px-4 py-3">
        <v-btn color="error" variant="flat" @click="show = false">{{
          $t("common.cancel")
        }}</v-btn>
        <v-spacer />
        <v-btn
          color="primary"
          variant="flat"
          :loading="saving"
          prepend-icon="mdi-content-save"
          @click="save"
        >
          {{ $t("common.save") }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import DialogHeader from "@/components/base/DialogHeader.vue";
import DialogSection from "@/components/base/DialogSection.vue";

export default {
  name: "AppSettingsDialog",
  components: { DialogHeader, DialogSection },
  data() {
    return {
      saving: false,
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
      this.saving = true;
      try {
        await this.$store.dispatch("saveSettings", {
          auto_reconnect: this.form.auto_reconnect,
          reconnect_interval_seconds: parseInt(
            this.form.reconnect_interval_seconds,
            10,
          ),
          reconnect_max_backoff_seconds: parseInt(
            this.form.reconnect_max_backoff_seconds,
            10,
          ),
          scan_duration_seconds: parseInt(this.form.scan_duration_seconds, 10),
        });
        this.show = false;
      } finally {
        this.saving = false;
      }
    },
  },
};
</script>
