<script setup>
import { computed } from "vue";
import { useConnectionStore } from "@/stores/connection.js";
import { useDeviceActions } from "@/composables/useDeviceActions.js";

const connection = useConnectionStore();
const actions = useDeviceActions();

const label = computed(() => {
  if (!connection.scanning) return "Add Device";
  return connection.secondsRemaining > 0
    ? `Scanning… ${connection.secondsRemaining}s`
    : "Finishing…";
});
</script>

<template>
  <div id="add-device-wrapper">
    <div
      class="card add-device-tile"
      :class="{ scanning: connection.scanning }"
      role="button"
      tabindex="0"
      title="Scan for nearby Bluetooth audio devices"
      @click="actions.scan()"
      @keydown.enter="actions.scan()"
    >
      <div class="card-body">
        <i :class="connection.scanning ? 'fas fa-spinner fa-spin' : 'fas fa-plus'" />
        <span>{{ label }}</span>
      </div>
    </div>
  </div>
</template>
