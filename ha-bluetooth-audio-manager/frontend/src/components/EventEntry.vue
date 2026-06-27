<script setup>
import { computed } from "vue";

const props = defineProps({
  entry: { type: Object, required: true },
});

// Unifies appendMprisCommand + appendAvrcpEvent (app.js §9). The label/class
// for AVRCP vs Transport and the MPRIS/AVRCP distinction were resolved when
// the entry was created in the events store.
const meta = computed(() => {
  if (props.entry.kind === "mpris") {
    return { label: "MPRIS", cls: "mpris" };
  }
  if (props.entry.kind === "avrcp") {
    return { label: "AVRCP", cls: "avrcp" };
  }
  return { label: "Transport", cls: "transport" };
});
</script>

<template>
  <div class="event-entry">
    <span class="event-time">{{ entry.time }}</span>
    <span
      class="event-type"
      :class="meta.cls"
    >{{ meta.label }}</span>
    <span class="event-content">
      <template v-if="entry.kind === 'mpris'">
        <strong>{{ entry.command }}</strong><span
          v-if="entry.detail"
          class="text-muted"
        > {{ entry.detail }}</span>
      </template>
      <template v-else>
        <strong>{{ entry.property }}</strong> =
        <span class="text-success">{{ entry.value }}</span>
      </template>
      <span
        v-if="entry.name"
        class="text-muted"
      > [{{ entry.name }}]</span>
    </span>
  </div>
</template>
