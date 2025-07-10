'use strict';

const EventEmitter = require('events');
const store = require("./store");
const { TTLockClient, AudioManage, LockedStatus, LogOperateCategory, LogOperateNames } = require("ttlock-sdk-js");

// ======= Add this utility =======
/**
 * Runs a promise with a timeout, and throws if timeout exceeded.
 */
async function runWithTimeout(promise, ms, description = "operation") {
  let timeout;
  const timeoutPromise = new Promise((_, reject) => {
    timeout = setTimeout(() => reject(new Error(`${description} timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeout);
  }
}
// ================================

const ScanType = Object.freeze({
  NONE: 0,
  AUTOMATIC: 1,
  MANUAL: 2
});

const SCAN_MAX = 3;

async function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

class Manager extends EventEmitter {
  constructor() {
    super();
    this.startupStatus = -1;
    this.client = undefined;
    this.scanning = false;
    this.scanTimer = undefined;
    this.scanCounter = 0;
    this.pairedLocks = new Map();
    this.newLocks = new Map();
    this.connectQueue = new Set();
    this.gateway = 'none';
    this.gateway_host = "";
    this.gateway_port = 0;
    this.gateway_key = "";
    this.gateway_user = "";
    this.gateway_pass = "";
  }

  async init() {
    if (typeof this.client == "undefined") {
      try {
        let clientOptions = {}
        if (this.gateway == "noble") {
          clientOptions.scannerType = "noble-websocket";
          clientOptions.scannerOptions = {
            websocketHost: this.gateway_host,
            websocketPort: this.gateway_port,
            websocketAesKey: this.gateway_key,
            websocketUsername: this.gateway_user,
            websocketPassword: this.gateway_pass
          }
        }
        this.client = new TTLockClient(clientOptions);
        this.updateClientLockDataFromStore();

        this.client.on("ready", () => {
          this.client.startMonitor();
        });
        this.client.on("foundLock", this._onFoundLock.bind(this));
        this.client.on("scanStart", this._onScanStarted.bind(this));
        this.client.on("scanStop", this._onScanStopped.bind(this));
        this.client.on("monitorStart", () => console.log("Monitor started"));
        this.client.on("monitorStop", () => console.log("Monitor stopped"));
        this.client.on("updatedLockData", this._onUpdatedLockData.bind(this));
        const adapterReady = await this.client.prepareBTService();
        if (adapterReady) {
          this.startupStatus = 0;
        } else {
          this.startupStatus = 1;
        }
      } catch (error) {
        console.log(error);
        this.startupStatus = 1;
      }
    }
  }

  updateClientLockDataFromStore() {
    const lockData = store.getLockData();
    this.client.setLockData(lockData);
  }

  setNobleGateway(gateway_host, gateway_port, gateway_key, gateway_user, gateway_pass) {
    this.gateway = "noble";
    this.gateway_host = gateway_host;
    this.gateway_port = gateway_port;
    this.gateway_key = gateway_key;
    this.gateway_user = gateway_user;
    this.gateway_pass = gateway_pass;
  }

  getStartupStatus() {
    return this.startupStatus;
  }

  async startScan() {
    if (!this.scanning) {
      await this.client.stopMonitor();
      const res = await this.client.startScanLock();
      if (res == true) {
        this._scanTimer();
      }
      return res;
    }
    return false;
  }

  async stopScan() {
    if (this.scanning) {
      if (typeof this.scanTimer != "undefined") {
        clearTimeout(this.scanTimer);
        this.scanTimer = undefined;
      }
      return await this.client.stopScanLock();
    }
    return false;
  }

  getIsScanning() {
    return this.scanning;
  }

  getPairedVisible() {
    return this.pairedLocks;
  }

  getNewVisible() {
    return this.newLocks;
  }

  async initLock(address) {
    const lock = this.newLocks.get(address);
    if (typeof lock != "undefined") {
      if (!(await this._connectLock(lock))) {
        return false;
      }
      try {
        let res = await runWithTimeout(lock.initLock(), 10000, "initLock");
        if (res != false) {
          this.pairedLocks.set(lock.getAddress(), lock);
          this.newLocks.delete(lock.getAddress());
          this._bindLockEvents(lock);
          this.emit("lockPaired", lock);
          return true;
        }
        return false;
      } catch (error) {
        console.warn("initLock error:", error);
        try { await lock.disconnect(); } catch (e) {}
        return false;
      }
    }
    return false;
  }

  async unlockLock(address) {
    const lock = this.pairedLocks.get(address);
    if (typeof lock != "undefined") {
      if (!(await this._connectLock(lock))) {
        return false;
      }
      try {
        const res = await runWithTimeout(lock.unlock(), 8000, "unlock");
        return res;
      } catch (error) {
        console.warn("unlockLock error:", error);
        try { await lock.disconnect(); } catch (e) {}
        return false;
      }
    }
    return false;
  }

  async lockLock(address) {
    const lock = this.pairedLocks.get(address);
    if (typeof lock != "undefined") {
      if (!(await this._connectLock(lock))) {
        return false;
      }
      try {
        const res = await runWithTimeout(lock.lock(), 8000, "lock");
        return res;
      } catch (error) {
        console.warn("lockLock error:", error);
        try { await lock.disconnect(); } catch (e) {}
        return false;
      }
    }
    return false;
  }

  async setAutoLock(address, value) {
    const lock = this.pairedLocks.get(address);
    if (typeof lock != "undefined") {
      if (!(await this._connectLock(lock))) {
        return false;
      }
      try {
        const res = await runWithTimeout(lock.setAutoLockTime(value), 8000, "setAutoLockTime");
        this.emit("lockUpdated", lock);
        return res;
      } catch (error) {
        console.warn("setAutoLock error:", error);
        try { await lock.disconnect(); } catch (e) {}
        return false;
      }
    }
    return false;
  }

  async getCredentials(address) {
    const passcodes = await this.getPasscodes(address);
    const cards = await this.getCards(address);
    const fingers = await this.getFingers(address);
    return {
      passcodes: passcodes,
      cards: cards,
      fingers: fingers
    };
  }

  async addPasscode(address, type, passCode, startDate, endDate) {
    const lock = this.pairedLocks.get(address);
    if (typeof lock != "undefined") {
      if (!lock.hasPassCode()) {
        return false;
      }
      if (!(await this._connectLock(lock))) {
        return false;
      }
      try {
        const res = await runWithTimeout(
          lock.addPassCode(type, passCode, startDate, endDate), 10000, "addPassCode");
        return res;
      } catch (error) {
        console.warn("addPasscode error:", error);
        try { await lock.disconnect(); } catch (e) {}
        return false;
      }
    }
    return false;
  }

  async updatePasscode(address, type, oldPasscode, newPasscode, startDate, endDate) {
    const lock = this.pairedLocks.get(address);
    if (typeof lock != "undefined") {
      if (!lock.hasPassCode()) {
        return false;
      }
      if (!(await this._connectLock(lock))) {
        return false;
      }
      try {
        const res = await runWithTimeout(
          lock.updatePassCode(type, oldPasscode, newPasscode, startDate, endDate), 10000, "updatePassCode");
        return res;
      } catch (error) {
        console.warn("updatePasscode error:", error);
        try { await lock.disconnect(); } catch (e) {}
        return false;
      }
    }
    return false;
  }

  async deletePasscode(address, type, passCode) {
    const lock = this.pairedLocks.get(address);
    if (typeof lock != "undefined") {
      if (!lock.hasPassCode()) {
        return false;
      }
      if (!(await this._connectLock(lock))) {
        return false;
      }
      try {
        const res = await runWithTimeout(
          lock.deletePassCode(type, passCode), 8000, "deletePassCode");
        return res;
      } catch (error) {
        console.warn("deletePasscode error:", error);
        try { await lock.disconnect(); } catch (e) {}
        return false;
      }
    }
    return false;
  }

  async getPasscodes(address) {
    const lock = this.pairedLocks.get(address);
    if (typeof lock != "undefined") {
      if (!lock.hasPassCode()) {
        return false;
      }
      if (!(await this._connectLock(lock))) {
        return false;
      }
      try {
        const passcodes = await runWithTimeout(
          lock.getPassCodes(), 8000, "getPassCodes");
        return passcodes;
      } catch (error) {
        console.warn("getPasscodes error:", error);
        try { await lock.disconnect(); } catch (e) {}
        return false;
      }
    }
    return false;
  }

  async addCard(address, startDate, endDate, alias) {
    const lock = this.pairedLocks.get(address);
    if (typeof lock != "undefined") {
      if (!lock.hasICCard()) {
        return false;
      }
      if (!(await this._connectLock(lock))) {
        return false;
      }
      try {
        const card = await runWithTimeout(
          lock.addICCard(startDate, endDate), 12000, "addICCard");
        store.setCardAlias(card, alias);
        return card;
      } catch (error) {
        console.warn("addCard error:", error);
        try { await lock.disconnect(); } catch (e) {}
        return false;
      }
    }
    return false;
  }

  async updateCard(address, card, startDate, endDate, alias) {
    const lock = this.pairedLocks.get(address);
    if (typeof lock != "undefined") {
      if (!lock.hasICCard()) {
        return false;
      }
      if (!(await this._connectLock(lock))) {
        return false;
      }
      try {
        const result = await runWithTimeout(
          lock.updateICCard(card, startDate, endDate), 10000, "updateICCard");
        store.setCardAlias(card, alias);
        return result;
      } catch (error) {
        console.warn("updateCard error:", error);
        try { await lock.disconnect(); } catch (e) {}
        return false;
      }
    }
    return false;
  }

  async deleteCard(address, card) {
    const lock = this.pairedLocks.get(address);
    if (typeof lock != "undefined") {
      if (!lock.hasICCard()) {
        return false;
      }
      if (!(await this._connectLock(lock))) {
        return false;
      }
      try {
        const result = await runWithTimeout(
          lock.deleteICCard(card), 8000, "deleteICCard");
        store.deleteCardAlias(card);
        return result;
      } catch (error) {
        console.warn("deleteCard error:", error);
        try { await lock.disconnect(); } catch (e) {}
        return false;
      }
    }
    return false;
  }

  async getCards(address) {
    const lock = this.pairedLocks.get(address);
    if (typeof lock != "undefined") {
      if (!lock.hasICCard()) {
        return false;
      }
      if (!(await this._connectLock(lock))) {
        return false;
      }
      try {
        let cards = await runWithTimeout(
          lock.getICCards(), 8000, "getICCards");
        if (cards.length > 0) {
          for (let card of cards) {
            card.alias = store.getCardAlias(card.cardNumber);
          }
        }
        return cards;
      } catch (error) {
        console.warn("getCards error:", error);
        try { await lock.disconnect(); } catch (e) {}
        return false;
      }
    }
    return false;
  }

  async addFinger(address, startDate, endDate, alias) {
    const lock = this.pairedLocks.get(address);
    if (typeof lock != "undefined") {
      if (!lock.hasFingerprint()) {
        return false;
      }
      if (!(await this._connectLock(lock))) {
        return false;
      }
      try {
        const finger = await runWithTimeout(
          lock.addFingerprint(startDate, endDate), 12000, "addFingerprint");
        store.setFingerAlias(finger, alias);
        return finger;
      } catch (error) {
        console.warn("addFinger error:", error);
        try { await lock.disconnect(); } catch (e) {}
        return false;
      }
    }
    return false;
  }

  async updateFinger(address, finger, startDate, endDate, alias) {
    const lock = this.pairedLocks.get(address);
    if (typeof lock != "undefined") {
      if (!lock.hasFingerprint()) {
        return false;
      }
      if (!(await this._connectLock(lock))) {
        return false;
      }
      try {
        const result = await runWithTimeout(
          lock.updateFingerprint(finger, startDate, endDate), 10000, "updateFingerprint");
        store.setFingerAlias(finger, alias);
        return result;
      } catch (error) {
        console.warn("updateFinger error:", error);
        try { await lock.disconnect(); } catch (e) {}
        return false;
      }
    }
    return false;
  }

  async deleteFinger(address, finger) {
    const lock = this.pairedLocks.get(address);
    if (typeof lock != "undefined") {
      if (!lock.hasFingerprint()) {
        return false;
      }
      if (!(await this._connectLock(lock))) {
        return false;
      }
      try {
        const result = await runWithTimeout(
          lock.deleteFingerprint(finger), 8000, "deleteFingerprint");
        store.deleteFingerAlias(finger);
        return result;
      } catch (error) {
        console.warn("deleteFinger error:", error);
        try { await lock.disconnect(); } catch (e) {}
        return false;
      }
    }
    return false;
  }

  async getFingers(address) {
    const lock = this.pairedLocks.get(address);
    if (typeof lock != "undefined") {
      if (!lock.hasFingerprint()) {
        return false;
      }
      if (!(await this._connectLock(lock))) {
        return false;
      }
      try {
        let fingers = await runWithTimeout(
          lock.getFingerprints(), 8000, "getFingerprints");
        if (fingers.length > 0) {
          for (let finger of fingers) {
            finger.alias = store.getFingerAlias(finger.fpNumber);
          }
        }
        return fingers;
      } catch (error) {
        console.warn("getFingers error:", error);
        try { await lock.disconnect(); } catch (e) {}
        return false;
      }
    }
    return false;
  }

  async setAudio(address, audio) {
    const lock = this.pairedLocks.get(address);
    if (typeof lock != "undefined") {
      if (!lock.hasLockSound()) {
        return false;
      }
      if (!(await this._connectLock(lock))) {
        return false;
      }
      try {
        const sound = audio == true ? AudioManage.TURN_ON : AudioManage.TURN_OFF;
        const res = await runWithTimeout(
          lock.setLockSound(sound), 8000, "setLockSound"
        );
        this.emit("lockUpdated", lock);
        return res;
      } catch (error) {
        console.warn("setAudio error:", error);
        try { await lock.disconnect(); } catch (e) {}
        return false;
      }
    }
    return false;
  }

  async getOperationLog(address, reload) {
    const lock = this.pairedLocks.get(address);
    if (typeof reload == "undefined") {
      reload = false;
    }
    if (typeof lock != "undefined") {
      if (!(await this._connectLock(lock))) {
        return false;
      }
      try {
        let operations = JSON.parse(JSON.stringify(
          await runWithTimeout(lock.getOperationLog(true, reload), 10000, "getOperationLog")));
        let validOperations = [];
        for (let operation of operations) {
          if (operation) {
            operation.recordTypeName = LogOperateNames[operation.recordType];
            if (LogOperateCategory.LOCK.includes(operation.recordType)) {
              operation.recordTypeCategory = "LOCK";
            } else if (LogOperateCategory.UNLOCK.includes(operation.recordType)) {
              operation.recordTypeCategory = "UNLOCK";
            } else if (LogOperateCategory.FAILED.includes(operation.recordType)) {
              operation.recordTypeCategory = "FAILED";
            } else {
              operation.recordTypeCategory = "OTHER";
            }
            if (typeof operation.password != "undefined") {
              if (LogOperateCategory.IC.includes(operation.recordType)) {
                operation.passwordName = store.getCardAlias(operation.password);
              } else if (LogOperateCategory.FR.includes(operation.recordType)) {
                operation.passwordName = store.getFingerAlias(operation.password);
              }
            }
            validOperations.push(operation);
          }
        }
        return validOperations;
      } catch (error) {
        console.warn("getOperationLog error:", error);
        try { await lock.disconnect(); } catch (e) {}
      }
    } else {
      return false;
    }
  }

  async resetLock(address) {
    const lock = this.pairedLocks.get(address);
    if (typeof lock != "undefined") {
      if (!(await this._connectLock(lock))) {
        return false;
      }
      try {
        const res = await runWithTimeout(
          lock.resetLock(), 12000, "resetLock");
        if (res) {
          lock.removeAllListeners();
          this.pairedLocks.delete(address);
          this.emit("lockListChanged");
        }
        return res;
      } catch (error) {
        console.warn("resetLock error:", error);
        try { await lock.disconnect(); } catch (e) {}
        return false;
      }
    }
    return false;
  }

  async _connectLock(lock, readData = true) {
    if (this.scanning) return false;
    if (!lock.isConnected()) {
      try {
        const res = await runWithTimeout(
          lock.connect(!readData), 10000, "connect"
        );
        if (!res) {
          console.log("Connect to lock failed", lock.getAddress());
          return false;
        }
      } catch (error) {
        console.warn("connectLock error:", error);
        try { await lock.disconnect(); } catch (e) {}
        return false;
      }
      return true;
    }
    return true;
  }

  async _onScanStarted() {
    this.scanning = true;
    console.log("BLE Scan started");
    this.emit("scanStart");
  }

  async _onScanStopped() {
    this.scanning = false;
    console.log("BLE Scan stopped");
    console.log("Refreshing paired locks");
    for (let address of this.connectQueue) {
      if (this.pairedLocks.has(address)) {
        let lock = this.pairedLocks.get(address);
        console.log("Auto connect to", address);
        try {
          const result = await runWithTimeout(lock.connect(), 8000, "connect");
          if (result === true) {
            await lock.disconnect();
            console.log("Successful connect attempt to paired lock", address);
            this.connectQueue.delete(address);
          } else {
            console.log("Unsuccessful connect attempt to paired lock", address);
          }
        } catch (error) {
          console.warn("refresh connectQueue error:", error);
          try { await lock.disconnect(); } catch (e) {}
        }
      }
    }
    this.emit("scanStop");
    setTimeout(() => {
      this.client.startMonitor();
    }, 200);
  }

  async _onFoundLock(lock) {
    let listChanged = false;
    if (lock.isPaired()) {
      if (!this.pairedLocks.has(lock.getAddress())) {
        this._bindLockEvents(lock);
        console.log("Discovered paired lock:", lock.getAddress());
        if (this.client.isMonitoring()) {
          try {
            const result = await runWithTimeout(lock.connect(), 8000, "connect");
            if (result == true) {
              console.log("Successful connect attempt to paired lock", lock.getAddress());
              await this._processOperationLog(lock);
            } else {
              console.log("Unsuccessful connect attempt to paired lock", lock.getAddress());
              this.connectQueue.add(lock.getAddress());
            }
            await lock.disconnect();
          } catch (error) {
            console.warn("foundLock connect error:", error);
            try { await lock.disconnect(); } catch (e) {}
          }
        } else {
          this.connectQueue.add(lock.getAddress());
        }
        listChanged = true;
      }
    } else if (!lock.isInitialized()) {
      if (!this.newLocks.has(lock.getAddress())) {
        console.log("Discovered new lock:", lock.toJSON());
        this.newLocks.set(lock.getAddress(), lock);
        listChanged = true;
        if (this.client.isScanning()) {
          console.log("New lock found, stopping scan");
          await this.stopScan();
        }
      }
    } else {
      console.log("Discovered unknown lock:", lock.toJSON());
    }
    if (listChanged) {
      this.emit("lockListChanged");
    }
  }

  async _onUpdatedLockData() {
    store.setLockData(this.client.getLockData());
  }

  _bindLockEvents(lock) {
    lock.on("connected", this._onLockConnected.bind(this));
    lock.on("disconnected", this._onLockDisconnected.bind(this));
    lock.on("locked", this._onLockLocked.bind(this));
    lock.on("unlocked", this._onLockUnlocked.bind(this));
    lock.on("updated", this._onLockUpdated.bind(this));
    lock.on("scanICStart", () => this.emit("lockCardScan", lock));
    lock.on("scanFRStart", () => this.emit("lockFingerScan", lock));
    lock.on("scanFRProgress", () => this.emit("lockFingerScanProgress", lock));
  }

  async _onLockConnected(lock) {
    if (lock.isPaired()) {
      this.pairedLocks.set(lock.getAddress(), lock);
      console.log("Connected to paired lock " + lock.getAddress());
      this.emit("lockConnected", lock);
    } else {
      console.log("Connected to new lock " + lock.getAddress());
    }
  }

  async _onLockDisconnected(lock) {
    console.log("Disconnected from lock " + lock.getAddress());
    this.client.startMonitor();
  }

  async _onLockLocked(lock) {
    this.emit("lockLock", lock);
  }

  async _onLockUnlocked(lock) {
    this.emit("lockUnlock", lock);
  }

  async _onLockUpdated(lock, paramsChanged) {
    console.log("lockUpdated", paramsChanged);
    if (paramsChanged.newEvents == true && lock.hasNewEvents()) {
      if (!lock.isConnected()) {
        try {
          const result = await runWithTimeout(lock.connect(), 8000, "connect");
        } catch (error) {
          console.warn("onLockUpdated connect error:", error);
        }
      }
      await this._processOperationLog(lock);
    }
    if (paramsChanged.lockedStatus == true) {
      try {
        const status = await runWithTimeout(lock.getLockStatus(), 5000, "getLockStatus");
        if (status == LockedStatus.LOCKED) {
          console.log(">>>>>> Lock is now locked from new event <<<<<<");
          this.emit("lockLock", lock);
        }
      } catch (error) {
        console.warn("onLockUpdated getLockStatus error:", error);
      }
    }
    if (paramsChanged.batteryCapacity == true) {
      this.emit("lockUpdated", lock);
    }
    try { await lock.disconnect(); } catch (e) {}
  }

  async _processOperationLog(lock) {
    try {
      let operations = await runWithTimeout(lock.getOperationLog(), 10000, "getOperationLog");
      let lastStatus = LockedStatus.UNKNOWN;
      for (let op of operations) {
        if (LogOperateCategory.UNLOCK.includes(op.recordType)) {
          lastStatus = LockedStatus.UNLOCKED;
          console.log(">>>>>> Lock was unlocked <<<<<<");
          this.emit("lockUnlock", lock);
        } else if (LogOperateCategory.LOCK.includes(op.recordType)) {
          lastStatus = LockedStatus.LOCKED;
          console.log(">>>>>> Lock was locked <<<<<<");
          this.emit("lockLock", lock);
        }
      }
      const status = await runWithTimeout(lock.getLockStatus(), 5000, "getLockStatus");
      if (lastStatus != LockedStatus.UNKNOWN && status != lastStatus) {
        if (status == LockedStatus.LOCKED) {
          console.log(">>>>>> Lock is now locked <<<<<<");
          this.emit("lockLock", lock);
        } else if (status == LockedStatus.UNLOCKED) {
          console.log(">>>>>> Lock is now unlocked <<<<<<");
          this.emit("lockUnlock", lock);
        }
      }
    } catch (error) {
      console.warn("processOperationLog error:", error);
      try { await lock.disconnect(); } catch (e) {}
    }
  }

  async _scanTimer() {
    if (typeof this.scanTimer == "undefined") {
      this.scanTimer = setTimeout(() => {
        this.stopScan();
      }, 30 * 1000);
    }
  }
}

const manager = new Manager();

module.exports = manager;
