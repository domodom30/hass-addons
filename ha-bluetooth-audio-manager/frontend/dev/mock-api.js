// Dev-only mock of the add-on backend (/api REST + /api/ws WebSocket).
//
// Enabled ONLY when Vite runs in "mock" mode (`npm run dev:mock`). It lets the
// frontend be tested in isolation, with the device/sink/adapter lists filled by
// fake data — no Python backend, BlueZ or PulseAudio required.
//
// Devices and sinks reach the store exclusively over the WebSocket
// (`devices_changed` / `sinks_changed`), so an HTTP-only proxy is not enough:
// we also stand up a tiny WebSocket server on /api/ws.
//
// No application code (src/) is touched. Remove this file + its wiring in
// vite.config.js / package.json to drop the mock entirely.

import { WebSocketServer } from "ws";
import {
  A2DP_SINK,
  AVRCP_TARGET,
  AVRCP_CONTROLLER,
  HFP_UUID,
} from "../src/profiles.js";

// ---- Fixtures ----

const INFO = {
  version: "2.9.0-mock",
  adapter: "hci0",
  hfp_switching_enabled: false,
  hostname: "homeassistant.local",
  mpd_password_set: false,
};

const SETTINGS = {
  auto_reconnect: true,
  reconnect_interval_seconds: 30,
  reconnect_max_backoff_seconds: 300,
  scan_duration_seconds: 30,
};

const DEVICES = [
  {
    address: "AA:BB:CC:11:22:33",
    name: "Sony WH-1000XM4",
    connected: true,
    paired: true,
    stored: true,
    battery: 78,
    rssi: -45,
    rssi_stale: false,
    signal_quality: "excellent",
    codec: "AAC",
    adapter: "hci0",
    auto_connect: true,
    idle_mode: "default",
    avrcp_enabled: true,
    audio_profile: "a2dp",
    bearers: ["BR/EDR"],
    uuids: [A2DP_SINK, AVRCP_TARGET, AVRCP_CONTROLLER, HFP_UUID],
  },
  {
    address: "AA:BB:CC:44:55:66",
    name: "Kitchen Speaker",
    connected: false,
    paired: true,
    stored: true,
    battery: null,
    rssi: null,
    signal_quality: "unknown",
    adapter: "hci0",
    auto_connect: true,
    idle_mode: "power_save",
    mpd_enabled: true,
    mpd_port: 6601,
    bearers: ["BR/EDR"],
    uuids: [A2DP_SINK],
  },
  {
    address: "AA:BB:CC:77:88:99",
    name: "JBL Buds",
    connected: false,
    paired: false,
    stored: false,
    battery: null,
    rssi: -72,
    rssi_stale: false,
    signal_quality: "fair",
    uuids: [A2DP_SINK, AVRCP_CONTROLLER],
  },
];

const SINKS = [
  {
    name: "bluez_sink.AA_BB_CC_11_22_33.a2dp_sink",
    volume: 65,
    mute: false,
    state: "running",
    sample_rate: 44100,
    channels: 2,
    format: "s16le",
  },
];

const ADAPTERS = [
  {
    address: "00:1A:7D:DA:71:13",
    name: "hci0",
    alias: "BlueZ 5.66",
    powered: true,
    selected: true,
    ha_managed: false,
    hw_model: "Generic Bluetooth Adapter",
    modalias: "usb:v1D6Bp0246d0540",
    tech: "BR/EDR + LE",
    ble_scanning: false,
  },
];

// ---- Helpers ----

function sendJson(res, body, status = 200) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

const REST_GET = {
  "/api/info": INFO,
  "/api/settings": SETTINGS,
  "/api/adapters": { adapters: ADAPTERS },
  "/api/audio/sinks": { sinks: SINKS },
  "/api/diagnostics/mpris": {},
};

// ---- Plugin ----

export function mockApiPlugin() {
  return {
    name: "mock-api",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url || "").split("?")[0];
        if (!path.startsWith("/api/")) return next();
        if (path === "/api/ws") return next(); // handled by the WS upgrade below

        if (req.method === "GET" && path in REST_GET) {
          return sendJson(res, REST_GET[path]);
        }
        if (path === "/api/scan" && req.method === "POST") {
          return sendJson(res, { scanning: true, duration: 5 });
        }
        // Any other command (pair/connect/volume/settings…): acknowledge.
        return sendJson(res, { ok: true });
      });

      const wss = new WebSocketServer({ noServer: true });
      wss.on("connection", (ws) => {
        ws.send(JSON.stringify({ type: "devices_changed", devices: DEVICES }));
        ws.send(JSON.stringify({ type: "sinks_changed", sinks: SINKS }));
      });

      server.httpServer?.on("upgrade", (req, socket, head) => {
        const { pathname } = new URL(req.url, "http://localhost");
        if (pathname.endsWith("/api/ws")) {
          wss.handleUpgrade(req, socket, head, (ws) =>
            wss.emit("connection", ws, req),
          );
        }
        // Other upgrades (Vite HMR, protocol "vite-hmr") are left to Vite.
      });
    },
  };
}
