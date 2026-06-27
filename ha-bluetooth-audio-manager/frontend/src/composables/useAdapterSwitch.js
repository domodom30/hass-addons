import { apiPost } from "@/api/client.js";
import { useUiStore } from "@/stores/ui.js";
import { useDevicesStore } from "@/stores/devices.js";
import { useModalsStore } from "@/stores/modals.js";

// Adapter selection + switch flow. Ports selectAdapter / doAdapterSwitch
// (app.js §11). Switching unpairs everything, so we confirm first unless
// there are no stored/paired devices to lose.
export function useAdapterSwitch() {
  const ui = useUiStore();
  const devices = useDevicesStore();
  const modals = useModalsStore();

  async function doAdapterSwitch(mac, label, clean) {
    modals.closeAdapterSwitch();
    modals.closeAdapters();
    ui.showBanner(
      clean
        ? `Cleaning devices and switching to ${label}...`
        : `Switching to adapter ${label}...`,
    );
    try {
      const result = await apiPost("/api/set-adapter", { adapter: mac, clean });
      if (result.restart_required) {
        ui.showBanner("Restarting app with new adapter...");
        // Fire-and-forget: the server dies during restart so the response
        // never arrives (expected 502). The WS reconnect loop detects revival.
        apiPost("/api/restart").catch(() => {});
      }
    } catch (e) {
      ui.hideBanner();
      ui.addToast(`Adapter switch failed: ${e.message}`, "error");
    }
  }

  async function selectAdapter(mac, label) {
    if (!devices.hasStoredOrPaired) {
      await doAdapterSwitch(mac, label, false);
      return;
    }
    modals.openAdapterSwitch(mac, label);
  }

  return { doAdapterSwitch, selectAdapter };
}
