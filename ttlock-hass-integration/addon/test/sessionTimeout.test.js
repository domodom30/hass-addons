import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

// Même substitution du SDK que lockCommands.test.js : manager.js charge sinon le binding
// noble natif.
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
const { withSessionTimeout } = await import('../src/manager.js');

/** Serrure factice : seule la session (connected/disconnect) intéresse le helper. */
function fakeLock() {
  return {
    connected: true,
    disconnects: 0,
    isConnected() {
      return this.connected;
    },
    async disconnect() {
      this.disconnects++;
      this.connected = false;
    }
  };
}

test('opération terminée dans le budget : valeur rendue, session conservée', async () => {
  const lock = fakeLock();
  const res = await withSessionTimeout(lock, Promise.resolve(['code']), 1000, 'test');
  assert.deepEqual(res, ['code']);
  assert.equal(lock.disconnects, 0);
  assert.equal(lock.connected, true);
});

test('erreur du SDK dans le budget : propagée telle quelle, sans déconnexion', async () => {
  const lock = fakeLock();
  await assert.rejects(withSessionTimeout(lock, Promise.reject(new Error('NO_PERMISSION')), 1000, 'test'), /NO_PERMISSION/);
  assert.equal(lock.disconnects, 0);
});

test('opération bloquée : session coupée puis rejet « BLE timeout »', async () => {
  const lock = fakeLock();
  const never = new Promise(() => {});
  await assert.rejects(withSessionTimeout(lock, never, 50, 'addICCard AA'), /BLE timeout \(addICCard AA\)/);
  assert.equal(lock.disconnects, 1);
  assert.equal(lock.connected, false);
});

test('promesse abandonnée qui rejette plus tard : pas de unhandledRejection', async () => {
  const lock = fakeLock();
  let rejectLate;
  const late = new Promise((_, reject) => (rejectLate = reject));
  const unhandled = [];
  const onUnhandled = (reason) => unhandled.push(reason);
  process.on('unhandledRejection', onUnhandled);
  try {
    await assert.rejects(withSessionTimeout(lock, late, 50, 'test'), /BLE timeout/);
    rejectLate(new Error('Disconnected while waiting for response'));
    await new Promise((r) => setTimeout(r, 50));
    assert.deepEqual(unhandled, []);
  } finally {
    process.off('unhandledRejection', onUnhandled);
  }
});
