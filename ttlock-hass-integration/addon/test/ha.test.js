import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { EventEmitter } from 'node:events';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// ha.js importe le SDK (binding noble natif) et async-mqtt : tous deux substitués, ce
// qui permet aussi d'observer chaque publication sans broker. Le client MQTT factice
// est fourni par le test via globalThis.__fakeMqtt.
const sdkStub = `
  import { EventEmitter } from 'node:events';
  export class TTLockClient extends EventEmitter {}
  export const AudioManage = { UNKNOWN: -1, TURN_ON: 1, TURN_OFF: 0 };
  export const LockedStatus = { UNKNOWN: -1, LOCKED: 0, UNLOCKED: 1 };
  export const LogOperateCategory = { LOCK: [], UNLOCK: [] };
  export const LogOperateNames = {};
`;
const mqttStub = `export default { connectAsync: (...args) => globalThis.__fakeMqtt.connectAsync(...args) };`;
const loader = `
  const stubs = {
    '@domodom30/ttlock-sdk-js': ${JSON.stringify(sdkStub)},
    'async-mqtt': ${JSON.stringify(mqttStub)}
  };
  export async function resolve(specifier, context, next) {
    if (stubs[specifier] !== undefined) {
      return { url: 'data:text/javascript,' + encodeURIComponent(stubs[specifier]), shortCircuit: true };
    }
    return next(specifier, context);
  }
`;
register('data:text/javascript,' + encodeURIComponent(loader));

class FakeMqttClient extends EventEmitter {
  constructor() {
    super();
    this.published = [];
    this.subscribed = [];
    this.ended = false;
  }
  async publish(topic, payload, options) {
    this.published.push({ topic, payload, options });
  }
  async subscribe(topic, options) {
    this.subscribed.push({ topic, options });
  }
  async end() {
    this.ended = true;
  }
}

const connections = [];
globalThis.__fakeMqtt = {
  async connectAsync(url, options) {
    const client = new FakeMqttClient();
    connections.push({ url, options, client });
    return client;
  }
};

const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ttlock-ha-'));
const { default: store } = await import('../src/store.js');
store.setDataPath(dataDir);
const { default: manager } = await import('../src/manager.js');
const { default: HomeAssistant } = await import('../src/ha.js');

const ADDRESS = 'E1:58:1B:3A:60:5E';
const ID = 'e1581b3a605e';
const LOCKED = 0;
const UNLOCKED = 1;
const UNKNOWN = -1;

function fakeLock(overrides = {}) {
  return {
    getAddress: () => ADDRESS,
    getName: () => 'M201',
    getModel: () => 'M201',
    getFirmware: () => '6.0.6',
    getManufacturer: () => 'TTLock',
    getRssi: () => -70,
    getBattery: () => 80,
    lockedStatus: LOCKED,
    statusUnverified: false,
    ...overrides
  };
}

/** Les HomeAssistant créés s'abonnent au manager (singleton) : on les détache entre tests. */
const instances = [];
async function connectedHa(options = {}) {
  const ha = new HomeAssistant({ mqttUrl: 'mqtt://broker:1883', ...options });
  instances.push(ha);
  await ha.connect();
  const { client } = connections.at(-1);
  client.published.length = 0; // ignorer la publication 'online' de la connexion
  return { ha, client };
}

beforeEach(async () => {
  for (const ha of instances.splice(0)) await ha.disconnect();
  manager.removeAllListeners();
  manager.pairedLocks.clear();
  connections.length = 0;
  store.deleteLockAlias(ADDRESS);
});

after(async () => {
  for (const ha of instances.splice(0)) await ha.disconnect();
  await store.saveData();
  await fs.rm(dataDir, { recursive: true, force: true });
});

const byTopic = (client, topic) => client.published.filter((p) => p.topic === topic);

test('connect : LWT retained « offline », reconnexion pilotée par l\'add-on, abonnement aux commandes', async () => {
  const ha = new HomeAssistant({ mqttUrl: 'mqtt://broker:1883' });
  instances.push(ha);
  await ha.connect();
  const { url, options, client } = connections[0];
  assert.equal(url, 'mqtt://broker:1883');
  assert.equal(options.reconnectPeriod, 0);
  assert.equal(options.username, undefined, 'broker anonyme : pas d\'identifiant vide');
  assert.deepEqual(options.will, { topic: 'ttlock/bridge/availability', payload: 'offline', qos: 1, retain: true });
  assert.deepEqual(client.subscribed, [{ topic: 'ttlock/+/set', options: { qos: 1 } }]);
  assert.deepEqual(byTopic(client, 'ttlock/bridge/availability'), [
    { topic: 'ttlock/bridge/availability', payload: 'online', options: { retain: true, qos: 1 } }
  ]);
  assert.equal(ha.connected, true);
});

test('connect : republie Discovery et état de toutes les serrures appairées', async () => {
  manager.pairedLocks.set(ADDRESS, fakeLock());
  const ha = new HomeAssistant({ mqttUrl: 'mqtt://broker:1883' });
  instances.push(ha);
  await ha.connect();
  const { client } = connections[0];
  assert.equal(byTopic(client, `homeassistant/lock/${ID}/lock/config`).length, 1);
  assert.deepEqual(byTopic(client, `ttlock/${ID}/availability`).map((p) => p.payload), ['online']);
  assert.equal(JSON.parse(byTopic(client, `ttlock/${ID}`)[0].payload).state, 'LOCK');
});

test('disconnect : publie « offline » retained puis ferme, sans relancer de reconnexion', async () => {
  const { ha, client } = await connectedHa();
  await ha.disconnect();
  assert.deepEqual(client.published, [
    { topic: 'ttlock/bridge/availability', payload: 'offline', options: { retain: true, qos: 1 } }
  ]);
  assert.equal(client.ended, true);
  client.emit('close');
  assert.equal(ha._reconnectTimer, null);
});

test('perte du broker : une seule reconnexion planifiée', async () => {
  const { ha, client } = await connectedHa();
  client.emit('close');
  client.emit('close');
  assert.equal(ha.connected, false);
  assert.ok(ha._reconnectTimer, 'reconnexion planifiée');
  await ha.disconnect();
  assert.equal(ha._reconnectTimer, null, 'disconnect annule la reconnexion');
});

test('configureLock : entités Discovery, identifiants et topics stables', async () => {
  const { ha, client } = await connectedHa({ discovery_prefix: 'custom' });
  await ha.configureLock(fakeLock());

  const configs = client.published.filter((p) => p.payload !== '');
  assert.deepEqual(
    configs.map((p) => p.topic),
    [
      `custom/lock/${ID}/lock/config`,
      `custom/sensor/${ID}/battery/config`,
      `custom/sensor/${ID}/rssi/config`,
      `custom/sensor/${ID}/last_operation/config`,
      `custom/sensor/${ID}/last_access/config`,
      `custom/sensor/${ID}/door_sensor_fault/config`,
      `custom/event/${ID}/operation/config`,
      `custom/binary_sensor/${ID}/connectivity/config`
    ]
  );
  for (const p of client.published) assert.deepEqual(p.options, { retain: true, qos: 1 }, p.topic);

  const lockEntity = JSON.parse(configs[0].payload);
  assert.equal(lockEntity.unique_id, `ttlock_${ID}`);
  assert.equal(lockEntity.name, 'M201');
  assert.equal(lockEntity.state_topic, `ttlock/${ID}`);
  assert.equal(lockEntity.command_topic, `ttlock/${ID}/set`);
  assert.equal(lockEntity.payload_lock, 'LOCK');
  assert.equal(lockEntity.payload_unlock, 'UNLOCK');
  assert.equal(lockEntity.optimistic, false);
  assert.deepEqual(lockEntity.device.identifiers, [`ttlock_${ID}`]);
  assert.equal(lockEntity.availability_mode, 'all');
  assert.deepEqual(lockEntity.availability.map((a) => a.topic), ['ttlock/bridge/availability', `ttlock/${ID}/availability`]);

  const uniqueIds = configs.map((p) => JSON.parse(p.payload).unique_id);
  assert.equal(new Set(uniqueIds).size, uniqueIds.length, 'unique_id distincts');
  for (const uid of uniqueIds) assert.ok(uid.startsWith(`ttlock_${ID}`), uid);
});

test('configureLock : purge les entités retirées (payload vide retained)', async () => {
  const { ha, client } = await connectedHa();
  await ha.configureLock(fakeLock());
  assert.deepEqual(
    client.published.filter((p) => p.payload === '').map((p) => p.topic),
    [
      `homeassistant/sensor/${ID}/last_operation_time/config`,
      `homeassistant/sensor/${ID}/last_access_time/config`,
      `homeassistant/sensor/${ID}/last_user/config`
    ]
  );
});

test('configureLock : sans effet hors connexion, idempotent tant que le nom ne change pas', async () => {
  const offline = new HomeAssistant({ mqttUrl: 'mqtt://broker:1883' });
  instances.push(offline);
  await offline.configureLock(fakeLock()); // client absent : ne doit pas lever

  const { ha, client } = await connectedHa();
  await ha.configureLock(fakeLock());
  const count = client.published.length;
  await ha.configureLock(fakeLock());
  assert.equal(client.published.length, count, 'pas de republication à l\'identique');

  store.setLockAlias(ADDRESS, 'Porte d\'entrée');
  await ha.configureLock(fakeLock());
  assert.ok(client.published.length > count, 'alias modifié : republication');
  assert.equal(JSON.parse(client.published.at(-4).payload).device.name, 'Porte d\'entrée');
});

test('updateLockState : état vérifié publié, état non vérifié jamais inventé', async () => {
  const { ha, client } = await connectedHa();
  const states = () => byTopic(client, `ttlock/${ID}`).map((p) => JSON.parse(p.payload));

  // Jamais vérifié : pas de champ state, batterie -1 non publiée.
  await ha.updateLockState(fakeLock({ statusUnverified: true, lockedStatus: UNLOCKED, getBattery: () => -1 }));
  assert.deepEqual(states().at(-1), { rssi: -70 });

  await ha.updateLockState(fakeLock({ lockedStatus: LOCKED }));
  assert.deepEqual(states().at(-1), { rssi: -70, battery: 80, state: 'LOCK' });

  // Non vérifié ensuite : on garde le dernier état VÉRIFIÉ, pas celui du cache.
  await ha.updateLockState(fakeLock({ statusUnverified: true, lockedStatus: UNLOCKED }));
  assert.equal(states().at(-1).state, 'LOCK');

  await ha.updateLockState(fakeLock({ lockedStatus: UNKNOWN }));
  assert.equal(states().at(-1).state, 'LOCK');

  await ha.updateLockState(fakeLock({ lockedStatus: UNLOCKED }));
  assert.equal(states().at(-1).state, 'UNLOCK');
  for (const p of byTopic(client, `ttlock/${ID}`)) assert.deepEqual(p.options, { retain: true, qos: 1 });
});

test('dépairage : purge Discovery (y compris entités retirées) et topics de données retained', async () => {
  const { ha, client } = await connectedHa();
  await ha.configureLock(fakeLock());
  await ha.updateLockState(fakeLock());
  client.published.length = 0;

  await ha._onLockUnpaired(fakeLock());
  for (const p of client.published) {
    assert.equal(p.payload, '', p.topic);
    assert.deepEqual(p.options, { retain: true, qos: 1 }, p.topic);
  }
  const topics = client.published.map((p) => p.topic);
  for (const t of [
    `homeassistant/lock/${ID}/lock/config`,
    `homeassistant/binary_sensor/${ID}/connectivity/config`,
    `homeassistant/event/${ID}/operation/config`,
    `homeassistant/sensor/${ID}/last_user/config`,
    `ttlock/${ID}`,
    `ttlock/${ID}/availability`,
    `ttlock/${ID}/last_operation`,
    `ttlock/${ID}/last_unlock`,
    `ttlock/${ID}/door_sensor_fault`
  ]) {
    assert.ok(topics.includes(t), t);
  }
  assert.equal(ha.configuredLocks.has(ADDRESS), false);
  assert.equal(ha.lastVerifiedState.has(ADDRESS), false);
});

test('disponibilité par serrure : offline / online retained', async () => {
  const { ha, client } = await connectedHa();
  await ha._onLockOffline(fakeLock());
  await ha._onLockOnline(fakeLock());
  assert.deepEqual(
    byTopic(client, `ttlock/${ID}/availability`).map((p) => [p.payload, p.options.retain]),
    [['offline', true], ['online', true]]
  );
});

/** Attend la fin des promesses lancées (non attendues) par _onMQTTMessage. */
const flush = () => new Promise((resolve) => setImmediate(resolve));

test('commandes MQTT : LOCK / UNLOCK routés vers la bonne serrure, le reste ignoré', async () => {
  const { ha } = await connectedHa();
  const calls = [];
  manager.lockLock = async (address) => calls.push(['LOCK', address]) && true;
  manager.unlockLock = async (address) => calls.push(['UNLOCK', address]) && true;

  ha._onMQTTMessage(`ttlock/${ID}/set`, Buffer.from('LOCK'));
  ha._onMQTTMessage(`ttlock/${ID}/set`, Buffer.from('UNLOCK'));
  ha._onMQTTMessage(`ttlock/${ID}/set`, Buffer.from('OPEN'));
  ha._onMQTTMessage(`ttlock/${ID}/set`, Buffer.from('lock'));
  ha._onMQTTMessage('ttlock/not-a-lock/set', Buffer.from('UNLOCK'));
  ha._onMQTTMessage(`ttlock/${ID}/other`, Buffer.from('UNLOCK'));
  ha._onMQTTMessage(`homeassistant/${ID}/set`, Buffer.from('UNLOCK'));
  await flush();

  assert.deepEqual(calls, [['LOCK', ADDRESS], ['UNLOCK', ADDRESS]]);
});

test('commande MQTT échouée : l\'état connu est republié pour sortir HA de l\'état transitoire', async () => {
  const { ha, client } = await connectedHa();
  manager.pairedLocks.set(ADDRESS, fakeLock({ lockedStatus: LOCKED }));
  manager.unlockLock = async () => false;

  ha._onMQTTMessage(`ttlock/${ID}/set`, Buffer.from('UNLOCK'));
  await flush();
  await flush();

  const states = byTopic(client, `ttlock/${ID}`);
  assert.equal(states.length, 1);
  assert.equal(JSON.parse(states[0].payload).state, 'LOCK');
});

test('commande MQTT : un rejet du manager ne devient pas une unhandledRejection', async () => {
  const { ha } = await connectedHa();
  manager.lockLock = async () => {
    throw new Error('radio indisponible');
  };
  const unhandled = [];
  const onUnhandled = (reason) => unhandled.push(reason);
  process.on('unhandledRejection', onUnhandled);
  try {
    ha._onMQTTMessage(`ttlock/${ID}/set`, Buffer.from('LOCK'));
    await flush();
    await flush();
    assert.deepEqual(unhandled, []);
  } finally {
    process.off('unhandledRejection', onUnhandled);
  }
});
