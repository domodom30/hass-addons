<script setup>
import { computed } from "vue";

const props = defineProps({
  device: { type: Object, required: true },
});

// Port of the RSSI slot in buildDeviceCard (app.js §7): colour by signal
// quality, dim+grey when the reading is stale, and a clip-path that visually
// fills the signal icon proportionally to quality.
const CLIP_PCT = { excellent: 0, good: 20, fair: 45, weak: 70, very_weak: 70 };

const stale = computed(() => !!props.device.rssi_stale);

const colorClass = computed(() => {
  if (stale.value) return "text-secondary";
  const q = props.device.signal_quality;
  if (q === "excellent" || q === "good") return "text-success";
  if (q === "fair") return "text-warning";
  return "text-danger";
});

const clipStyle = computed(() => {
  const clip = CLIP_PCT[props.device.signal_quality] || 0;
  return clip ? { clipPath: `inset(0 ${clip}% 0 0)` } : {};
});

const title = computed(() => {
  const q = props.device.signal_quality || "unknown";
  return stale.value ? `${q} (last seen during scan)` : q;
});
</script>

<template>
  <span v-if="device.rssi != null">
    <i
      class="fas fa-signal"
      :class="colorClass"
      :style="clipStyle"
      :title="title"
    />
    <small :class="stale ? 'text-secondary' : 'text-muted'">
      {{ device.rssi }} dBm</small>
  </span>
</template>
