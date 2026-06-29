## [3.3.0] — 2026-06-29

### ✨ Added

- **Localised notification messages**: the toast, error and status messages
  produced by the UI (pairing, connection, adapter switch, settings saved,
  rename, keep-alive, etc.) now go through the existing vue-i18n system and are
  shown in the selected language (English / French) instead of being
  hard-coded in English. Messages forwarded from the backend are unchanged.

---

## [3.2.1] — 2026-06-29

### 🐛 Fixed

- **Volume could not be set while idle**: `media_player.volume_set` no longer
  fails with *“All outputs are disabled”*. MPD now uses a software (global)
  mixer, so volume can be set even when nothing is playing — e.g. before a TTS
  announcement.
- **“Control speaker hardware volume” toggle** now persists its state in the UI
  (the setting is included in the device payload sent to the frontend).

---

## [3.2.0] — 2026-06-29

### ✨ Added

- **MPD volume controls the speaker's hardware volume**: a new per-device
  *Control speaker hardware volume* toggle (MPD section of device settings)
  makes `media_player.volume_set` move the speaker's real volume (AVRCP
  Absolute Volume) by bridging MPD mixer changes to the PulseAudio sink —
  instead of only attenuating MPD's software stream. Off by default, so
  existing setups keep MPD as the single software volume knob. Note: when on,
  loudness tapers more steeply (≈ squared) because both layers attenuate.

---

## [3.1.0] — 2026-06-28

### 🎨 Changed

- **Signal indicator**: the RSSI icon now reflects signal strength with a
  matching shape (full → empty bars) and colours all five quality levels —
  *excellent/good* green, *fair* orange, *weak* deep orange and *very weak*
  red — with a distinct greyed-out *stale* state.

---

## [3.0.0] — 2026-06-28

### 🎨 Changed

- **Redesigned dialogs**: every dialog (device settings, app settings,
  adapters, add-device wizard, events, logs and confirmations) now shares a
  consistent header and is organised into clearly titled sections with even
  spacing — replacing the bare dividers and uneven layout.
- **Device settings** are grouped into *Reconnection*, *Audio*, *MPD player*
  and *Media buttons* sections; each field's hint now sits cleanly below the
  control instead of crowding it.

### 🐛 Fixed

- Switch hints (auto-reconnect, MPD, AVRCP) no longer overflow and overlap the
  next field in the settings dialogs.
- Floating field labels (e.g. *Hardware volume*, *Delay before suspend*) no
  longer crowd their input.

---

## [2.9.0] — 2026-06-28

### ✨ Added

- **Per-device auto-reconnect**: each speaker now has its own *Auto Reconnect*
  toggle in its settings. The global *Auto Reconnect* setting acts as a master
  switch (off ⇒ nothing reconnects); the reconnect interval and backoff remain
  global. Disabling the toggle cancels any in-flight reconnection; enabling it
  on a disconnected device starts reconnecting immediately. Existing devices
  keep reconnecting (enabled by default). A status chip on each device card
  shows whether auto-reconnect is on.
- **Battery level**: device cards now show the speaker's battery percentage
  when the device reports it (BlueZ Battery1).
- **Active codec**: connected devices display the negotiated A2DP codec
  (SBC / AAC / …) alongside the audio format.
- **Rename a device**: rename a speaker straight from its card menu; the new
  name is stored and applied to the BlueZ alias.
- **Real health check**: `/api/health` now verifies D-Bus and adapter power
  state (used by the add-on watchdog).

### 🎨 Changed

- **Cancel / Close buttons** are now solid red buttons (matching the type of
  the primary *Save* buttons) across the settings, device, adapters and
  add-device dialogs.
- **Typography**: bundled the self-hosted **Inter** font (sharper at small
  sizes) with font smoothing, and reduced the font size of switches,
  dropdowns and buttons for a denser, cleaner layout.
- **Logs viewer**: aligned columns into a clean table — the logger column has a
  fixed width with ellipsis and the timestamp column no longer wastes space.
- **Overflow menu**: each entry now has a distinct icon color for easier
  scanning.
- **Confirmations & feedback**: disconnect and pair now ask for confirmation,
  and the app-settings *Save* button shows a loading state.
- **Internationalization**: translated previously hardcoded labels (device
  capabilities, signal quality, event types) — full English/French coverage.

### 🐛 Fixed

- Background audio-profile switches now log their errors instead of failing
  silently.
- Per-device D-Bus subscriptions are released on shutdown (no more leaked
  callbacks).

---

## [2.8.0] — 2026-06-27

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

## [2.7.9] — 2026-06-27

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

## [2.7.8] — 2026

### ✨ Added

- Initial release: manage Bluetooth A2DP audio devices from a web UI with
  persistent pairing, auto-reconnect, per-device idle modes, AVRCP media
  buttons, per-device MPD instances, and a custom AppArmor profile.
