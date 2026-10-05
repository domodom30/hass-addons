import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  shouldForceMonitorRecovery,
  MONITOR_SILENCE_MS,
  MONITOR_RECOVERY_COOLDOWN_MS
} from '../src/monitorHealth.js';

const NOW = 1_800_000_000_000;
const ago = (ms) => NOW - ms;

test('silence prolongé alors que le monitor se déclare actif → reprise forcée', () => {
  assert.equal(
    shouldForceMonitorRecovery({
      monitoring: true,
      lastSeen: [ago(MONITOR_SILENCE_MS + 1000)],
      now: NOW
    }),
    true
  );
});

test('publicité récente → aucune reprise', () => {
  assert.equal(
    shouldForceMonitorRecovery({
      monitoring: true,
      lastSeen: [ago(10_000)],
      now: NOW
    }),
    false
  );
});

test('la serrure la plus récemment vue fait foi', () => {
  // Une serrure hors de portée ne doit pas déclencher une reprise si une autre répond.
  assert.equal(
    shouldForceMonitorRecovery({
      monitoring: true,
      lastSeen: [ago(MONITOR_SILENCE_MS + 60_000), ago(5_000)],
      now: NOW
    }),
    false
  );
});

test('monitor déclaré inactif → le chemin de reprise normal s\'en charge', () => {
  assert.equal(
    shouldForceMonitorRecovery({
      monitoring: false,
      lastSeen: [ago(MONITOR_SILENCE_MS + 1000)],
      now: NOW
    }),
    false
  );
});

test('aucune serrure connue → aucun signal attendu, donc aucune conclusion', () => {
  assert.equal(shouldForceMonitorRecovery({ monitoring: true, lastSeen: [], now: NOW }), false);
});

test('serrure connue mais jamais vue → aucune conclusion', () => {
  assert.equal(
    shouldForceMonitorRecovery({ monitoring: true, lastSeen: [undefined], now: NOW }),
    false
  );
});

test('cooldown: une seule reprise par fenêtre', () => {
  const params = {
    monitoring: true,
    lastSeen: [ago(MONITOR_SILENCE_MS + 1000)],
    now: NOW
  };
  assert.equal(shouldForceMonitorRecovery({ ...params, lastRecoveryAt: 0 }), true);
  // Reprise il y a une minute : on laisse la précédente agir.
  assert.equal(shouldForceMonitorRecovery({ ...params, lastRecoveryAt: ago(60_000) }), false);
  // Passé la fenêtre, on retente.
  assert.equal(
    shouldForceMonitorRecovery({ ...params, lastRecoveryAt: ago(MONITOR_RECOVERY_COOLDOWN_MS + 1000) }),
    true
  );
});

test('seuils surchargeables', () => {
  assert.equal(
    shouldForceMonitorRecovery({
      monitoring: true,
      lastSeen: [ago(30_000)],
      now: NOW,
      silenceMs: 10_000
    }),
    true
  );
});

test('accepte un itérateur (Map.values) comme source', () => {
  const lastSeen = new Map([['AA:BB:CC:DD:EE:FF', ago(MONITOR_SILENCE_MS + 1000)]]);
  assert.equal(
    shouldForceMonitorRecovery({ monitoring: true, lastSeen: lastSeen.values(), now: NOW }),
    true
  );
});
