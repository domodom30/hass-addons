import { readFileSync } from 'node:fs';
import mqtt from 'async-mqtt';
import manager from './manager.js';
import store from './store.js';
import { LockedStatus } from '@domodom30/ttlock-sdk-js';
import {
  BRIDGE_AVAILABILITY_TOPIC,
  PAYLOAD_ONLINE,
  PAYLOAD_OFFLINE,
  lockIdFromAddress,
  stateTopic,
  commandTopic,
  commandSubscription,
  lockAvailabilityTopic,
  lastOperationTopic,
  lastUnlockTopic,
  operationEventTopic,
  discoveryConfigTopic,
  parseCommandTopic,
  latestOperation,
  latestUnlock,
  buildLastOperationPayload,
  buildOperationEventPayload,
  OPERATION_EVENT_TYPES
} from './mqttTopics.js';

// Read once at module load — used to populate the discovery `origin` block (HA
// convention since 2023.8: attributes entities to the integration that created them,
// shown on the device page). package.json is always present alongside this file.
const ADDON_VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url))).version;

class HomeAssistant {
  /**
   *
   * @param {import('./manager')} manager
   * @param {Object} options
   * @param {string} options.mqttUrl
   * @param {string} [options.mqttUser] optional — anonymous broker supported
   * @param {string} [options.mqttPass] optional — anonymous broker supported
   * @param {string} [options.discovery_prefix]
   */
  constructor(options) {
    this.mqttUrl = options.mqttUrl;
    this.mqttUser = options.mqttUser;
    this.mqttPass = options.mqttPass;
    this.discovery_prefix = options.discovery_prefix || 'homeassistant';
    /** @type {Map<string, string>} address → last published name (alias or SDK name) */
    this.configuredLocks = new Map();
    this.connected = false;
    this._connecting = false;
    this._reconnectTimer = null;

    manager.on('lockPaired', this._onLockPaired.bind(this));
    manager.on('lockConnected', this._onLockConnected.bind(this));
    manager.on('lockUnlock', this._onLockUnlock.bind(this));
    manager.on('lockLock', this._onLockLock.bind(this));
    manager.on('lockUpdated', this._onLockBatteryUpdated.bind(this));
    manager.on('lockUnpaired', this._onLockUnpaired.bind(this));
    manager.on('lockStateUpdated', this._onLockStateUpdated.bind(this));
    manager.on('lockOffline', this._onLockOffline.bind(this));
    manager.on('lockOnline', this._onLockOnline.bind(this));
    manager.on('lockOperation', this._onLockOperation.bind(this));
  }

  /** Schedule a single reconnection attempt (guarded against duplicates). */
  _scheduleReconnect() {
    if (this._reconnectTimer) return;
    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      this.connect();
    }, 5000);
  }

  async connect() {
    if (this._connecting) return;
    this._connecting = true;
    try {
      // Tear down any previous client first — the old 'close' handler must not
      // survive, otherwise listeners accumulate and several clients reconnect
      // in parallel.
      if (this.client) {
        this.client.removeAllListeners();
        await this.client.end(true).catch(() => {});
        this.client = null;
      }

      this.client = await mqtt.connectAsync(this.mqttUrl, {
        username: this.mqttUser || undefined,
        password: this.mqttPass || undefined,
        // Disable mqtt.js' built-in auto-reconnect — we drive a single
        // reconnection loop ourselves via the 'close' handler.
        reconnectPeriod: 0,
        will: {
          topic: BRIDGE_AVAILABILITY_TOPIC,
          payload: PAYLOAD_OFFLINE,
          qos: 1,
          retain: true
        }
      });

      this.client.on('message', this._onMQTTMessage.bind(this));
      this.client.on('error', (err) => {
        console.error('MQTT error:', err.message);
      });
      this.client.on('close', () => {
        if (this.connected) {
          console.log('MQTT disconnected, reconnecting in 5s...');
          this.connected = false;
          this._scheduleReconnect();
        }
      });

      await this.client.subscribe(commandSubscription(), { qos: 1 });
      this.connected = true;
      console.log('MQTT connected');
      // Publishes bridge availability 'online' then republishes every known
      // lock — required because the broker may have restarted.
      await this._republishAll();
    } catch (error) {
      console.error('MQTT connection failed:', error.message);
      this._scheduleReconnect();
    } finally {
      this._connecting = false;
    }
  }

  /**
   * Construct a unique ID for a lock, based on the MAC address
   * @param {import('ttlock-sdk-js').TTLock} lock
   */
  getLockId(lock) {
    return lockIdFromAddress(lock.getAddress());
  }

  /**
   * Build the Home Assistant device block shared by every entity of a lock.
   * @param {import('ttlock-sdk-js').TTLock} lock
   * @param {string} id
   */
  _buildDevice(lock, id) {
    const address = lock.getAddress();
    const deviceInfo = lock.deviceInfo || store.getDeviceInfo(address);
    const rawModel = lock.getModel();
    const rawFirmware = lock.getFirmware();
    const rawManufacturer = lock.getManufacturer();
    return {
      identifiers: ['ttlock_' + id],
      name: store.getLockAlias(address) || lock.getName(),
      manufacturer: rawManufacturer && rawManufacturer !== 'unknown' ? rawManufacturer : '',
      model: rawModel && rawModel !== 'unknown' ? rawModel : deviceInfo?.modelNum || '',
      sw_version: rawFirmware && rawFirmware !== 'unknown' ? rawFirmware : deviceInfo?.firmwareRevision || ''
    };
  }

  /**
   * Hybrid availability: an entity is available only when BOTH the bridge and
   * the lock report 'online' (availability_mode: all).
   * @param {string} id
   */
  _hybridAvailability(id) {
    return {
      availability: [
        { topic: BRIDGE_AVAILABILITY_TOPIC, payload_available: PAYLOAD_ONLINE, payload_not_available: PAYLOAD_OFFLINE },
        { topic: lockAvailabilityTopic(id), payload_available: PAYLOAD_ONLINE, payload_not_available: PAYLOAD_OFFLINE }
      ],
      availability_mode: 'all'
    };
  }

  /**
   * `origin` block shared by every discovery payload (HA convention since 2023.8) —
   * attributes the entities to this integration on the device/entity info page.
   */
  _origin() {
    return {
      origin: {
        name: 'TTLock Home Assistant Integration',
        sw_version: ADDON_VERSION,
        support_url: 'https://github.com/domodom30/hass-addons/issues'
      }
    };
  }

  /**
   * Configure a lock device in HA
   * @param {import('ttlock-sdk-js').TTLock} lock
   * @param {boolean} [force] republish discovery even if already configured
   */
  async configureLock(lock, force = false) {
    if (!this.connected) return;
    const address = lock.getAddress();
    const name = store.getLockAlias(address) || lock.getName();
    if (!force && this.configuredLocks.get(address) === name) return;

    const id = lockIdFromAddress(address);
    const device = this._buildDevice(lock, id);
    const avail = this._hybridAvailability(id);
    const origin = this._origin();

    const entities = [
      {
        component: 'lock',
        objectId: 'lock',
        payload: {
          unique_id: 'ttlock_' + id,
          name: name,
          device: device,
          state_topic: stateTopic(id),
          command_topic: commandTopic(id),
          payload_lock: 'LOCK',
          payload_unlock: 'UNLOCK',
          state_locked: 'LOCK',
          state_unlocked: 'UNLOCK',
          value_template: '{{ value_json.state }}',
          optimistic: false,
          retain: false,
          qos: 1,
          ...avail,
          ...origin
        }
      },
      {
        component: 'sensor',
        objectId: 'battery',
        payload: {
          unique_id: 'ttlock_' + id + '_battery',
          name: name + ' Battery',
          device: device,
          device_class: 'battery',
          state_class: 'measurement',
          entity_category: 'diagnostic',
          unit_of_measurement: '%',
          state_topic: stateTopic(id),
          value_template: '{{ value_json.battery }}',
          qos: 1,
          ...avail,
          ...origin
        }
      },
      {
        component: 'sensor',
        objectId: 'rssi',
        payload: {
          unique_id: 'ttlock_' + id + '_rssi',
          name: name + ' RSSI',
          device: device,
          device_class: 'signal_strength',
          state_class: 'measurement',
          entity_category: 'diagnostic',
          unit_of_measurement: 'dBm',
          icon: 'mdi:signal',
          state_topic: stateTopic(id),
          value_template: '{{ value_json.rssi }}',
          qos: 1,
          ...avail,
          ...origin
        }
      },
      {
        component: 'sensor',
        objectId: 'last_operation',
        payload: {
          unique_id: 'ttlock_' + id + '_last_operation',
          name: name + ' Last operation',
          device: device,
          icon: 'mdi:history',
          state_topic: lastOperationTopic(id),
          value_template: '{{ value_json.event }}',
          json_attributes_topic: lastOperationTopic(id),
          qos: 1,
          ...avail,
          ...origin
        }
      },
      {
        component: 'sensor',
        objectId: 'last_access',
        payload: {
          unique_id: 'ttlock_' + id + '_last_access',
          name: name + ' Last access',
          device: device,
          icon: 'mdi:account-key',
          state_topic: lastUnlockTopic(id),
          value_template: '{{ value_json.event }}',
          json_attributes_topic: lastUnlockTopic(id),
          qos: 1,
          ...avail,
          ...origin
        }
      },
      {
        component: 'sensor',
        objectId: 'last_operation_time',
        payload: {
          unique_id: 'ttlock_' + id + '_last_operation_time',
          name: name + ' Last operation time',
          device: device,
          device_class: 'timestamp',
          icon: 'mdi:clock-check',
          // Même topic que last_operation. Le backend émet désormais un ISO 8601
          // déjà timezone-aware (offset DST-correct calculé à la date de l'op), donc
          // on le passe tel quel. Le garde `[-6] in ['+','-']` rejette les anciens
          // messages retained sans offset ('…:57:51') et le format entier compact.
          state_topic: lastOperationTopic(id),
          value_template: "{{ value_json.timestamp if value_json.timestamp is string and value_json.timestamp[-6] in ['+', '-'] else None }}",
          qos: 1,
          ...avail,
          ...origin
        }
      },
      {
        component: 'sensor',
        objectId: 'last_access_time',
        payload: {
          unique_id: 'ttlock_' + id + '_last_access_time',
          name: name + ' Last access time',
          device: device,
          device_class: 'timestamp',
          icon: 'mdi:clock-check-outline',
          // Même logique que last_operation_time (ISO déjà timezone-aware).
          state_topic: lastUnlockTopic(id),
          value_template: "{{ value_json.timestamp if value_json.timestamp is string and value_json.timestamp[-6] in ['+', '-'] else None }}",
          qos: 1,
          ...avail,
          ...origin
        }
      },
      {
        component: 'sensor',
        objectId: 'last_user',
        payload: {
          unique_id: 'ttlock_' + id + '_last_user',
          name: name + ' Last user',
          device: device,
          icon: 'mdi:account',
          state_topic: lastUnlockTopic(id),
          value_template: "{{ value_json.by if value_json.by else '—' }}",
          json_attributes_topic: lastUnlockTopic(id),
          qos: 1,
          ...avail,
          ...origin
        }
      },
      {
        component: 'event',
        objectId: 'operation',
        payload: {
          unique_id: 'ttlock_' + id + '_operation',
          name: name + ' Operation',
          device: device,
          icon: 'mdi:gesture-tap',
          state_topic: operationEventTopic(id),
          event_types: OPERATION_EVENT_TYPES,
          value_template: '{{ value_json.event_type }}',
          json_attributes_topic: operationEventTopic(id),
          qos: 1,
          ...avail,
          ...origin
        }
      },
      {
        component: 'binary_sensor',
        objectId: 'connectivity',
        payload: {
          unique_id: 'ttlock_' + id + '_connectivity',
          name: name + ' Connectivity',
          device: device,
          device_class: 'connectivity',
          entity_category: 'diagnostic',
          state_topic: lockAvailabilityTopic(id),
          payload_on: PAYLOAD_ONLINE,
          payload_off: PAYLOAD_OFFLINE,
          qos: 1,
          // Depends on the bridge only so it stays visible/historised even
          // when the lock itself is offline.
          availability: [{ topic: BRIDGE_AVAILABILITY_TOPIC, payload_available: PAYLOAD_ONLINE, payload_not_available: PAYLOAD_OFFLINE }],
          ...origin
        }
      }
    ];

    try {
      for (const entity of entities) {
        await this._publish(discoveryConfigTopic(this.discovery_prefix, entity.component, id, entity.objectId), entity.payload, { retain: true, qos: 1 });
      }
      this.configuredLocks.set(address, name);
    } catch (error) {
      console.error('MQTT configureLock error:', error.message);
    }
  }

  /**
   * Publish a payload. Objects are JSON-encoded; strings are sent as-is
   * (availability / retained-message purges).
   * @param {string} topic
   * @param {object|string} payload
   * @param {{retain?: boolean, qos?: number}} [options]
   */
  async _publish(topic, payload, { retain = true, qos = 0 } = {}) {
    const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
    if (process.env.MQTT_DEBUG == '1') {
      console.log('MQTT Publish', topic, data);
    }
    await this.client.publish(topic, data, { retain, qos });
  }

  /**
   * Update the readings of a lock in HA
   * @param {import('ttlock-sdk-js').TTLock} lock
   */
  async updateLockState(lock) {
    if (!this.connected) return;
    try {
      const id = lockIdFromAddress(lock.getAddress());
      const lockedStatus = await lock.getLockStatus();
      const statePayload = {
        battery: lock.getBattery(),
        rssi: lock.getRssi()
      };
      if (lockedStatus != LockedStatus.UNKNOWN) {
        statePayload.state = lockedStatus == LockedStatus.LOCKED ? 'LOCK' : 'UNLOCK';
      }
      await this._publish(stateTopic(id), statePayload, { retain: true, qos: 1 });
    } catch (error) {
      console.error('MQTT updateLockState error:', error.message);
    }
  }

  /**
   * Publish per-lock availability ('online' / 'offline').
   * @param {import('ttlock-sdk-js').TTLock} lock
   * @param {boolean} online
   */
  async publishLockAvailability(lock, online) {
    if (!this.connected) return;
    try {
      const id = lockIdFromAddress(lock.getAddress());
      await this._publish(lockAvailabilityTopic(id), online ? PAYLOAD_ONLINE : PAYLOAD_OFFLINE, {
        retain: true,
        qos: 1
      });
    } catch (error) {
      console.error('MQTT publishLockAvailability error:', error.message);
    }
  }

  /**
   * Publish the most recent operation-log entry (who locked/unlocked, when).
   * Reads the persisted log only — no BLE.
   * @param {import('ttlock-sdk-js').TTLock} lock
   */
  async publishLastOperation(lock) {
    if (!this.connected) return;
    try {
      const address = lock.getAddress();
      const ops = manager.getPersistedOperationLog(address);
      const last = latestOperation(ops);
      if (!last) return;
      // Déduplication : skip si le recordNumber n'a pas changé depuis la dernière
      // publication. Le seuil est PERSISTÉ (deviceInfoData) et non plus gardé en
      // mémoire, pour ne pas republier — et donc re-déclencher des automations HA —
      // à chaque redémarrage de l'addon (les messages retained suffisent).
      const lastRecord = last.recordNumber ?? null;
      if (store.getLastPublishedRecord(address, 'op') === lastRecord) return;
      const id = lockIdFromAddress(address);
      await this._publish(lastOperationTopic(id), buildLastOperationPayload(last), {
        retain: true,
        qos: 1
      });
      store.setLastPublishedRecord(address, 'op', lastRecord);
    } catch (error) {
      console.error('MQTT publishLastOperation error:', error.message);
    }
  }

  /**
   * Publish the most recent *credential* unlock (carte IC / code / empreinte …)
   * for the "last access" sensor. Unlike publishLastOperation this skips the
   * auto-lock / door-sensor records that would otherwise mask the method.
   * Reads the persisted log only — no BLE.
   * @param {import('ttlock-sdk-js').TTLock} lock
   */
  async publishLastUnlock(lock) {
    if (!this.connected) return;
    try {
      const address = lock.getAddress();
      const ops = manager.getPersistedOperationLog(address);
      const last = latestUnlock(ops);
      if (!last) return;
      // Déduplication : même logique (persistée) que publishLastOperation.
      const lastRecord = last.recordNumber ?? null;
      if (store.getLastPublishedRecord(address, 'unlock') === lastRecord) return;
      const id = lockIdFromAddress(address);
      await this._publish(lastUnlockTopic(id), buildLastOperationPayload(last), {
        retain: true,
        qos: 1
      });
      store.setLastPublishedRecord(address, 'unlock', lastRecord);
    } catch (error) {
      console.error('MQTT publishLastUnlock error:', error.message);
    }
  }

  /**
   * Re-publish bridge availability and every known lock's discovery + state
   * after a (re)connection — retained messages alone are not enough if the
   * broker restarted.
   */
  async _republishAll() {
    await this._publish(BRIDGE_AVAILABILITY_TOPIC, PAYLOAD_ONLINE, { retain: true, qos: 1 });
    for (const address of this.configuredLocks.keys()) {
      const lock = manager.pairedLocks?.get?.(address);
      if (!lock) continue;
      try {
        await this.configureLock(lock, true);
        await this.publishLockAvailability(lock, true);
        await this.updateLockState(lock);
        await this.publishLastOperation(lock);
        await this.publishLastUnlock(lock);
      } catch (error) {
        console.error('MQTT republish error:', error.message);
      }
    }
  }

  /**
   * Publish availability + state + last operation for a lock.
   * @param {import('ttlock-sdk-js').TTLock} lock
   */
  async _refreshLock(lock) {
    await this.publishLockAvailability(lock, true);
    await this.updateLockState(lock);
    await this.publishLastOperation(lock);
    await this.publishLastUnlock(lock);
  }

  /**
   *
   * @param {import('ttlock-sdk-js').TTLock} lock
   */
  async _onLockPaired(lock) {
    await this.configureLock(lock);
    await this._refreshLock(lock);
  }

  /**
   *
   * @param {import('ttlock-sdk-js').TTLock} lock
   */
  async _onLockConnected(lock) {
    await this.configureLock(lock);
    await this._refreshLock(lock);
  }

  /**
   *
   * @param {import('ttlock-sdk-js').TTLock} lock
   */
  async _onLockUnlock(lock) {
    await this._refreshLock(lock);
  }

  /**
   *
   * @param {import('ttlock-sdk-js').TTLock} lock
   */
  async _onLockLock(lock) {
    await this._refreshLock(lock);
  }

  /**
   * Mise à jour rapide de l'état de la serrure (battery/rssi/state) depuis le cache BLE,
   * émise par _handleLockedStatusUpdate avant que la connexion BLE soit établie pour lire
   * le journal opérationnel. Ne publie PAS last_operation ni last_access (données pas encore
   * disponibles à cet instant — elles seront publiées par _onLockUnlock/_onLockLock après
   * la lecture complète du log via _processOperationLog).
   * @param {import('ttlock-sdk-js').TTLock} lock
   */
  async _onLockStateUpdated(lock) {
    await this.updateLockState(lock);
  }

  /**
   * @param {import('ttlock-sdk-js').TTLock} lock
   */
  async _onLockBatteryUpdated(lock) {
    await this.configureLock(lock); // no-op unless alias changed since last discovery publish
    await this._refreshLock(lock);
  }

  /**
   * Remove a lock's MQTT discovery entries when it is unpaired
   * @param {import('ttlock-sdk-js').TTLock} lock
   */
  async _onLockUnpaired(lock) {
    if (!this.connected) return;
    try {
      const id = lockIdFromAddress(lock.getAddress());
      const discoveryTopics = [
        discoveryConfigTopic(this.discovery_prefix, 'lock', id, 'lock'),
        discoveryConfigTopic(this.discovery_prefix, 'sensor', id, 'battery'),
        discoveryConfigTopic(this.discovery_prefix, 'sensor', id, 'rssi'),
        discoveryConfigTopic(this.discovery_prefix, 'sensor', id, 'last_operation'),
        discoveryConfigTopic(this.discovery_prefix, 'sensor', id, 'last_access'),
        discoveryConfigTopic(this.discovery_prefix, 'sensor', id, 'last_operation_time'),
        discoveryConfigTopic(this.discovery_prefix, 'sensor', id, 'last_access_time'),
        discoveryConfigTopic(this.discovery_prefix, 'sensor', id, 'last_user'),
        discoveryConfigTopic(this.discovery_prefix, 'event', id, 'operation'),
        discoveryConfigTopic(this.discovery_prefix, 'binary_sensor', id, 'connectivity')
      ];
      for (const topic of discoveryTopics) {
        if (process.env.MQTT_DEBUG == '1') {
          console.log('MQTT Remove discovery', topic);
        }
        await this._publish(topic, '', { retain: true, qos: 1 });
      }
      // Purge retained data topics so a re-pair starts clean. (operationEventTopic is
      // published non-retained, so nothing lingers there — no need to purge it.)
      for (const topic of [stateTopic(id), lockAvailabilityTopic(id), lastOperationTopic(id), lastUnlockTopic(id)]) {
        await this._publish(topic, '', { retain: true, qos: 1 });
      }
      this.configuredLocks.delete(lock.getAddress());
      store.clearPublishedRecords(lock.getAddress());
    } catch (error) {
      console.error('MQTT _onLockUnpaired error:', error.message);
    }
  }

  /**
   * A lock stopped responding to BLE advertisements/connects for longer than the
   * configured timeout (manager's reachability watchdog) — flip its per-lock
   * availability topic to 'offline' so hybrid-availability entities go unavailable
   * instead of showing stale battery/rssi/state values forever.
   * @param {import('ttlock-sdk-js').TTLock} lock
   */
  async _onLockOffline(lock) {
    await this.publishLockAvailability(lock, false);
  }

  /**
   * A previously-offline lock answered a BLE advertisement/connect again.
   * @param {import('ttlock-sdk-js').TTLock} lock
   */
  async _onLockOnline(lock) {
    await this.publishLockAvailability(lock, true);
  }

  /**
   * A new operation was read from a lock's log (manager emits one `lockOperation`
   * per new record, in chronological order). Publish it as a transient HA `event`
   * so automations can react per operation and HA keeps a history — unlike the
   * retained last_operation/last_access sensors which only expose the latest state.
   * @param {import('ttlock-sdk-js').TTLock} lock
   * @param {object} op enriched operation (recordTypeCategory / recordTypeName set)
   */
  async _onLockOperation(lock, op) {
    if (!this.connected || !op) return;
    try {
      const id = lockIdFromAddress(lock.getAddress());
      // NON-retained: an event is a point-in-time trigger, not a state to restore.
      await this._publish(operationEventTopic(id), buildOperationEventPayload(op), {
        retain: false,
        qos: 1
      });
    } catch (error) {
      console.error('MQTT _onLockOperation error:', error.message);
    }
  }

  /**
   *
   * @param {string} topic
   * @param {Buffer} message
   */
  _onMQTTMessage(topic, message) {
    /**
     * Topic: ttlock/e1581b3a605e/set
       Message: UNLOCK
     */
    const parsed = parseCommandTopic(topic);
    if (parsed) {
      const command = message.toString('utf8');
      if (process.env.MQTT_DEBUG == '1') {
        console.log('MQTT command:', parsed.address, command);
      }
      switch (command) {
        case 'LOCK':
          manager.lockLock(parsed.address);
          break;
        case 'UNLOCK':
          manager.unlockLock(parsed.address);
          break;
      }
    } else if (process.env.MQTT_DEBUG == '1') {
      console.log('Topic:', topic);
      console.log('Message:', message.toString('utf8'));
    }
  }
}

export default HomeAssistant;
