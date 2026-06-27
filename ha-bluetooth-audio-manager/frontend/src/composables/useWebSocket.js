import { API_BASE } from "@/api/client.js";
import { useDevicesStore } from "@/stores/devices.js";
import { useEventsStore } from "@/stores/events.js";
import { useLogsStore } from "@/stores/logs.js";
import { useUiStore } from "@/stores/ui.js";
import { useConnectionStore } from "@/stores/connection.js";

const WS_INITIAL_DELAY = 1000;
const WS_MAX_DELAY = 30000;
const WS_BACKOFF = 1.5;

// Real-time updates over WebSocket with exponential reconnect backoff.
// Ports app.js §12. Each message is routed to the relevant Pinia store; sink
// changes need no manual re-render because device cards read sinks reactively.
export function startWebSocket() {
  const devices = useDevicesStore();
  const events = useEventsStore();
  const logs = useLogsStore();
  const ui = useUiStore();
  const connection = useConnectionStore();

  let ws = null;
  let reconnectDelay = WS_INITIAL_DELAY;
  let connected = false;

  function connect() {
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${proto}//${location.host}${API_BASE}/api/ws`;
    ws = new WebSocket(wsUrl);

    ws.onmessage = (e) => {
      // First real message (not just TCP open) means the server is back.
      if (reconnectDelay !== WS_INITIAL_DELAY || !connected) {
        connected = true;
        ui.hideReconnect();
        ui.hideBanner();
      }
      reconnectDelay = WS_INITIAL_DELAY;

      const msg = JSON.parse(e.data);
      switch (msg.type) {
        case "devices_changed":
          devices.applyDevices(msg.devices);
          break;
        case "sinks_changed":
          devices.setSinks(msg.sinks);
          break;
        case "mpris_command":
          events.addMpris(msg);
          break;
        case "avrcp_event":
          events.addAvrcp(msg);
          break;
        case "log_entry":
          logs.add(msg);
          break;
        case "keepalive_changed":
          ui.addToast(
            `Keep-alive ${msg.enabled ? "started" : "stopped"} for ${msg.address}`,
            "info",
          );
          break;
        case "scan_started":
          connection.setScanning(true, msg.duration);
          break;
        case "scan_finished":
          connection.setScanning(false);
          if (msg.error) ui.addToast(`Scan failed: ${msg.error}`, "error");
          break;
        case "scan_state":
          if (msg.scanning && !connection.scanning) {
            connection.setScanning(true);
          } else if (!msg.scanning && connection.scanning) {
            connection.setScanning(false);
          }
          break;
        case "status":
          if (msg.message) ui.showBanner(msg.message);
          else ui.hideBanner();
          break;
        case "toast":
          ui.addToast(msg.message, msg.level || "info");
          break;
        case "warning_banner":
          ui.showWarningBanner(msg.message);
          break;
        case "settings_changed":
          // Updated by another client; the open modal reloads on next open.
          break;
        default:
          // eslint-disable-next-line no-console
          console.log("[WS] Unknown message type:", msg.type);
      }
    };

    ws.onclose = () => {
      ws = null;
      connected = false;
      ui.showReconnect();
      setTimeout(connect, reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * WS_BACKOFF, WS_MAX_DELAY);
    };

    ws.onerror = () => {
      if (ws) ws.close();
    };
  }

  connect();
}
