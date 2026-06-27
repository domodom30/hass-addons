<script setup>
import { ref, computed, watch, nextTick } from "vue";
import { useLogsStore } from "@/stores/logs.js";
import { useUiStore } from "@/stores/ui.js";
import LogEntry from "@/components/LogEntry.vue";

const logs = useLogsStore();
const ui = useUiStore();

const containerEl = ref(null);

// "Live" off freezes the view (keeps a snapshot) without dropping buffered
// entries; turning it back on resumes the reactive filtered stream.
const frozen = ref(null);
watch(
  () => logs.live,
  (on) => {
    frozen.value = on ? null : [...logs.filtered];
  },
);

const displayed = computed(() =>
  logs.live ? logs.filtered : frozen.value || [],
);

watch(
  () => displayed.value.length,
  () => {
    if (!logs.autoScroll) return;
    nextTick(() => {
      if (containerEl.value)
        containerEl.value.scrollTop = containerEl.value.scrollHeight;
    });
  },
);
</script>

<template>
  <div class="view-panel">
    <div class="logs-toolbar bg-body-tertiary border-bottom sticky-top">
      <div class="container py-2">
        <div class="row g-2 align-items-center">
          <div class="col-auto">
            <button
              type="button"
              class="btn btn-outline-secondary btn-sm"
              @click="ui.setView('devices')"
            >
              <i class="fas fa-arrow-left me-1" />Back
            </button>
          </div>
          <div class="col-auto">
            <h5 class="mb-0">
              <i class="fas fa-scroll me-2" />Logs
            </h5>
          </div>
          <div class="col-auto">
            <select
              v-model="logs.levelFilter"
              class="form-select form-select-sm"
              aria-label="Filter by log level"
            >
              <option value="">
                All Levels
              </option>
              <option value="DEBUG">
                Debug
              </option>
              <option value="INFO">
                Info
              </option>
              <option value="WARNING">
                Warning
              </option>
              <option value="ERROR">
                Error
              </option>
            </select>
          </div>
          <div class="col">
            <div class="input-group input-group-sm">
              <span class="input-group-text"><i class="fas fa-search" /></span>
              <input
                v-model="logs.search"
                type="text"
                class="form-control"
                placeholder="Search logs..."
              >
            </div>
          </div>
          <div class="col-auto">
            <div class="form-check form-switch mb-0">
              <input
                id="log-auto-scroll"
                v-model="logs.autoScroll"
                class="form-check-input"
                type="checkbox"
              >
              <label
                class="form-check-label small"
                for="log-auto-scroll"
              >Auto-scroll</label>
            </div>
          </div>
          <div class="col-auto">
            <div class="form-check form-switch mb-0">
              <input
                id="log-live"
                v-model="logs.live"
                class="form-check-input"
                type="checkbox"
              >
              <label
                class="form-check-label small"
                for="log-live"
              >Live</label>
            </div>
          </div>
          <div class="col-auto">
            <span class="badge bg-secondary">{{ displayed.length }}</span>
          </div>
        </div>
      </div>
    </div>

    <div
      ref="containerEl"
      class="logs-container font-monospace"
    >
      <div
        v-if="!displayed.length"
        class="text-center py-5 text-muted"
      >
        <p>No matching log entries.</p>
      </div>
      <LogEntry
        v-for="e in displayed"
        :key="e.id"
        :entry="e"
      />
    </div>
  </div>
</template>
