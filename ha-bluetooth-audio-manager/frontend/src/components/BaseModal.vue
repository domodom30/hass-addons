<script setup>
import { watch, onBeforeUnmount } from "vue";

const props = defineProps({
  show: { type: Boolean, default: false },
  title: { type: String, default: "" },
  size: { type: String, default: "" }, // e.g. "modal-lg"
  headerClass: { type: String, default: "" },
  scrollable: { type: Boolean, default: false },
});

const emit = defineEmits(["close"]);

function close() {
  emit("close");
}

function onKeydown(e) {
  if (e.key === "Escape") close();
}

// Lock body scroll and wire ESC while open (parity with Bootstrap's modal).
watch(
  () => props.show,
  (open) => {
    if (open) {
      document.body.classList.add("modal-open");
      document.addEventListener("keydown", onKeydown);
    } else {
      document.body.classList.remove("modal-open");
      document.removeEventListener("keydown", onKeydown);
    }
  },
);

onBeforeUnmount(() => {
  document.body.classList.remove("modal-open");
  document.removeEventListener("keydown", onKeydown);
});
</script>

<template>
  <Teleport to="body">
    <template v-if="show">
      <div
        class="modal fade show d-block"
        tabindex="-1"
        role="dialog"
        @mousedown.self="close"
      >
        <div
          class="modal-dialog modal-dialog-centered"
          :class="[size, { 'modal-dialog-scrollable': scrollable }]"
        >
          <div class="modal-content">
            <div
              class="modal-header"
              :class="headerClass"
            >
              <h5 class="modal-title">
                <slot name="title">
                  {{ title }}
                </slot>
              </h5>
              <button
                type="button"
                class="btn-close"
                aria-label="Close"
                @click="close"
              />
            </div>
            <div class="modal-body">
              <slot />
            </div>
            <div
              v-if="$slots.footer"
              class="modal-footer"
            >
              <slot name="footer" />
            </div>
          </div>
        </div>
      </div>
      <div class="modal-backdrop fade show" />
    </template>
  </Teleport>
</template>
