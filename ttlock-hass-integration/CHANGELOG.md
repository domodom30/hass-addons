# Changelog


## [2.7.0] — 2026-08-24

### ⬆️ Dependencies

- **`@domodom30/ttlock-sdk-js` 0.7.4 → 0.8.0.** `NobleDevice.connect()` no
  longer polls `connected` every 100 ms against a fixed cycle budget; it now
  settles directly on noble's native connect callback (success or error),
  with the timeout timer cleared the instant that callback fires and a late
  callback after timeout safely ignored — removing a race that could tear
  down a connection that had actually just succeeded. `AudioManage` is split
  into `AudioManage` (`TURN_ON`/`TURN_OFF`, unchanged values) and a new
  `AudioManageOperation` (`QUERY`/`MODIFY`); the add-on only ever used
  `TURN_ON`/`TURN_OFF` (`manager.js`), so no source change is required.

### 🐛 Fixed

- **Connect wrapper timeout too tight for the new SDK connect budget
  (issue #25).** `_connectAttempt` wrapped `lock.connect()` in a 15s timeout,
  but the SDK's own connect budget — native noble connect (~10s) + GATT
  reads + `TTLock.connect()`'s completion poll (~15s) — can run up to ~25s.
  On a weak link the wrapper could abort a connection the SDK was still
  legitimately completing, producing a contradictory "failed (returned
  false)" right as the handshake actually succeeded. The wrapper timeout is
  now 28s, safely above the SDK's own ceiling.
- **Credential/config dialogs silently closed on failure.** `Card.vue`,
  `Passcode.vue`, `Finger.vue` and `ConfigDlg.vue` all closed themselves as
  soon as the relevant "waiting" flag cleared, whether the save had
  succeeded or the backend had just reported an error — the only visible
  feedback was an easy-to-miss error toast elsewhere on screen. Each dialog
  now remembers the error count right before saving and only auto-closes if
  no new error appeared while waiting. `ConfigDlg.vue` additionally had
  `busy` reset by its own save method rather than by the "waiting" watcher,
  which silently defeated any such check since the fire-and-forget WebSocket
  send resolves long before the real server response; that premature reset
  is now removed.

### ✨ Added

- **Activity log: filter by lock and by date range.** Alongside the existing
  category filter, the global "all locks" view can now be narrowed to a
  single lock, and any view can be restricted to a date range — both
  client-side, no backend change needed.


## [2.6.9] — 2026-08-12

### 🐛 Fixed

- **Transient `operation` events silently lost when MQTT was disconnected.** The `event`
  entity is only published if `this.connected` is true at the moment `_onLockOperation`
  fires. Since `manager._processOperationLog` advances the `lastProcessedRecord` /
  `lastProcessedDate` thresholds independently of MQTT connectivity (other consumers,
  like the WebSocket UI, must keep working without MQTT), an operation processed during
  an outage was never treated as "new" again — the event was gone for good, which
  mattered most for the `ALARM` category. A new persisted threshold
  (`lastPublishedEvent`) now lets `ha.js` replay any missed transient events once per
  (re)connect, reading the persisted log only (no BLE).
- **Retroactive automation triggers after a manual "Refresh" in the UI.** `getOperationLog`
  (the WebSocket UI's full BLE read) didn't advance `lastProcessedRecord` /
  `lastProcessedDate`, so operations newer than the persisted threshold — already seen by
  the user — could be re-discovered as "new" on the next automatic cycle and retroactively
  emit `lockOperation` / `lockLock` / `lockUnlock`. The manual path now advances the same
  thresholds, without emitting events, mirroring the existing `resynced` asymmetry in
  `_processOperationLog`.

### 🎨 UI / UX

- **Activity log** (`LockLogsDialog.vue`): each entry's category tag is now translated
  (FR/EN) instead of showing the raw `UNLOCK` / `LOCK` / `ALARM` / `FAILED` / `OTHER`
  category in English regardless of locale. Added the missing Alarm / Failed / Other
  filter buttons alongside the existing All / Unlock / Lock.


## [2.6.8] — 2026-08-10

### 📝 Changed

- **Changelog only.** The 2.6.7 entry credited the `last_user` sensor to 2.5.0; it was
  actually added in 2.5.3. Behaviour is identical to 2.6.7 — no add-on code changed.


## [2.6.7] — 2026-08-10

### 🐛 Fixed

- **The `event` entity never fired.** Its discovery config carried
  `value_template: '{{ value_json.event_type }}'`, but Home Assistant's MQTT `event`
  platform requires the processed payload to stay a JSON object holding `event_type`.
  Reduced to the bare string `lock`, every message was rejected — the entity sat on
  `unknown` with `event_type: null` (its attributes did update, since
  `json_attributes_topic` is handled separately), no automation could trigger on it, the
  logbook stayed empty, and Home Assistant logged
  `No valid JSON event payload detected` for every single operation. The published
  payload was already in the expected shape, so both `value_template` and the now
  redundant `json_attributes_topic` are gone: HA reads `event_type` from the payload and
  promotes the remaining keys to attributes itself.

### 🗑️ Removed

- **The `last_operation_time`, `last_access_time` and `last_user` sensors.** All three
  were flat projections of fields already exposed as attributes of `last_operation` /
  `last_access`, published from the very same topics — `last_user` even duplicated the
  complete attribute set of `last_access`. Side by side on the device card they mixed two
  distinct timelines (every operation on one side, the last *credential* access on the
  other) with nothing to signal it, so the card read as "Eddy locked the door at 18:01"
  when the 18:01 record was a door-sensor lock with no credential at all.

  The data is unchanged and still available:

  ```jinja
  {{ state_attr('sensor.<lock>_last_operation', 'timestamp') }}
  {{ state_attr('sensor.<lock>_last_access', 'timestamp') }}
  {{ state_attr('sensor.<lock>_last_access', 'by') }}
  ```

  MQTT discovery is retained, so the add-on republishes an empty payload on the three
  config topics at every (re)configuration: existing installations drop the orphaned
  entities on their own, with no manual cleanup. Update any dashboard card or automation
  referencing them before upgrading. This supersedes the `last_user` sensor introduced in
  2.5.3.


## [2.6.6] — 2026-08-10

### 🐛 Fixed

- **New operations stopped being recorded once the lock's journal had gone full circle.**
  The firmware journal is circular: past its ceiling (≈ 4998 records on an R6) the record
  counter starts over on low indices. Both the deduplication threshold
  (`recordNumber > lastProcessedRecord`) and the append probe (starting at
  `max(recordNumber) + 1`) assumed that counter to be forever increasing. After the wrap
  the probe kept polling sequences past the end of the ring, every genuinely new record
  came back with an index *below* the stored threshold and was discarded as "already
  processed" — the operation log froze, `last_operation` / `last_access` / the `event`
  entity stopped updating, while the lock kept advertising `newEvents` and the add-on
  reconnected over BLE every minute for nothing.

  Novelty is now decided on `operateDate` — the only monotonic field in the journal —
  with `recordNumber` kept purely as a tie-breaker within the same second, and persisted
  alongside it (`lastProcessedDate`). The probe anchors on the **write head** (the most
  recent record by date) instead of the highest index, follows the firmware's own
  backwards sequence pointer once when it signals the end of the ring, and treats any
  stale record it meets as an empty slot. A lock whose threshold is stuck past the ring
  end realigns itself on the first read after the update.

- **Thousands of stale operations are no longer replayed as Home Assistant events.**
  Records recovered from the untouched part of the ring carry old dates; they now fail
  the novelty test instead of being emitted one by one on `ttlock/<id>/event`. The
  catch-up batch that follows a resynchronisation updates the sensors but stays silent on
  the event topic, so automations bound to `event.*_operation` are not triggered
  retroactively.

- **The lock no longer wakes up every minute for an empty read.** A lock that keeps
  advertising `newEvents` after its journal has been read now falls under the same
  exponential back-off as connection failures (15 s → 3 min) after five consecutive reads
  without a new operation. The first real operation resets it immediately.

- Lock/unlock state and the event order are derived from the chronological order of the
  new operations rather than from their record numbers, which no longer reflect time once
  the journal has wrapped.


## [2.6.5] — 2026-08-10

### 🐛 Fixed

- **The automatic log reader no longer locks itself into a permanent failure loop.**
  Reading the journal with `all=true` (introduced in 2.6.4) makes the SDK re-walk *every*
  sequence missing from its cache between 0 and the highest known record. Since the
  persisted journal is deliberately capped (`max_oplog`, 300 by default), those gaps
  number in the thousands and never close — the lock's journal is circular. Each cycle
  therefore attempted thousands of BLE reads, blew through the 30 s budget, and — worse —
  the SDK's backfill loop kept running after the forced disconnect, colliding with the
  next session (`Command already in progress` → failed admin login → `adminAuth absent`).
  The result was an endless `newEvents: échec #N` back-off and, eventually, a lock
  reported offline.

  The automatic path now reads incrementally (new `src/oplog.js`): the `0xffff` stream,
  then a bounded probe for records appended past the last known one — never a backfill of
  old gaps. A full catch-up is still available on demand through **Refresh** in the UI.

- **A successful read is no longer reported as a failure.** Success was decided by
  checking `lock.adminAuth` *after* the read; locks routinely self-disconnect right after
  the last command, which resets that flag and triggered an unnecessary back-off. The
  admin handshake is now recorded while the session is still alive.

- **Duplicate `Disconnected from lock` events.** In gateway mode a single disconnect
  travels the BLE stack twice, restarting the monitor and republishing to MQTT twice.
  Duplicates within one second are now ignored.

- **Locks are no longer marked offline when the radio itself is down.** The availability
  watchdog only counts silence when the gateway is connected and the monitor is actually
  running — otherwise *no* lock can be heard and the timeout said nothing about range.

- **The `oplog_cooldown` option had no effect**: `start.sh` never exported it, so the
  cooldown stayed pinned at 60 s whatever the configuration. It is exported now, and the
  two contradictory defaults in the code (10 s / 60 s) are aligned on 60 s.
  `oplog_cooldown`, `lock_offline_timeout` and `max_oplog` also appear in the add-on's
  default options.

- **Misleading log line**: `lecture oplog bloquée (CRC corrompu?)` pointed at a CRC
  problem that cannot occur with the default `ignore_crc: true`. It now reports what
  actually happened — the read exceeded its budget.

- **SDK version drift between development and production.** `package-lock.json` (not
  tracked by git) still pinned 0.7.2 while `package.json` asked for `^0.7.3`, so a local
  checkout and the built image did not run the same SDK code. Both now agree on 0.7.4.

- **A dead BLE monitor could pass for a healthy one.** Everything that restarts the scan
  — `isMonitoring()`, `startMonitor()`'s idempotence guard, `_ensureMonitoring()` — trusts
  the state the scanner reports about itself, and a gateway that dies without announcing
  it leaves that state stuck on "scanning". Nothing could then repair it: the radio was
  deaf, the add-on believed otherwise, and every lock eventually turned up `offline`.
  A heartbeat now compares that claim against the only signal that cannot lie — incoming
  BLE advertisements. Three minutes of silence while the monitor claims to be running
  forces a full stop/start cycle (at most one every five minutes, so genuinely
  out-of-range locks don't cause a loop), well before the 15-minute availability timeout.
  The root cause is fixed on the SDK side in 0.7.4.

### ⬆️ Dependencies

- **`@domodom30/ttlock-sdk-js` 0.7.3 → 0.7.4.** Carries the two matching SDK-side fixes:
  the operation-log backfill is now bounded (it stops when the link drops or its time
  budget runs out, and never re-probes sequences the firmware already reported as
  absent), and a gateway drop occurring before authentication now announces
  `poweredOff` — without it the scanner stayed stuck on "scanning" with nothing
  listening, which is the root cause the monitor heartbeat above only papers over.

---

## [2.6.4] — 2026-08-09

### 🐛 Fixed

- **New operations are captured again automatically**: the background reader
  (`_processOperationLog`) now performs a full log read (`all=true`) instead of
  the "new events" (`0xffff`) read. The lock firmware never returns freshly
  appended records through the `0xffff` stream — only a full read probes beyond
  the last known record number — so newly recorded operations were no longer
  reaching the journal, the MQTT `last_operation` / `last_access` sensors, nor
  the `event` entity until a manual **Refresh**. They now flow in on their own
  (throttled by `oplog_cooldown`). The log line was trimmed to the new records
  only, and the max-record computation made safe for large journals.

---

## [2.6.3] — 2026-08-09

### ✨ Added

- **Offline detection for locks (`lock_offline_timeout` option)**: a reachability
  watchdog now marks a lock's MQTT entities as *unavailable* after N minutes
  without BLE contact (default 15, configurable). The manager emits `lockOffline`
  / `lockOnline` events that drive the per-lock availability topic, so Home
  Assistant reflects a lock that has gone out of range instead of showing a stale
  state.
- **Discovery `origin` block**: every MQTT discovery payload now carries an
  `origin` (name, `sw_version`, support URL), per the HA 2023.8+ convention, so
  the entities are attributed to this integration on the device page.
- **Operation `event` entity**: each lock now exposes an HA `event` entity that
  fires once per new operation (`event_types`: unlock / lock / failed / alarm /
  other), so automations can react per operation and HA keeps a history —
  complementing the retained `last_operation` / `last_access` sensors which only
  hold the latest state.
- **Configurable journal size (`max_oplog` option)**: the number of operation-log
  entries kept in the persisted journal is now configurable (default 300).

### 💄 Changed

- **Instant operation-log dialog**: opening the journal now renders immediately
  from the persisted cache instead of forcing a BLE read. A fresh BLE fetch only
  happens on an explicit **Refresh** — so opening the log no longer holds the BLE
  radio (and no longer blocks lock/unlock commands from HA for up to 120 s) when
  the lock is out of range.
- **Diagnostic sensors**: `battery`, `rssi` and `connectivity` moved to
  `entity_category: diagnostic`; added `state_class: measurement`, a proper
  `signal_strength` device class for RSSI (now in dBm), and `qos: 1` on all
  discovery entities.
- **`last_operation` attribute renamed**: the historical battery level in the
  operation payload is now `battery_at_event` (was `battery`), so it is never
  confused with the live battery sensor.

### 🐛 Fixed

- **Operation-log dedup survives a lock reset**: the deduplication threshold is
  now reset when a lock is reset (via the addon or the official TTLock app) or
  re-paired. Previously, once the firmware record counter restarted from 0, all
  new operations were filtered out and the `last_operation` / `last_access`
  sensors stayed frozen.
- **DST-correct operation timestamps**: the `*_time` sensors now use an offset
  computed from the operation's own date (the addon aligns its clock to Home
  Assistant's timezone), instead of appending the *current* offset — fixing a
  1 h drift for operations recorded on the other side of a DST change.
- **No display shrink on manual refresh**: a partial BLE read is now merged with
  the cache by `recordNumber` instead of replacing it, so refreshing the log
  never drops already-shown entries.
- **No spurious re-publish on restart**: the last published operation/unlock
  record is now persisted, so restarting the addon no longer re-publishes the
  latest event (which could re-trigger HA automations).
- **Robust operation-log persistence**: `lockData.json` is now always written
  dense (no more stray `null` entries from the SDK's sparse array) and
  re-indexed by `recordNumber` on load, so the SDK no longer re-scans the whole
  journal on restart.

---

## [2.6.2] — 2026-07-02

### 💄 Changed

- **Redesigned the operation-log dialog (`LockLogsDialog`)**: the hard-coded
  "terminal" look (fixed dark background and hex colours) was replaced by a
  native Vuetify list driven by the app theme, so the journal now renders
  correctly in both light and dark modes. Each entry uses theme tokens
  (`success`/`error`/`warning`/`info`) for its type chip and icon; the type
  filter gained a leading icon per option and the auto-scroll switch a lighter
  label.

### 🐛 Fixed

- **Bumped `@domodom30/ttlock-sdk-js` to `0.7.3`**.

---

## [2.6.1] — 2026-06-30

### 🐛 Fixed

- **Bumped `@domodom30/ttlock-sdk-js` to `0.7.2`** — SDK audit fixes (P0/P1/P2):
  - IC card deletion of long (8-byte) card numbers no longer sends an empty
    command; the field width is chosen by value so 10-digit numbers no longer
    throw.
  - Operation-log records in a multi-record page get distinct record numbers
    (previously all but the last were dropped from the cache).
  - Passcode add/update/delete validate input before sending instead of
    transmitting an empty frame.
  - noble listener leaks fixed (scanner/characteristic/descriptor) → no more
    `MaxListenersExceeded` over long runs / reconnections.
  - `connect()` no longer wedges on a throw; the auto-lock timer is cancelled on
    manual lock/unlock and on disconnect; assorted robustness fixes.

---

## [2.5.13] — 2026-06-30

### 🔧 Changed

- **Add-on config migrated from `config.json` to `config.yaml`** (the modern HA add-on
  standard, matching the other add-on in the repo). Same content; the CI version
  extractor, the sync-versions trigger/script now read the YAML.
- **App version badge & GitHub link sourced from `config.yaml`**: `vite.config.js` now
  injects `VITE_APP_VERSION` / `VITE_APP_GITHUB` from `config.yaml` (`version` + `url`)
  instead of the stale frontend `package.json`, so the `AppTopBar` badge and GitHub link
  always reflect the real add-on version and repository URL.

---

## [2.5.12] — 2026-06-30

### 🐛 Fixed

- **All lock/unlock buttons spun at the same time**: the `waiting` computed in `Lock.vue`
  relied on global flags (`waiting`, `waitingCredentials`, `scanStatus`). A new `waitingAddress`
  in the store targets the lock actually being operated; `Lock.vue` now shows the spinner only
  for that lock (`waiting && waitingAddress === lock.address`).

---

## [2.5.11] — 2026-06-30

### 🐛 Fixed

- **Lock name reverted to the MAC address after disconnect**: the BLE name (GATT `2a00`) is only
  readable while connected and was never persisted. On disconnect, `Lock.fromStoreEntry` fell back
  to `getLockAlias(address) || address` → the MAC. The BLE name is now cached (`store.setLockName`
  in `deviceInfoData`) as soon as it is known, and both serialization paths resolve the name in the
  order **alias → live BLE name → persisted BLE name → MAC**, so the name stays stable offline.

### ✨ Added

- **Lock renaming**: new "Rename" entry in each card's menu (a pre-filled dialog). The custom name
  is stored locally (`aliasData.json`, via the new `rename` websocket command); clearing the field
  removes the alias and reverts to the BLE name. The alias is also used as the device name in Home
  Assistant MQTT discovery.

---

## [2.5.10] — 2026-06-30

### 🐛 Fixed

- **Regression 2.5.8 — audio & auto-lock time not displayed**: by making
  `Lock._resolveAudio()` / `Lock._resolveAutoLockTime()` strictly *cache-only* (to stop the BLE
  contention with `macro_adminLogin`), the BLE fallback that surfaced these values was removed,
  but **no flow populated `_cachedAudio` / `_cachedAutoLock` on connect** — only
  `setAudio`/`getAudio`/`calibrate` filled them. `fromTTLock` therefore read empty caches
  (`undefined`) and the UI no longer showed audio or auto-lock. A new helper
  `manager._cacheLockSettings(lock)`, called in `_onLockConnected` after `_saveLockFeatures` (and
  before the status broadcast), populates the caches from properties **already read by the SDK**
  (`lock.autoLockTime`, `lock.lockSound`) — **without any new BLE**: the *cache-only* contract of
  `fromTTLock` stays intact, but the values reappear on the first (re)connection of the monitor

---

## [2.5.9] — 2026-06-30

### 🐛 Fixed

- **Disk persistence — race on `saveData()`**: `saveData()` is `async` but called fire-and-forget
  from a dozen mutators (`setLockData`, `setDeviceInfo`, `setLockFeatures`, aliases…). A burst of
  concurrent calls (typically after processing an operation log) competed for the same `.tmp` file:
  the first `rename` consumed it, the following ones failed with `ENOENT`
  (`rename '/data/lockData.json.tmp' -> '/data/lockData.json'`, same for `aliasData.json` /
  `deviceInfoData.json`). Result: nothing was persisted to `/data`, the `lockData.json` cache never
  updated, and the *cache-only* path (2.5.8) had nothing to serve after a restart. `saveData()` now
  serializes writes with burst coalescing (`_doSaveData()` re-reads the current in-memory state at
  execution time → the most recent version is always persisted)
- **Credentials — silent failure**: on BLE connection failure, `getCredentials()` returned the
  *truthy* sentinel `{ passcodes: false, cards: false, fingers: false }`, which `handleCredentials`
  interpreted as success → empty panel with no message. Real failures (lock unreachable,
  connection/reconnection impossible, all reads failed after 3 attempts) now return `false`,
  triggering the "Failed fetching credentials" error and unblocking the spinner. A lock genuinely
  without a capability keeps its legitimate result (`{false,false,false}`)

---

## [2.5.8] — 2026-06-29

### 🐛 Fixed

- **BLE — contention on admin login**: `Lock.fromTTLock()` (status broadcast path, executed on every `WsApi.sendLockStatus` / `getLocks`) emitted an unserialized BLE command `getLockSound()` / `getAutolockTime()` outside the global radio mutex. This command collided with the `macro_adminLogin` loop, causing `No response to checkAdmin` and `No response to get audioManage`. `_resolveAudio()` and `_resolveAutoLockTime()` are now strictly *cache-only* (reading `_cachedAudio` / `_cachedAutoLock`, populated by the mutex-guarded flows `getAudio` / setAudio / calibrate), respecting the "non-BLE" contract already documented in `fromTTLock`
- **Version**: `addon/package.json` (left at `2.5.1`) realigned to the release version — the startup banner showed an incorrect version

---

## [2.5.7] — 2026-06-27

### 🎨 UI / UX

- **AppTopBar — lock icon**: the image logo (`icon.png`) is replaced by the MDI icon `mdi-lock` (primary color); asset import removed
- **AppTopBar — BLE scan button removed**: adding a lock is now done exclusively through the floating action button
- **Lock card — enriched contextual menu**: *Operation log* and *Settings* inline buttons moved into the `⋮` overflow menu alongside *Credentials*, with a visual divider between the two groups
- **"Add a lock" FAB** (`App.vue`): the circular `mdi-plus` button with `elevation="6"` replaced by a flat text button — no shadow, no circular shape
- **Home page — empty state**: the button now opens the `AddLockWizard` (`mdi-lock-plus-outline`) instead of triggering a direct BLE scan
- **Activity log** (`LockLogsDialog.vue`): each terminal line now displays a colored MDI icon; `FAILED` is handled as a distinct category (orange `#fb923c`, `mdi-alert-circle`) instead of being grouped with `OTHER` (blue, `mdi-information-outline`)
- **Recent activity** (`Home.vue`): `opIcon`/`opColor` now cover all 5 categories — `LOCK`, `UNLOCK`, `ALARM`, `FAILED` (deep-orange), `OTHER` (info)

---

## [2.5.3] — 2026-06-21

### ✨ Added

- **`last_user` sensor**: new MQTT discovery entity exposing the `by` field from the `last_unlock` payload (`ttlock/<id>/last_unlock`). Displays the IC card alias, fingerprint alias, or PIN code used to open the lock; shows `—` when access comes from the TTLock app or a BLE admin session
- No backend change required: the `by` field was already published by `buildLastOperationPayload()` — only the MQTT discovery declaration is added in `ha.js`
- Discovery topic is properly cleaned up when a lock is unpaired

---

## [2.5.2] — 2026-06-21

### 🐛 Fixed

- **Global BLE radio mutex** — serialization across locks
  - **`_radioChain` (constructor)**: global promise chain added to serialize BLE radio access across all locks. The previous per-address mutex allowed two locks to attempt a GATT connection simultaneously, causing both `connect()` calls to fail
  - **`_acquireMutex` rewritten**: each caller chains onto `_radioChain` and waits for the previous holder to release. The release function is now idempotent (via a `released` flag) — a double-call no longer advances the chain twice or prematurely unblocks the next waiter
  - The per-address `_bleMutex` is kept for existing guards (`isLockBusy`, `_bleMutex.size > 0`) — their semantics remain correct since global serialization ensures at most one entry at a time

---

## [2.5.1] — 2026-06-21

### 🐛 Fixed

- **Cleaner BLE `macro_adminLogin` error messages**
  - **`Manager.getOperationLog` catch**: stack trace no longer double-logged — single `console.warn` emitted: `getOperationLog [<address>]: BLE admin auth failed — lock out of range or busy`
  - **`_doAdminLogin` catch**: message now includes the MAC address with plain-language description: `[<address>] BLE admin login failed — lock out of range or busy (no response to checkAdmin)`
  - **`_processOperationLog` adminAuth guard**: reformatted with address prefix: `_processOperationLog [<address>]: adminAuth missing — BLE admin auth failed or disconnected during read`

---

## [2.5.0] — 2026-06-19

### ✨ Added

- **ALARM category**: `_enrichOperation()` in `manager.js` now maps `LogOperateCategory.ALARM` (DOOR_SENSOR_ANOMALY, TAMPER_ALARM, LOW_BATTERY_ALARM…) to `recordTypeCategory = 'ALARM'` instead of `'OTHER'`
- **`mdi-shield-lock-open` icon**: ALARM entries display the icon in orange in the activity log

---

## [1.9.22] — 2026-05-20

### 🎨 UI / UX

- **Gateway area redesign** (`AppTopBar`): the chip + 2 separate buttons replaced by a single clickable icon — green (`mdi-lan-connect`) if connected, red (`mdi-lan-disconnect`) if disconnected, orange (`mdi-help-network`) otherwise; spinner while an operation is in progress
- **Dropdown menu**: a click opens a `v-menu` with *Reconnect gateway* and *Restart ESP32 gateway*, disabled while an operation is in progress
- **Hover tooltip**: retains the status text (host if connected, error message otherwise)

---

## [1.9.21] — 2026-05-20

### 🐛 Fixed

- **ESP32 reboot end detection — forced noble WS reconnection**
  - **Root cause**: noble WebSocket TCP stays "stuck" after reboot (no application-level ping/pong). `_setGatewayStatus('disconnected')` never fired → `_esp32RebootPending` stayed `true` → 60s spinner, no notification
  - **Forced reconnection**: `rebootEsp32()` schedules `ws.reconnect()` after 2 s on success (ECONNRESET or HTTP 200), forcing the `close → open` cycle → `_esp32RebootPending = false` → snackbar
  - **Deduplication**: `rebootEsp32()` returns immediately if `_esp32RebootPending` is already `true`
  - **One-shot `settle()`**: replaces duplicate `resolve()/this._esp32RebootPending=true` calls; prevents `req.destroy()` (timeout) from incorrectly setting the flag
  - **Fixed `_connectLock` fail-fast**: the guard now waits for `_esp32RebootPending` to become `false` (instead of `_waitForGatewayReady` which returned `true` immediately when `gatewayStatus === 'connected'`)

---

## [1.9.20] — 2026-05-20

### 🐛 Fixed

- **BLE fail-fast + WS resilience during ESP32 reboot**
  - **`_connectLock` fail-fast during reboot** (`manager.js`): when `_esp32RebootPending = true`, waits for `_waitForGatewayReady(20000)` before attempting BLE — silently waits instead of logging `newEvents: failure #1`
  - **`clearWaitingFlags` no longer touches `waitingEsp32Reboot`** (`store/index.js`): if the frontend↔addon WS drops during reboot, the spinner persists and the notice shows correctly when the gateway comes back. Cleanup handled by `setGatewayStatus('connected')` or the 60s safety timeout

---

## [1.9.19] — 2026-05-20

### ✨ Added

- **ESP32 reboot completion notification**
  - **Backend log**: `_setGatewayStatus('connected')` detects `_esp32RebootPending` and logs `[Gateway] ESP32 rebooted — gateway back online`
  - **Frontend snackbar**: `setGatewayStatus('connected')` mutation automatically pushes `notices.gateway.esp32RebootComplete` — green snackbar *"ESP32 gateway rebooted — connection restored"*
  - **Affected layers**: `manager.js`, `store/index.js`, locales fr/en

---

## [1.9.18] — 2026-05-20

### 🐛 Fixed

- **ESP32 reboot spinner — stay active until fully reconnected**
  - **Extended spinner**: `_onEsp32Reboot` no longer clears `waitingEsp32Reboot` on HTTP success; stays active until `gatewayStatus` becomes `'connected'` (~10-15s). 60s safety timeout if ESP32 does not come back
  - **Reconnect button disabled** during reboot: prevents unintended `restartGateway` calls while rebooting
  - **`setGatewayStatus('connected')` clears `waitingEsp32Reboot`** in the Vuex mutation

---

## [1.9.17] — 2026-05-20

### ✨ Added

- **"Restart ESP32 gateway" button** (`AppTopBar`)
  - New `mdi-restart` button sends `GET https://gateway_host:443/restart` with Basic Auth; ESP32 executes `ESP.restart()` after 2 loop iterations
  - Uses `rejectUnauthorized: false` (self-signed cert on the ESP32 side)
  - Spinner covers only the HTTP phase (1-5s); gateway chip then displays the `disconnected → connecting → connected` cycle automatically
  - Error snackbar if the ESP32 is unreachable or credentials are incorrect
  - **Affected layers**: `manager.rebootEsp32()`, `WsApi.sendEsp32Reboot()`, dispatcher, `api.rebootEsp32()` + `_onEsp32Reboot()`, store (`waitingEsp32Reboot`), `AppTopBar.vue`, locales fr/en

---

## [1.9.16] — 2026-05-20

### ✨ Added

- **"Reconnect gateway" button** (`AppTopBar`)
  - New `mdi-lan-pending` button forces a WebSocket reconnection via `ws.reconnect()` without restarting the addon or the ESP32
  - Spinner during reconnection (up to 15s); error snackbar if the gateway does not respond
  - **Affected layers**: `manager.restartGateway()`, `WsApi.sendGatewayRestart()`, dispatcher, `api.restartGateway()` + `_onGatewayRestart()`, store (`waitingGatewayRestart`), `AppTopBar.vue`, locales fr/en

---

## [1.9.15] — 2026-05-20

### ⚡ Performance

- **ESP32 — reduced post-disconnect BLE delay** (`ble_api.cpp`): `vTaskDelay` after disconnect reduced from 1000 ms → 200 ms. Saves 800 ms per lock/unlock cycle
- **ESP32 — reduced delay between BLE retries** (`ble_api.cpp`): delay between BLE connection attempts reduced from 1000 ms → 500 ms. Saves up to 2 s on initial connections
- **Addon — faster monitor resume** (`manager.js`): `_scheduleGatewayRecovery` delay reduced from 2500 ms → 500 ms. BLE monitor restarts 2 s earlier after a WebSocket reconnect
- **Addon — faster WebSocket reconnection** (`manager.js`): RWS configured with `minReconnectionDelay: 300 ms` and `connectionTimeout: 2000 ms` (defaults were 1000 ms / 4000 ms). Reconnection after a network drop is 700 ms faster

---

## [1.9.10] — 2026-05-15

### ✨ Added · 🐛 Fixed

- **Gateway chip always visible** (`AppTopBar`): permanently displayed — green with `host:port` on hover when connected, `warning`/`error` otherwise. Backend exposes `gatewayHost` in the `status` payload (`manager.getGatewayHost()`, `WsApi.js`)
- **Reliable BLE monitor recovery**: `_recoverMonitor` replaced by `_ensureMonitoring()` + periodic watchdog (20 s). Fixes `monitor BLE redémarré: false` — `TTLockClient.stopMonitor()` did not reset the internal `monitoring` flag so `startMonitor()` always returned `false`. New code detects the blocked state, resets SDK internal flags, and verifies `isMonitoring()` with retries
- **BLE fail-fast when gateway is disconnected**: `_connectLock` waits up to 6 s for reconnection then cleanly aborts instead of chaining 4 doomed attempts; early exit if the link drops mid-operation. Guards scoped to noble mode only

---

## [1.9.9] — 2026-05-15

### 🐛 Fixed · ✨ Added

- **Error robustness** (`index.js`): `uncaughtException` handler rewritten — replaces fragile exact-string matching with targeted detection of recoverable error classes (message fragment OR errno). Added symmetric `unhandledRejection` handler. Throttled warning (max 1/30 s)
- **Configuration validation** (`init.js`): normalises and validates noble options before `setNobleGateway` — `gateway_port` coerced to number, all required fields checked (SDK silently fell back to `admin`/`admin` when missing)
- **Link status in the UI**: `manager.js` observes the SDK's reconnecting-websocket and exposes `gatewayStatus` (`connecting`/`connected`/`disconnected`/`unknown`). Warning chip shown in `AppTopBar` when not connected. 100% defensive — degrades to `unknown` if SDK internals change
- **Monitoring recovery watchdog**: restarts the BLE monitor on gateway reconnection (`stopMonitor` + `startMonitor`, one retry). The SDK did not re-emit the scan command after a silent reconnect

---

## [1.9.0] — 2026-05-12

### 🐛 Fixed

- **Admin connection (`adminLogin`)**: systematic reset of `lock.adminAuth` before each `_doAdminLogin` — the SDK was setting `adminAuth=true` during `connect(false)/onConnected` even on stale sessions, causing `NO_PERMISSION (0x01)` on subsequent reads/writes. Also reset in `catch` to avoid short-circuiting the macro on the next attempt
- **Add PIN**: `addPasscode` now waits 1.5 s then retries `getPassCodes` up to 3 times (with reconnection if needed) — avoids returning an empty list when the firmware index is not yet ready
- **Store persistence**: new `fileDataRename` helper retries `fs.rename` up to 3 times on `EPERM` (antivirus / indexer holding the `.tmp`). Applied to `lockData`, `aliasData`, `deviceInfoData`
- **TTLock SDK**: bump `@domodom30/ttlock-sdk-js` `^0.6.0` → `^0.6.3`
- **Frontend**: `CredentialsAll.vue` and `SettingsAll.vue` use `Array.some()` instead of `Array.find()` for unpaired lock detection
- **Frontend**: refreshed Settings and Credentials interfaces
- **Dev mode**: `api/index.js` honours `process.env.DEV_MODE` for credentials/passcode/card/finger handlers

---

## [1.4.0] — 2026-04-27

### 🐛 Fixed

- **Firmware version not displayed after restart**: `store.js` adds `deviceInfoData` (`setDeviceInfo`/`getDeviceInfo`) persisted in `/data/deviceInfoData.json`; `manager.js` saves `lock.deviceInfo` immediately after pairing; `Lock.js` and `ha.js` fall back to `store.getDeviceInfo()` when absent
- **Audio (sound) chip greyed out**: `Lock.js` — `getLockSound()` was incorrectly conditioned on `!isConnected()`, blocking the value during the `lockConnected` event; now uses an in-memory cache

---

## [1.2.38] — 2026-04-26

### 🐛 Fixed

- **PIN (passcode) crash** `Cannot read properties of undefined (reading 'length')` when adding or editing a PIN
  - `Passcode.vue`: use `||` instead of `??` for empty strings (`passCode`, `newPassCode`, `startDate`); block save if new PIN is empty
  - `api/index.js`: validate required parameters before calling the manager; apply default dates on update if absent
  - `manager.js`: defensive guard in `updatePasscode` before calling the SDK

---

## [1.2.37] — 2026-04-26

### 🐛 Fixed · 🔧 Reliability

- **`_processOperationLog`**: deduplication via lock flag + `finally` — concurrent executions prevented; `_onLockUpdated` no longer attempts to connect if already running
- **`manager`**: emit `lockBatteryUpdated` in addition to `lockUpdated` on battery change
- **`ha.js`**: subscribe to `lockUpdated` (instead of `lockBatteryUpdated` which was never emitted) — battery now correctly published via MQTT; `updateLockState` wrapped in `try/catch`
- **`store.js`**: atomic saves via temp file + `rename()` — protects against JSON corruption on power loss
- **`WsApi.js`**: centralised `_send()` with `try/catch` — protects against sends on a closed socket
- **`api/index.js`**: `getAudio` errors now forwarded to the WebSocket client

---

## [1.2.0] — 2026-04-22

### 🔧 Changed

- Migrate frontend from Vue 2 → Vue 3 + Vuetify 3
- Replace webpack / @vue/cli-service with Vite 5
- Replace `v-jsoneditor` with `json-editor-vue` (Vue 3 compatible)

---

## [0.4.11] — 2021-05-06

- Bump SDK in attempt at fixing connect limbo

## [0.4.0] — 2021-03-27

- Monitor advertisement packets to detect lock/unlock status updates (pin, fingerprint, card)
- More reliable device discovery
- View operation log
- Optimise communication with the lock
- Add lock unpair
- Fixes on settings save

## [0.3.2] — 2021-03-16

- Fix bugs related to aliases when adding a new card or fingerprint

## [0.3.1] — 2021-03-08

- Add aliases (friendly names) to cards and fingerprints

## [0.3.0] — 2021-01-22

- New layout separating settings and credentials
- Manage lock sound

## [0.2.31] — 2021-01-21

- Bump SDK — fix gateway disconnection issues

## [0.2.24] — 2021-01-20

- Bump SDK — fix switch feature and remote unlock error during pairing
- Stop scan after a new unpaired lock is found
- Option to debug gateway messages (`gateway_debug: true`)

## [0.2.21] — 2021-01-17

- Bump SDK — stability fixes

## [0.2.19] — 2021-01-16

- Auto-lock management

## [0.2.16] — 2021-01-16

- Basic config editing UI
- Option for communication debug (`debug_communication: true`)

## [0.2.12] — 2021-01-16

- Persist device state between HA restarts
- Option for MQTT debug (`debug_mqtt: true`)

## [0.2.11] — 2021-01-15

- Filter credentials type availability based on lock features
- Force noble in websocket mode to avoid missing BLE adapter
- Unstable connection fixes from SDK
- Status updates to all clients
- Reduce scan interval
- Option to ignore CRC errors (`ignore_crc: true`)

## [0.2.7] — 2021-01-12

- Add support for BLE Gateway (not TTLock G2 gateway)

## [0.1.1] — 2021-01-08

- Possible fix for discovering unpaired locks
- Debug found locks

## [0.1.0] — 2021-01-05

Initial release
