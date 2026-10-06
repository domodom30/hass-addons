import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { EventEmitter } from 'node:events';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// api/index.js importe le SDK (binding noble natif) et `ws` : tous deux substitués. Le
// serveur WebSocket factice expose ses options (verifyClient) et permet d'injecter des
// connexions et des messages comme le ferait `ws` ≥ 8 (texte reçu en Buffer).
const sdkStub = `
  import { EventEmitter } from 'node:events';
  export class TTLockClient extends EventEmitter {}
  export const AudioManage = { UNKNOWN: -1, TURN_ON: 1, TURN_OFF: 0 };
  export const LockedStatus = { UNKNOWN: -1, LOCKED: 0, UNLOCKED: 1 };
  export const LogOperateCategory = { LOCK: [], UNLOCK: [] };
  export const LogOperateNames = {};
  export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
`;
const wsStub = `
  import { EventEmitter } from 'node:events';
  class Server extends EventEmitter {
    constructor(options) {
      super();
      this.options = options;
      this.clients = new Set();
      globalThis.__wsServers.push(this);
    }
  }
  export default { Server };
`;
const loader = `
  const stubs = {
    '@domodom30/ttlock-sdk-js': ${JSON.stringify(sdkStub)},
    'ws': ${JSON.stringify(wsStub)}
  };
  export async function resolve(specifier, context, next) {
    if (stubs[specifier] !== undefined) {
      return { url: 'data:text/javascript,' + encodeURIComponent(stubs[specifier]), shortCircuit: true };
    }
    return next(specifier, context);
  }
`;
register('data:text/javascript,' + encodeURIComponent(loader));
globalThis.__wsServers = [];

const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ttlock-api-'));
const { default: store } = await import('../src/store.js');
store.setDataPath(dataDir);
const { default: manager } = await import('../src/manager.js');
const { default: initApi } = await import('../api/index.js');

const ADDRESS = 'E1:58:1B:3A:60:5E';

class FakeSocket extends EventEmitter {
  constructor() {
    super();
    this.sent = [];
  }
  send(json) {
    this.sent.push(JSON.parse(json));
  }
}

/**
 * Laisse les handlers async (non attendus par l'émetteur) aller au bout, y compris la
 * pause de 10 ms de handleSettings avant sa confirmation.
 */
const flush = async () => {
  for (let i = 0; i < 5; i++) await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setTimeout(resolve, 30));
};

let wss;
let sock;

/** Envoie un message comme `ws` ≥ 8 le livre : texte dans un Buffer. */
async function send(message) {
  sock.sent.length = 0;
  sock.emit('message', Buffer.from(typeof message === 'string' ? message : JSON.stringify(message)));
  await flush();
  return sock.sent;
}

const errors = (sent) => sent.filter((m) => m.type === 'error').map((m) => m.data.message);

/** Remplace des méthodes du manager (singleton) le temps d'un test, en notant les appels. */
const calls = [];
function stubManager(methods) {
  for (const [name, impl] of Object.entries(methods)) {
    manager[name] = async (...args) => {
      calls.push([name, ...args]);
      return impl(...args);
    };
  }
}

beforeEach(async () => {
  calls.length = 0;
  manager.removeAllListeners();
  globalThis.__wsServers.length = 0;
  await initApi({}, { allowedIPs: ['172.30.32.2'] });
  wss = globalThis.__wsServers[0];
  sock = new FakeSocket();
  wss.clients.add(sock);
  wss.emit('connection', sock);
  await flush();
});

after(async () => {
  await store.saveData();
  await fs.rm(dataDir, { recursive: true, force: true });
});

test('serveur : chemin /api et filtre IP branché sur l\'upgrade WebSocket', () => {
  assert.equal(wss.options.path, '/api');
  const verify = (remoteAddress) => {
    let res;
    wss.options.verifyClient({ req: { socket: { remoteAddress } } }, (ok, code) => (res = [ok, code]));
    return res;
  };
  assert.deepEqual(verify('172.30.32.2'), [true, undefined]);
  assert.deepEqual(verify('192.168.1.20'), [false, 403]);
});

test('connexion : état initial envoyé au client', () => {
  assert.equal(sock.sent[0].type, 'status');
  assert.ok(Array.isArray(sock.sent[0].data.locks));
});

test('messages invalides ignorés sans planter (JSON cassé, type inconnu, adresse absente)', async () => {
  stubManager({ lockLock: () => true });
  assert.deepEqual(await send('{pas du json'), []);
  assert.deepEqual(await send({ type: 'inconnu', data: {} }), []);
  assert.deepEqual(await send({ data: { address: ADDRESS } }), []);
  assert.deepEqual(await send({ type: 'lock', data: {} }), []);
  assert.deepEqual(calls, []);
});

test('lock / unlock : routés vers le manager avec l\'adresse reçue (message en Buffer)', async () => {
  stubManager({ lockLock: () => true, unlockLock: () => true });
  await send({ type: 'lock', data: { address: ADDRESS } });
  await send({ type: 'unlock', data: { address: ADDRESS } });
  assert.deepEqual(calls, [['lockLock', ADDRESS], ['unlockLock', ADDRESS]]);
});

test('PIN : champs manquants ou dates invalides refusés avant toute opération BLE', async () => {
  stubManager({ addPasscode: () => [], updatePasscode: () => [] });
  const base = { address: ADDRESS };
  assert.deepEqual(errors(await send({ type: 'passcode', data: { ...base, passcode: { passCode: -1, newPassCode: '123456', type: 2 } } })), [
    'Invalid passcode data: missing required fields'
  ]);
  assert.deepEqual(
    errors(await send({ type: 'passcode', data: { ...base, passcode: { passCode: -1, newPassCode: '123456', type: 2, startDate: '2026-10-06', endDate: '202712312359' } } })),
    ['Invalid passcode data: invalid date format (expected YYYYMMDDHHmm)']
  );
  assert.deepEqual(
    errors(await send({ type: 'passcode', data: { ...base, passcode: { passCode: '111111', newPassCode: '222222', type: 2 } } })),
    ['Invalid passcode data: missing dates for update']
  );
  assert.deepEqual(calls, []);
});

test('PIN : ajout, modification, suppression aiguillés vers la bonne opération', async () => {
  stubManager({
    addPasscode: () => [{ newPassCode: '123456' }],
    updatePasscode: () => [{ newPassCode: '222222' }],
    deletePasscode: () => []
  });
  const dates = { startDate: '202610060000', endDate: '202712312359' };

  let sent = await send({ type: 'passcode', data: { address: ADDRESS, passcode: { passCode: -1, newPassCode: '123456', type: 2, ...dates } } });
  assert.deepEqual(calls.at(-1), ['addPasscode', ADDRESS, 2, '123456', dates.startDate, dates.endDate]);
  assert.equal(sent[0].type, 'credentials');
  assert.deepEqual(sent[0].data.passcodes, [{ newPassCode: '123456' }]);

  await send({ type: 'passcode', data: { address: ADDRESS, passcode: { passCode: '111111', newPassCode: '222222', type: 2, ...dates } } });
  assert.deepEqual(calls.at(-1), ['updatePasscode', ADDRESS, 2, '111111', '222222', dates.startDate, dates.endDate]);

  await send({ type: 'passcode', data: { address: ADDRESS, passcode: { passCode: '222222', newPassCode: -1, type: 2 } } });
  assert.deepEqual(calls.at(-1), ['deletePasscode', ADDRESS, 2, '222222']);
});

test('PIN : échec remonté au client, avec le détail renvoyé par la serrure', async () => {
  stubManager({ addPasscode: () => false });
  manager.getLastPasscodeError = () => ({ message: 'code déjà utilisé' });
  const sent = await send({
    type: 'passcode',
    data: { address: ADDRESS, passcode: { passCode: -1, newPassCode: '123456', type: 2, startDate: '202610060000', endDate: '202712312359' } }
  });
  assert.deepEqual(errors(sent), ['PIN operation failed: code déjà utilisé']);
});

test('PIN supprimé mais liste non relue : relecture complète des identifiants', async () => {
  stubManager({ deletePasscode: () => null, getCredentials: () => ({ passcodes: [], cards: [], fingers: false }) });
  const sent = await send({ type: 'passcode', data: { address: ADDRESS, passcode: { passCode: '222222', newPassCode: -1, type: 2 } } });
  assert.deepEqual(calls.map((c) => c[0]), ['deletePasscode', 'getCredentials']);
  assert.equal(sent[0].type, 'credentials');
});

test('cartes : dates validées à l\'ajout, suppression par startDate = -1', async () => {
  stubManager({ addCard: () => [], deleteCard: () => [] });
  assert.deepEqual(
    errors(await send({ type: 'card', data: { address: ADDRESS, card: { cardNumber: -1, startDate: 'demain', endDate: '202712312359' } } })),
    ['Invalid card data: invalid date format (expected YYYYMMDDHHmm)']
  );
  assert.deepEqual(calls, []);
  await send({ type: 'card', data: { address: ADDRESS, card: { cardNumber: '123', startDate: -1 } } });
  assert.deepEqual(calls, [['deleteCard', ADDRESS, '123']]);
});

test('empreintes : dates validées, échec signalé', async () => {
  stubManager({ addFinger: () => false });
  assert.deepEqual(
    errors(await send({ type: 'finger', data: { address: ADDRESS, finger: { fpNumber: -1, startDate: '2026', endDate: '202712312359' } } })),
    ['Invalid fingerprint data: invalid date format (expected YYYYMMDDHHmm)']
  );
  assert.deepEqual(
    errors(await send({ type: 'finger', data: { address: ADDRESS, finger: { fpNumber: -1, startDate: '202610060000', endDate: '202712312359' } } })),
    ['Fingerprint operation failed']
  );
});

test('réglages : valeurs invalides refusées sans opération BLE', async () => {
  stubManager({ setAutoLock: () => true, setAudio: () => true });
  assert.deepEqual(errors(await send({ type: 'settings', data: { address: ADDRESS, settings: { autolock: 'abc' } } })), [
    'Invalid autolock value: must be a non-negative integer'
  ]);
  assert.deepEqual(errors(await send({ type: 'settings', data: { address: ADDRESS, settings: { autolock: -5 } } })), [
    'Invalid autolock value: must be a non-negative integer'
  ]);
  assert.deepEqual(errors(await send({ type: 'settings', data: { address: ADDRESS, settings: { audio: 'oui' } } })), [
    'Invalid audio value: must be a boolean'
  ]);
  assert.deepEqual(calls, []);

  const sent = await send({ type: 'settings', data: { address: ADDRESS, settings: { autolock: '30', audio: false } } });
  assert.deepEqual(calls, [['setAutoLock', ADDRESS, 30], ['setAudio', ADDRESS, false]]);
  assert.deepEqual(sent.at(-1), { type: 'settings', data: { address: ADDRESS, settings: { autolock: true, audio: true } } });
});

test('config : export de lockData, import JSON invalide refusé', async () => {
  stubManager({ startScan: () => true });
  manager.updateClientLockDataFromStore = () => calls.push(['updateClientLockDataFromStore']);

  let sent = await send({ type: 'config', data: { get: true } });
  assert.equal(sent[0].type, 'config');
  assert.deepEqual(JSON.parse(sent[0].data.config), store.getLockData());

  sent = await send({ type: 'config', data: { set: '{pas du json' } });
  assert.deepEqual(sent, [{ type: 'config', data: { set: 'Failed to set config' } }]);
  assert.deepEqual(calls, []);
});

/** Capture console.error/warn le temps d'un appel (pour vérifier qu'aucune clé n'y fuit). */
async function captureLogs(fn) {
  const logs = [];
  const { error, warn } = console;
  console.error = (...args) => logs.push(args.join(' '));
  console.warn = (...args) => logs.push(args.join(' '));
  try {
    await fn();
  } finally {
    console.error = error;
    console.warn = warn;
  }
  return logs;
}

test('config : import invalide refusé, store intact, identifiants absents des logs', async () => {
  stubManager({ startScan: () => true });
  manager.updateClientLockDataFromStore = () => calls.push(['updateClientLockDataFromStore']);
  const lock = { address: ADDRESS, privateData: { aesKey: 'SECRET-AES', admin: { adminPs: 'SECRET-PS', unlockKey: 'SECRET-UK' } } };
  store.setLockData([lock]);

  const cases = [
    ['{}', 'Invalid config: expected a JSON array of locks'],
    [JSON.stringify([{ address: 'pas-une-mac', privateData: lock.privateData }]), 'Invalid config: entry 1 has an invalid or missing address'],
    [JSON.stringify([lock, lock]), `Invalid config: duplicate address ${ADDRESS}`],
    [JSON.stringify([lock, { address: 'C4:11:22:33:44:55' }]), /^Invalid config: C4:11:22:33:44:55: missing lock credentials/],
    // Ce type d'erreur (« Unexpected token ») cite un extrait de l'entrée dans son message.
    ['[{"aesKey": SECRET-AES}]', 'Failed to set config']
  ];
  for (const [payload, expected] of cases) {
    let sent;
    const logs = await captureLogs(async () => {
      sent = await send({ type: 'config', data: { set: payload } });
    });
    assert.equal(sent.length, 1, payload);
    assert.equal(sent[0].type, 'config');
    if (expected instanceof RegExp) assert.match(sent[0].data.set, expected);
    else assert.equal(sent[0].data.set, expected);
    assert.doesNotMatch(logs.join('\n'), /SECRET/, 'aucun identifiant dans les logs');
  }
  assert.deepEqual(store.getLockData(), [lock], 'store intact');
  assert.deepEqual(calls, [], 'ni rechargement SDK ni scan');
});

test('config : import valide appliqué ; suppression autorisée mais journalisée', async () => {
  stubManager({ startScan: () => true });
  manager.updateClientLockDataFromStore = () => calls.push(['updateClientLockDataFromStore']);
  const creds = { aesKey: 'k', admin: { adminPs: 'p', unlockKey: 'u' } };
  const a = { address: ADDRESS, privateData: creds };
  const b = { address: 'C4:11:22:33:44:55', privateData: creds };
  store.setLockData([a]);

  let sent = await send({ type: 'config', data: { set: JSON.stringify([a, b]) } });
  assert.deepEqual(sent, [{ type: 'config', data: { set: true } }]);
  assert.deepEqual(store.getLockData(), [a, b]);
  assert.deepEqual(calls.map((c) => c[0]), ['updateClientLockDataFromStore', 'startScan']);

  // Entrée incomplète pour une serrure connue : ses identifiants sont conservés.
  sent = await send({ type: 'config', data: { set: JSON.stringify([a, { address: b.address, battery: 10 }]) } });
  assert.deepEqual(sent, [{ type: 'config', data: { set: true } }]);
  assert.deepEqual(store.getLockData()[1], b);

  const logs = await captureLogs(async () => {
    sent = await send({ type: 'config', data: { set: JSON.stringify([a]) } });
  });
  assert.deepEqual(sent, [{ type: 'config', data: { set: true } }]);
  assert.deepEqual(store.getLockData(), [a]);
  assert.ok(logs.some((l) => l.includes('removes paired lock(s): C4:11:22:33:44:55')), logs.join('\n'));
});

test('renommage : alias rogné à 64 caractères, nom vide = retour au nom BLE', async () => {
  await send({ type: 'rename', data: { address: ADDRESS, name: '  ' + 'x'.repeat(80) + '  ' } });
  assert.equal(store.getLockAlias(ADDRESS), 'x'.repeat(64));
  await send({ type: 'rename', data: { address: ADDRESS, name: '   ' } });
  assert.equal(store.getLockAlias(ADDRESS), false);
});

test('journal : vue ouverte = cache seul, sans BLE ; BLE fusionné au cache sans le réduire', async () => {
  stubManager({ getOperationLog: () => [{ recordNumber: 2, operateDate: 20 }] });
  manager.getPersistedOperationLog = () => [{ recordNumber: 1, operateDate: 10 }];

  let sent = await send({ type: 'operations', data: { address: ADDRESS, reload: false } });
  assert.deepEqual(calls, []);
  assert.deepEqual(sent.map((m) => m.data.operations.length), [1]);

  sent = await send({ type: 'operations', data: { address: ADDRESS, reload: true } });
  assert.deepEqual(calls, [['getOperationLog', ADDRESS, true]]);
  assert.deepEqual(sent.at(-1).data.operations.map((o) => o.recordNumber), [2, 1]);
});
