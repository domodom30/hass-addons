"use strict";

import ReconnectingWebSocket from "reconnecting-websocket";
import { t } from "../i18n";

// REST commands + a push WebSocket for live events. The HA ingress serves the
// UI under a dynamic prefix, so URLs are derived from location.pathname and
// kept relative. Commands go over REST (POST/PUT /api/...); the server pushes
// device/sink/event/log updates over /api/ws which we commit into the store.
class Api {
  constructor(store) {
    this.store = store;
    this.base = globalThis.location.pathname.replace(/\/$/, "");
  }

  // ---- REST helpers ----

  async _get(path) {
    const resp = await fetch(`${this.base}${path}`);
    if (!resp.ok) throw new Error(`API error: ${resp.status}`);
    return resp.json();
  }

  async _send(method, path, body) {
    const resp = await fetch(`${this.base}${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
    });
    if (!resp.ok) {
      const data = await resp.json().catch(() => null);
      throw new Error(data?.error || `API error: ${resp.status}`);
    }
    return resp.json();
  }

  _post(path, body) {
    return this._send("POST", path, body);
  }

  _put(path, body) {
    return this._send("PUT", path, body);
  }

  // ---- WebSocket (push events) ----

  connect() {
    if (this.ws) return;
    const proto = globalThis.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${proto}//${globalThis.location.host}${this.base}/api/ws`;
    this.ws = new ReconnectingWebSocket(url, [], { maxReconnectionDelay: 30000 });
    this.ws.addEventListener("message", this._onMessage.bind(this));
    this.ws.addEventListener("close", () =>
      this.store.commit("setReconnecting", true),
    );
  }

  _onMessage(ev) {
    this.store.commit("setReconnecting", false);
    let msg;
    try {
      msg = JSON.parse(ev.data);
    } catch {
      return;
    }
    const c = (m, p) => this.store.commit(m, p);
    switch (msg.type) {
      case "devices_changed":
        c("setDevices", msg.devices);
        break;
      case "sinks_changed":
        c("setSinks", msg.sinks);
        break;
      case "mpris_command":
        c("addMpris", msg);
        break;
      case "avrcp_event":
        c("addAvrcp", msg);
        break;
      case "log_entry":
        c("addLog", msg);
        break;
      case "scan_started":
        c("setScan", { scanning: true, duration: msg.duration });
        break;
      case "scan_finished":
        c("setScan", { scanning: false });
        if (msg.error) c("setError", { message: t("notify.scanFailed", { error: msg.error }) });
        break;
      case "scan_state":
        c("setScan", { scanning: !!msg.scanning });
        break;
      case "status":
        c("setStatus", msg.message || null);
        break;
      case "toast":
        if (msg.level === "error") c("setError", { message: msg.message });
        else c("setNotice", { message: msg.message });
        break;
      case "warning_banner":
        c("setError", { message: msg.message });
        break;
      case "keepalive_changed":
        c("setNotice", {
          message: msg.enabled
            ? t("notify.keepaliveStarted", { address: msg.address })
            : t("notify.keepaliveStopped", { address: msg.address }),
        });
        break;
      case "settings_changed":
        c("setSettings", msg);
        break;
    }
  }

  // ---- Commands ----

  getInfo() {
    return this._get("/api/info");
  }
  getSettings() {
    return this._get("/api/settings");
  }
  getAdapters() {
    return this._get("/api/adapters");
  }
  scan() {
    return this._post("/api/scan");
  }
  pair(address) {
    return this._post("/api/pair", { address });
  }
  connectDevice(address) {
    return this._post("/api/connect", { address });
  }
  disconnect(address) {
    return this._post("/api/disconnect", { address });
  }
  forceReconnect(address) {
    return this._post("/api/force-reconnect", { address });
  }
  forget(address) {
    return this._post("/api/forget", { address });
  }
  setVolume(address, volume) {
    return this._post("/api/set-volume", { address, volume });
  }
  setMute(address, mute) {
    return this._post("/api/set-mute", { address, mute });
  }
  setAdapter(adapter, clean) {
    return this._post("/api/set-adapter", { adapter, clean });
  }
  restart() {
    return this._post("/api/restart");
  }
  saveSettings(settings) {
    return this._put("/api/settings", settings);
  }
  saveDeviceSettings(address, settings) {
    return this._put(
      `/api/devices/${encodeURIComponent(address)}/settings`,
      settings,
    );
  }
  renameDevice(address, name) {
    return this._put(`/api/devices/${encodeURIComponent(address)}/name`, {
      name,
    });
  }
}

export default Api;
