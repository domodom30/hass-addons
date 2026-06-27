import { defineStore } from "pinia";
import { apiGet, apiPut } from "@/api/client.js";

// Runtime add-on settings (auto-reconnect, intervals, scan duration) managed
// by the App Settings modal. Ports app.js §11b.
export const useSettingsStore = defineStore("settings", {
  state: () => ({
    auto_reconnect: true,
    reconnect_interval_seconds: 30,
    reconnect_max_backoff_seconds: 300,
    scan_duration_seconds: 30,
  }),
  actions: {
    async load() {
      const data = await apiGet("/api/settings");
      this.$patch(data);
      return data;
    },
    async save(settings) {
      const data = await apiPut("/api/settings", settings);
      this.$patch(data);
      return data;
    },
  },
});
