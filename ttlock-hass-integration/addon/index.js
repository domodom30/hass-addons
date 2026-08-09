import manager from './src/manager.js';
import init from './src/init.js';

/**
 * Recognise the class of transient WebSocket connection errors raised when the
 * noble gateway (ESP / ttlock-gateway) is unreachable or drops mid-handshake.
 * The SDK wraps the socket in `reconnecting-websocket`, so these are recoverable:
 * the SDK keeps retrying on its own. We only need to keep the process alive and
 * avoid flagging a fatal startup error. Matching is intentionally broad (message
 * fragment OR errno code) so a `ws` version bump doesn't silently break it.
 * @param {any} error
 */
function isRecoverableGatewayError(error) {
  const msg = String(error?.message ?? error ?? '');
  const code = error?.code;
  return /WebSocket.*clos|closed before the connection|WebSocket is not open/i.test(msg) || ['ECONNREFUSED', 'ETIMEDOUT', 'EHOSTUNREACH', 'ENETUNREACH', 'ENOTFOUND', 'ECONNRESET'].includes(code);
}

// Throttle the gateway-unreachable warning: reconnecting-websocket retries with
// backoff and each failed attempt can surface here, so log at most once/30s.
let lastGatewayWarn = 0;
function warnGatewayUnreachable() {
  const now = Date.now();
  if (now - lastGatewayWarn < 30000) return;
  lastGatewayWarn = now;
  console.warn('[Gateway] Connection to gateway (ESP/noble) unavailable — the SDK WebSocket client will automatically retry (backoff).');
}

// The reconnecting-websocket connect failure surfaces either as an
// uncaughtException or an unhandledRejection depending on timing. Treat the
// recoverable gateway case as non-fatal in BOTH; keep the original fatal
// behaviour for anything genuinely unexpected.
process.on('uncaughtException', (error) => {
  if (isRecoverableGatewayError(error)) {
    warnGatewayUnreachable();
    return;
  }
  console.error('uncaughtException catch:');
  console.error(error);
  manager.startupStatus = 1;
});

process.on('unhandledRejection', (reason) => {
  if (isRecoverableGatewayError(reason)) {
    warnGatewayUnreachable();
    return;
  }
  console.error('unhandledRejection catch:');
  console.error(reason);
});

init({
  // options go here
  settingsPath: process.env.DATA_PATH || '/data',
  mqttHost: process.env.MQTT_HOST,
  mqttPort: process.env.MQTT_PORT,
  mqttSSL: process.env.MQTT_SSL,
  mqttUser: process.env.MQTT_USER,
  mqttPass: process.env.MQTT_PASS,
  discovery_prefix: process.env.MQTT_DISCOVERY_PREFIX,
  gateway: process.env.GATEWAY || 'none',
  gateway_host: process.env.GATEWAY_HOST || '127.0.0.1',
  gateway_port: process.env.GATEWAY_PORT || 2846,
  gateway_key: process.env.GATEWAY_KEY,
  gateway_user: process.env.GATEWAY_USER,
  gateway_pass: process.env.GATEWAY_PASS,
  // Cooldown en secondes entre deux lectures du journal opérationnel (option addon oplog_cooldown).
  // Manager.js lit process.env.OPLOG_COOLDOWN directement ; cette entrée documente le paramètre.
  oplog_cooldown: parseInt(process.env.OPLOG_COOLDOWN, 10) || 10,
  // Minutes sans contact BLE avant qu'un lock ne soit publié 'offline' sur son topic de
  // disponibilité MQTT (option addon lock_offline_timeout). Manager.js lit
  // process.env.LOCK_OFFLINE_TIMEOUT directement ; cette entrée documente le paramètre.
  lock_offline_timeout: parseInt(process.env.LOCK_OFFLINE_TIMEOUT, 10) || 15,
  // Taille maximale du journal d'opérations persisté (option addon max_oplog).
  // store.js lit process.env.MAX_OPLOG directement ; cette entrée documente le paramètre.
  max_oplog: parseInt(process.env.MAX_OPLOG, 10) || 300
});
