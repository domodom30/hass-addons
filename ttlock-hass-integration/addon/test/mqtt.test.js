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
  parseCommandTopic,
  latestOperation,
  latestUnlock,
  buildLastOperationPayload
} from '../src/mqttTopics.js';

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
    timestamp: '2026-05-15T09:30:00', // ISO 8601 converti depuis le format compact YYYYMMDDHHmmss
    battery: 0 // numeric 0 kept, not coerced to null
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
  assert.equal(buildLastOperationPayload({ operateDate: 20260520205751 }).timestamp, '2026-05-20T20:57:51');
  // Format string avec séparateurs (valeur de test / affichée)
  assert.equal(buildLastOperationPayload({ operateDate: '2026-05-20 20:57:51' }).timestamp, '2026-05-20T20:57:51');
  // Sans secondes (12 chiffres, padded)
  assert.equal(buildLastOperationPayload({ operateDate: 202605201957 }).timestamp, '2026-05-20T19:57:00');
  // Absent
  assert.equal(buildLastOperationPayload({ operateDate: null }).timestamp, null);
  assert.equal(buildLastOperationPayload({}).timestamp, null);
});
