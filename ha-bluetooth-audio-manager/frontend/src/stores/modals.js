import { defineStore } from "pinia";

// Centralized modal visibility + context so deeply nested components (e.g.
// DeviceCard) can open modals without prop drilling. Replaces the imperative
// `new bootstrap.Modal(...)` calls from the original app.js.
export const useModalsStore = defineStore("modals", {
  state: () => ({
    adapters: false,
    appSettings: false,
    adapterSwitch: { open: false, mac: null, label: null },
    deviceSettings: { open: false, device: null },
    forget: { open: false, address: null },
  }),
  actions: {
    openAdapters() {
      this.adapters = true;
    },
    closeAdapters() {
      this.adapters = false;
    },
    openAppSettings() {
      this.appSettings = true;
    },
    closeAppSettings() {
      this.appSettings = false;
    },
    openAdapterSwitch(mac, label) {
      this.adapterSwitch = { open: true, mac, label };
    },
    closeAdapterSwitch() {
      this.adapterSwitch = { open: false, mac: null, label: null };
    },
    openDeviceSettings(device) {
      this.deviceSettings = { open: true, device };
    },
    closeDeviceSettings() {
      this.deviceSettings = { open: false, device: null };
    },
    openForget(address) {
      this.forget = { open: true, address };
    },
    closeForget() {
      this.forget = { open: false, address: null };
    },
  },
});
