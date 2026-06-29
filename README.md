<div align="center">

# Domodom Add-ons — Home Assistant

**Dépôt d'add-ons Home Assistant maintenu par [Domodom30](https://github.com/domodom30).**

[![HA](https://img.shields.io/badge/Home%20Assistant-compatible-41BDF5?style=flat-square&logo=homeassistant)](https://www.home-assistant.io/)

</div>

---

## 📦 Installation du dépôt

1. Dans Home Assistant, ouvrez **Paramètres → Modules complémentaires → Boutique des modules complémentaires**.
2. Menu **⋮** (en haut à droite) → **Dépôts**.
3. Ajoutez l'URL : `https://github.com/domodom30/hass-addons`
4. Les add-ons ci-dessous apparaîtront dans la boutique.

[![Open your Home Assistant instance and show the add add-on repository dialog with a specific repository URL pre-filled.](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2Fdomodom30%2Fhass-addons)

---

## 🧩 Add-ons disponibles

| Add-on | Version | Description | Architectures |
|---|---|---|---|
| [**TTLock**](./ttlock-hass-integration) | `2.5.7` | Intégration des serrures connectées TTLock via BLE, **sans cloud**. | amd64, armv7, armhf, i386, aarch64 |
| [**Bluetooth Audio Manager**](./ha-bluetooth-audio-manager) | `3.2.0` | Gestion des périphériques audio Bluetooth (A2DP) avec appairage persistant et reconnexion automatique. | aarch64, amd64, armv7, armhf |

---

### 🔑 TTLock

> Intégrez vos serrures connectées TTLock directement dans Home Assistant — aucun cloud requis.

- **Contrôle de serrure** — appairage, verrouillage/déverrouillage (UI ou MQTT), statut temps réel (état, batterie, RSSI).
- **Gestion des accès** — codes PIN, cartes IC et empreintes digitales (ajout, modification, suppression, alias).
- **Réglages** — auto-verrouillage, bip de confirmation, synchronisation de l'horloge, journal des opérations.
- **Intégration HA via MQTT** — découverte automatique (MQTT Discovery), entité `lock`, capteurs batterie/RSSI, firmware exposé en `sw_version`.
- **Passerelle BLE distante** — compatible avec une [passerelle ESP32 BLE](https://github.com/domodom30/esp32-ble-gateway) si le serveur HA n'a pas de Bluetooth ou si les serrures sont hors de portée.

📖 [Documentation complète](./ttlock-hass-integration/README.md)

---

### 🔊 Bluetooth Audio Manager

> Gérez vos enceintes et récepteurs audio Bluetooth (A2DP) depuis une interface web intégrée à Home Assistant.

- **Gestion en un clic** — scan, appairage, connexion et déconnexion depuis l'interface web.
- **Reconnexion automatique** — après une déconnexion ou un redémarrage, avec backoff exponentiel configurable.
- **Modes d'inactivité par appareil** — Power Save, Stay Awake (keep-alive inaudible) ou Auto-Disconnect.
- **Instances MPD par appareil** — chaque périphérique BT obtient son propre Music Player Daemon, exposable en `media_player` pour le TTS et les automatisations.
- **Multi-adaptateurs & monitoring** — détection de tous les adaptateurs Bluetooth, vues Événements et Logs en temps réel.
- **Sécurité** — profil AppArmor en moindre privilège, opérations Bluetooth via BlueZ D-Bus, coexistence sûre avec les intégrations BLE de HA (Classic BR/EDR uniquement).

📖 [Documentation complète](./ha-bluetooth-audio-manager/README.md)

---

## 🔗 Liens utiles

- 🐛 [Signaler un bug](https://github.com/domodom30/hass-addons/issues)
- 📦 [Fork du SDK TTLock](https://github.com/domodom30/ttlock-sdk-js)
- 📡 [Passerelle ESP32 BLE](https://github.com/domodom30/esp32-ble-gateway)

---

<div align="center">
<sub>Maintenu avec ❤️ pour la communauté Home Assistant.</sub>
</div>
