<template>
  <v-dialog v-model="show" max-width="560" scrollable>
    <v-card v-if="device">
      <div class="d-flex align-center ga-3 px-5 py-3">
        <v-avatar size="36" color="primary" variant="tonal">
          <v-icon size="20">mdi-cog-outline</v-icon>
        </v-avatar>
        <div class="overflow-hidden flex-grow-1">
          <div class="text-subtitle-1 font-weight-bold text-truncate">
            {{ device.name }}
          </div>
          <div class="text-caption text-medium-emphasis font-mono">
            {{ device.address }}
          </div>
        </div>
        <v-btn
          icon="mdi-close"
          variant="text"
          size="small"
          @click="show = false"
        />
      </div>
      <v-divider />

      <v-card-text class="pa-5">
        <v-switch
          v-model="form.autoConnect"
          :label="$t('deviceSettings.autoReconnect')"
          :messages="$t('deviceSettings.autoReconnectHelp')"
        />

        <v-divider class="my-4" />

        <v-select
          v-if="hfpSwitching"
          v-model="form.audioProfile"
          :items="profileItems"
          item-title="label"
          item-value="value"
          :label="$t('deviceSettings.audioProfile')"
          :hint="
            form.audioProfile === 'hfp'
              ? $t('deviceSettings.hfpHelp')
              : $t('deviceSettings.a2dpHelp')
          "
          persistent-hint
          class="mb-4"
        />

        <v-select
          v-model="form.idleMode"
          :items="idleItems"
          item-title="label"
          item-value="value"
          :label="$t('deviceSettings.whenIdle')"
          :hint="idleHelp"
          persistent-hint
          class="mb-4"
        />

        <v-select
          v-if="form.idleMode === 'power_save'"
          v-model="form.powerSaveDelay"
          :items="delayItems"
          item-title="label"
          item-value="value"
          :label="$t('deviceSettings.delayBeforeSuspend')"
          class="mb-4"
        />
        <v-select
          v-if="form.idleMode === 'keep_alive'"
          v-model="form.kaMethod"
          :items="methodItems"
          item-title="label"
          item-value="value"
          :label="$t('deviceSettings.method')"
          class="mb-4"
        />
        <v-select
          v-if="form.idleMode === 'auto_disconnect'"
          v-model="form.autoDisconnectMinutes"
          :items="disconnectItems"
          item-title="label"
          item-value="value"
          :label="$t('deviceSettings.disconnectAfter')"
          class="mb-4"
        />

        <v-divider class="mb-4" />

        <v-switch
          v-model="form.mpdEnabled"
          :label="$t('deviceSettings.mpd')"
          :messages="$t('deviceSettings.mpdHelp')"
        />
        <template v-if="form.mpdEnabled">
          <v-text-field
            v-model.number="form.mpdHwVolume"
            type="number"
            min="1"
            max="100"
            :label="$t('deviceSettings.hwVolume')"
            :hint="$t('deviceSettings.hwVolumeHelp')"
            persistent-hint
            class="mb-4"
          />
          <v-text-field
            v-model.number="form.mpdPort"
            type="number"
            min="6600"
            max="6609"
            :label="$t('deviceSettings.mpdPort')"
            :hint="$t('deviceSettings.mpdPortHelp')"
            persistent-hint
            class="mb-3"
          />
          <v-alert
            v-if="form.mpdPort"
            type="info"
            variant="tonal"
            density="compact"
          >
            {{ $t("deviceSettings.usePort", { port: form.mpdPort }) }}<br />
            {{ $t("deviceSettings.host") }}: <code>{{ mpdHostname }}</code
            ><br />
            {{ $t("deviceSettings.password") }}:
            <code>{{ mpdPasswordDisplay }}</code>
          </v-alert>
        </template>

        <v-divider class="my-4" />

        <v-switch
          v-model="form.avrcpEnabled"
          :disabled="!hasAvrcpCap"
          :label="$t('deviceSettings.mediaButtons')"
          :messages="
            hasAvrcpCap
              ? $t('deviceSettings.avrcpHelp')
              : $t('deviceSettings.avrcpUnsupported')
          "
        />
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
import { AVRCP_TARGET, AVRCP_CONTROLLER, HFP_UUID, HSP_UUID } from "@/profiles";

export default {
  name: "DeviceSettingsDialog",
  data() {
    return {
      saving: false,
      lowerUuids: [],
      form: {
        autoConnect: true,
        audioProfile: "a2dp",
        idleMode: "default",
        kaMethod: "infrasound",
        powerSaveDelay: 0,
        autoDisconnectMinutes: 30,
        mpdEnabled: false,
        mpdHwVolume: 100,
        mpdPort: "",
        avrcpEnabled: true,
      },
    };
  },
  computed: {
    show: {
      get() {
        return this.$store.state.ui.overlay === "deviceSettings";
      },
      set(v) {
        if (!v) this.$store.commit("clearOverlay");
      },
    },
    device() {
      return this.$store.getters.deviceByAddress(this.$store.state.ui.address);
    },
    hfpSwitching() {
      return this.$store.state.info.hfpSwitchingEnabled;
    },
    mpdHostname() {
      return this.$store.state.info.mpdHostname;
    },
    mpdPasswordDisplay() {
      return this.$store.state.info.mpdPasswordSet
        ? "**********"
        : this.$t("deviceSettings.none");
    },
    hasHfp() {
      return (
        this.lowerUuids.includes(HFP_UUID) || this.lowerUuids.includes(HSP_UUID)
      );
    },
    hasAvrcpCap() {
      return (
        this.lowerUuids.includes(AVRCP_TARGET) ||
        this.lowerUuids.includes(AVRCP_CONTROLLER)
      );
    },
    idleHelp() {
      return {
        default: this.$t("deviceSettings.idleHelpDefault"),
        power_save: this.$t("deviceSettings.idleHelpPowerSave"),
        keep_alive: this.$t("deviceSettings.idleHelpKeepAlive"),
        auto_disconnect: this.$t("deviceSettings.idleHelpAutoDisconnect"),
      }[this.form.idleMode];
    },
    profileItems() {
      return [
        { value: "a2dp", label: this.$t("deviceSettings.a2dp") },
        {
          value: "hfp",
          label: this.$t("deviceSettings.hfp"),
          props: { disabled: !this.hasHfp },
        },
      ];
    },
    idleItems() {
      return [
        { value: "default", label: this.$t("deviceSettings.idleDefault") },
        { value: "power_save", label: this.$t("deviceSettings.idlePowerSave") },
        { value: "keep_alive", label: this.$t("deviceSettings.idleKeepAlive") },
        {
          value: "auto_disconnect",
          label: this.$t("deviceSettings.idleAutoDisconnect"),
        },
      ];
    },
    delayItems() {
      return [
        { value: 0, label: this.$t("deviceSettings.immediately") },
        { value: 30, label: "30s" },
        { value: 60, label: "1 min" },
        { value: 300, label: "5 min" },
      ];
    },
    methodItems() {
      return [
        { value: "infrasound", label: this.$t("deviceSettings.infrasound") },
        { value: "silence", label: this.$t("deviceSettings.silence") },
      ];
    },
    disconnectItems() {
      return [
        { value: 5, label: "5 min" },
        { value: 15, label: "15 min" },
        { value: 30, label: "30 min" },
        { value: 60, label: "60 min" },
      ];
    },
  },
  watch: {
    show(open) {
      if (open) this.init();
    },
    "form.mpdEnabled"(enabled) {
      if (!enabled || this.form.mpdPort) return;
      const used = this.$store.getters.usedMpdPorts(this.device?.address);
      for (let p = 6600; p <= 6609; p++) {
        if (!used.has(p)) {
          this.form.mpdPort = p;
          break;
        }
      }
    },
  },
  methods: {
    init() {
      const d = this.device || {};
      this.lowerUuids = (d.uuids || []).map((u) => u.toLowerCase());
      this.form = {
        autoConnect: d.auto_connect ?? true,
        audioProfile: d.audio_profile || "a2dp",
        idleMode: d.idle_mode || "default",
        kaMethod: d.keep_alive_method || "infrasound",
        powerSaveDelay: d.power_save_delay ?? 0,
        autoDisconnectMinutes: d.auto_disconnect_minutes ?? 30,
        mpdEnabled: d.mpd_enabled || false,
        mpdHwVolume: d.mpd_hw_volume ?? 100,
        mpdPort: d.mpd_port || "",
        avrcpEnabled: this.hasAvrcpCap ? (d.avrcp_enabled ?? true) : false,
      };
    },
    async save() {
      if (!this.device) return;
      this.saving = true;
      const settings = {
        auto_connect: this.form.autoConnect,
        idle_mode: this.form.idleMode,
        keep_alive_method: this.form.kaMethod,
        power_save_delay: parseInt(this.form.powerSaveDelay, 10) || 0,
        auto_disconnect_minutes:
          parseInt(this.form.autoDisconnectMinutes, 10) || 30,
        mpd_enabled: this.form.mpdEnabled,
      };
      if (settings.mpd_enabled) {
        settings.mpd_hw_volume = parseInt(this.form.mpdHwVolume, 10) || 100;
        if (this.form.mpdPort)
          settings.mpd_port = parseInt(this.form.mpdPort, 10);
      }
      if (this.hfpSwitching) settings.audio_profile = this.form.audioProfile;
      if (this.hasAvrcpCap) settings.avrcp_enabled = this.form.avrcpEnabled;
      try {
        await this.$store.dispatch("saveDeviceSettings", {
          address: this.device.address,
          settings,
        });
        this.show = false;
      } catch (e) {
        this.$store.commit("setError", {
          message: `Failed to save settings: ${e.message}`,
        });
      } finally {
        this.saving = false;
      }
    },
  },
};
</script>
