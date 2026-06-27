<script setup>
import { ref, computed, watch } from "vue";
import { apiGet } from "@/api/client.js";
import { useModalsStore } from "@/stores/modals.js";
import { useAdapterSwitch } from "@/composables/useAdapterSwitch.js";
import BaseModal from "./BaseModal.vue";

const modals = useModalsStore();
const { selectAdapter } = useAdapterSwitch();

const adapters = ref(null); // null = loading, [] = none found
const error = ref(false);

async function load() {
  adapters.value = null;
  error.value = false;
  try {
    const data = await apiGet("/api/adapters");
    adapters.value = data.adapters || [];
  } catch {
    error.value = true;
    adapters.value = [];
  }
}

watch(
  () => modals.adapters,
  (open) => {
    if (open) load();
  },
);

// Friendly-name resolution + technical line, ports renderAdaptersModal §8.
const rows = computed(() =>
  (adapters.value || []).map((a) => {
    const hwResolved = a.hw_model && a.hw_model !== a.modalias;
    const aliasUseful = a.alias && a.alias !== a.name && !a.alias.includes(".");
    const friendlyName = hwResolved ? a.hw_model : aliasUseful ? a.alias : "";
    const techParts = [a.name];
    if (a.modalias) techParts.push(a.modalias);
    return {
      ...a,
      friendlyName,
      techLine: techParts.join(" — "),
      displayLabel: friendlyName || a.name,
      showSelect: !a.selected && a.powered,
    };
  }),
);
</script>

<template>
  <BaseModal
    :show="modals.adapters"
    size="modal-lg"
    scrollable
    @close="modals.closeAdapters()"
  >
    <template #title>
      <i class="fas fa-microchip me-2" />Bluetooth Adapters
    </template>

    <div class="alert alert-warning">
      <i class="fas fa-exclamation-triangle me-2" />
      <strong>Recommendation:</strong> Use a dedicated Bluetooth adapter that is
      <strong>not configured in Home Assistant</strong> and is not used for BLE
      scanning. Leave the adapter unconfigured in HA — this app will manage it
      directly.
    </div>
    <p class="text-muted">
      Only one adapter can be active at a time. Select which Bluetooth adapter to
      use. Changing the adapter requires an app restart. All existing devices will
      be unpaired and need to be re-paired with the new adapter.
    </p>

    <div
      v-if="adapters === null"
      class="text-center py-4"
    >
      <div
        class="spinner-border text-primary"
        role="status"
      >
        <span class="visually-hidden">Loading...</span>
      </div>
      <p class="mt-2 text-muted">
        Loading adapters...
      </p>
    </div>
    <p
      v-else-if="!rows.length"
      class="text-center text-muted py-3"
    >
      No Bluetooth adapters found.
    </p>
    <div v-else>
      <div
        v-for="a in rows"
        :key="a.address"
        class="card adapter-card mb-2"
      >
        <div
          class="card-body d-flex justify-content-between align-items-center py-2"
        >
          <div>
            <div
              v-if="a.friendlyName"
              class="fw-semibold"
            >
              {{ a.friendlyName }}
            </div>
            <div :class="a.friendlyName ? 'small text-muted' : 'fw-semibold'">
              {{ a.techLine }}
            </div>
            <div class="font-monospace small text-muted">
              {{ a.address }}
            </div>
          </div>
          <div class="d-flex align-items-center gap-2">
            <span
              v-if="a.powered"
              class="badge bg-success"
            >Powered</span>
            <span
              v-else
              class="badge bg-secondary"
            >Off</span>
            <span
              v-if="a.selected"
              class="badge bg-success"
            >In Use</span>
            <span
              v-if="a.ha_managed"
              class="badge bg-info"
            >HA Bluetooth</span>
            <span
              v-if="a.ble_scanning"
              class="badge bg-warning"
            >HA BLE Scanning</span>
            <button
              v-if="a.showSelect"
              type="button"
              class="btn btn-sm btn-primary"
              @click="selectAdapter(a.address, a.displayLabel)"
            >
              <i class="fas fa-check me-1" />Select
            </button>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <button
        type="button"
        class="btn btn-secondary"
        @click="modals.closeAdapters()"
      >
        Close
      </button>
    </template>
  </BaseModal>
</template>
