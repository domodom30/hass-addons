<template>
  <span v-if="device.rssi != null" class="d-inline-flex align-center ga-1">
    <v-icon size="13" :color="color" :title="title">mdi-signal</v-icon>
    <span class="text-caption" :class="stale ? 'text-secondary' : 'text-medium-emphasis'">
      {{ device.rssi }} dBm
    </span>
  </span>
</template>

<script>
export default {
  name: "RssiIndicator",
  props: {
    device: { type: Object, required: true },
  },
  computed: {
    stale() {
      return !!this.device.rssi_stale;
    },
    color() {
      if (this.stale) return "grey";
      const q = this.device.signal_quality;
      if (q === "excellent" || q === "good") return "success";
      if (q === "fair") return "warning";
      return "error";
    },
    title() {
      const q = this.device.signal_quality || "unknown";
      return this.stale ? `${q} (last seen during scan)` : q;
    },
  },
};
</script>
