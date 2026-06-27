<script setup>
import { reactive, watch } from "vue";
import { useModalsStore } from "@/stores/modals.js";
import { useUiStore } from "@/stores/ui.js";
import { useSettingsStore } from "@/stores/settings.js";
import BaseModal from "./BaseModal.vue";

const modals = useModalsStore();
const ui = useUiStore();
const settings = useSettingsStore();

const form = reactive({
  scan_duration_seconds: 30,
  auto_reconnect: true,
  reconnect_interval_seconds: 30,
  reconnect_max_backoff_seconds: 300,
});

// Load current settings each time the modal opens (app.js openSettingsModal).
watch(
  () => modals.appSettings,
  async (open) => {
    if (!open) return;
    try {
      const data = await settings.load();
      Object.assign(form, data);
    } catch (e) {
      ui.addToast(`Failed to load settings: ${e.message}`, "error");
      modals.closeAppSettings();
    }
  },
);

async function save() {
  try {
    await settings.save({
      auto_reconnect: form.auto_reconnect,
      reconnect_interval_seconds: parseInt(form.reconnect_interval_seconds, 10),
      reconnect_max_backoff_seconds: parseInt(
        form.reconnect_max_backoff_seconds,
        10,
      ),
      scan_duration_seconds: parseInt(form.scan_duration_seconds, 10),
    });
    ui.addToast("Settings saved", "success");
    modals.closeAppSettings();
  } catch (e) {
    ui.addToast(`Failed to save settings: ${e.message}`, "error");
  }
}
</script>

<template>
  <BaseModal
    :show="modals.appSettings"
    @close="modals.closeAppSettings()"
  >
    <template #title>
      <i class="fas fa-sliders me-2" />App Settings
    </template>

    <div class="mb-3">
      <label
        class="form-label"
        for="setting-scan-duration"
      >Scan Duration (seconds)</label>
      <input
        id="setting-scan-duration"
        v-model="form.scan_duration_seconds"
        type="number"
        class="form-control"
        min="5"
        max="120"
        step="1"
      >
      <div class="form-text">
        How long to scan for discoverable Bluetooth audio devices (5–60).
      </div>
    </div>

    <hr>

    <div class="mb-3">
      <div class="form-check form-switch">
        <input
          id="setting-auto-reconnect"
          v-model="form.auto_reconnect"
          class="form-check-input"
          type="checkbox"
        >
        <label
          class="form-check-label"
          for="setting-auto-reconnect"
        >
          <strong>Auto Reconnect</strong>
        </label>
      </div>
      <div class="form-text">
        Automatically reconnect to paired devices when they become available.
      </div>
    </div>

    <div class="mb-3">
      <label
        class="form-label"
        for="setting-reconnect-interval"
      >Reconnect Interval (seconds)</label>
      <input
        id="setting-reconnect-interval"
        v-model="form.reconnect_interval_seconds"
        type="number"
        class="form-control"
        min="5"
        max="600"
        step="1"
      >
      <div class="form-text">
        Initial delay between reconnection attempts (5–600).
      </div>
    </div>

    <div class="mb-3">
      <label
        class="form-label"
        for="setting-reconnect-max-backoff"
      >Max Reconnect Backoff (seconds)</label>
      <input
        id="setting-reconnect-max-backoff"
        v-model="form.reconnect_max_backoff_seconds"
        type="number"
        class="form-control"
        min="60"
        max="3600"
        step="1"
      >
      <div class="form-text">
        Maximum delay between reconnection attempts with exponential backoff
        (60–3600).
      </div>
    </div>

    <template #footer>
      <button
        type="button"
        class="btn btn-secondary"
        @click="modals.closeAppSettings()"
      >
        Cancel
      </button>
      <button
        type="button"
        class="btn btn-primary"
        @click="save"
      >
        <i class="fas fa-save me-1" />Save
      </button>
    </template>
  </BaseModal>
</template>
