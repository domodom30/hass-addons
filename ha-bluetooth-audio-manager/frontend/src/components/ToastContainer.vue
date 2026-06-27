<script setup>
import { useUiStore } from "@/stores/ui.js";

const ui = useUiStore();

const ICONS = {
  info: "fas fa-info-circle text-primary",
  success: "fas fa-check-circle text-success",
  warning: "fas fa-exclamation-triangle text-warning",
  error: "fas fa-times-circle text-danger",
};
const TITLES = {
  info: "Info",
  success: "Success",
  warning: "Warning",
  error: "Error",
};
</script>

<template>
  <div
    class="toast-container position-fixed top-0 start-50 translate-middle-x p-3 toast-z"
  >
    <div
      v-for="t in ui.toasts"
      :key="t.id"
      class="toast show"
      role="alert"
    >
      <div class="toast-header">
        <i
          class="me-2"
          :class="ICONS[t.level] || ICONS.info"
        />
        <strong class="me-auto">{{ TITLES[t.level] || "Notice" }}</strong>
        <button
          type="button"
          class="btn-close"
          aria-label="Close"
          @click="ui.dismissToast(t.id)"
        />
      </div>
      <div class="toast-body">
        {{ t.message }}
      </div>
    </div>
  </div>
</template>
