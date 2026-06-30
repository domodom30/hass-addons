import store from '../src/store.js';
import manager from '../src/manager.js';

class Lock {
  /** @type {string} MAC address */
  address;
  /** @type {number} Signal strength */
  rssi;
  /** @type {number} Battery level */
  battery;
  /** @type {string} Assigned name */
  name;
  /** @type {boolean} If the lock is paired or not */
  paired;
  /** @type {boolean} If the lock is connected or not */
  connected;
  /** @type {import('ttlock-sdk-js').LockedStatus} If the lock is locked or not, -1 unknown, 0 locked, 1 unlocked */
  locked;
  /** @type {number} The number of seconds the lock will auto lock after being unlocked */
  autoLockTime;
  /** @type {boolean} If the lock's audio is enabled or not */
  audio;
  /** @type {boolean} If the lock has auto-lock feature */
  hasAutoLock;
  /** @type {boolean} If the lock has a keypad and supports passcodes (PIN) */
  hasPasscode;
  /** @type {boolean} If the lock has card reader support */
  hasCard;
  /** @type {boolean} If the lock has fingerprint reader support */
  hasFinger;
  /** @type {boolean} If the lock has audio management */
  hasAudio;
  /** @type {string} Lock model */
  model;
  /** @type {string} Firmware version */
  firmware;
  /** @type {string} Manufacturer */
  manufacturer;

  /**
   * @param {import('ttlock-sdk-js').TTLock} lockObject
   * @param {string} address
   * @returns {number|undefined}
   */
  static _resolveAutoLockTime(lockObject, address) {
    // Cache-only: fromTTLock runs on every status broadcast and must NEVER touch the BLE
    // bus (see fromTTLock). The cache is populated by the mutex-guarded calibrate flow
    // (manager._tryCalibrateTime). undefined => not yet known.
    return manager.getCachedAutoLock(address);
  }

  /**
   * @param {import('ttlock-sdk-js').TTLock} lockObject
   * @param {string} address
   * @returns {boolean|undefined}
   */
  static _resolveAudio(lockObject, address) {
    // Cache-only: fromTTLock runs on every status broadcast and must NEVER touch the BLE
    // bus (see fromTTLock). Issuing getLockSound() here fired an un-serialized
    // audioManageCommand outside the global radio mutex, racing with macro_adminLogin and
    // causing "No response to checkAdmin" / "No response to get audioManage". The cache is
    // populated by the mutex-guarded flows (manager.getAudio / setAudio). undefined => not yet known.
    return manager.getCachedAudio(address);
  }

  /**
   * @param {import('ttlock-sdk-js').TTLock} lockObject
   * @param {string} address
   * @returns {{ model: string, firmware: string, manufacturer: string }}
   */
  static _resolveDeviceInfo(lockObject, address) {
    const deviceInfo = lockObject.deviceInfo || store.getDeviceInfo(address);
    const model = lockObject.getModel();
    const firmware = lockObject.getFirmware();
    const manufacturer = lockObject.getManufacturer();
    return {
      model: model && model !== 'unknown' ? model : deviceInfo?.modelNum || '',
      firmware: firmware && firmware !== 'unknown' ? firmware : deviceInfo?.firmwareRevision || '',
      manufacturer: manufacturer && manufacturer !== 'unknown' ? manufacturer : ''
    };
  }

  /**
   * Build a Lock from a persisted lockData.json entry, WITHOUT any BLE.
   * Used so paired locks remain visible (and their cached operation log
   * reachable) even when the lock is not currently advertising / the
   * gateway is offline. Capabilities are unknown offline → false; the UI
   * still exposes the operations action.
   * @param {Object} entry store.getLockData() entry
   * @returns {Lock}
   */
  static fromStoreEntry(entry) {
    const lock = new Lock();
    const address = entry.address;
    const deviceInfo = store.getDeviceInfo(address);

    lock.address = address;
    lock.name = store.getLockAlias(address) || store.getLockName(address) || address;
    lock.paired = true;
    lock.connected = false;
    lock.rssi = typeof entry.rssi === 'number' ? entry.rssi : -1;
    lock.battery = typeof entry.battery === 'number' ? entry.battery : -1;
    lock.locked = typeof entry.lockedStatus === 'number' ? entry.lockedStatus : -1;
    lock.autoLockTime = typeof entry.autoLockTime === 'number' ? entry.autoLockTime : -1;
    const features = store.getLockFeatures(address);
    lock.hasAutoLock = features?.hasAutoLock ?? false;
    lock.hasPasscode = features?.hasPasscode ?? false;
    lock.hasCard = features?.hasCard ?? false;
    lock.hasFinger = features?.hasFinger ?? false;
    lock.hasAudio = features?.hasAudio ?? false;
    lock.audio = manager.getCachedAudio(address) ?? false;
    lock.model = deviceInfo?.modelNum || '';
    lock.firmware = deviceInfo?.firmwareRevision || '';
    lock.manufacturer = '';

    return lock;
  }

  /**
   *
   * @param {import('ttlock-sdk-js').TTLock} lockObject
   */
  static async fromTTLock(lockObject) {
    const lock = new Lock();

    lock.address = lockObject.getAddress();
    // The BLE name (GATT 2a00) is only available while connected. Persist it so the
    // offline path (fromStoreEntry) keeps showing the real name instead of the MAC.
    const bleName = lockObject.getName();
    if (bleName) store.setLockName(lock.address, bleName);
    lock.name = store.getLockAlias(lock.address) || bleName || store.getLockName(lock.address) || lock.address;
    lock.paired = lockObject.isPaired();
    lock.connected = lockObject.isConnected();
    lock.rssi = lockObject.getRssi();
    lock.battery = lockObject.getBattery();

    try {
      lock.locked = await lockObject.getLockStatus();
    } catch {
      // lock in pairing mode
    }

    // STRICTLY non-BLE from here on: this method runs on every status broadcast and must
    // NEVER touch the BLE bus, otherwise it races with user ops (=> "Command already in progress").
    lock.autoLockTime = Lock._resolveAutoLockTime(lockObject, lock.address);
    lock.audio = Lock._resolveAudio(lockObject, lock.address);

    lock.hasAutoLock = lockObject.hasAutolock();
    lock.hasPasscode = lockObject.hasPassCode();
    lock.hasCard = lockObject.hasICCard();
    lock.hasFinger = lockObject.hasFingerprint();
    lock.hasAudio = lockObject.hasLockSound();

    const info = Lock._resolveDeviceInfo(lockObject, lock.address);
    lock.model = info.model;
    lock.firmware = info.firmware;
    lock.manufacturer = info.manufacturer;

    return lock;
  }
}

export default Lock;
