<script setup>
import { useModalsStore } from "@/stores/modals.js";
import { useAdapterSwitch } from "@/composables/useAdapterSwitch.js";
import BaseModal from "./BaseModal.vue";

const modals = useModalsStore();
const { doAdapterSwitch } = useAdapterSwitch();

function confirm() {
  const { mac, label } = modals.adapterSwitch;
  if (mac) doAdapterSwitch(mac, label, true);
}
</script>

<template>
  <BaseModal
    :show="modals.adapterSwitch.open"
    header-class="bg-warning-subtle"
    @close="modals.closeAdapterSwitch()"
  >
    <template #title>
      <i class="fas fa-exclamation-triangle text-warning me-2" />Switch Bluetooth
      Adapter
    </template>
    <p>
      You are about to switch to adapter
      <strong>{{ modals.adapterSwitch.label }}</strong>.
    </p>
    <div class="alert alert-warning mb-3">
      <i class="fas fa-info-circle me-2" />
      Bluetooth pairings are tied to a specific adapter. Switching adapters means
      <strong>all current device pairings will be removed</strong> and devices
      will need to be re-paired on the new adapter.
    </div>
    <p class="mb-0 text-muted small">
      All connected devices will be disconnected and removed before the app
      restarts with the new adapter.
    </p>
    <template #footer>
      <button
        type="button"
        class="btn btn-secondary"
        @click="modals.closeAdapterSwitch()"
      >
        Cancel
      </button>
      <button
        type="button"
        class="btn btn-warning"
        @click="confirm"
      >
        <i class="fas fa-exchange-alt me-1" />Switch &amp; Clear Pairings
      </button>
    </template>
  </BaseModal>
</template>
