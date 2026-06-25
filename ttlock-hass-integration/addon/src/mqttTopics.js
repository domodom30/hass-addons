/**
 * MQTT topic helpers and constants.
 *
 * Pure module (no dependencies, no side effects) so the topic logic can be
 * unit-tested without a broker. ha.js must not build topic strings by hand —
 * everything goes through here.
 */

// Prefix for data topics (state / commands / availability). Distinct from the
// Home Assistant discovery prefix (configurable, defaults to 'homeassistant').
export const DATA_PREFIX = 'ttlock';

// Bridge-wide availability topic. The addon publishes 'online' here on every
// (re)connect and registers an MQTT Last Will so the broker publishes
// 'offline' automatically if the addon crashes or loses the network.
export const BRIDGE_AVAILABILITY_TOPIC = DATA_PREFIX + '/bridge/availability';

export const PAYLOAD_ONLINE = 'online';
export const PAYLOAD_OFFLINE = 'offline';

const LOCK_ID_RE = /^[0-9a-f]{12}$/i;

/**
 * Build the lock id (MAC without colons, lowercase) used in every topic.
 * @param {string} address e.g. "E1:58:1B:3A:60:5E"
 * @returns {string} e.g. "e1581b3a605e"
 */
export function lockIdFromAddress(address) {
  return address.split(':').join('').toLowerCase();
}

/**
 * Reverse of lockIdFromAddress: rebuild the uppercase MAC address from a lock
 * id. Returns null when the id is not exactly 12 hex characters.
 * @param {string} id e.g. "e1581b3a605e"
 * @returns {string|null} e.g. "E1:58:1B:3A:60:5E"
 */
export function addressFromLockId(id) {
  if (typeof id !== 'string' || !LOCK_ID_RE.test(id)) return null;
  let address = '';
  for (let i = 0; i < id.length; i++) {
    address += id[i];
    if (i < id.length - 1 && i % 2 == 1) {
      address += ':';
    }
  }
  return address.toUpperCase();
}

/** State topic carrying the JSON `{battery, rssi, state?}` payload. */
export function stateTopic(id) {
  return DATA_PREFIX + '/' + id;
}

/** Command topic HA publishes LOCK/UNLOCK to. */
export function commandTopic(id) {
  return DATA_PREFIX + '/' + id + '/set';
}

/** Wildcard subscription matching every lock's command topic. */
export function commandSubscription() {
  return DATA_PREFIX + '/+/set';
}

/** Per-lock availability topic ('online' / 'offline'). */
export function lockAvailabilityTopic(id) {
  return DATA_PREFIX + '/' + id + '/availability';
}

/** Topic carrying the JSON payload of the "last operation" sensor. */
export function lastOperationTopic(id) {
  return DATA_PREFIX + '/' + id + '/last_operation';
}

/** Topic carrying the JSON payload of the "last access" (last unlock) sensor. */
export function lastUnlockTopic(id) {
  return DATA_PREFIX + '/' + id + '/last_unlock';
}

/**
 * Home Assistant MQTT discovery config topic.
 * @param {string} prefix discovery prefix (e.g. "homeassistant")
 * @param {string} component "lock" | "sensor" | "binary_sensor" | ...
 * @param {string} id lock id
 * @param {string} objectId entity object id (e.g. "battery", "last_operation")
 */
export function discoveryConfigTopic(prefix, component, id, objectId) {
  return prefix + '/' + component + '/' + id + '/' + objectId + '/config';
}

/**
 * Parse an inbound command topic `ttlock/<12 hex>/set`.
 * @param {string} topic
 * @returns {{address: string}|null} null when the topic is not a valid command
 */
export function parseCommandTopic(topic) {
  if (typeof topic !== 'string') return null;
  const parts = topic.split('/');
  if (parts.length !== 3 || parts[0] !== DATA_PREFIX || parts[2] !== 'set') {
    return null;
  }
  const address = addressFromLockId(parts[1]);
  if (!address) return null;
  return { address };
}

/**
 * Reducer keeping the more recent of two operations, mirroring the frontend
 * ordering: operateDate desc, then recordNumber desc.
 */
function _moreRecent(best, op) {
  if (!best) return op;
  if (op.operateDate > best.operateDate) return op;
  if (op.operateDate < best.operateDate) return best;
  return (op.recordNumber ?? 0) > (best.recordNumber ?? 0) ? op : best;
}

/**
 * Record types in the UNLOCK category that are NOT a real access method but
 * door-sensor side effects, so they must not mask the credential that opened
 * the door on the "last access" sensor:
 *  - 31 = DOOR_SENSOR_UNLOCK ("Ouverture capteur de porte")
 *  - 32 = DOOR_GO_OUT ("Passage sortie enregistré")
 * Values mirror the SDK `LogOperate` enum; kept inline so this module stays
 * dependency-free (like DATA_PREFIX et al.).
 */
const NON_CREDENTIAL_UNLOCK_RECORD_TYPES = new Set([31, 32]);

/**
 * Pick the most recent operation from an (already enriched) operation log,
 * mirroring the frontend ordering: operateDate desc, then recordNumber desc.
 * @param {Array} operations
 * @returns {object|null}
 */
export function latestOperation(operations) {
  if (!Array.isArray(operations) || operations.length === 0) return null;
  return operations.filter(Boolean).reduce(_moreRecent, null);
}

/**
 * Pick the most recent *credential* unlock (recordTypeCategory === 'UNLOCK',
 * excluding door-sensor side effects) so the "last access" sensor surfaces the
 * method (carte IC, code, empreinte, …) even when an auto-lock immediately
 * overwrites the latest record. Operations must be enriched
 * (manager._enrichOperation sets recordTypeCategory).
 * @param {Array} operations
 * @returns {object|null}
 */
export function latestUnlock(operations) {
  if (!Array.isArray(operations) || operations.length === 0) return null;
  return operations
    .filter(
      (op) =>
        op &&
        op.recordTypeCategory === 'UNLOCK' &&
        !NON_CREDENTIAL_UNLOCK_RECORD_TYPES.has(op.recordType)
    )
    .reduce(_moreRecent, null);
}

/**
 * Convert a TTLock compact date (YYYYMMDDHHmmss as integer or formatted string)
 * to an ISO 8601 string ("YYYY-MM-DDTHH:mm:ss") suitable for HA timestamp
 * sensors. Strips all non-digit characters so it handles both the raw SDK
 * format (20260520205751) and the formatted display string ("2026-05-20 20:57:51").
 * Returns null when the value is absent or too short to be a valid date.
 * @param {number|string|null|undefined} compact
 * @returns {string|null}
 */
function operateDateToIso(compact) {
  if (compact == null) return null;
  const digits = String(compact).replace(/\D/g, '');
  if (digits.length < 12) return null; // need at least YYYYMMDDHHmm
  const d = digits.padEnd(14, '0');
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T${d.slice(8, 10)}:${d.slice(10, 12)}:${d.slice(12, 14)}`;
}

/**
 * Build the JSON payload for the "last operation" sensor from an enriched
 * operation (recordTypeName / recordTypeCategory / passwordName added by
 * manager._enrichOperation). Numeric fields use `??` so a real 0 is kept.
 * The `timestamp` field is an ISO 8601 string converted from the TTLock
 * compact date format (YYYYMMDDHHmmss) so HA timestamp sensors can consume
 * it directly via `{{ value_json.timestamp }}`.
 * @param {object} op
 */
export function buildLastOperationPayload(op) {
  return {
    event: op.recordTypeName ?? null,
    category: op.recordTypeCategory ?? null,
    by: op.passwordName || op.password || null,
    record_type: op.recordType ?? null,
    record_number: op.recordNumber ?? null,
    timestamp: operateDateToIso(op.operateDate),
    battery: op.electricQuantity ?? null
  };
}
