import { apiPost } from "@/api/client.js";
import { useUiStore } from "@/stores/ui.js";
import { useConnectionStore } from "@/stores/connection.js";

// Device lifecycle actions (scan/pair/connect/disconnect/...). Ports app.js
// §11. Each wraps the REST call and surfaces failures as toasts; device list
// updates arrive separately via the devices_changed websocket event.
export function useDeviceActions() {
  const ui = useUiStore();
  const connection = useConnectionStore();

  async function scan() {
    if (connection.scanning) return;
    try {
      const result = await apiPost("/api/scan");
      if (result.scanning) connection.setScanning(true, result.duration);
    } catch (e) {
      ui.addToast(`Scan failed: ${e.message}`, "error");
    }
  }

  async function pair(address) {
    try {
      const res = await apiPost("/api/pair", { address });
      if (res && res.warning === "no_audio_profiles") {
        ui.addToast(
          "Paired, but no audio profiles found — this device may not support audio playback.",
          "warning",
        );
      }
    } catch (e) {
      ui.addToast(`Pairing failed: ${e.message}`, "error");
    }
  }

  async function connect(address) {
    try {
      await apiPost("/api/connect", { address });
    } catch (e) {
      ui.addToast(`Connection failed: ${e.message}`, "error");
    }
  }

  async function disconnect(address) {
    try {
      await apiPost("/api/disconnect", { address });
    } catch (e) {
      ui.addToast(`Disconnect failed: ${e.message}`, "error");
    }
  }

  async function forceReconnect(address) {
    try {
      await apiPost("/api/force-reconnect", { address });
    } catch (e) {
      ui.addToast(`Force reconnect failed: ${e.message}`, "error");
    }
  }

  async function dismiss(address) {
    try {
      await apiPost("/api/forget", { address });
    } catch (e) {
      ui.addToast(`Dismiss failed: ${e.message}`, "error");
    }
  }

  return { scan, pair, connect, disconnect, forceReconnect, dismiss };
}
