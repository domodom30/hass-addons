<script setup>
import { computed } from "vue";

const props = defineProps({
  entry: { type: Object, required: true },
});

// Port of renderSingleLogEntry (app.js §10): HH:MM:SS.mmm timestamp, level
// chip, short logger name (last dotted segment) and message.
const timestamp = computed(() => {
  const d = new Date(props.entry.ts * 1000);
  return (
    d.toLocaleTimeString() + "." + String(d.getMilliseconds()).padStart(3, "0")
  );
});

const levelClass = computed(() => props.entry.level.toLowerCase());
const shortLogger = computed(() => (props.entry.logger || "").split(".").pop());
</script>

<template>
  <div class="log-entry">
    <span class="log-timestamp">{{ timestamp }}</span>
    <span
      class="log-level"
      :class="levelClass"
    >{{ entry.level }}</span>
    <span class="log-logger">{{ shortLogger }}</span>
    <span class="log-message">{{ entry.message }}</span>
  </div>
</template>
