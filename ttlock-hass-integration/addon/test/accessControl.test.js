import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_ALLOWED_IPS, isAllowedAddress, createWsVerifyClient } from '../src/accessControl.js';

/** Appelle le hook verifyClient comme le fait `ws` et renvoie ce qu'il a répondu. */
function verify(hook, remoteAddress) {
  let result;
  hook({ req: { socket: { remoteAddress } } }, (ok, code, message) => {
    result = { ok, code, message };
  });
  return result;
}

test('proxy Ingress et loopback autorisés par défaut', () => {
  for (const ip of ['172.30.32.2', '::ffff:172.30.32.2', '::1', '::ffff:127.0.0.1']) {
    assert.equal(isAllowedAddress(ip), true, ip);
  }
});

test('adresses du LAN et valeurs invalides refusées', () => {
  for (const ip of ['192.168.1.20', '::ffff:192.168.1.20', '172.30.32.1', '172.30.33.2', '', undefined, null]) {
    assert.equal(isAllowedAddress(ip), false, String(ip));
  }
});

test('liste personnalisée respectée', () => {
  assert.equal(isAllowedAddress('10.0.0.5', ['10.0.0.5']), true);
  assert.equal(isAllowedAddress('172.30.32.2', ['10.0.0.5']), false);
});

test('la liste par défaut est figée', () => {
  assert.ok(Object.isFrozen(DEFAULT_ALLOWED_IPS));
});

test('verifyClient : upgrade WebSocket accepté depuis le proxy Ingress', () => {
  assert.deepEqual(verify(createWsVerifyClient(), '172.30.32.2'), { ok: true, code: undefined, message: undefined });
});

test('verifyClient : upgrade WebSocket refusé (403) depuis le LAN', () => {
  assert.deepEqual(verify(createWsVerifyClient(), '::ffff:192.168.1.20'), { ok: false, code: 403, message: 'Denied' });
});

test('verifyClient : socket sans adresse distante refusé', () => {
  let result;
  createWsVerifyClient()({ req: { socket: {} } }, (ok) => (result = ok));
  assert.equal(result, false);
});
