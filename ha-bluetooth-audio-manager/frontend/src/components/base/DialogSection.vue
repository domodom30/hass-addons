<template>
  <div :class="{ 'mt-6': !first }">
    <div
      v-if="title"
      class="text-overline text-medium-emphasis mb-2 dialog-section-title"
    >
      {{ title }}
    </div>
    <div class="d-flex flex-column ga-4">
      <slot />
    </div>
  </div>
</template>

<script>
export default {
  name: "DialogSection",
  props: {
    title: { type: String, default: "" },
    first: { type: Boolean, default: false },
  },
};
</script>

<style scoped>
.dialog-section-title {
  line-height: 1.2;
  letter-spacing: 0.08em;
}
</style>
