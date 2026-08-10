import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DATA_PREFIX,
  BRIDGE_AVAILABILITY_TOPIC,
  PAYLOAD_ONLINE,
  PAYLOAD_OFFLINE,
  lockIdFromAddress,
  addressFromLockId,
  stateTopic,
  commandTopic,
  commandSubscription,
  lockAvailabilityTopic,
  lastOperationTopic,
  lastUnlockTopic,
  discoveryConfigTopic,
  REMOVED_DISCOVERY_OBJECT_IDS,
  parseCommandTopic,
  latestOperation,
  latestUnlock,
  buildLastOperationPayload,
  buildOperationEventPayload,
  operationEventTopic,
  OPERATION_EVENT_TYPES
} from '../src/mqttTopics.js';

// operateDateToIso emits a timezone-aware ISO using the process TZ (DST-aware).
// Pin UTC so the expected offsets below are deterministic across machines/CI.
process.env.TZ = 'UTC';

test('constants', () => {
  assert.equal(DATA_PREFIX, 'ttlock');
  assert.equal(BRIDGE_AVAILABILITY_TOPIC, 'ttlock/bridge/availability');
  assert.equal(PAYLOAD_ONLINE, 'online');
  assert.equal(PAYLOAD_OFFLINE, 'offline');
});

test('lockIdFromAddress', () => {
  assert.equal(lockIdFromAddress('E1:58:1B:3A:60:5E'), 'e1581b3a605e');
  assert.equal(lockIdFromAddress('e1:58:1b:3a:60:5e'), 'e1581b3a605e');
});

test('addressFromLockId valid / round-trip', () => {
  assert.equal(addressFromLockId('e1581b3a605e'), 'E1:58:1B:3A:60:5E');
  const addr = 'AB:CD:EF:01:23:45';
  assert.equal(addressFromLockId(lockIdFromAddress(addr)), addr);
});

test('addressFromLockId rejects bad input', () => {
  assert.equal(addressFromLockId(''), null);
  assert.equal(addressFromLockId('e1581b3a605'), null); // 11 chars
  assert.equal(addressFromLockId('e1581b3a605e0'), null); // 13 chars
  assert.equal(addressFromLockId('e1581b3a605z'), null); // non-hex
  assert.equal(addressFromLockId(null), null);
  assert.equal(addressFromLockId(123456789012), null);
});

test('topic helpers', () => {
  assert.equal(stateTopic('e1581b3a605e'), 'ttlock/e1581b3a605e');
  assert.equal(commandTopic('e1581b3a605e'), 'ttlock/e1581b3a605e/set');
  assert.equal(commandSubscription(), 'ttlock/+/set');
  assert.equal(lockAvailabilityTopic('e1581b3a605e'), 'ttlock/e1581b3a605e/availability');
  assert.equal(lastOperationTopic('e1581b3a605e'), 'ttlock/e1581b3a605e/last_operation');
  assert.equal(lastUnlockTopic('e1581b3a605e'), 'ttlock/e1581b3a605e/last_unlock');
  assert.equal(
    discoveryConfigTopic('homeassistant', 'sensor', 'e1581b3a605e', 'battery'),
    'homeassistant/sensor/e1581b3a605e/battery/config'
  );
  assert.equal(
    discoveryConfigTopic('ha', 'binary_sensor', 'e1581b3a605e', 'connectivity'),
    'ha/binary_sensor/e1581b3a605e/connectivity/config'
  );
});

test('parseCommandTopic valid', () => {
  assert.deepEqual(parseCommandTopic('ttlock/e1581b3a605e/set'), {
    address: 'E1:58:1B:3A:60:5E'
  });
});

test('parseCommandTopic rejects', () => {
  assert.equal(parseCommandTopic('ttlock/e1581b3a605e'), null); // 2 segments
  assert.equal(parseCommandTopic('ttlock/e1581b3a605e/set/x'), null); // 4 segments
  assert.equal(parseCommandTopic('other/e1581b3a605e/set'), null); // wrong prefix
  assert.equal(parseCommandTopic('ttlock/e1581b3a605e/get'), null); // wrong action
  assert.equal(parseCommandTopic('ttlock/e1581b3a60/set'), null); // id not 12
  assert.equal(parseCommandTopic('ttlock/e1581b3a605z/set'), null); // id not hex
  assert.equal(parseCommandTopic('homeassistant/lock/e1581b3a605e/lock/config'), null);
  assert.equal(parseCommandTopic(null), null);
});

test('latestOperation picks newest (operateDate then recordNumber)', () => {
  assert.equal(latestOperation([]), null);
  assert.equal(latestOperation(null), null);
  const ops = [
    { operateDate: '2026-05-10 10:00:00', recordNumber: 1 },
    { operateDate: '2026-05-12 08:00:00', recordNumber: 5 },
    { operateDate: '2026-05-12 08:00:00', recordNumber: 6 }, // tie -> highest recordNumber
    { operateDate: '2026-05-11 23:00:00', recordNumber: 4 }
  ];
  assert.equal(latestOperation(ops).recordNumber, 6);
});

test('latestUnlock picks newest credential unlock, ignores door-sensor side effects', () => {
  assert.equal(latestUnlock([]), null);
  assert.equal(latestUnlock(null), null);
  // No credential unlock at all -> null
  assert.equal(
    latestUnlock([
      { operateDate: '2026-05-15 23:50:59', recordNumber: 4101, recordType: 30, recordTypeCategory: 'LOCK' },
      { operateDate: '2026-05-15 23:50:54', recordNumber: 4100, recordType: 31, recordTypeCategory: 'UNLOCK' }
    ]),
    null
  );
  // IC unlock (17) wins even though DOOR_SENSOR_UNLOCK (31) and the LOCK record are more recent
  const ops = [
    { operateDate: '2026-05-15 23:48:18', recordNumber: 4098, recordType: 30, recordTypeCategory: 'LOCK' },
    { operateDate: '2026-05-15 23:50:52', recordNumber: 4099, recordType: 17, recordTypeCategory: 'UNLOCK' },
    { operateDate: '2026-05-15 23:50:54', recordNumber: 4100, recordType: 31, recordTypeCategory: 'UNLOCK' },
    { operateDate: '2026-05-15 23:50:59', recordNumber: 4101, recordType: 30, recordTypeCategory: 'LOCK' }
  ];
  const last = latestUnlock(ops);
  assert.equal(last.recordNumber, 4099);
  assert.equal(last.recordType, 17);
  // DOOR_GO_OUT (32) is also excluded; falls back to the earlier code unlock (4)
  const ops2 = [
    { operateDate: '2026-05-15 10:00:00', recordNumber: 10, recordType: 4, recordTypeCategory: 'UNLOCK' },
    { operateDate: '2026-05-15 11:00:00', recordNumber: 11, recordType: 32, recordTypeCategory: 'UNLOCK' }
  ];
  assert.equal(latestUnlock(ops2).recordNumber, 10);
});

test('buildLastOperationPayload', () => {
  const op = {
    recordType: 4,
    recordTypeName: 'Unlock by IC card',
    recordTypeCategory: 'UNLOCK',
    password: '1234567',
    passwordName: 'Carte Alice',
    recordNumber: 42,
    operateDate: '2026-05-15 09:30:00',
    electricQuantity: 0
  };
  assert.deepEqual(buildLastOperationPayload(op), {
    event: 'Unlock by IC card',
    category: 'UNLOCK',
    by: 'Carte Alice',
    record_type: 4,
    record_number: 42,
    timestamp: '2026-05-15T09:30:00+00:00', // ISO 8601 timezone-aware (TZ=UTC ici)
    battery_at_event: 0 // numeric 0 kept, not coerced to null
  });
});

test('buildLastOperationPayload falls back to password then null', () => {
  const noName = buildLastOperationPayload({ password: '999', recordType: 1 });
  assert.equal(noName.by, '999');
  const nothing = buildLastOperationPayload({ recordType: 1 });
  assert.equal(nothing.by, null);
  assert.equal(nothing.event, null);
});

test('buildLastOperationPayload timestamp: compact YYYYMMDDHHmmss → ISO 8601', () => {
  // Format entier brut du SDK TTLock (ex. serrure réelle)
  assert.equal(buildLastOperationPayload({ operateDate: 20260520205751 }).timestamp, '2026-05-20T20:57:51+00:00');
  // Format string avec séparateurs (valeur de test / affichée)
  assert.equal(buildLastOperationPayload({ operateDate: '2026-05-20 20:57:51' }).timestamp, '2026-05-20T20:57:51+00:00');
  // Sans secondes (12 chiffres, padded)
  assert.equal(buildLastOperationPayload({ operateDate: 202605201957 }).timestamp, '2026-05-20T19:57:00+00:00');
  // Absent
  assert.equal(buildLastOperationPayload({ operateDate: null }).timestamp, null);
  assert.equal(buildLastOperationPayload({}).timestamp, null);
});

test('operateDateToIso is DST-aware (offset from the op date, not now)', () => {
  const prev = process.env.TZ;
  process.env.TZ = 'Europe/Paris';
  try {
    // Été (CEST, UTC+2) et hiver (CET, UTC+1) doivent produire des offsets différents,
    // ce qui prouve que l'offset est calculé à la date de l'op (pas à l'instant courant).
    assert.equal(buildLastOperationPayload({ operateDate: 20260715120000 }).timestamp, '2026-07-15T12:00:00+02:00');
    assert.equal(buildLastOperationPayload({ operateDate: 20260115120000 }).timestamp, '2026-01-15T12:00:00+01:00');
  } finally {
    process.env.TZ = prev;
  }
});

test('buildOperationEventPayload maps category to event_type', () => {
  const op = { recordTypeCategory: 'UNLOCK', recordTypeName: 'Unlock by IC card', recordNumber: 7, operateDate: 20260520205751 };
  const payload = buildOperationEventPayload(op);
  assert.equal(payload.event_type, 'unlock');
  assert.ok(OPERATION_EVENT_TYPES.includes(payload.event_type));
  assert.equal(payload.event, 'Unlock by IC card'); // attributs de last_operation réutilisés
  // Catégorie inconnue → repli sur 'other'
  assert.equal(buildOperationEventPayload({ recordTypeCategory: 'WEIRD' }).event_type, 'other');
  assert.equal(buildOperationEventPayload({}).event_type, 'other');
});

test('operationEventTopic', () => {
  assert.equal(operationEventTopic('e1581b3a605e'), 'ttlock/e1581b3a605e/event');
});

test('REMOVED_DISCOVERY_OBJECT_IDS: purge des entités retirées en 2.6.7', () => {
  // Source de vérité unique pour la purge (configureLock + _onLockUnpaired). La
  // découverte MQTT étant retained, oublier une entrée laisserait une entité
  // orpheline à vie dans Home Assistant.
  assert.deepEqual(REMOVED_DISCOVERY_OBJECT_IDS.map(([, objectId]) => objectId), [
    'last_operation_time',
    'last_access_time',
    'last_user'
  ]);
  const topics = REMOVED_DISCOVERY_OBJECT_IDS.map(([component, objectId]) =>
    discoveryConfigTopic('homeassistant', component, 'e1581b3a605e', objectId));
  assert.deepEqual(topics, [
    'homeassistant/sensor/e1581b3a605e/last_operation_time/config',
    'homeassistant/sensor/e1581b3a605e/last_access_time/config',
    'homeassistant/sensor/e1581b3a605e/last_user/config'
  ]);
});

test('le payload event est autoportant: event_type + attributs, sans value_template', () => {
  // L'entité HA `event` consomme désormais ce payload tel quel : il doit rester un
  // objet JSON portant event_type, sinon HA le rejette (« No valid JSON event payload
  // detected ») et l'entité ne se déclenche jamais.
  const payload = buildOperationEventPayload({
    recordTypeCategory: 'UNLOCK',
    recordTypeName: 'Déverrouillage carte IC',
    passwordName: 'Eddy',
    recordType: 17,
    recordNumber: 374,
    operateDate: 20260810150316,
    electricQuantity: 93
  });
  assert.equal(typeof payload, 'object');
  assert.equal(payload.event_type, 'unlock');
  // Les clés restantes deviennent les attributs de l'entité event côté HA.
  assert.deepEqual(Object.keys(payload).filter((k) => k !== 'event_type').sort(), [
    'battery_at_event', 'by', 'category', 'event', 'record_number', 'record_type', 'timestamp'
  ]);
  assert.equal(payload.by, 'Eddy');
  assert.equal(payload.record_number, 374);
});
