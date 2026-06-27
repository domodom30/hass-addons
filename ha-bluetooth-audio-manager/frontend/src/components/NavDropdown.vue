<script setup>
import { ref, onBeforeUnmount } from "vue";

defineProps({
  label: { type: String, required: true },
  icon: { type: String, default: "" },
});

// Minimal click-to-open dropdown replacing Bootstrap's JS dropdown. Closes on
// outside click or on selecting an item (items live in the default slot).
const open = ref(false);

function toggle() {
  open.value = !open.value;
  if (open.value) document.addEventListener("click", close);
}
function close() {
  open.value = false;
  document.removeEventListener("click", close);
}
onBeforeUnmount(() => document.removeEventListener("click", close));
</script>

<template>
  <div class="dropdown d-inline-block me-2">
    <button
      class="btn btn-outline-light dropdown-toggle"
      type="button"
      :title="label"
      @click.stop="toggle"
    >
      <i
        v-if="icon"
        :class="icon"
        class="me-1"
      />{{ label }}
    </button>
    <ul
      class="dropdown-menu dropdown-menu-end"
      :class="{ show: open }"
    >
      <slot />
    </ul>
  </div>
</template>
