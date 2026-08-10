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

  /**
   * Persist the operateDate (compact YYYYMMDDHHmmss) of the last operation already
   * processed for a lock. C'est le critère de nouveauté PRINCIPAL : le journal firmware
   * est circulaire, donc `recordNumber` finit par repartir sur des index bas et ne peut
   * pas servir seul de seuil (cf. _processOperationLog). La date, elle, reste monotone.
   * @param {string} address Lock MAC address
   * @param {number} operateDate
   */
  setLastProcessedDate(address, operateDate) {
    if (!address || typeof operateDate !== 'number') return;
    if (!this.deviceInfoData[address]) this.deviceInfoData[address] = {};
    if (this.deviceInfoData[address].lastProcessedDate === operateDate) return; // no-op
    this.deviceInfoData[address].lastProcessedDate = operateDate;
    this.saveData();
  }

  /**
   * @param {string} address Lock MAC address
   * @returns {number} last processed operateDate, or 0 if unknown
   */
  getLastProcessedDate(address) {
    return this.deviceInfoData[address]?.lastProcessedDate || 0;
  }

  /**
   * Persist the recordNumber of the last operation published to MQTT for the
   * given sensor kind ('op' = last_operation, 'unlock' = last_access). Persisting
   * (rather than an in-memory Map) prevents re-publishing — and thus re-triggering
   * HA automations — after an addon restart, since retained messages already hold
   * the current value.
   * @param {string} address Lock MAC address
   * @param {'op'|'unlock'} kind
   * @param {number|null} recordNumber
   */
  setLastPublishedRecord(address, kind, recordNumber) {
    if (!address || (kind !== 'op' && kind !== 'unlock')) return;
    if (!this.deviceInfoData[address]) this.deviceInfoData[address] = {};
    if (!this.deviceInfoData[address].lastPublished) this.deviceInfoData[address].lastPublished = {};
    if (this.deviceInfoData[address].lastPublished[kind] === recordNumber) return; // no-op
    this.deviceInfoData[address].lastPublished[kind] = recordNumber;
    this.saveData();
  }

  /**
   * @param {string} address Lock MAC address
   * @param {'op'|'unlock'} kind
   * @returns {number|null|undefined} last published recordNumber for this kind
   */
  getLastPublishedRecord(address, kind) {
    return this.deviceInfoData[address]?.lastPublished?.[kind];
  }

  /** Forget the published-record bookkeeping for a lock (called on unpair). */
  clearPublishedRecords(address) {
    if (this.deviceInfoData[address]?.lastPublished) {
      delete this.deviceInfoData[address].lastPublished;
      this.saveData();
    }
  }

  /**
   * Nombre maximum d'opérations conservées dans le journal persisté (les plus récentes).
   * Le tableau en mémoire reste complet : cette borne ne s'applique qu'à l'écriture disque.
   * Configurable via l'option addon `max_oplog` (env MAX_OPLOG) ; défaut 300.
   *
   * Conséquence à garder en tête : le cache mémoire peut contenir des milliers d'entrées
   * dont l'index maximum reste bloqué sur la fin de l'anneau firmware, alors que le
   * journal relu du disque redémarre sur les seuls MAX_OPLOG plus récents. Aucune logique
   * de nouveauté ne doit donc dépendre de `Math.max(recordNumber)` : c'est exactement ce
   * qui rendait l'addon aveugle après un tour complet du journal circulaire (cf. oplog.js).
   */
  static MAX_OPLOG = parseInt(process.env.MAX_OPLOG, 10) > 0 ? parseInt(process.env.MAX_OPLOG, 10) : 300;

  /**
   * Densifie un journal d'opérations pour l'écriture disque : retire les trous/`null`
   * (le SDK stocke operationLog comme un tableau creux indexé par recordNumber, donc
   * JSON.stringify sème des `null` pour chaque recordNumber non lu), trie du plus récent
   * au plus ancien (operateDate desc, puis recordNumber desc) et borne aux MAX_OPLOG
   * entrées les plus récentes. Fonction pure — aucun effet de bord.
   * @param {Array} operationLog
   * @returns {Array} tableau dense trié, borné à MAX_OPLOG
   */
  _denseOperationLog(operationLog) {
    return operationLog
      .filter(Boolean)
      .sort((a, b) => {
        if (b.operateDate !== a.operateDate) return (b.operateDate || 0) - (a.operateDate || 0);
        return (b.recordNumber || 0) - (a.recordNumber || 0);
      })
      .slice(0, Store.MAX_OPLOG);
  }

  /**
   * Reconstruit un tableau creux indexé par recordNumber à partir du journal dense lu
   * du fichier. Le SDK dépend de cette indexation (`operationLog[recordNumber]`) pour son
   * cache : sans elle, il re-scanne tout le journal au redémarrage. Les entrées sans
   * recordNumber numérique sont ignorées. Une entrée sans operationLog valide est renvoyée
   * telle quelle. Fonction pure — aucun effet de bord.
   * @param {any} entry
   * @returns {any}
   */
  _reindexOperationLog(entry) {
    if (!entry || !Array.isArray(entry.operationLog)) return entry;
    const sparse = [];
    for (const op of entry.operationLog) {
      if (op && typeof op.recordNumber === 'number') sparse[op.recordNumber] = op;
    }
    return { ...entry, operationLog: sparse };
  }

  async loadData() {
    try {
      await fs.access(this.settingsPath + '/lockData.json');
      const lockDataTxt = (await fs.readFile(this.settingsPath + '/lockData.json')).toString();
      const parsed = JSON.parse(lockDataTxt);
      // Ré-indexe operationLog par recordNumber : le fichier est dense (sans null) mais le
      // SDK attend un tableau creux indexé par recordNumber (cf. _reindexOperationLog).
      this.lockData = (Array.isArray(parsed) ? parsed : []).map((entry) => this._reindexOperationLog(entry));
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
      // Densifie operationLog avant écriture : le tableau en mémoire est creux (indexé par
      // recordNumber côté SDK), donc JSON.stringify sèmerait un `null` par recordNumber non
      // lu. On densifie TOUJOURS (pas seulement au-delà de 300) pour que le fichier ne
      // contienne aucun `null`, tout en bornant aux 300 opérations les plus récentes.
      // In-memory lockData stays intact so the SDK's sequence-number tracking is unaffected.
      const lockDataToSave = this.lockData.map((entry) => {
        if (!entry || !Array.isArray(entry.operationLog)) return entry;
        return { ...entry, operationLog: this._denseOperationLog(entry.operationLog) };
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
