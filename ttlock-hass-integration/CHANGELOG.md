# Changelog

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [2.5.9] — 2026-06-30

### 🐛 Fixed

- **Persistance disque — course sur `saveData()`** : `saveData()` est `async` mais appelé en
  fire-and-forget depuis une dizaine de mutateurs (`setLockData`, `setDeviceInfo`, `setLockFeatures`,
  alias…). Une rafale d'appels concurrents (typiquement après le traitement d'un journal d'opérations)
  se disputait le même fichier `.tmp` : le premier `rename` le consommait, les suivants échouaient en
  `ENOENT` (`rename '/data/lockData.json.tmp' -> '/data/lockData.json'`, idem `aliasData.json` /
  `deviceInfoData.json`). Résultat : rien n'était persisté dans `/data`, le cache `lockData.json` ne se
  mettait jamais à jour et le chemin *cache-only* (2.5.8) n'avait rien à servir après un redémarrage.
  `saveData()` sérialise désormais les écritures avec coalescence des rafales (`_doSaveData()` relit
  l'état mémoire courant à son exécution → on persiste toujours la version la plus récente)
- **Identifiants — échec silencieux** : sur échec de connexion BLE, `getCredentials()` renvoyait le
  sentinel *truthy* `{ passcodes: false, cards: false, fingers: false }`, que `handleCredentials`
  interprétait comme un succès → panneau vide sans message. Les vrais échecs (serrure injoignable,
  connexion/reconnexion impossible, toutes les lectures échouées après 3 essais) renvoient maintenant
  `false`, déclenchant l'erreur « Failed fetching credentials » et débloquant le spinner. Une serrure
  réellement sans capacité conserve son résultat légitime (`{false,false,false}`)

---

## [2.5.8] — 2026-06-29

### 🐛 Fixed

- **BLE — contention sur le login admin** : `Lock.fromTTLock()` (chemin de diffusion de statut, exécuté à chaque `WsApi.sendLockStatus` / `getLocks`) émettait une commande BLE `getLockSound()` / `getAutolockTime()` non sérialisée, hors du mutex radio global. Cette commande entrait en collision avec la boucle `macro_adminLogin`, provoquant des `No response to checkAdmin` et `No response to get audioManage`. `_resolveAudio()` et `_resolveAutoLockTime()` sont désormais strictement *cache-only* (lecture de `_cachedAudio` / `_cachedAutoLock`, alimentés par les flux mutex-gardés `getAudio` / setAudio / calibrate), respectant le contrat « non-BLE » déjà documenté dans `fromTTLock`
- **Version** : `addon/package.json` (resté à `2.5.1`) réaligné sur la version de release — le banner de démarrage affichait une version erronée

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
