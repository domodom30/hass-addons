import { promises as fs } from 'node:fs';

class Store {
  settingsPath = '/data';
  lockData = [];
  aliasData = { lock: {}, card: {}, finger: {} };
  /** @type {Object.<string, {firmwareRevision?: string, modelNum?: string, hardwareRevision?: string, factoryDate?: string}>} */
  deviceInfoData = {};

  setDataPath(path) {
    this.settingsPath = path;
  }

  getDataPath() {
    return this.settingsPath;
  }

  /**
   * Returns true if a lockData entry carries complete admin credentials.
   * Mirrors the SDK's TTLock.isPaired() so a degraded entry (emitted during a
   * failed connect or a spurious lockReset) is recognised and never allowed to
   * overwrite good credentials on disk.
   * @param {any} entry
   */
  _isPairedEntry(entry) {
    const pd = entry && entry.privateData;
    return !!(pd && pd.aesKey && pd.admin && pd.admin.adminPs && pd.admin.unlockKey);
  }

  setLockData(newData) {
    const incoming = Array.isArray(newData) ? newData : [];
    // Guard against credential loss: the SDK emits updatedLockData on both
    // dataUpdated AND lockReset, and an entry observed mid-failed-connect can
    // be missing its admin block. Without this check a single degraded emit
    // would overwrite lockData.json and permanently break checkAdmin.
    const prevByAddress = new Map();
    for (const entry of this.lockData) {
      if (entry && entry.address) prevByAddress.set(entry.address, entry);
    }
    this.lockData = incoming.map((entry) => {
      if (this._isPairedEntry(entry)) return entry;
      const prev = entry && entry.address ? prevByAddress.get(entry.address) : undefined;
      if (prev && this._isPairedEntry(prev)) {
        console.warn(`Refusing to persist degraded lockData for ${entry && entry.address} — keeping previous credentials`);
        return prev;
      }
      // No valid prior entry (e.g. a brand-new lock still mid-pairing) — keep as-is.
      return entry;
    });
    this.saveData();
  }

  getLockData() {
    return this.lockData;
  }

  setLockAlias(address, alias) {
    this.aliasData.lock[address] = alias;
    this.saveData();
  }

  getLockAlias(address, defaultValue = false) {
    return Object.hasOwn(this.aliasData.lock, address) ? this.aliasData.lock[address] : defaultValue;
  }

  deleteLockAlias(address) {
    if (Object.hasOwn(this.aliasData.lock, address)) {
      delete this.aliasData.lock[address];
      this.saveData();
    }
  }

  setCardAlias(card, alias) {
    if (alias !== undefined && alias !== '') {
      this.aliasData.card[card] = alias;
      this.saveData();
    }
  }

  getCardAlias(card) {
    return Object.hasOwn(this.aliasData.card, card) ? this.aliasData.card[card] : card;
  }

  deleteCardAlias(card) {
    delete this.aliasData.card[card];
    this.saveData();
  }

  setFingerAlias(finger, alias) {
    this.aliasData.finger[finger] = alias;
    this.saveData();
  }

  getFingerAlias(finger) {
    return Object.hasOwn(this.aliasData.finger, finger) ? this.aliasData.finger[finger] : finger;
  }

  deleteFingerAlias(finger) {
    delete this.aliasData.finger[finger];
    this.saveData();
  }

  /**
   * Return the full aliasData object (used for export).
   * @returns {{ lock: Object, card: Object, finger: Object }}
   */
  getAliasData() {
    return this.aliasData;
  }

  /**
   * Replace the entire aliasData with the provided object and persist.
   * Unknown/extra keys are ignored; missing sections default to {}.
   * @param {{ lock?: Object, card?: Object, finger?: Object }} data
   */
  importAliasData(data) {
    this.aliasData = {
      lock: (typeof data.lock === 'object' && data.lock !== null) ? data.lock : {},
      card: (typeof data.card === 'object' && data.card !== null) ? data.card : {},
      finger: (typeof data.finger === 'object' && data.finger !== null) ? data.finger : {}
    };
    this.saveData();
  }

  /**
   * Save the deviceInfo for a lock (persists firmware revision etc.)
   * @param {string} address Lock MAC address
   * @param {Object} deviceInfo deviceInfo object from TTLock.deviceInfo
   */
  setDeviceInfo(address, deviceInfo) {
    if (address && deviceInfo) {
      this.deviceInfoData[address] = deviceInfo;
      this.saveData();
    }
  }

  /**
   * Get the persisted deviceInfo for a lock
   * @param {string} address Lock MAC address
   * @returns {Object|undefined}
   */
  getDeviceInfo(address) {
    return this.deviceInfoData[address];
  }

  /**
   * Persist the last-known BLE-advertised name for a lock. The SDK only exposes
   * the GATT device name (2a00) while connected; caching it here lets the offline
   * serialization path (Lock.fromStoreEntry) show the real name instead of the MAC.
   * Only triggers a disk write when the value actually changed.
   * @param {string} address Lock MAC address
   * @param {string} name BLE-advertised name
   */
  setLockName(address, name) {
    if (!address || !name) return;
    if (!this.deviceInfoData[address]) this.deviceInfoData[address] = {};
    if (this.deviceInfoData[address].name === name) return;
    this.deviceInfoData[address].name = name;
    this.saveData();
  }

  /**
   * Get the persisted BLE name for a lock
   * @param {string} address Lock MAC address
   * @returns {string|undefined}
   */
  getLockName(address) {
    return this.deviceInfoData[address]?.name;
  }

  /**
   * Save feature flags for a lock (hasAutoLock, hasPasscode, etc.)
   * Only triggers a disk write when something actually changed.
   * @param {string} address Lock MAC address
   * @param {{ hasAutoLock: boolean, hasPasscode: boolean, hasCard: boolean, hasFinger: boolean, hasAudio: boolean }} features
   */
  setLockFeatures(address, features) {
    if (!address || !features) return;
    if (!this.deviceInfoData[address]) this.deviceInfoData[address] = {};
    const prev = this.deviceInfoData[address].features;
    if (prev &&
      prev.hasAutoLock === features.hasAutoLock &&
      prev.hasPasscode === features.hasPasscode &&
      prev.hasCard === features.hasCard &&
      prev.hasFinger === features.hasFinger &&
      prev.hasAudio === features.hasAudio) return;
    this.deviceInfoData[address].features = features;
    this.saveData();
  }

  /**
   * Get persisted feature flags for a lock
   * @param {string} address Lock MAC address
   * @returns {{ hasAutoLock: boolean, hasPasscode: boolean, hasCard: boolean, hasFinger: boolean, hasAudio: boolean }|undefined}
   */
  getLockFeatures(address) {
    return this.deviceInfoData[address]?.features;
  }

  /**
   * Persist the highest operation log recordNumber already processed for a lock.
   * Used by _processOperationLog to avoid re-emitting stale operations that the
   * firmware keeps returning (e.g. DOOR_SENSOR events never acknowledged by cloud).
   * @param {string} address Lock MAC address
   * @param {number} recordNumber
   */
  setLastProcessedRecord(address, recordNumber) {
    if (!address || typeof recordNumber !== 'number') return;
    if (!this.deviceInfoData[address]) this.deviceInfoData[address] = {};
    if (this.deviceInfoData[address].lastProcessedRecord === recordNumber) return; // no-op
    this.deviceInfoData[address].lastProcessedRecord = recordNumber;
    this.saveData();
  }

  /**
   * @param {string} address Lock MAC address
   * @returns {number} last processed recordNumber, or 0 if unknown
   */
  getLastProcessedRecord(address) {
    return this.deviceInfoData[address]?.lastProcessedRecord || 0;
  }

  async loadData() {
    try {
      await fs.access(this.settingsPath + '/lockData.json');
      const lockDataTxt = (await fs.readFile(this.settingsPath + '/lockData.json')).toString();
      const parsed = JSON.parse(lockDataTxt);
      this.lockData = Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      this.lockData = [];
      if (error.code !== 'ENOENT') {
        console.error(error);
      }
    }
    try {
      await fs.access(this.settingsPath + '/aliasData.json');
      const aliasDataTxt = (await fs.readFile(this.settingsPath + '/aliasData.json')).toString();
      this.aliasData = JSON.parse(aliasDataTxt);
    } catch (error) {
      this.aliasData = {
        lock: {},
        card: {},
        finger: {}
      };
      if (error.code !== 'ENOENT') {
        console.error(error);
      }
    }

    try {
      await fs.access(this.settingsPath + '/deviceInfoData.json');
      const deviceInfoDataTxt = (await fs.readFile(this.settingsPath + '/deviceInfoData.json')).toString();
      this.deviceInfoData = JSON.parse(deviceInfoDataTxt);
    } catch (error) {
      this.deviceInfoData = {};
      if (error.code !== 'ENOENT') {
        console.error(error);
      }
    }

    return this.lockData;
  }

  async fileDataRename(src, dest) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await fs.rename(src, dest);
        return;
      } catch (err) {
        if (err.code === 'EPERM' && attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, 100 * attempt));
        } else {
          throw err;
        }
      }
    }
  }

  async saveData() {
    // Sérialise les écritures : les appels fire-and-forget concurrents (setLockData,
    // setDeviceInfo, setLockFeatures, alias…) ne doivent jamais se disputer le même nom
    // de .tmp, sinon le premier rename consomme le fichier et les suivants tombent sur
    // ENOENT. La coalescence fusionne les rafales — chaque _doSaveData() relit l'état
    // mémoire courant à son exécution, donc on persiste toujours la version la plus récente.
    this._savePending = true;
    if (this._saving) return this._saveChain;
    this._saving = true;
    this._saveChain = (async () => {
      try {
        while (this._savePending) {
          this._savePending = false;
          await this._doSaveData();
        }
      } finally {
        this._saving = false;
      }
    })();
    return this._saveChain;
  }

  async _doSaveData() {
    try {
      const lockPath = this.settingsPath + '/lockData.json';
      const tmpLock = lockPath + '.tmp';
      // Keep one generation of backup so credentials are recoverable if a
      // degraded write ever slips through (manual restore of lockData.json.bak).
      try {
        await fs.copyFile(lockPath, lockPath + '.bak');
      } catch (error) {
        if (error.code !== 'ENOENT') console.warn('lockData.json backup failed:', error.message);
      }
      // Prune operationLog to the 300 most recent entries before writing — in-memory
      // lockData stays intact so the SDK's sequence-number tracking is unaffected.
      const MAX_OPLOG = 300;
      const lockDataToSave = this.lockData.map((entry) => {
        if (!entry || !Array.isArray(entry.operationLog) || entry.operationLog.length <= MAX_OPLOG) return entry;
        const pruned = entry.operationLog
          .filter(Boolean)
          .sort((a, b) => {
            if (b.operateDate !== a.operateDate) return (b.operateDate || 0) - (a.operateDate || 0);
            return (b.recordNumber || 0) - (a.recordNumber || 0);
          })
          .slice(0, MAX_OPLOG);
        return { ...entry, operationLog: pruned };
      });
      await fs.writeFile(tmpLock, Buffer.from(JSON.stringify(lockDataToSave)));
      await this.fileDataRename(tmpLock, lockPath);
    } catch (error) {
      console.error(error);
    }
    try {
      const tmpAlias = this.settingsPath + '/aliasData.json.tmp';
      await fs.writeFile(tmpAlias, Buffer.from(JSON.stringify(this.aliasData)));
      await this.fileDataRename(tmpAlias, this.settingsPath + '/aliasData.json');
    } catch (error) {
      console.error(error);
    }
    try {
      const tmpDeviceInfo = this.settingsPath + '/deviceInfoData.json.tmp';
      // S'assurer que le répertoire existe avant d'écrire (utile en dev ou premier démarrage).
      await fs.mkdir(this.settingsPath, { recursive: true }).catch((mkdirErr) => {
        if (mkdirErr.code !== 'EEXIST') console.warn('deviceInfoData mkdir failed:', mkdirErr.message);
      });
      try {
        await fs.writeFile(tmpDeviceInfo, Buffer.from(JSON.stringify(this.deviceInfoData)));
      } catch (writeErr) {
        console.error('deviceInfoData writeFile failed:', writeErr.message);
        throw writeErr;
      }
      await this.fileDataRename(tmpDeviceInfo, this.settingsPath + '/deviceInfoData.json');
    } catch (error) {
      console.error('deviceInfoData save error:', error.message);
    }
  }
}

const store = new Store();

export default store;
