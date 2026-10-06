import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { EventEmitter } from 'node:events';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// manager.js n'est pas importable tel quel en test : le SDK charge le binding noble natif
// au chargement. On substitue au SDK un module minimal exposant ce que manager.js importe.
const sdkStub = `
  import { EventEmitter } from 'node:events';
  export class TTLockClient extends EventEmitter {}
  export const AudioManage = { UNKNOWN: -1, TURN_ON: 1, TURN_OFF: 0 };
  export const LockedStatus = { UNKNOWN: -1, LOCKED: 0, UNLOCKED: 1 };
  export const LogOperateCategory = { LOCK: [], UNLOCK: [] };
  export const LogOperateNames = {};
`;
const loader = `
  export async function resolve(specifier, context, next) {
    if (specifier === '@domodom30/ttlock-sdk-js') {
      return { url: 'data:text/javascript,' + encodeURIComponent(${JSON.stringify(sdkStub)}), shortCircuit: true };
    }
    return next(specifier, context);
  }
`;
register('data:text/javascript,' + encodeURIComponent(loader));

// Le store écrit par défaut dans /data (dossier de l'add-on) : la lecture du journal
// testée ici le sauvegarde, il faut donc le rediriger vers un dossier jetable.
const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ttlock-lockcmd-'));
const { default: store } = await import('../src/store.js');
store.setDataPath(dataDir);
after(async () => {
  await store.saveData();
  await fs.rm(dataDir, { recursive: true, force: true });
});

const { default: manager } = await import('../src/manager.js');

const LOCKED = 0;
const UNLOCKED = 1;

/**
 * Serrure factice : connect() instantané, lock()/unlock() asynchrones qui journalisent
 * l'ordre réel d'exécution — c'est l'ordre physique qui compte pour une porte.
 */
function makeLock(address, { failFirst = 0, actuationMs = 20 } = {}) {
  const lock = new EventEmitter();
  const executed = [];
  let failures = failFirst;
  let connected = false;
  Object.assign(lock, {
    connecting: false,
    lockedStatus: LOCKED,
    statusUnverified: false,
    autoLockTime: 0,
    adminAuth: false,
    connectCalls: [],
    getAddress: () => address,
    isConnected: () => connected,
    async connect(skipDataRead) {
      lock.connectCalls.push(skipDataRead);
      connected = true;
      return true;
    },
    async disconnect() {
      connected = false;
    },
    async macro_adminLogin() {
      lock.adminAuth = true;
      return true;
    },
    async lock() {
      await new Promise((r) => setTimeout(r, actuationMs));
      if (failures-- > 0) return false;
      executed.push('LOCK');
      lock.lockedStatus = LOCKED;
      return true;
    },
    async unlock() {
      await new Promise((r) => setTimeout(r, actuationMs));
      if (failures-- > 0) return false;
      executed.push('UNLOCK');
      lock.lockedStatus = UNLOCKED;
      return true;
    }
  });
  return { lock, executed };
}

beforeEach(() => {
  manager.client = { startMonitor() {}, isMonitoring: () => false };
  manager.gateway = 'none';
  manager.scanning = false;
  manager.pairedLocks.clear();
  manager._desiredState.clear();
  manager.removeAllListeners();
});

test('lock/unlock se connecte sans lecture de données ni login admin', async () => {
  const { lock, executed } = makeLock('AA:00:00:00:00:01');
  manager.pairedLocks.set(lock.getAddress(), lock);

  assert.equal(await manager.unlockLock(lock.getAddress()), true);

  assert.deepEqual(executed, ['UNLOCK']);
  assert.deepEqual(lock.connectCalls, [true]); // connect(skipDataRead = true)
  assert.equal(lock.adminAuth, false);
  assert.equal(manager.isLockBusy(lock.getAddress()), false);
});

test('la dernière intention gagne : UNLOCK → LOCK → UNLOCK finit déverrouillé', async () => {
  const { lock, executed } = makeLock('AA:00:00:00:00:02');
  const address = lock.getAddress();
  manager.pairedLocks.set(address, lock);

  const first = manager.unlockLock(address);
  const second = manager.lockLock(address);
  const third = manager.unlockLock(address); // rejoint le premier UNLOCK en vol
  const results = await Promise.all([first, second, third]);

  assert.equal(executed.at(-1), 'UNLOCK');
  assert.equal(lock.lockedStatus, UNLOCKED);
  assert.deepEqual(executed, ['UNLOCK']); // le LOCK obsolète n'est jamais exécuté
  assert.deepEqual(results, [true, false, true]);
});

test('une relance ne repasse pas derrière une commande opposée', async () => {
  // UNLOCK échoue une fois puis réussirait ; un LOCK arrive pendant la première tentative.
  const { lock, executed } = makeLock('AA:00:00:00:00:03', { failFirst: 1 });
  const address = lock.getAddress();
  manager.pairedLocks.set(address, lock);

  const unlock = manager.unlockLock(address);
  await new Promise((r) => setTimeout(r, 5));
  const relock = manager.lockLock(address);
  await Promise.all([unlock, relock]);

  assert.deepEqual(executed, ['LOCK']);
  assert.equal(lock.lockedStatus, LOCKED);
});

test('les tentatives gardent la radio : une tâche de fond ne s’intercale pas', async () => {
  const { lock, executed } = makeLock('AA:00:00:00:00:04', { failFirst: 1 });
  const address = lock.getAddress();
  manager.pairedLocks.set(address, lock);
  const order = [];

  const unlock = manager.unlockLock(address).then(() => order.push('unlock-done'));
  await new Promise((r) => setTimeout(r, 5));
  const background = manager._acquireMutex(address).then((release) => {
    order.push('background');
    release();
  });
  await Promise.all([unlock, background]);

  assert.deepEqual(executed, ['UNLOCK']);
  assert.deepEqual(order, ['unlock-done', 'background']);
});

test('vérification d’état : un connect raté arme quand même le cooldown (pas de tempête)', async () => {
  const { lock } = makeLock('AA:00:00:00:00:05');
  manager.pairedLocks.set(lock.getAddress(), lock);
  lock.statusUnverified = true;
  lock.connect = async (skipDataRead) => {
    lock.connectCalls.push(skipDataRead);
    return false;
  };

  await manager._handleStatusUnverified(lock);
  await manager._handleStatusUnverified(lock); // publicité suivante, quelques secondes après

  assert.equal(lock.connectCalls.length, 1);
  assert.equal(lock._statusCheckFailCount, 1);
});

test('lecture du journal : l’état live est lu avant le journal, pendant que la session vit', async () => {
  const { lock } = makeLock('AA:00:00:00:00:06');
  manager.pairedLocks.set(lock.getAddress(), lock);
  await lock.connect(true);
  const calls = [];
  lock.operationLog = [];
  lock.getLockStatus = async () => {
    calls.push('status');
    if (!lock.isConnected()) throw new Error('Lock is not connected');
    return UNLOCKED;
  };
  lock.getOperationLog = async () => {
    calls.push('oplog');
    lock.adminAuth = true;
    // La serrure coupe la liaison juste après la lecture du journal (cas observé).
    await lock.disconnect();
  };
  const emitted = [];
  manager.on('lockUnlock', () => emitted.push('lockUnlock'));
  manager.on('lockLock', () => emitted.push('lockLock'));

  assert.equal(await manager._processOperationLog(lock), true);

  assert.deepEqual(calls, ['status', 'oplog']);
  assert.deepEqual(emitted, ['lockUnlock']);
});
