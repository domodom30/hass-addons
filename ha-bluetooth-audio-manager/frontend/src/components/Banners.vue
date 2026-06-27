<script setup>
import { ref, watch, onBeforeUnmount } from "vue";
import { useUiStore } from "@/stores/ui.js";

const ui = useUiStore();

// Live "(Xm Ys)" elapsed counter for the reconnect banner. Ports the
// setInterval in showReconnectBanner (app.js §5b).
const elapsed = ref("");
let timer = null;

function tick() {
  if (!ui.reconnectStart) return;
  const s = Math.floor((Date.now() - ui.reconnectStart) / 1000);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  elapsed.value = m > 0 ? `(${m}m ${rem}s)` : `(${rem}s)`;
}

watch(
  () => ui.reconnecting,
  (on) => {
    clearInterval(timer);
    if (on) {
      tick();
      timer = setInterval(tick, 1000);
    } else {
      elapsed.value = "";
    }
  },
  { immediate: true },
);

onBeforeUnmount(() => clearInterval(timer));
</script>

<template>
  <div id="alert-container">
    <div
      v-if="ui.reconnecting"
      class="alert alert-warning d-flex align-items-center gap-2 mb-3"
      role="alert"
    >
      <div
        class="spinner-border spinner-border-sm"
        role="status"
      >
        <span class="visually-hidden">Reconnecting...</span>
      </div>
      <span>Reconnecting to server…</span>
      <span class="text-muted small">{{ elapsed }}</span>
    </div>

    <div
      v-if="ui.operationBanner"
      class="alert alert-info d-flex align-items-center gap-2 mb-3"
      role="alert"
    >
      <div
        class="spinner-border spinner-border-sm"
        role="status"
      >
        <span class="visually-hidden">Loading...</span>
      </div>
      <span>{{ ui.operationBanner }}</span>
    </div>

    <div
      v-if="ui.warningBanner"
      class="alert alert-warning alert-dismissible d-flex align-items-center gap-2 mb-3"
      role="alert"
    >
      <i class="fas fa-exclamation-triangle" />
      <span>{{ ui.warningBanner }}</span>
      <button
        type="button"
        class="btn-close"
        aria-label="Close"
        @click="ui.hideWarningBanner()"
      />
    </div>
  </div>
</template>
