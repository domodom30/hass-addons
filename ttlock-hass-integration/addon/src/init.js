import HomeAssistant from './ha.js';
import store from './store.js';
import manager from './manager.js';
import express from 'express';
import api from '../api/index.js';
import { detectLanguage } from './haLanguage.js';

/**
 * Validate and normalise the noble-gateway options.
 *
 * The SDK silently falls back to hard-coded defaults for any missing field
 * (AES key `f8b55c…`, user/pass `admin`/`admin`), so a typo in the addon
 * config produces a confusing "connects but unauthorised" failure instead of a
 * clear error. We surface the problem loudly here but still proceed: refusing
 * to start would also break setups that intentionally rely on the SDK
 * defaults. The port is coerced to a number (it arrives as a string from the
 * environment) so it cannot silently become `NaN` downstream.
 * @param {Object} options
 * @returns {{host:string, port:number, key:string, user:string, pass:string}}
 */
function normaliseNobleOptions(options) {
  const problems = [];

  const host = String(options.gateway_host ?? '').trim();
  if (!host) problems.push('[gateway_host] is empty');

  const port = Number.parseInt(options.gateway_port, 10);
  const validPort = Number.isInteger(port) && port > 0 && port < 65536;
  if (!validPort) problems.push(`gateway_port invalide (${options.gateway_port})`);

  const key = String(options.gateway_key ?? '').trim();
  if (!key) problems.push('[gateway_key] is empty — the default AES key from the SDK will be used');
  else if (!/^[0-9a-fA-F]+$/.test(key) || key.length % 2 !== 0) problems.push("gateway_key n'est pas une chaîne hexadécimale valide");

  const user = String(options.gateway_user ?? '').trim();
  const pass = String(options.gateway_pass ?? '').trim();
  if (!user || !pass) problems.push('[gateway_user/gateway_pass] is empty — default SDK credentials (admin/admin)');

  if (problems.length) {
    console.warn('[Gateway] Noble configuration incomplete or invalid :');
    for (const p of problems) console.warn('  - ' + p);
    console.warn('[Gateway] The SDK will use its default values ​​for missing fields — correct the addon configuration if the connection fails.');
  }

  return {
    host: host || '127.0.0.1',
    port: validPort ? port : 2846,
    key,
    user,
    pass
  };
}

/**
 * Handle the initialisation process
 * - load saved data
 * - create manager
 * - create express app
 * @param {Object} options
 * @param {string} options.settingsPath Path to the file in which lock data settings are saved
 * @param {string} options.mqttHost MQTT host
 * @param {string} options.mqttPort MQTT port
 * @param {string} options.mqttSSL MQTT ssl
 * @param {string} options.mqttUser MQTT username (optional — anonymous broker supported)
 * @param {string} options.mqttPass MQTT password (optional — anonymous broker supported)
 * @param {string} options.discovery_prefix Home Assistant MQTT discovery prefix
 * @param {'none'|'noble'} options.gateway External BLE gateway type
 * @param {string} options.gateway_host Gateway hostname or IP
 * @param {number} options.gateway_port Gateway port
 * @param {string} options.gateway_key Gateway AES key
 * @param {string} options.gateway_user Gateway username
 * @param {string} options.gateway_pass  Gateway password
 */
export default async function init(options = {}) {
  // load saved data
  if (options.settingsPath) {
    store.setDataPath(options.settingsPath);
  }
  await store.loadData();
  await detectLanguage();

  // initialize manager
  if (options.gateway === 'noble') {
    const g = normaliseNobleOptions(options);
    manager.setNobleGateway(g.host, g.port, g.key, g.user, g.pass);
  }
  if (options.mqttHost) {
    const useSSL = options.mqttSSL === 'true';
    const mqttPort = options.mqttPort || (useSSL ? 8883 : 1883);
    const haOptions = {
      mqttUrl: (useSSL ? 'mqtts://' : 'mqtt://') + options.mqttHost + ':' + mqttPort,
      // undefined (not '') so mqtt.js connects anonymously when no auth is set
      mqttUser: options.mqttUser || undefined,
      mqttPass: options.mqttPass || undefined,
      discovery_prefix: options.discovery_prefix || undefined
    };
    const ha = new HomeAssistant(haOptions);
    await ha.connect();
  }

  await manager.init();

  // create express app
  const app = express();
  const port = options.port ?? 55099;

  // Because we use host networking we need to filter out
  // all requests except those coming from the HA proxy
  const localIP = options.localIP ?? ['172.30.32.2', '::ffff:172.30.32.2', '::1', '::ffff:127.0.0.1'];
  app.use((req, res, next) => {
    if (localIP.includes(req.ip)) {
      next();
    } else {
      res.status(403).send('Denied');
    }
  });

  app.use(express.json({ limit: '1mb' }));

  // ── Alias import / export ──────────────────────────────────────────────────
  // Export: télécharge aliasData.json
  app.get('/api/aliases', (req, res) => {
    res.setHeader('Content-Disposition', 'attachment; filename="aliasData.json"');
    res.json(store.getAliasData());
  });

  // Import: remplace aliasData par le JSON envoyé en body
  app.post('/api/aliases', (req, res) => {
    const data = req.body;
    if (
      !data ||
      typeof data !== 'object' ||
      Array.isArray(data) ||
      typeof data.lock !== 'object' || Array.isArray(data.lock) ||
      typeof data.card !== 'object' || Array.isArray(data.card) ||
      typeof data.finger !== 'object' || Array.isArray(data.finger)
    ) {
      return res.status(400).json({ error: 'Format invalide : le fichier doit contenir les clés « lock », « card » et « finger » (objets).' });
    }
    store.importAliasData(data);
    res.json({ ok: true });
  });
  // ──────────────────────────────────────────────────────────────────────────

  app.use('/frontend', express.static('frontend'));

  const server = app.listen(port, () => {
    console.log('Server started');
  });

  api(server);
}
