import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPairedEntry, validateLockDataImport } from '../src/lockDataImport.js';

// Identifiants factices : seule leur présence compte.
const creds = () => ({ aesKey: 'k', admin: { adminPs: 'p', unlockKey: 'u' } });
const paired = (address) => ({ address, privateData: creds() });
const A = 'E1:58:1B:3A:60:5E';
const B = 'C4:11:22:33:44:55';

test('isPairedEntry : identifiants complets exigés', () => {
  assert.equal(isPairedEntry(paired(A)), true);
  assert.equal(isPairedEntry({ address: A }), false);
  assert.equal(isPairedEntry({ address: A, privateData: { aesKey: 'k', admin: { adminPs: 'p' } } }), false);
  assert.equal(isPairedEntry(null), false);
});

test('format : un tableau est exigé', () => {
  for (const data of [{}, null, 'texte', 42, { 0: paired(A) }]) {
    assert.deepEqual(validateLockDataImport(data, [paired(A)]), { ok: false, error: 'expected a JSON array of locks' });
  }
});

test('entrées : objet avec adresse MAC valide', () => {
  assert.deepEqual(validateLockDataImport([null]), { ok: false, error: 'entry 1 is not an object' });
  assert.deepEqual(validateLockDataImport([paired(A), []]), { ok: false, error: 'entry 2 is not an object' });
  assert.deepEqual(validateLockDataImport([{ privateData: creds() }]), { ok: false, error: 'entry 1 has an invalid or missing address' });
  assert.deepEqual(validateLockDataImport([paired('E1:58:1B:3A:60')]), { ok: false, error: 'entry 1 has an invalid or missing address' });
});

test('doublons refusés, casse ignorée', () => {
  assert.deepEqual(validateLockDataImport([paired(A), paired(A.toLowerCase())]), {
    ok: false,
    error: `duplicate address ${A.toLowerCase()}`
  });
});

test('nouvelle serrure : identifiants complets exigés', () => {
  const result = validateLockDataImport([{ address: B }], [paired(A)]);
  assert.equal(result.ok, false);
  assert.match(result.error, /^C4:11:22:33:44:55: missing lock credentials/);
  assert.deepEqual(validateLockDataImport([paired(A), paired(B)], [paired(A)]), { ok: true, removed: [] });
});

test('serrure connue avec entrée incomplète : acceptée (le store garde ses identifiants)', () => {
  assert.deepEqual(validateLockDataImport([{ address: A, battery: 50 }], [paired(A)]), { ok: true, removed: [] });
});

test('suppressions autorisées mais signalées', () => {
  assert.deepEqual(validateLockDataImport([paired(A)], [paired(A), paired(B)]), { ok: true, removed: [B] });
  assert.deepEqual(validateLockDataImport([], [paired(A), paired(B)]), { ok: true, removed: [A, B] });
  // Une entrée sans identifiants n'était pas une serrure utilisable : pas signalée.
  assert.deepEqual(validateLockDataImport([], [{ address: B }]), { ok: true, removed: [] });
});

test('les messages d\'erreur ne citent jamais les identifiants', () => {
  const secret = { address: B, privateData: { aesKey: 'SECRET-KEY', admin: { adminPs: 'SECRET-PS' } } };
  const result = validateLockDataImport([secret], []);
  assert.equal(result.ok, false);
  assert.doesNotMatch(result.error, /SECRET/);
});
