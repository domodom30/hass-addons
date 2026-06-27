import { defineStore } from "pinia";
import { apiGet } from "@/api/client.js";

// App metadata and feature flags fetched once from /api/info. Replaces the
// window._hfpSwitchingEnabled / window._mpdHostname / window._mpdPasswordSet
// globals from the original app.js.
export const useInfoStore = defineStore("info", {
  state: () => ({
    version: "loading...",
    adapter: "",
    hfpSwitchingEnabled: false,
    mpdHostname: location.hostname,
    mpdPasswordSet: false,
    loaded: false,
  }),
  actions: {
    async load() {
      try {
        const data = await apiGet("/api/info");
        this.version = data.version;
        this.adapter = data.adapter || "";
        this.hfpSwitchingEnabled = !!data.hfp_switching_enabled;
        this.mpdHostname = data.hostname || location.hostname;
        this.mpdPasswordSet = !!data.mpd_password_set;
        this.loaded = true;
      } catch {
        this.version = "unknown";
      }
    },
  },
});
