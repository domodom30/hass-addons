import { defineStore } from "pinia";

const DEVICE_STALE_MS = 20000; // keep disappeared (discovered-only) devices 20s

// Non-reactive bookkeeping for the debounced fade-out of devices that vanish
// between scans. Kept outside Pinia state to avoid Map reactivity quirks; the
// reactive output is always the freshly reassigned `displayed` array.
const _lastSeen = new Map(); // address -> timestamp (ms)
const _cache = new Map(); // address -> last known device object
let _cleanupTimer = null;

// Priority: connected (0) > paired/stored (1) > discovered (2), then address.
function priority(d) {
  return d.connected ? 0 : d.paired || d.stored ? 1 : 2;
}

function sortStable(devices) {
  return devices.slice().sort((a, b) => {
    const pa = priority(a);
    const pb = priority(b);
    if (pa !== pb) return pa - pb;
    return a.address.localeCompare(b.address);
  });
}

export const useDevicesStore = defineStore("devices", {
  state: () => ({
    raw: null, // last raw device list from the server (no stale entries)
    sinks: [], // PulseAudio sinks, merged into cards reactively
    displayed: [], // merged (stale-aware) + stably sorted list rendered by the UI
  }),
  getters: {
    deviceByAddress: (state) => (address) =>
      state.displayed.find((d) => d.address === address) || null,
    hasStoredOrPaired: (state) =>
      !!state.displayed.some((d) => d.stored || d.paired),
    sinkForAddress: (state) => (address) => {
      const macNorm = address.replace(/:/g, "_").toLowerCase();
      return state.sinks.find(
        (s) => s.name && s.name.toLowerCase().includes(macNorm),
      );
    },
    usedMpdPorts: (state) => (excludeAddress) =>
      new Set(
        state.displayed
          .filter((d) => d.mpd_port != null && d.address !== excludeAddress)
          .map((d) => d.mpd_port),
      ),
  },
  actions: {
    setSinks(sinks) {
      this.sinks = sinks || [];
    },
    applyDevices(devices) {
      const now = Date.now();
      this.raw = devices;

      if (devices) {
        for (const d of devices) {
          _lastSeen.set(d.address, now);
          _cache.set(d.address, d);
        }
      }

      const merged = devices ? [...devices] : [];
      const seen = new Set(merged.map((d) => d.address));

      for (const [addr, lastSeen] of _lastSeen) {
        if (seen.has(addr)) continue;
        const age = now - lastSeen;
        if (age < DEVICE_STALE_MS) {
          const cached = _cache.get(addr);
          if (cached && !cached.paired && !cached.stored && !cached.connected) {
            merged.push({ ...cached, _stale: true });
            seen.add(addr);
          }
        } else {
          _lastSeen.delete(addr);
          _cache.delete(addr);
        }
      }

      this.displayed = sortStable(merged);
      this._ensureCleanupTimer();
    },
    _ensureCleanupTimer() {
      if (_cleanupTimer) return;
      _cleanupTimer = setInterval(() => {
        const now = Date.now();
        const hasStale = [..._lastSeen.entries()].some(
          ([addr, ts]) =>
            !this.raw?.find((d) => d.address === addr) &&
            now - ts < DEVICE_STALE_MS,
        );
        // Re-run the merge to flush just-expired entries.
        this.applyDevices(this.raw);
        if (!hasStale) {
          clearInterval(_cleanupTimer);
          _cleanupTimer = null;
        }
      }, 5000);
    },
    // Clears the fade-out bookkeeping (e.g. after an adapter switch wipes all
    // devices). Also gives tests a clean slate since the Maps are module-level.
    resetTracking() {
      _lastSeen.clear();
      _cache.clear();
      if (_cleanupTimer) {
        clearInterval(_cleanupTimer);
        _cleanupTimer = null;
      }
      this.raw = null;
      this.displayed = [];
    },
  },
});
