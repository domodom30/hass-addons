<template>
  <div class="d-flex align-center ga-3 px-5 py-3">
    <v-avatar :color="color" size="36" variant="tonal">
      <v-icon size="20">{{ icon }}</v-icon>
    </v-avatar>
    <div class="overflow-hidden flex-grow-1">
      <div class="text-subtitle-1 font-weight-bold text-truncate">
        <slot name="title">{{ title }}</slot>
      </div>
      <div
        v-if="subtitle || $slots.subtitle"
        class="text-caption text-medium-emphasis text-truncate"
        :class="{ 'font-mono': subtitleMono }"
      >
        <slot name="subtitle">{{ subtitle }}</slot>
      </div>
    </div>
    <slot name="append" />
    <v-btn
      v-if="closable"
      icon="mdi-close"
      variant="text"
      size="small"
      @click="$emit('close')"
    />
  </div>
</template>

<script>
export default {
  name: "DialogHeader",
  props: {
    icon: { type: String, required: true },
    color: { type: String, default: "primary" },
    title: { type: String, default: "" },
    subtitle: { type: String, default: "" },
    subtitleMono: { type: Boolean, default: false },
    closable: { type: Boolean, default: true },
  },
  emits: ["close"],
};
</script>
