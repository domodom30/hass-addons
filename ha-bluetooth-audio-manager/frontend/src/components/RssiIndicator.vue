<template>
  <span v-if="device.rssi != null" class="d-inline-flex align-center ga-1">
    <v-icon size="13" :color="color" :title="title">{{ icon }}</v-icon>
    <span class="text-caption" :class="stale ? 'text-secondary' : 'text-medium-emphasis'">
      {{ device.rssi }} dBm
    </span>
  </span>
</template>

<script>
// Signal quality (from the backend's classify_signal) → icon shape + color.
// Vuetify 3 does not resolve the Material "deep-orange" palette name, so the
// "weak" level uses a literal hex.
const QUALITY = {
  excellent: { icon: "mdi-signal-cellular-3", color: "success" },
  good: { icon: "mdi-signal-cellular-3", color: "success" },
  fair: { icon: "mdi-signal-cellular-2", color: "warning" },
  weak: { icon: "mdi-signal-cellular-1", color: "#E8590C" },
  very_weak: { icon: "mdi-signal-cellular-outline", color: "error" },
};
const FALLBACK = { icon: "mdi-signal-cellular-outline", color: "error" };

export default {
  name: "RssiIndicator",
  props: {
    device: { type: Object, required: true },
  },
  computed: {
    stale() {
      return !!this.device.rssi_stale;
    },
    icon() {
      if (this.stale) return "mdi-signal-off";
      return (QUALITY[this.device.signal_quality] || FALLBACK).icon;
    },
    color() {
      if (this.stale) return "grey";
      return (QUALITY[this.device.signal_quality] || FALLBACK).color;
    },
    title() {
      const q = this.device.signal_quality || "unknown";
      return this.stale ? this.$t("rssi.lastSeen", { quality: q }) : q;
    },
  },
};
</script>
