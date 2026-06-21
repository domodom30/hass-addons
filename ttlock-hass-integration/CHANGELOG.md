# Changelog

## [2.5.1] - 2026-06-21

### Fix: global BLE radio mutex — serialization across locks

- **`_radioChain` (constructor)**: added a global promise chain to serialize BLE radio access across all locks. The previous per-address mutex allowed two different locks to attempt a GATT connection simultaneously, causing collisions where both `connect()` calls failed or returned `false`
- **`_acquireMutex` rewritten**: each caller chains onto `_radioChain` and waits for the previous holder to release before attempting its own connection. The release function is now idempotent (via a `released` flag) — a double-call no longer advances the chain twice or prematurely unblocks the next waiter
- The per-address `_bleMutex` is kept for existing guards (`isLockBusy`, `_bleMutex.size > 0` in `_onScanStopped` and `_ensureMonitoring`) — their semantics remain correct since with global serialization the map holds at most one entry at a time

## [2.5.0] - 2026-06-19

### Cleaner BLE `macro_adminLogin` error messages

- **`Manager.getOperationLog` catch**: when the SDK raises `No response to checkAdmin`, the stack trace is no longer double-logged — a single `console.warn` line is emitted instead: `getOperationLog [<address>]: BLE admin auth failed — lock out of range or busy`
- **`_doAdminLogin` catch**: the message now includes the MAC address and translates `No response to checkAdmin` into a plain-language description: `[<address>] BLE admin login failed — lock out of range or busy (no response to checkAdmin)`
- **`_processOperationLog` adminAuth guard**: message reformatted with address prefix and more explicit cause: `_processOperationLog [<address>]: adminAuth missing — BLE admin auth failed or disconnected during read`

## [1.9.23] - 2026-05-20

### Sensor anomaly icon in the activity log

- **ALARM category**: `_enrichOperation()` in `manager.js` now maps `LogOperateCategory.ALARM` (DOOR_SENSOR_ANOMALY, TAMPER_ALARM, LOW_BATTERY_ALARM…) to `recordTypeCategory = 'ALARM'` instead of `'OTHER'`
- **`mdi-shield-lock-open` icon**: ALARM entries display the icon in orange in `OperationsAll.vue` and `Operations.vue`

## [1.9.22] - 2026-05-20

### AppTopBar: single gateway icon with dropdown menu

- **Gateway area redesign**: the chip + 2 separate buttons are replaced by a single clickable icon. Green (`mdi-lan-connect`) if connected, red (`mdi-lan-disconnect`) if disconnected, orange (`mdi-help-network`) otherwise. Spinner while an operation is in progress
- **Dropdown menu**: a click opens a `v-menu` with two actions — *Reconnect gateway* and *Restart ESP32 gateway* — disabled while an operation is in progress
- **Hover tooltip**: retains the status text (host if connected, error message otherwise)

## [1.9.21] - 2026-05-20

### Fix: ESP32 reboot end detection — forced noble WS reconnection

- **Root cause**: the noble WebSocket TCP (addon ↔ ESP32) stays "stuck" after reboot because the noble protocol has no application-level ping/pong. `_setGatewayStatus('disconnected')` never fired → `_esp32RebootPending` stayed `true` → 60s spinner, no notification
- **Forced reconnection**: `rebootEsp32()` — after a success (ECONNRESET or HTTP 200), schedules `ws.reconnect()` after 2 s. Forces the `close → open` cycle on the noble WS → `_setGatewayStatus('disconnected')` then `'connected'` → `_esp32RebootPending = false` → snackbar *ESP32 gateway rebooted*
- **Deduplication**: `rebootEsp32()` returns immediately if `_esp32RebootPending` is already true (prevents a double-reboot if two WS clients send the command simultaneously)
- **One-shot `settle()`**: replaces the duplicate `resolve()/this._esp32RebootPending=true` calls. Prevents the case where `req.destroy()` (timeout) itself emits ECONNRESET and would incorrectly set `_esp32RebootPending = true`
- **Fixed `_connectLock` fail-fast**: the `_esp32RebootPending` guard now waits for the flag to become `false` again (rather than `_waitForGatewayReady` which returned `true` immediately if `gatewayStatus === 'connected'`)

## [1.9.20] - 2026-05-20

### BLE fail-fast + WS resilience during ESP32 reboot

- **`_connectLock` fail-fast during reboot**: `manager.js` — when `_esp32RebootPending = true`, `_connectLock` calls `_waitForGatewayReady(20000)` before attempting BLE connection. The ESP32 takes 10-15s to restart; during this window the gateway is still marked `connected` but BLE connections fail. The guard silently waits for the gateway to come back instead of logging `newEvents: failure #1`
- **`clearWaitingFlags` no longer touches `waitingEsp32Reboot`**: `store/index.js` — if the frontend↔addon WS drops during the reboot (HA restart, ingress), the flag stays active. The spinner persists and the *ESP32 gateway rebooted* notice shows correctly when the gateway comes back online. Cleanup is handled by `setGatewayStatus('connected')` (normal path) or the 60s safety timeout

## [1.9.19] - 2026-05-20

### ESP32 reboot completion notification

- **Backend log**: when the gateway comes back online after an ESP32 reboot, `_setGatewayStatus('connected')` detects the `_esp32RebootPending` flag and logs `[Gateway] ESP32 rebooted — gateway back online` (instead of the generic status message)
- **Frontend snackbar**: the `setGatewayStatus('connected')` mutation automatically pushes the `notices.gateway.esp32RebootComplete` notice when `waitingEsp32Reboot` was active — `Notices.vue` displays a green snackbar *"Passerelle ESP32 redémarrée — connexion rétablie"* (fr) / *"ESP32 gateway rebooted — connection restored"* (en)
- **Affected layers**: `manager.js` (`_esp32RebootPending`, `rebootEsp32`, `_setGatewayStatus`), `store/index.js` (`setGatewayStatus` mutation), locales fr/en (`notices.gateway.esp32RebootComplete`)

## [1.9.18] - 2026-05-20

### Fix: ESP32 reboot spinner — stay active until fully reconnected

- **Extended spinner**: `_onEsp32Reboot` no longer clears `waitingEsp32Reboot` on HTTP success. The spinner stays active until `gatewayStatus` becomes `'connected'` again (natural end-of-reboot signal, ~10-15s). 60s safety timeout if the ESP32 does not come back
- **Reconnect button disabled** during ESP32 reboot: `:disabled="isRebootingEsp32"` on the `mdi-lan-pending` button prevents the user from clicking "reconnect gateway" while the ESP32 is rebooting, avoiding the unintended `restartGateway` calls observed in logs
- **`setGatewayStatus('connected')` clears `waitingEsp32Reboot`** in the Vuex mutation: when the WS reconnects after the reboot, the flag is automatically cleared

## [1.9.17] - 2026-05-20

### "Restart ESP32 gateway" button in AppTopBar

- **New `mdi-restart` button**: when a noble gateway is configured, a hardware restart button appears next to the WS reconnect button. A click sends a `GET https://gateway_host:443/restart` with Basic Auth (credentials from gateway config). The ESP32 responds 200 then executes `ESP.restart()` after 2 loop iterations
- **Self-signed certificate**: the HTTPS request uses `rejectUnauthorized: false` (auto-generated cert on the ESP32 side, standard behaviour)
- **Spinner**: covers only the HTTP phase (1-5s); the gateway chip then displays the `disconnected → connecting → connected` cycle automatically via existing mechanisms
- **Error feedback**: if the ESP32 is unreachable or credentials are incorrect, an error snackbar is shown
- **No ESP32-side changes**: the `/restart` endpoint is already present in `web.cpp`
- **Affected layers**: `manager.rebootEsp32()` (import `node:https`), `WsApi.sendEsp32Reboot()`, `case 'rebootEsp32'` in the dispatcher, `api.rebootEsp32()` + `_onEsp32Reboot()` (frontend), store (`waitingEsp32Reboot`), `AppTopBar.vue`, locales fr/en

## [1.9.16] - 2026-05-20

### "Reconnect gateway" button in AppTopBar

- **New button in the toolbar**: when a noble gateway is configured, an `mdi-lan-pending` button appears next to the gateway chip. A click forces a WebSocket reconnection (via `ws.reconnect()` on the internal RWS socket) without restarting the addon or the ESP32
- **Progress indicator**: the button shows a spinner during reconnection (up to 15 s) and updates automatically via the existing gateway status
- **Error feedback**: if the gateway does not respond within 15 s, an error snackbar is shown
- **Affected layers**: `manager.restartGateway()` (backend), `WsApi.sendGatewayRestart()`, `case 'restartGateway'` in the dispatcher, `api.restartGateway()` + `_onGatewayRestart()` (frontend), store (`waitingGatewayRestart`), `AppTopBar.vue`, locales fr/en

## [1.9.15] - 2026-05-20

### Connection performance improvements

- **ESP32 — reduced post-disconnect BLE delay**: `ble_api.cpp` — `vTaskDelay` after disconnect reduced from 1000 ms to 200 ms. Saves 800 ms per lock/unlock cycle
- **ESP32 — reduced delay between BLE retries**: `ble_api.cpp` — delay between BLE connection attempts reduced from 1000 ms to 500 ms. Saves up to 2 s on initial connections that require multiple tries
- **Addon — faster monitor resume**: `manager.js` — `_scheduleGatewayRecovery` delay reduced from 2500 ms to 500 ms. BLE monitor restarts 2 s earlier after a WebSocket reconnect
- **Addon — faster WebSocket reconnection**: `manager.js` — SDK `reconnecting-websocket` (RWS) configured with `minReconnectionDelay: 300 ms` and `connectionTimeout: 2000 ms` (instead of defaults 1000 ms and 4000 ms). Reconnection after a network drop is 700 ms faster. Applied defensively (feature-detected) in `_attachGatewayWatchdog`

## [1.9.10] - 2026-05-15

### Noble gateway: UI, monitor recovery, fail-fast

- **Gateway chip always visible**: when a noble gateway is configured, the chip stays permanently displayed — green (`success`) with `host:port` on hover when the link is connected, `warning`/`error` otherwise (`AppTopBar.vue`). The backend exposes `gatewayHost` in the `status` payload (`manager.getGatewayHost()`, `WsApi.js`); the frontend stores it (`store`, `api`) and displays it in the tooltip (locales fr/en: `app.gateway.connected`)
- **Reliable BLE monitor recovery**: `_recoverMonitor` replaced by `_ensureMonitoring()` + periodic watchdog (20 s). Fixes `monitor BLE redémarré: false`: `TTLockClient.stopMonitor()` did not reset the internal `monitoring` flag, so `startMonitor()` always returned `false` and the scan stayed dead until a manual scan. The new code detects this blocked state, resets the SDK's internal flags (documented coupling, feature-detected) and actually verifies `isMonitoring()` with retries. The watchdog also covers `startMonitor()` calls silently returning false from `_onScanStopped`/`_onLockDisconnected`
- **BLE operation fail-fast when gateway is disconnected**: `_connectLock` briefly waits for reconnection (≤6 s) then cleanly aborts instead of chaining 4 attempts × backoff doomed to `Disconnected while waiting for response`; early exit from the loop if the link drops mid-operation. Guards scoped to noble mode — no impact on local BLE

## [1.9.9] - 2026-05-15

### Noble gateway improvements (WebSocket)

- **Error robustness**: `index.js` replaces the `uncaughtException` handler based on exact string matching (fragile, misleading "retrying…" message when the addon was not actually retrying) with targeted detection of recoverable connection error classes (message fragment OR errno code). Added a symmetric `unhandledRejection` handler. Throttled warning (max 1/30 s) and corrected message: it is the SDK's `reconnecting-websocket` that retries
- **Configuration validation**: `init.js` normalises and validates noble options before `setNobleGateway` — `gateway_port` is coerced to a number (it arrived as a string from the environment), `gateway_host`/`gateway_key`/`gateway_user`/`gateway_pass` are checked and any missing or invalid value is explicitly reported (the SDK silently fell back to hardcoded defaults, including `admin`/`admin`)
- **Link status in the UI**: `manager.js` observes the SDK's `reconnecting-websocket` (open/close/error) and exposes `gatewayStatus` (`connecting`/`connected`/`disconnected`/`unknown`). Broadcast in the `status` payload (`WsApi.js`, `api/index.js`); the frontend (`store`, `api`, `AppTopBar.vue`, locales fr/en) displays a warning chip when the gateway is not connected. 100% defensive detection: degrades to `unknown` if the SDK's internal structure changes, never crashes
- **Monitoring recovery watchdog**: on gateway reconnection, `manager.js` restarts the BLE monitor (`stopMonitor` then `startMonitor`, with one retry). The SDK did not re-emit the scan command after a silent reconnection — the scan therefore stayed dead until the next restart. Recovery is debounced and deferred if a lock operation is in progress

## [1.9.0] - 2026-05-12

### Fixes

- **Admin connection (adminLogin)**: systematic reset of `lock.adminAuth` before each `_doAdminLogin`
  - `manager.js`: the SDK set `adminAuth=true` during `connect(false)/onConnected` even when the firmware session was no longer valid (disconnection mid-auth). Skipping `_doAdminLogin` on a stale session caused `NO_PERMISSION (0x01)` on reads/writes (notably `getPassCodes`)
  - `manager.js`: `adminAuth` also reset in the `catch` to avoid short-circuiting the macro on the next attempt
- **Add PIN**: reliable list refresh after write
  - `manager.js`: `addPasscode` now waits 1.5 s then retries `getPassCodes` up to 3 times (with reconnection if the lock disconnected). Avoids returning an empty list to the UI when the firmware index is not yet ready
- **Store persistence**: robust JSON saves against Windows file locks
  - `store.js`: new `fileDataRename` helper that retries `fs.rename` up to 3 times on `EPERM` (antivirus / indexer holding the `.tmp`). Applied to `lockData`, `aliasData` and `deviceInfoData`
- **TTLock SDK**: bump `@domodom30/ttlock-sdk-js` `^0.6.0` → `^0.6.3`
- **Frontend**: `CredentialsAll.vue` and `SettingsAll.vue` use `Array.some()` (SonarQube) instead of `Array.find()` for unpaired lock detection
- **Frontend**: refreshed Settings and Credentials interfaces
- **Dev mode**: `api/index.js` honours `process.env.DEV_MODE` for `handleCredentials`/`handlePasscode`/`handleCard`/`handleFinger` (mock via `WsApi._devSendCredentials`)

## [1.4.0] - 2026-04-27

### Fixes

- **Firmware**: fixed a recurring bug where the lock firmware version was not displayed after a restart
  - `store.js`: added `deviceInfoData` (`setDeviceInfo` / `getDeviceInfo` methods) persisted in `/data/deviceInfoData.json`
  - `manager.js`: saves `lock.deviceInfo` to the store immediately after pairing (`initLock`)
  - `Lock.js`: fallback to `store.getDeviceInfo()` when `lock.deviceInfo` is absent (after restart)
  - `ha.js`: same fallback for `sw_version` in Home Assistant MQTT discovery

- **Audio (sound)**: the sound status chip stayed greyed out on the lock card even when sound was active
  - `Lock.js`: `getLockSound()` uses an in-memory cache and is safe when the lock is connected; the read was incorrectly conditioned on `!isConnected()`, blocking the value during the `lockConnected` event

## [1.2.38] - 2026-04-26

### Fixes

- **PIN (passcode)**: fixed crash `Cannot read properties of undefined (reading 'length')` when adding or editing a PIN code
  - `Passcode.vue`: use `||` instead of `??` to handle empty strings (`passCode`, `newPassCode`, `startDate`)
  - `Passcode.vue`: block save if the new PIN is empty
  - `api/index.js`: validate required parameters before calling the manager; default dates for update if absent
  - `manager.js`: defensive guard in `updatePasscode` to detect missing parameters before calling the SDK

## [1.2.37] - 2026-04-26

### Fixes and reliability improvements

- **manager**: prevent concurrent executions of `_processOperationLog` via lock (deduplication flag + `finally`)
- **manager**: `_onLockUpdated` no longer attempts to connect if `_processOperationLog` is already running
- **manager**: emit `lockBatteryUpdated` in addition to `lockUpdated` on battery change
- **ha.js**: subscribe to `lockUpdated` (instead of `lockBatteryUpdated` which was never emitted) — battery is now correctly published via MQTT
- **ha.js**: `updateLockState` wrapped in a `try/catch` to prevent MQTT crashes
- **store.js**: atomic saves via temp file + `rename()` — protects against JSON corruption on power loss
- **WsApi.js**: centralised `_send()` method with `try/catch` — protects against sends on a closed socket
- **api/index.js**: `getAudio` errors are now forwarded to the WebSocket client

## [1.2.0] - 2026-04-22

- Migrate frontend from Vue 2 to Vue 3 + Vuetify 3
- Replace webpack / @vue/cli-service build toolchain with Vite 5
- Replace v-jsoneditor with json-editor-vue (Vue 3 compatible)

## [0.4.11] - 2021-05-06

- Bump SDK in attempt at fixing connect limbo

## [0.4.0] - 2021-03-27

- Monitor advertisement packets to detect lock/unlock status updates (detects unlock events using pin, fingerprint or card)
- Discovery should be more reliable now
- View operation log
- Optimise communication with the lock
- Add lock unpair
- Fixes on settings save

## [0.3.2] - 2021-03-16

- Fix some bugs related to aliases when adding a new card or fingerprint

## [0.3.1] - 2021-03-08

- Add aliases (friendly names) to cards and fingerprints

## [0.3.0] - 2021-01-22

- New layout separating settings and credentials
- Manage lock sound

## [0.2.31] - 2021-01-21

- Bump SDK for fixing gateway disconnection issues

## [0.2.24] - 2021-01-20

- Bump SDK for switch feature fix and remote unlock error during pairing
- Stop scan after a new unpaired lock is found
- Option to debug gateway messages (`gateway_debug: true` in config)

## [0.2.21] - 2021-01-17

- Bump SDK for stability fixes

## [0.2.19] - 2021-01-16

- Auto-lock management

## [0.2.16] - 2021-01-16

- Basic config editing UI for saving/restoring lock pairing data
- Option for communication debug (`debug_communication: true` in config)

## [0.2.12] - 2021-01-16

- Persist device state between HA restarts
- Option for MQTT debug (`debug_mqtt: true` in config)

## [0.2.11] - 2021-01-15

- Filter credentials type availability based on lock features
- Force noble in websocket mode to avoid missing BLE adapter
- Unstable connection fixes from SDK
- Status updates to all clients
- Reduce scan interval
- Option to ignore CRC errors (`ignore_crc: true` in config)

## [0.2.7] - 2021-01-12

- Add support for BLE Gateway (not TTLock G2 gateway)

## [0.1.1] - 2021-01-08

- Possible fix for discovering unpaired locks
- Debug found locks

## [0.1.0] - 2021-01-05

Initial release
