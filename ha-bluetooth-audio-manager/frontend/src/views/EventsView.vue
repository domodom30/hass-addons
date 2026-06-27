<script setup>
import { ref, watch, nextTick } from "vue";
import { useEventsStore } from "@/stores/events.js";
import { useUiStore } from "@/stores/ui.js";
import EventEntry from "@/components/EventEntry.vue";

const events = useEventsStore();
const ui = useUiStore();

const logEl = ref(null);

// Auto-scroll to newest, matching appendEventEntry (app.js §9).
watch(
  () => events.entries.length,
  () => {
    nextTick(() => {
      if (logEl.value) logEl.value.scrollTop = logEl.value.scrollHeight;
    });
  },
);
</script>

<template>
  <div class="view-panel">
    <div class="subview-header bg-body-tertiary border-bottom sticky-top">
      <div class="container py-2">
        <div class="d-flex align-items-center justify-content-between">
          <div class="d-flex align-items-center">
            <button
              type="button"
              class="btn btn-outline-secondary btn-sm me-3"
              @click="ui.setView('devices')"
            >
              <i class="fas fa-arrow-left me-1" />Back
            </button>
            <h5 class="mb-0">
              <i class="fas fa-list me-2" />Events
              <span class="badge bg-secondary ms-2">{{ events.count }}</span>
            </h5>
          </div>
          <button
            type="button"
            class="btn btn-outline-danger btn-sm"
            @click="events.clear()"
          >
            <i class="fas fa-trash me-1" />Clear
          </button>
        </div>
      </div>
    </div>
    <div class="container py-3">
      <div
        ref="logEl"
        class="events-log-container font-monospace"
      >
        <div
          v-if="!events.entries.length"
          class="text-center py-4 text-muted"
        >
          <i class="fas fa-satellite-dish fa-2x mb-2 d-block opacity-50" />
          No events yet. Connect a device and press buttons on it.
        </div>
        <EventEntry
          v-for="e in events.entries"
          :key="e.id"
          :entry="e"
        />
      </div>
    </div>
  </div>
</template>
