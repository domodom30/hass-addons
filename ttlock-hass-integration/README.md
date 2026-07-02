<div align="center">

<img src="https://raw.githubusercontent.com/domodom30/hass-addons/master/ttlock-hass-integration/logo.png" alt="TTLock" width="120" />

# TTLock — Home Assistant Add-on

**Integrate your TTLock smart locks directly into Home Assistant — no cloud required.**

[![Version](https://img.shields.io/badge/version-2.6.2-blue?style=flat-square)](https://github.com/domodom30/hass-addons/blob/master/ttlock-hass-integration/CHANGELOG.md)
[![HA](https://img.shields.io/badge/Home%20Assistant-compatible-41BDF5?style=flat-square&logo=homeassistant)](https://www.home-assistant.io/)
[![BLE](https://img.shields.io/badge/Bluetooth-BLE-0082FC?style=flat-square&logo=bluetooth)](https://github.com/abandonware/noble)
[![SDK](https://img.shields.io/badge/SDK-%40domodom30%2Fttlock--sdk--js-orange?style=flat-square)](https://www.npmjs.com/package/@domodom30/ttlock-sdk-js)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE.md)

> ⚠️ **Work in progress** — Feedback and bug reports welcome: [open an issue](https://github.com/domodom30/hass-addons/issues)

</div>

<p align="center">
  <a href="https://ko-fi.com/A1V11ZZTPI">
    <img src="https://ko-fi.com/img/githubbutton_sm.svg" alt="ko-fi">
  </a>
</p>

---

## 📑 Table of contents

- [Requirements](#-requirements)
- [Features](#-features)
- [Screenshots](#-screenshots)
- [Configuration](#%EF%B8%8F-configuration)
- [ESP32 BLE Gateway](#-esp32-ble-gateway)
- [Useful links](#-useful-links)

---

## 📋 Requirements

| Component | Details |
|---|---|
| **Bluetooth** | Adapter compatible with [`@abandonware/noble`](https://github.com/abandonware/noble) **or** a remote Noble BLE gateway (e.g. ESP32) |
| **MQTT** | Optional broker — recommended for Home Assistant automations (Mosquitto add-on is auto-detected) |
| **Home Assistant** | Supervised / OS install with add-ons support |

---

## ✨ Features

### 🔒 Lock control
- Pair / unpair a lock
- Lock / unlock from the UI or via MQTT
- Real-time status (locked, unlocked, battery, RSSI)

### 🗝️ Access management
- **PIN codes** — add, edit, delete (with validity period)
- **IC cards** — add, delete, friendly aliases
- **Fingerprints** — add, delete, friendly aliases

### ⚙️ Settings
- Auto-lock with configurable delay
- Confirmation beep (on/off)
- Clock synchronisation (admin-authenticated)
- Device information (manufacturer, model, firmware) — persisted across restarts
- Operation log viewer with refresh

### 🏠 Home Assistant integration (via MQTT)
- Automatic discovery via MQTT Discovery
- `lock` entity with `LOCK` / `UNLOCK` commands
- Battery sensor (`%`)
- RSSI signal sensor (`dB`)
- Firmware exposed as `sw_version` on the HA device

---

## 📸 Screenshots

<table>
  <tr>
    <td align="center"><strong>Lock list</strong></td>
    <td align="center"><strong>Settings</strong></td>
  </tr>
  <tr>
    <td><img src="https://raw.githubusercontent.com/domodom30/hass-addons/master/ttlock-hass-integration/img/frontend.png" alt="Lock list" width="380"/></td>
    <td><img src="https://raw.githubusercontent.com/domodom30/hass-addons/master/ttlock-hass-integration/img/frontend_settings.png" alt="Settings" width="380"/></td>
  </tr>
  <tr>
    <td align="center"><strong>PIN codes</strong></td>
    <td align="center"><strong>IC cards</strong></td>
  </tr>
  <tr>
    <td><img src="https://raw.githubusercontent.com/domodom30/hass-addons/master/ttlock-hass-integration/img/frontend_code.png" alt="PIN codes" width="380"/></td>
    <td><img src="https://raw.githubusercontent.com/domodom30/hass-addons/master/ttlock-hass-integration/img/frontend_ic.png" alt="IC cards" width="380"/></td>
  </tr>
  <tr>
    <td align="center"><strong>Add IC card</strong></td>
    <td align="center"><strong>Operation log</strong></td>
  </tr>
  <tr>
    <td><img src="https://raw.githubusercontent.com/domodom30/hass-addons/master/ttlock-hass-integration/img/frontend_addIC.png" alt="Add IC card" width="380"/></td>
    <td><img src="https://raw.githubusercontent.com/domodom30/hass-addons/master/ttlock-hass-integration/img/frontend_operations.png" alt="Operation log" width="380"/></td>
  </tr>
  <tr>
    <td align="center" colspan="2"><strong>Home Assistant — MQTT device</strong></td>
  </tr>
  <tr>
    <td colspan="2" align="center"><img src="https://raw.githubusercontent.com/domodom30/hass-addons/master/ttlock-hass-integration/img/ha1.png" alt="HA device" width="600"/></td>
  </tr>
</table>

---

## ⚙️ Configuration

```yaml
gateway: "none"         # "none" = local BLE, "noble" = remote Noble BLE gateway
gateway_host: ""        # Noble gateway hostname or IP (if gateway: noble)
gateway_port: 9000      # Gateway port
gateway_key: ""         # Gateway AES key
gateway_user: ""        # Gateway username
gateway_pass: ""        # Gateway password
ignore_crc: true        # Ignore CRC errors (required by many firmwares)
debug_communication: false  # Verbose BLE protocol logs
debug_mqtt: false           # Verbose MQTT logs
gateway_debug: false        # Verbose gateway logs
```

> 💡 The MQTT broker is configured automatically if the **Mosquitto** add-on is installed in Home Assistant.

---

## 📡 ESP32 BLE Gateway

If your Home Assistant server doesn't have Bluetooth, or if your locks are out of range, you can use an **ESP32 as a remote BLE gateway**.

👉 **[esp32-ble-gateway](https://github.com/domodom30/esp32-ble-gateway)**

This gateway bridges WiFi and BLE using the Noble WebSocket protocol — fully compatible with this add-on.

### Gateway features

| Feature | Details |
|---|---|
| 🔧 **Stack** | NimBLE-Arduino 2.x + Vue 3 / Vite WebUI |
| 🌐 **Network** | DHCP or static IP, mDNS (`<name>.local`) |
| 🔑 **Auth** | AES-128-CBC key + configurable admin login / password |
| 🔒 **TLS** | HTTPS web interface (self-signed certificate) |
| 📦 **Hardware** | ESP32-WROVER board |

### Quick setup

1. Flash the filesystem then the firmware via PlatformIO
2. Connect to the `ESP32GW` WiFi AP (password: `87654321`)
3. Open `https://esp32gw.local`, configure your WiFi, AES key and admin credentials
4. Set the add-on configuration:

```yaml
gateway: "noble"
gateway_host: "IP_OR_HOSTNAME_OF_ESP32"
gateway_port: 8080
gateway_key: "AES_KEY_FROM_ESP_CONFIG"
gateway_user: "YOUR_ADMIN_LOGIN"
gateway_pass: "YOUR_ADMIN_PASSWORD"
```

---

## 🔗 Useful links

- 📝 [Changelog](CHANGELOG.md)
- 🐛 [Report a bug](https://github.com/domodom30/hass-addons/issues)
- 📦 [TTLock SDK fork](https://github.com/domodom30/ttlock-sdk-js)
- 📡 [ESP32 BLE gateway](https://github.com/domodom30/esp32-ble-gateway)

---

<p align="center">
  <a href="https://ko-fi.com/A1V11ZZTPI">
    <img src="https://ko-fi.com/img/githubbutton_sm.svg" alt="ko-fi">
  </a>
</p>

<div align="center">
<sub>Built with ❤️ for the Home Assistant community.</sub>
</div>

