# Changelog

All notable changes to this add-on are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [2.8.0] — 2026-06-28

### ✨ Added

- **Per-device auto-reconnect**: each speaker now has its own *Auto Reconnect*
  toggle in its settings. The global *Auto Reconnect* setting acts as a master
  switch (off ⇒ nothing reconnects); the reconnect interval and backoff remain
  global. Disabling the toggle cancels any in-flight reconnection; enabling it
  on a disconnected device starts reconnecting immediately. Existing devices
  keep reconnecting (enabled by default).

### 🎨 Changed

- **Cancel / Close buttons** are now solid red buttons (matching the type of
  the primary *Save* buttons) across the settings, device, adapters and
  add-device dialogs.
- **Typography**: bundled the self-hosted Roboto font and enabled font
  smoothing for a sharper, consistent rendering.
- **Logs viewer**: aligned columns into a clean table — the logger column has a
  fixed width with ellipsis and the timestamp column no longer wastes space.
- **Overflow menu**: each entry now has a distinct icon color for easier
  scanning.

---

## [2.7.0] — 2026-06-27

### ✨ Added

- **Add-device wizard**: a floating action button opens a 3-step assistant
  (scan → pick a discovered device → paired). The dashboard grid now shows
  only managed devices; discovery happens in the wizard.
- **Volume control on device cards**: a slider and mute button on each
  connected device drive the PulseAudio sink and propagate to the speaker's
  AVRCP absolute volume. Live changes are throttled while dragging and stay
  in sync with the speaker's physical buttons.

### 🎨 Changed

- **Compact switches**: switches are no longer inset and use a compact
  density with ✓ / ✗ thumb icons.

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
