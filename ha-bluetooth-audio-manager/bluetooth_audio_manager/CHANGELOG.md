# Changelog

All notable changes to this add-on are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [2.5.0] — 2026-06-27

### ✨ Changed

- **Web UI rebuilt with Vue 3 + Vuetify 3**: themed light/dark interface,
  Material Design Icons, internationalization (English/French), `vue-router`
  and `vuex` state management — replaces the previous vanilla-JS UI.
- **Real-time updates** over a reconnecting WebSocket, with device commands
  issued over REST.

### 📦 Packaging

- Pre-built **multi-arch images** are now published to
  `ghcr.io/domodom30/{arch}-ha-bluetooth-audio-manager` by GitHub Actions
  (no more local build on install).
- Supported architectures narrowed to **amd64** and **aarch64** (the natively
  built targets); `armv7`/`armhf` are no longer produced.

### 🛡️ Robustness

- The web UI now stays available in a **degraded mode** if the Bluetooth
  manager fails to start, instead of the whole add-on going down.

---

## [2.0.0] — 2026

### ✨ Added

- Initial release: manage Bluetooth A2DP audio devices from a web UI with
  persistent pairing, auto-reconnect, per-device idle modes, AVRCP media
  buttons, per-device MPD instances, and a custom AppArmor profile.
