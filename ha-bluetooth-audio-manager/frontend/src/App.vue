<script setup>
import { onMounted } from "vue";
import { useUiStore } from "@/stores/ui.js";
import { useInfoStore } from "@/stores/info.js";
import { useModalsStore } from "@/stores/modals.js";
import { startWebSocket } from "@/composables/useWebSocket.js";

import NavDropdown from "@/components/NavDropdown.vue";
import ToastContainer from "@/components/ToastContainer.vue";
import DevicesView from "@/views/DevicesView.vue";
import EventsView from "@/views/EventsView.vue";
import LogsView from "@/views/LogsView.vue";
import AdaptersModal from "@/components/AdaptersModal.vue";
import AdapterSwitchModal from "@/components/AdapterSwitchModal.vue";
import AppSettingsModal from "@/components/AppSettingsModal.vue";
import DeviceSettingsModal from "@/components/DeviceSettingsModal.vue";
import ForgetDeviceModal from "@/components/ForgetDeviceModal.vue";

const ui = useUiStore();
const info = useInfoStore();
const modals = useModalsStore();

onMounted(() => {
  info.load();
  startWebSocket();

  // Follow the OS theme while running (initial value is set in index.html).
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", (e) => {
      document.documentElement.setAttribute(
        "data-bs-theme",
        e.matches ? "dark" : "light",
      );
    });
});
</script>

<template>
  <ToastContainer />

  <div class="app-header text-white py-4 mb-4">
    <div class="container">
      <div class="row align-items-center">
        <div class="col">
          <h1 class="mb-0">
            <i class="fab fa-bluetooth-b me-2" />Bluetooth Audio Manager
          </h1>
          <p class="mb-0 opacity-75">
            Manage Bluetooth audio device connections
          </p>
          <div class="build-info">
            <span class="build-label">Build</span>
            <span class="build-version">{{ info.version }}</span>
          </div>
        </div>
        <div class="col-auto">
          <NavDropdown
            label="Views"
            icon="fas fa-eye"
          >
            <li>
              <a
                class="dropdown-item"
                href="#"
                @click.prevent="ui.setView('events')"
              >
                <i class="fas fa-list me-2" />Events
              </a>
            </li>
            <li>
              <a
                class="dropdown-item"
                href="#"
                @click.prevent="ui.setView('logs')"
              >
                <i class="fas fa-scroll me-2" />Logs
              </a>
            </li>
          </NavDropdown>

          <NavDropdown
            label="Settings"
            icon="fas fa-cog"
          >
            <li>
              <a
                class="dropdown-item"
                href="#"
                @click.prevent="modals.openAppSettings()"
              >
                <i class="fas fa-sliders me-2" />App Settings
              </a>
            </li>
            <li>
              <a
                class="dropdown-item"
                href="#"
                @click.prevent="modals.openAdapters()"
              >
                <i class="fas fa-microchip me-2" />Bluetooth Adapters
              </a>
            </li>
          </NavDropdown>
        </div>
      </div>
    </div>
  </div>

  <DevicesView v-show="ui.activeView === 'devices'" />
  <EventsView v-show="ui.activeView === 'events'" />
  <LogsView v-show="ui.activeView === 'logs'" />

  <footer class="app-footer text-center py-2 text-muted">
    <span>{{ info.version }}<template v-if="info.adapter"> ({{ info.adapter }})</template></span>
  </footer>

  <AdaptersModal />
  <AdapterSwitchModal />
  <AppSettingsModal />
  <DeviceSettingsModal />
  <ForgetDeviceModal />
</template>
