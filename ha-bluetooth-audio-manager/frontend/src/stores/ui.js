import { defineStore } from "pinia";

let _toastId = 0;

// UI chrome state: active view, toasts, operation/warning banners and the
// websocket reconnect indicator. Mirrors the imperative banner/toast helpers
// from the original app.js §4 / §5 / §5b.
export const useUiStore = defineStore("ui", {
  state: () => ({
    activeView: "devices", // "devices" | "events" | "logs"
    toasts: [], // { id, message, level }
    operationBanner: null, // string | null (spinner alert)
    warningBanner: null, // string | null (dismissible warning)
    reconnecting: false,
    reconnectStart: null, // epoch ms when the reconnect banner appeared
  }),
  actions: {
    setView(view) {
      this.activeView = view;
    },
    addToast(message, level = "info") {
      const id = ++_toastId;
      this.toasts.push({ id, message, level });
      setTimeout(() => this.dismissToast(id), 5000);
    },
    dismissToast(id) {
      this.toasts = this.toasts.filter((t) => t.id !== id);
    },
    showBanner(text) {
      this.operationBanner = text;
    },
    hideBanner() {
      this.operationBanner = null;
    },
    showWarningBanner(text) {
      this.warningBanner = text;
    },
    hideWarningBanner() {
      this.warningBanner = null;
    },
    showReconnect() {
      if (this.reconnecting) return;
      this.reconnecting = true;
      this.reconnectStart = Date.now();
    },
    hideReconnect() {
      this.reconnecting = false;
      this.reconnectStart = null;
    },
  },
});
