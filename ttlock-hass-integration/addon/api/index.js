import { sleep } from '@domodom30/ttlock-sdk-js';
import WebSocket from 'ws';
import manager from '../src/manager.js';
import store from '../src/store.js';
import Message from './Message.js';
import WsApi from './WsApi.js';

// ── validation helpers ────────────────────────────────────────────────────────

/** TTLock date strings are exactly 12 digits: YYYYMMDDHHmm */
function isValidTTLockDate(d) {
  return typeof d === 'string' && /^\d{12}$/.test(d);
}

/** autolock must be a non-NaN non-negative integer */
function isValidAutoLock(v) {
  const n = Number.parseInt(v, 10);
  return !Number.isNaN(n) && n >= 0;
}

// ── case handlers ────────────────────────────────────────────────────────────

async function handlePair(wss, msg) {
  if (!msg.data?.address) return;
  const paired = await manager.initLock(msg.data.address);
  if (paired) return;
  const lock = manager.getNewVisible().get(msg.data.address);
  if (lock) WsApi.sendLockStatus(wss, lock);
}

async function handleLockOrUnlock(wss, msg, op) {
  if (!msg.data?.address) return;
  const result = await op(msg.data.address);
  if (result) return;
  const lock = manager.getPairedVisible().get(msg.data.address);
  if (lock) WsApi.sendLockStatus(wss, lock);
}

async function handleCredentials(api, ws, msg) {
  if (!msg.data?.address) return;

  if (process.env.DEV_MODE) {
    WsApi._devSendCredentials(ws);
    return;
  }

  const credentials = await manager.getCredentials(msg.data.address);
  if (!credentials) {
    api.sendError('Failed fetching credentials', msg);
    return;
  }
  api.sendCredentials(msg.data.address, credentials);
}

async function handlePasscode(api, ws, msg) {
  if (!msg.data?.address || !msg.data?.passcode) return;

  if (process.env.DEV_MODE) {
    WsApi._devSendCredentials(ws);
    return;
  }

  const passcode = msg.data.passcode;
  console.log('passcode operation received:', JSON.stringify(passcode));
  const address = msg.data.address;

  const passCodeIsNew = passcode.passCode == null || passcode.passCode === '' || passcode.passCode == -1;
  const passCodeIsDelete = passcode.newPassCode == null || passcode.newPassCode === '' || passcode.newPassCode == -1;

  // Each manager method now returns the updated passcodes array on success, or false on failure.
  let passcodes = false;
  let operationKind = null;
  if (passCodeIsNew) {
    if (!passcode.newPassCode || !passcode.startDate || !passcode.endDate) {
      api.sendError('Invalid passcode data: missing required fields', msg);
      return;
    }
    if (!isValidTTLockDate(passcode.startDate) || !isValidTTLockDate(passcode.endDate)) {
      api.sendError('Invalid passcode data: invalid date format (expected YYYYMMDDHHmm)', msg);
      return;
    }
    operationKind = 'add';
    passcodes = await manager.addPasscode(address, passcode.type, passcode.newPassCode, passcode.startDate, passcode.endDate);
  } else if (passCodeIsDelete) {
    const codeToDelete = passcode.passCode || passcode.newPassCode;
    if (!codeToDelete) {
      api.sendError('Invalid passcode data: cannot determine code to delete', msg);
      return;
    }
    operationKind = 'delete';
    passcodes = await manager.deletePasscode(address, passcode.type, codeToDelete);
  } else {
    if (!passcode.passCode || !passcode.newPassCode) {
      api.sendError('Invalid passcode data: missing passCode or newPassCode for update', msg);
      return;
    }
    if (!passcode.startDate || !passcode.endDate) {
      api.sendError('Invalid passcode data: missing dates for update', msg);
      return;
    }
    if (!isValidTTLockDate(passcode.startDate) || !isValidTTLockDate(passcode.endDate)) {
      api.sendError('Invalid passcode data: invalid date format (expected YYYYMMDDHHmm)', msg);
      return;
    }
    operationKind = 'update';
    passcodes = await manager.updatePasscode(address, passcode.type, passcode.passCode, passcode.newPassCode, passcode.startDate, passcode.endDate);
  }

  if (passcodes === false) {
    const detail = manager.getLastPasscodeError(address);
    api.sendError(detail ? `PIN operation failed: ${detail.message}` : 'PIN operation failed', msg);
    return;
  }
  if (passcodes === null) {
    // delete succeeded but getPassCodes failed — re-fetch full credentials
    const credentials = await manager.getCredentials(address);
    if (!credentials) {
      api.sendError('PIN deleted but failed to refresh list', msg);
      return;
    }
    api.sendCredentials(address, credentials);
    api.sendNotice(`notices.passcode.${operationKind}`);
    return;
  }
  api.sendPasscodes(address, passcodes);
  api.sendNotice(`notices.passcode.${operationKind}`);
}

async function handleCard(api, ws, msg) {
  if (!msg.data?.address || !msg.data?.card) return;

  if (process.env.DEV_MODE) {
    WsApi._devSendCredentials(ws);
    return;
  }

  const card = msg.data.card;
  const address = msg.data.address;
  // Each manager method now returns the updated cards array on success, or false on failure.
  let cards = false;

  if (card.cardNumber == -1) {
    if (!isValidTTLockDate(card.startDate) || !isValidTTLockDate(card.endDate)) {
      api.sendError('Invalid card data: invalid date format (expected YYYYMMDDHHmm)', msg);
      return;
    }
    cards = await manager.addCard(address, card.startDate, card.endDate, card.alias);
  } else if (card.startDate == -1) {
    cards = await manager.deleteCard(address, card.cardNumber);
  } else {
    if (!isValidTTLockDate(card.startDate) || !isValidTTLockDate(card.endDate)) {
      api.sendError('Invalid card data: invalid date format (expected YYYYMMDDHHmm)', msg);
      return;
    }
    cards = await manager.updateCard(address, card.cardNumber, card.startDate, card.endDate, card.alias);
  }

  if (cards === false) {
    api.sendError('Card operation failed', msg);
    return;
  }
  if (cards === null) {
    // delete succeeded but getICCards failed — re-fetch full credentials
    const credentials = await manager.getCredentials(address);
    if (!credentials) {
      api.sendError('Card deleted but failed to refresh list', msg);
      return;
    }
    api.sendCredentials(address, credentials);
    return;
  }
  api.sendCards(address, cards);
}

async function handleFinger(api, ws, msg) {
  if (!msg.data?.address || !msg.data?.finger) return;

  if (process.env.DEV_MODE) {
    WsApi._devSendCredentials(ws);
    return;
  }

  const finger = msg.data.finger;
  const address = msg.data.address;
  // Each manager method now returns the updated fingers array on success, or false on failure.
  let fingers = false;

  if (finger.fpNumber == -1) {
    if (!isValidTTLockDate(finger.startDate) || !isValidTTLockDate(finger.endDate)) {
      api.sendError('Invalid fingerprint data: invalid date format (expected YYYYMMDDHHmm)', msg);
      return;
    }
    fingers = await manager.addFinger(address, finger.startDate, finger.endDate, finger.alias);
  } else if (finger.startDate == -1) {
    fingers = await manager.deleteFinger(address, finger.fpNumber);
  } else {
    if (!isValidTTLockDate(finger.startDate) || !isValidTTLockDate(finger.endDate)) {
      api.sendError('Invalid fingerprint data: invalid date format (expected YYYYMMDDHHmm)', msg);
      return;
    }
    fingers = await manager.updateFinger(address, finger.fpNumber, finger.startDate, finger.endDate, finger.alias);
  }

  if (fingers === false) {
    api.sendError('Fingerprint operation failed', msg);
    return;
  }
  if (fingers === null) {
    // delete succeeded but getFingerprints failed — re-fetch full credentials
    const credentials = await manager.getCredentials(address);
    if (!credentials) {
      api.sendError('Fingerprint deleted but failed to refresh list', msg);
      return;
    }
    api.sendCredentials(address, credentials);
    return;
  }
  api.sendFingers(address, fingers);
}

async function handleSettings(api, msg) {
  if (!msg.data?.address || !msg.data.settings) return;
  const { address, settings } = msg.data;
  const confirmed = {};

  if (settings.autolock !== undefined) {
    if (!isValidAutoLock(settings.autolock)) {
      api.sendError('Invalid autolock value: must be a non-negative integer', msg);
      return;
    }
    confirmed.autolock = await manager.setAutoLock(address, Number.parseInt(settings.autolock, 10));
    if (confirmed.autolock !== true) api.sendError('Unable to set auto-lock time', msg);
  }

  if (settings.audio !== undefined) {
    if (typeof settings.audio !== 'boolean') {
      api.sendError('Invalid audio value: must be a boolean', msg);
      return;
    }
    confirmed.audio = await manager.setAudio(address, settings.audio);
    if (confirmed.audio !== true) api.sendError('Failed to set audio mode', msg);
  }

  if (settings.calibrate) {
    confirmed.calibrate = await manager.calibrateTime(address);
    if (confirmed.calibrate !== true) api.sendError('Failed to calibrate lock clock', msg);
  }

  if (confirmed.autolock || confirmed.audio || confirmed.calibrate) {
    await sleep(10);
  }
  api.sendSettingsConfirmation(address, confirmed);
}

async function handleConfig(api, msg) {
  if (!msg.data) return;
  if (msg.data.get) {
    api.sendConfig();
    return;
  }
  if (!msg.data.set) return;
  try {
    const lockData = JSON.parse(msg.data.set);
    store.setLockData(lockData);
    manager.updateClientLockDataFromStore();
    manager.startScan();
    api.sendConfigConfirm();
  } catch (error) {
    console.error('Failed to set config:', error);
    api.sendConfigConfirm('Failed to set config');
  }
}

/**
 * Union two operation lists by recordNumber (fresh wins on conflict), sorted like
 * the frontend/store: operateDate desc, then recordNumber desc. Guards against a
 * partial BLE read shrinking the journal already shown from cache.
 * @param {Array} cached
 * @param {Array} fresh
 * @returns {Array}
 */
function mergeOperationsByRecord(cached, fresh) {
  const byRecord = new Map();
  for (const op of cached || []) if (op) byRecord.set(op.recordNumber, op);
  for (const op of fresh || []) if (op) byRecord.set(op.recordNumber, op); // fresh overrides
  return [...byRecord.values()].sort((a, b) => {
    if (b.operateDate !== a.operateDate) return (b.operateDate || 0) - (a.operateDate || 0);
    return (b.recordNumber || 0) - (a.recordNumber || 0);
  });
}

async function handleOperations(api, msg) {
  if (!msg.data?.address) return;
  const address = msg.data.address;
  // reload absent (front compilé actuel) → on tente quand même le BLE pour
  // préserver le bouton « rafraîchir ». reload === false (front futur) →
  // cache seul. reload === true → cache puis BLE forcé.
  const reload = msg.data.reload;

  const cached = manager.getPersistedOperationLog(address);

  if (reload === false) {
    // Vue ouverte : cache seul, pas de BLE. On répond TOUJOURS (même cache vide)
    // pour débloquer le spinner côté frontend (setOperations met waitingOperations=false).
    api.sendOperationLog(address, cached);
    return;
  }

  if (cached.length) api.sendOperationLog(address, cached);

  const fresh = await manager.getOperationLog(address, true);
  if (Array.isArray(fresh)) {
    // Fusion cache ∪ BLE par recordNumber : une lecture BLE partielle (cache SDK
    // incomplet / lecture interrompue) ne doit pas RÉDUIRE le journal déjà affiché.
    api.sendOperationLog(address, mergeOperationsByRecord(cached, fresh));
    return;
  }
  // BLE échoué
  if (!cached.length) {
    api.sendOperationLog(address, []); // débloque le spinner (setOperations)
    api.sendError('Failed getting operation log', msg);
  }
  // cache présent → silencieux (choix utilisateur)
}

async function handleRename(wss, msg) {
  if (!msg.data?.address || typeof msg.data.name !== 'string') return;
  const address = msg.data.address;
  // Custom names are a local alias (the SDK cannot write a name to the lock).
  // An empty name clears the alias and reverts to the BLE-advertised name.
  const name = msg.data.name.trim().slice(0, 64);
  if (name) {
    store.setLockAlias(address, name);
  } else {
    store.deleteLockAlias(address);
  }
  WsApi.sendStatus(wss);
}

async function handleUnpair(api, msg) {
  if (!msg.data?.address) return;
  const res = await manager.resetLock(msg.data.address);
  if (!res) api.sendError('Failed to unpair lock', msg);
}

async function handleRestartGateway(api) {
  const success = await manager.restartGateway();
  api.sendGatewayRestart(success);
}

async function handleRebootEsp32(api) {
  const success = await manager.rebootEsp32();
  api.sendEsp32Reboot(success);
}

// ── main message dispatcher ──────────────────────────────────────────────────

async function onMessage(wss, api, ws, message) {
  const msg = new Message(message);
  if (!msg.isValid()) return;

  switch (msg.type) {
    case 'status':
      WsApi.sendStatus(wss);
      break;
    case 'scan':
      manager.startScan();
      break;
    case 'pair':
      await handlePair(wss, msg);
      break;
    case 'lock':
      await handleLockOrUnlock(wss, msg, (addr) => manager.lockLock(addr));
      break;
    case 'unlock':
      await handleLockOrUnlock(wss, msg, (addr) => manager.unlockLock(addr));
      break;
    case 'credentials':
      await handleCredentials(api, ws, msg);
      break;
    case 'passcode':
      await handlePasscode(api, ws, msg);
      break;
    case 'card':
      await handleCard(api, ws, msg);
      break;
    case 'finger':
      await handleFinger(api, ws, msg);
      break;
    case 'settings':
      await handleSettings(api, msg);
      break;
    case 'config':
      await handleConfig(api, msg);
      break;
    case 'operations':
      await handleOperations(api, msg);
      break;
    case 'rename':
      await handleRename(wss, msg);
      break;
    case 'unpair':
      await handleUnpair(api, msg);
      break;
    case 'restartGateway':
      await handleRestartGateway(api);
      break;
    case 'rebootEsp32':
      await handleRebootEsp32(api);
      break;
  }
}

// ── export ───────────────────────────────────────────────────────────────────

export default async function initApi(server) {
  const wss = new WebSocket.Server({ server, path: '/api' });

  async function sendStatusUpdate() {
    WsApi.sendStatus(wss);
  }

  // Debounce per-lock status broadcasts: a burst of rapid events (lockUnlock +
  // lockUpdated + battery) for the same lock collapses into a single broadcast
  // after a 50 ms quiet window. fromTTLock() reads current state at fire time,
  // so the broadcast always reflects the latest values.
  const _lockUpdateTimers = new Map();
  function sendLockStatusUpdate(lock) {
    const address = lock.getAddress?.() || '';
    if (!address) {
      WsApi.sendLockStatus(wss, lock);
      return;
    }
    if (_lockUpdateTimers.has(address)) clearTimeout(_lockUpdateTimers.get(address));
    _lockUpdateTimers.set(address, setTimeout(() => {
      _lockUpdateTimers.delete(address);
      WsApi.sendLockStatus(wss, lock);
    }, 50));
  }

  manager.on('lockListChanged', sendStatusUpdate);
  manager.on('lockPaired', sendStatusUpdate);
  manager.on('lockConnected', sendLockStatusUpdate);
  manager.on('lockLock', sendLockStatusUpdate);
  manager.on('lockUnlock', sendLockStatusUpdate);
  manager.on('lockUpdated', sendLockStatusUpdate);
  manager.on('scanStart', sendStatusUpdate);
  manager.on('scanStop', sendStatusUpdate);
  manager.on('adapterReady', sendStatusUpdate);
  manager.on('gatewayStatusChanged', sendStatusUpdate);

  wss.on('connection', (ws) => {
    const api = new WsApi(ws);

    ws.on('message', async (message) => onMessage(wss, api, ws, message));

    async function sendLockCardScan(lock) {
      api.sendCardScan(lock.getAddress());
    }
    async function sendLockFingerScan(lock) {
      api.sendFingerScan(lock.getAddress());
    }
    async function sendLockFingerScanProgress(lock) {
      api.sendFingerScanProgress(lock.getAddress());
    }

    manager.on('lockCardScan', sendLockCardScan);
    manager.on('lockFingerScan', sendLockFingerScan);
    manager.on('lockFingerScanProgress', sendLockFingerScanProgress);

    ws.on('close', async () => {
      manager.off('lockCardScan', sendLockCardScan);
      manager.off('lockFingerScan', sendLockFingerScan);
      manager.off('lockFingerScanProgress', sendLockFingerScanProgress);
    });

    WsApi.sendStatus(wss);
  });
}
