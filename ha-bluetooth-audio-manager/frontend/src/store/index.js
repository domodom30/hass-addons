import { createStore } from "vuex";
import Api from "../api";
import { t } from "../i18n";
import { hasAvrcp } from "../profiles";
import {
  DEVICE_STALE_MS,
  mergeStale,
  isDuplicateVolume,
} from "../devices-util";

/** @type {Api} */
let api;

// ---- Device fade-out bookkeeping (module-level, non-reactive) ----
const _lastSeen = new Map();
const _cache = new Map();
let _cleanupTimer = null;

// ---- Events ----
const MAX_EVENTS = 100;
const MAX_LOGS = 1000;
let _eventId = 0;
let _logId = 0;
const _lastVolume = {};

function eventTime(data) {
  const d = data.ts ? new Date(data.ts * 1000) : new Date();
  return d.toLocaleTimeString();
}

const store = createStore({
  state: {
    ready: false,
    reconnecting: false,
    info: {
      version: import.meta.env.VITE_APP_VERSION || "dev",
      adapter: "",
      hfpSwitchingEnabled: false,
      mpdHostname: globalThis.location.hostname,
      mpdPasswordSet: false,
    },
    raw: null,
    devices: [],
    sinks: [],
    scanning: false,
    scanEndsAt: 0,
    events: [],
    logs: [],
    settings: {
      auto_reconnect: true,
      reconnect_interval_seconds: 30,
      reconnect_max_backoff_seconds: 300,
      scan_duration_seconds: 30,
    },
    adapters: null,
    errors: [],
    notices: [],
    status: null,
    ui: { overlay: null, address: null },
  },
  getters: {
    deviceByAddress: (state) => (address) =>
      state.devices.find((d) => d.address === address) || null,
    connectedCount: (state) => state.devices.filter((d) => d.connected).length,
    managedCount: (state) =>
      state.devices.filter((d) => d.stored || d.paired).length,
    // Devices shown on the dashboard grid (paired/stored/connected only).
    managedDevices: (state) =>
      state.devices.filter((d) => d.paired || d.stored || d.connected),
    // Freshly discovered, not-yet-managed devices (shown in the add wizard).
    discoveredDevices: (state) =>
      state.devices.filter(
        (d) => !d.paired && !d.stored && !d.connected && !d._stale,
      ),
    hasStoredOrPaired: (state) =>
      state.devices.some((d) => d.stored || d.paired),
    sinkForAddress: (state) => (address) => {
      const mac = address.replace(/:/g, "_").toLowerCase();
      return state.sinks.find((s) => s.name && s.name.toLowerCase().includes(mac));
    },
    usedMpdPorts: (state) => (excludeAddress) =>
      new Set(
        state.devices
          .filter((d) => d.mpd_port != null && d.address !== excludeAddress)
          .map((d) => d.mpd_port),
      ),
  },
  mutations: {
    setReady(state) {
      state.ready = true;
    },
    setReconnecting(state, value) {
      state.reconnecting = value;
    },
    setInfo(state, info) {
      state.info = { ...state.info, ...info };
    },
    setDevices(state, devices) {
      state.raw = devices;
      state.devices = mergeStale(devices, _lastSeen, _cache);
      if (!_cleanupTimer) {
        _cleanupTimer = setInterval(() => {
          const now = Date.now();
          const hasStale = [..._lastSeen.entries()].some(
            ([addr, ts]) =>
              !state.raw?.find((d) => d.address === addr) &&
              now - ts < DEVICE_STALE_MS,
          );
          state.devices = mergeStale(state.raw, _lastSeen, _cache);
          if (!hasStale) {
            clearInterval(_cleanupTimer);
            _cleanupTimer = null;
          }
        }, 5000);
      }
    },
    setSinks(state, sinks) {
      state.sinks = sinks || [];
    },
    // Optimistic patch of a device's sink (volume/mute) for instant UI feedback;
    // the authoritative state arrives right after via the sinks_changed event.
    patchSink(state, { address, patch }) {
      const mac = address.replace(/:/g, "_").toLowerCase();
      const sink = state.sinks.find(
        (s) => s.name && s.name.toLowerCase().includes(mac),
      );
      if (sink) Object.assign(sink, patch);
    },
    setScan(state, { scanning, duration }) {
      state.scanning = scanning;
      state.scanEndsAt = scanning && duration ? Date.now() + duration * 1000 : 0;
    },
    addMpris(state, data) {
      let name = "";
      if (data.address) {
        name = store.getters.deviceByAddress(data.address)?.name || "";
      } else {
        const connected = state.devices.filter((d) => d.connected);
        if (connected.length === 1) name = connected[0].name;
      }
      state.events.push({
        id: ++_eventId,
        kind: "mpris",
        time: eventTime(data),
        command: data.command,
        detail: data.detail || "",
        name,
      });
      if (state.events.length > MAX_EVENTS)
        state.events = state.events.slice(-MAX_EVENTS);
    },
    addAvrcp(state, data) {
      if (
        data.property === "Volume" &&
        data.address &&
        isDuplicateVolume(_lastVolume, data.address, data.value)
      ) {
        return;
      }
      const valueStr =
        typeof data.value === "object"
          ? JSON.stringify(data.value)
          : String(data.value);
      const dev = store.getters.deviceByAddress(data.address);
      const isAvrcp = dev ? hasAvrcp(dev.uuids) : false;
      state.events.push({
        id: ++_eventId,
        kind: isAvrcp ? "avrcp" : "transport",
        time: eventTime(data),
        property: data.property,
        value: valueStr,
        name: dev?.name || "",
      });
      if (state.events.length > MAX_EVENTS)
        state.events = state.events.slice(-MAX_EVENTS);
    },
    clearEvents(state) {
      state.events = [];
    },
    addLog(state, data) {
      state.logs.push({ id: ++_logId, ...data });
      if (state.logs.length > MAX_LOGS) state.logs = state.logs.slice(-MAX_LOGS);
    },
    setSettings(state, settings) {
      const allowed = [
        "auto_reconnect",
        "reconnect_interval_seconds",
        "reconnect_max_backoff_seconds",
        "scan_duration_seconds",
      ];
      const patch = {};
      for (const k of allowed) if (k in settings) patch[k] = settings[k];
      state.settings = { ...state.settings, ...patch };
    },
    setAdapters(state, adapters) {
      state.adapters = adapters;
    },
    setError(state, data) {
      state.errors.push(data);
    },
    clearErrors(state) {
      state.errors = [];
    },
    setNotice(state, data) {
      state.notices.push(data);
    },
    clearNotices(state) {
      state.notices = [];
    },
    setStatus(state, message) {
      state.status = message;
    },
    setOverlay(state, { overlay, address = null }) {
      state.ui = { overlay, address };
    },
    clearOverlay(state) {
      state.ui = { overlay: null, address: null };
    },
  },
  actions: {
    async init({ commit }) {
      if (api) return;
      api = new Api(store);
      api.connect();
      commit("setReady");
      // Initial REST loads (devices/sinks arrive over the WS on connect).
      try {
        const info = await api.getInfo();
        commit("setInfo", {
          version: info.version,
          adapter: info.adapter,
          hfpSwitchingEnabled: !!info.hfp_switching_enabled,
          mpdHostname: info.hostname || globalThis.location.hostname,
          mpdPasswordSet: !!info.mpd_password_set,
        });
      } catch {
        // info is best-effort
      }
      try {
        commit("setSettings", await api.getSettings());
      } catch {
        // settings best-effort
      }
    },
    async loadAdapters({ commit }) {
      try {
        const data = await api.getAdapters();
        commit("setAdapters", data.adapters || []);
      } catch (e) {
        commit("setAdapters", []);
        commit("setError", { message: e.message });
      }
    },
    async scan({ state, commit }) {
      if (state.scanning) return;
      try {
        const r = await api.scan();
        if (r.scanning) commit("setScan", { scanning: true, duration: r.duration });
      } catch (e) {
        commit("setError", { message: t("notify.scanFailed", { error: e.message }) });
      }
    },
    async pair({ commit }, address) {
      try {
        const r = await api.pair(address);
        if (r && r.warning === "no_audio_profiles") {
          commit("setNotice", { message: t("notify.pairedNoProfiles") });
        }
      } catch (e) {
        commit("setError", { message: t("notify.pairFailed", { error: e.message }) });
      }
    },
    async connect({ commit }, address) {
      try {
        await api.connectDevice(address);
      } catch (e) {
        commit("setError", { message: t("notify.connectFailed", { error: e.message }) });
      }
    },
    async disconnect({ commit }, address) {
      try {
        await api.disconnect(address);
      } catch (e) {
        commit("setError", { message: t("notify.disconnectFailed", { error: e.message }) });
      }
    },
    async forceReconnect({ commit }, address) {
      try {
        await api.forceReconnect(address);
      } catch (e) {
        commit("setError", { message: t("notify.forceReconnectFailed", { error: e.message }) });
      }
    },
    async forget({ commit }, address) {
      try {
        await api.forget(address);
      } catch (e) {
        commit("setError", { message: t("notify.forgetFailed", { error: e.message }) });
      }
    },
    async setVolume({ commit }, { address, volume }) {
      commit("patchSink", { address, patch: { volume } });
      try {
        await api.setVolume(address, volume);
      } catch (e) {
        commit("setError", { message: t("notify.volumeFailed", { error: e.message }) });
      }
    },
    async setMute({ commit }, { address, mute }) {
      commit("patchSink", { address, patch: { mute } });
      try {
        await api.setMute(address, mute);
      } catch (e) {
        commit("setError", { message: t("notify.muteFailed", { error: e.message }) });
      }
    },
    async setAdapter({ commit }, { mac, label, clean }) {
      commit(
        "setStatus",
        clean
          ? t("notify.adapterCleanSwitch", { label })
          : t("notify.adapterSwitch", { label }),
      );
      try {
        const r = await api.setAdapter(mac, clean);
        if (r.restart_required) {
          commit("setStatus", t("notify.adapterRestart"));
          api.restart().catch(() => {});
        }
      } catch (e) {
        commit("setStatus", null);
        commit("setError", { message: t("notify.adapterSwitchFailed", { error: e.message }) });
      }
    },
    async saveSettings({ commit }, settings) {
      try {
        commit("setSettings", await api.saveSettings(settings));
        commit("setNotice", { message: t("notify.settingsSaved") });
      } catch (e) {
        commit("setError", { message: t("notify.settingsSaveFailed", { error: e.message }) });
      }
    },
    async saveDeviceSettings({ commit }, { address, settings }) {
      const resp = await api.saveDeviceSettings(address, settings);
      const port = resp.settings?.mpd_port;
      commit("setNotice", {
        message:
          settings.mpd_enabled && port
            ? t("notify.deviceSettingsSavedMpd", { port })
            : t("notify.deviceSettingsSaved"),
      });
      return resp;
    },
    async renameDevice({ commit }, { address, name }) {
      try {
        await api.renameDevice(address, name);
        commit("setNotice", { message: t("notify.deviceRenamed") });
      } catch (e) {
        commit("setError", { message: t("notify.renameFailed", { error: e.message }) });
      }
    },
    async restart() {
      api.restart().catch(() => {});
    },
  },
});

store.dispatch("init");

export default store;
