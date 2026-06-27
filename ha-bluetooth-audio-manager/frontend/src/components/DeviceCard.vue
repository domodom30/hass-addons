<template>
  <v-card class="d-flex flex-column" :class="{ 'device-stale': device._stale }">
    <v-card-item>
      <template #title>
        <div class="d-flex align-center justify-space-between">
          <span
            class="text-subtitle-1 font-weight-bold text-truncate"
            :title="device.name"
          >
            {{ device.name }}
          </span>
          <div class="d-flex align-center ga-1 flex-shrink-0">
            <v-chip :color="statusColor" size="small" variant="tonal" label>
              {{ statusText }}
            </v-chip>
            <v-menu v-if="showMenu" location="bottom end">
              <template #activator="{ props }">
                <v-btn
                  v-bind="props"
                  icon="mdi-dots-vertical"
                  variant="text"
                  size="small"
                />
              </template>
              <v-list density="compact" min-width="190">
                <v-list-item @click="openSettings">
                  <template #prepend>
                    <v-icon size="18" class="mr-3">mdi-cog-outline</v-icon>
                  </template>
                  <v-list-item-title class="text-caption">{{
                    $t("device.settings")
                  }}</v-list-item-title>
                </v-list-item>
                <v-list-item v-if="device.connected" @click="forceReconnect">
                  <template #prepend>
                    <v-icon size="18" class="mr-3">mdi-sync</v-icon>
                  </template>
                  <v-list-item-title class="text-caption">{{
                    $t("device.forceReconnect")
                  }}</v-list-item-title>
                </v-list-item>
                <v-divider class="my-1" />
                <v-list-item base-color="error" @click="forget">
                  <template #prepend>
                    <v-icon size="18" class="mr-3">mdi-delete-outline</v-icon>
                  </template>
                  <v-list-item-title class="text-caption">{{
                    $t("device.forget")
                  }}</v-list-item-title>
                </v-list-item>
              </v-list>
            </v-menu>
          </div>
        </div>
      </template>
    </v-card-item>

    <v-card-text class="pt-0 flex-grow-1">
      <CapabilityChips :device="device" class="mb-2" />

      <div
        class="text-caption text-medium-emphasis font-mono d-flex align-center flex-wrap ga-2 mb-1"
      >
        <span>{{ device.address }}</span>
        <RssiIndicator :device="device" />
        <span v-if="device.adapter"
          >{{ $t("device.on") }} {{ device.adapter }}</span
        >
      </div>

      <div
        v-if="profilesState"
        class="text-caption mb-1"
        :class="profilesState.cls"
      >
        <v-icon v-if="profilesState.icon" size="12" class="mr-1">{{
          profilesState.icon
        }}</v-icon>
        {{ profilesState.text }}
      </div>

      <div
        v-if="sinkInfo"
        class="text-caption text-medium-emphasis d-flex align-center ga-1 mb-1"
      >
        <v-icon size="12">mdi-music</v-icon>
        <span v-if="sinkInfo.parts">{{ sinkInfo.parts }} ·</span>
        <v-chip size="x-small" variant="tonal" label>{{
          sinkInfo.stateLabel
        }}</v-chip>
      </div>

      <!-- Volume control (connected device only) -->
      <div v-if="sink" class="d-flex align-center ga-1 mt-1">
        <v-btn
          :icon="volumeIcon"
          variant="text"
          size="small"
          density="comfortable"
          :title="sink.mute ? $t('device.unmute') : $t('device.mute')"
          @click="toggleMute"
        />
        <v-slider
          v-model="localVolume"
          :aria-label="$t('device.volume')"
          :min="0"
          :max="100"
          :step="1"
          :disabled="sink.mute"
          density="compact"
          hide-details
          color="primary"
          class="flex-grow-1"
          @start="dragging = true"
          @update:model-value="onSlide"
          @end="onSlideEnd"
        />
        <span
          class="text-caption text-medium-emphasis"
          style="min-width: 34px; text-align: right"
        >
          {{ sink.mute ? $t("sink.muted") : localVolume + "%" }}
        </span>
      </div>

      <div v-if="featureChips.length" class="d-flex flex-wrap ga-1 mt-2">
        <v-chip
          v-for="(f, i) in featureChips"
          :key="i"
          :color="f.color"
          :prepend-icon="f.icon"
          size="x-small"
          variant="outlined"
          label
        >
          {{ f.text }}
        </v-chip>
      </div>
    </v-card-text>

    <v-card-actions class="px-4 pb-3 pt-0">
      <template v-if="device.connected">
        <v-btn
          color="error"
          variant="tonal"
          size="small"
          prepend-icon="mdi-link-off"
          @click="disconnect"
        >
          {{ $t("device.disconnect") }}
        </v-btn>
      </template>
      <template v-else-if="device.paired || device.stored">
        <v-btn
          color="success"
          size="small"
          prepend-icon="mdi-link"
          @click="connect"
        >
          {{ $t("device.connect") }}
        </v-btn>
      </template>
      <template v-else>
        <v-btn
          color="primary"
          size="small"
          prepend-icon="mdi-handshake-outline"
          @click="pair"
        >
          {{ $t("device.pair") }}
        </v-btn>
        <v-btn
          variant="text"
          size="small"
          icon="mdi-close"
          :title="$t('device.dismiss')"
          @click="dismiss"
        />
      </template>
    </v-card-actions>
  </v-card>
</template>

<script>
import CapabilityChips from "./CapabilityChips.vue";
import RssiIndicator from "./RssiIndicator.vue";
import { profileLabels } from "@/profiles";

export default {
  name: "DeviceCard",
  components: { CapabilityChips, RssiIndicator },
  inject: ["confirm"],
  props: {
    device: { type: Object, required: true },
  },
  data() {
    return { localVolume: 0, dragging: false };
  },
  beforeUnmount() {
    clearTimeout(this._volTimer);
  },
  computed: {
    sink() {
      return this.$store.getters.sinkForAddress(this.device.address);
    },
    sinkVolume() {
      return this.sink ? this.sink.volume : null;
    },
    volumeIcon() {
      if (!this.sink || this.sink.mute) return "mdi-volume-mute";
      const v = this.localVolume;
      if (v === 0) return "mdi-volume-variant-off";
      if (v < 40) return "mdi-volume-low";
      if (v < 75) return "mdi-volume-medium";
      return "mdi-volume-high";
    },
    statusColor() {
      if (this.device.connected) return "success";
      if (this.device.paired) return "primary";
      return "secondary";
    },
    statusText() {
      if (this.device.connected) return this.$t("device.connected");
      if (this.device.paired) return this.$t("device.paired");
      return this.$t("device.discovered");
    },
    showMenu() {
      return this.device.stored || this.device.paired;
    },
    profilesText() {
      return profileLabels(this.device.uuids);
    },
    profilesState() {
      const d = this.device;
      if (d.cod_matched && !d.paired) {
        return {
          cls: "text-warning",
          icon: "mdi-information-outline",
          text: this.$t("device.detectedByClass"),
        };
      }
      if (d.paired && !this.profilesText) {
        return {
          cls: "text-warning",
          icon: "mdi-alert-outline",
          text: this.$t("device.pairedNoProfiles"),
        };
      }
      if (this.profilesText) {
        return {
          cls: "text-medium-emphasis",
          icon: null,
          text: this.profilesText,
        };
      }
      return null;
    },
    sinkInfo() {
      if (!this.device.connected) return null;
      const sink = this.sink;
      if (!sink) return null;
      const parts = [
        sink.sample_rate ? `${(sink.sample_rate / 1000).toFixed(1)} kHz` : null,
        sink.channels ? `${sink.channels}ch` : null,
        sink.format || null,
      ].filter(Boolean);
      const stateMap = {
        running: this.$t("sink.streaming"),
        idle: this.$t("sink.idle"),
        suspended: this.$t("sink.suspended"),
      };
      return {
        parts: parts.join(" / "),
        vol: sink.mute ? this.$t("sink.muted") : `${sink.volume}%`,
        stateLabel: stateMap[sink.state] || sink.state,
      };
    },
    featureChips() {
      const d = this.device;
      const out = [];
      const im = d.idle_mode || "default";
      if (im === "power_save") {
        out.push({
          color: "info",
          icon: "mdi-moon-waning-crescent",
          text: this.$t("device.powerSave"),
        });
      } else if (im === "keep_alive" && d.keep_alive_active) {
        out.push({
          color: "error",
          icon: "mdi-heart-pulse",
          text: this.$t("device.stayAwake"),
        });
      } else if (im === "auto_disconnect") {
        out.push({
          color: "warning",
          icon: "mdi-power-plug-off-outline",
          text: this.$t("device.autoDisconnect"),
        });
      }
      if (d.mpd_enabled) {
        out.push({
          color: "primary",
          icon: "mdi-music",
          text: `MPD :${d.mpd_port || "?"}`,
        });
      }
      return out;
    },
  },
  watch: {
    // Keep the slider in sync with external volume changes (speaker buttons,
    // sinks_changed) — but never while the user is actively dragging.
    sinkVolume: {
      immediate: true,
      handler(v) {
        if (!this.dragging && v != null) this.localVolume = v;
      },
    },
  },
  methods: {
    onSlide(v) {
      // Throttle live updates to ~1 per 300ms while dragging.
      const now = Date.now();
      if (now - (this._lastSent || 0) >= 300) {
        this._lastSent = now;
        this.sendVolume(v);
      } else {
        clearTimeout(this._volTimer);
        this._volTimer = setTimeout(() => {
          this._lastSent = Date.now();
          this.sendVolume(this.localVolume);
        }, 300);
      }
    },
    onSlideEnd() {
      this.dragging = false;
      clearTimeout(this._volTimer);
      this.sendVolume(this.localVolume);
    },
    sendVolume(v) {
      this.$store.dispatch("setVolume", {
        address: this.device.address,
        volume: Math.round(v),
      });
    },
    toggleMute() {
      this.$store.dispatch("setMute", {
        address: this.device.address,
        mute: !this.sink.mute,
      });
    },
    openSettings() {
      this.$store.commit("setOverlay", {
        overlay: "deviceSettings",
        address: this.device.address,
      });
    },
    connect() {
      this.$store.dispatch("connect", this.device.address);
    },
    disconnect() {
      this.$store.dispatch("disconnect", this.device.address);
    },
    pair() {
      this.$store.dispatch("pair", this.device.address);
    },
    dismiss() {
      this.$store.dispatch("forget", this.device.address);
    },
    forceReconnect() {
      this.$store.dispatch("forceReconnect", this.device.address);
    },
    async forget() {
      const ok = await this.confirm(
        this.$t("forget.title"),
        this.$t("forget.message", { address: this.device.address }),
        {
          color: "error",
          icon: "mdi-delete-outline",
          confirmText: this.$t("forget.confirm"),
        },
      );
      if (ok) this.$store.dispatch("forget", this.device.address);
    },
  },
};
</script>

<style scoped>
.device-stale {
  opacity: 0.55;
}
</style>
