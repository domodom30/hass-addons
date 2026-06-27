import { defineStore } from "pinia";
import { useDevicesStore } from "./devices.js";

const MAX_EVENT_ENTRIES = 100;
const VOLUME_DEDUP_MS = 1500;

let _eventId = 0;
const _lastVolumeEvent = {}; // address -> { value, ts } (non-reactive dedup)

function eventTime(data) {
  const d = data.ts ? new Date(data.ts * 1000) : new Date();
  return d.toLocaleTimeString();
}

function deviceName(address) {
  if (!address) return "";
  const dev = useDevicesStore().deviceByAddress(address);
  return dev ? dev.name : "";
}

function deviceHasAvrcp(address) {
  if (!address) return false;
  const dev = useDevicesStore().deviceByAddress(address);
  if (!dev || !dev.uuids) return false;
  return dev.uuids.some(
    (u) => u.startsWith("0000110c") || u.startsWith("0000110e"),
  );
}

// Combined MPRIS + AVRCP/Transport event log. Ports app.js §9, including the
// 1.5s volume-event de-duplication and the AVRCP-vs-Transport labelling.
export const useEventsStore = defineStore("events", {
  state: () => ({
    entries: [], // { id, kind, time, command?, detail?, property?, value?, name }
  }),
  getters: {
    count: (state) => state.entries.length,
  },
  actions: {
    _push(entry) {
      this.entries.push({ id: ++_eventId, ...entry });
      if (this.entries.length > MAX_EVENT_ENTRIES) {
        this.entries = this.entries.slice(-MAX_EVENT_ENTRIES);
      }
    },
    addMpris(data) {
      let name = "";
      if (data.address) {
        name = deviceName(data.address);
      } else {
        // Infer from a single connected device when the backend didn't resolve.
        const connected = useDevicesStore().displayed.filter((d) => d.connected);
        if (connected.length === 1) name = connected[0].name;
      }
      this._push({
        kind: "mpris",
        time: eventTime(data),
        command: data.command,
        detail: data.detail || "",
        name,
      });
    },
    addAvrcp(data) {
      if (data.property === "Volume" && data.address) {
        const now = Date.now();
        const prev = _lastVolumeEvent[data.address];
        if (
          prev &&
          prev.value === String(data.value) &&
          now - prev.ts < VOLUME_DEDUP_MS
        ) {
          return; // suppress duplicate (D-Bus, PulseAudio and AVRCP can all fire)
        }
        _lastVolumeEvent[data.address] = { value: String(data.value), ts: now };
      }

      const valueStr =
        typeof data.value === "object"
          ? JSON.stringify(data.value)
          : String(data.value);
      const isAvrcp = deviceHasAvrcp(data.address);

      this._push({
        kind: isAvrcp ? "avrcp" : "transport",
        time: eventTime(data),
        property: data.property,
        value: valueStr,
        name: deviceName(data.address),
      });
    },
    clear() {
      this.entries = [];
    },
  },
});
