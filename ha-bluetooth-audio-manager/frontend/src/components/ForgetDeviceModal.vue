<script setup>
import { apiPost } from "@/api/client.js";
import { useModalsStore } from "@/stores/modals.js";
import { useUiStore } from "@/stores/ui.js";
import BaseModal from "./BaseModal.vue";

const modals = useModalsStore();
const ui = useUiStore();

async function confirm() {
  const address = modals.forget.address;
  modals.closeForget();
  if (!address) return;
  try {
    await apiPost("/api/forget", { address });
  } catch (e) {
    ui.addToast(`Forget failed: ${e.message}`, "error");
  }
}
</script>

<template>
  <BaseModal
    :show="modals.forget.open"
    header-class="bg-danger-subtle"
    @close="modals.closeForget()"
  >
    <template #title>
      <i class="fas fa-exclamation-triangle text-danger me-2" />Forget Device
    </template>
    <p>
      Forget device <strong>{{ modals.forget.address }}</strong>? This will unpair it.
    </p>
    <template #footer>
      <button
        type="button"
        class="btn btn-secondary"
        @click="modals.closeForget()"
      >
        Cancel
      </button>
      <button
        type="button"
        class="btn btn-danger"
        @click="confirm"
      >
        <i class="fas fa-trash me-1" />Forget
      </button>
    </template>
  </BaseModal>
</template>
