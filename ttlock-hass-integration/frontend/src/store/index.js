import { createStore } from 'vuex';
import Api from '../api';

/** @type {Api} */
let api;

const store = createStore({
  state: {
    ready: false,
    startupStatus: -1,
    scanStatus: 0,
    gatewayStatus: 'n/a',
    gatewayHost: '',
    locks: [],
    passcodes: {},
    cards: {},
    fingers: {},
    operations: {},
    waitingCredentials: false,
    waitingCardScan: false,
    waitingFingerScan: false,
    fingerScanProgress: 0,
    waitingOperations: false,
    waiting: false,
    errors: [],
    notices: [],
    activeLockAddress: '',
    config: '',
    waitingConfig: false,
    waitingAutoLock: false,
    waitingSettings: false,
    waitingCalibrate: false,
    calibrateSuccess: null,
    waitingGatewayRestart: false,
    waitingEsp32Reboot: false,
    ui: { overlay: null, address: null }
  },
  mutations: {
    setOverlay(state, { overlay, address = null }) {
      state.ui = { overlay, address };
    },
    clearOverlay(state) {
      state.ui = { overlay: null, address: null };
    },
    setReady(state) {
      state.ready = true;
    },
    setStartupStatus(state, status) {
      state.startupStatus = status;
    },
    setScanStatus(state, status) {
      state.scanStatus = status;
    },
    setGatewayStatus(state, status) {
      state.gatewayStatus = status;
      if (status === 'connected' && state.waitingEsp32Reboot) {
        state.notices.push({ message: 'notices.gateway.esp32RebootComplete' });
      }
      if (status === 'connected') state.waitingEsp32Reboot = false;
    },
    setGatewayHost(state, host) {
      state.gatewayHost = host;
    },
    setLocks(state, locks) {
      state.locks = locks;
      state.waiting = false;
    },
    setLock(state, updatedLock) {
      let newLocks = [];
      let updated = false;
      for (const lock of state.locks) {
        if (lock.address == updatedLock.address) {
          const merged = { ...lock };
          for (const key of Object.keys(updatedLock)) {
            const value = updatedLock[key];

            if (value !== undefined) {
              merged[key] = value;
            }
          }
          newLocks.push(merged);
          updated = true;
        } else {
          newLocks.push(lock);
        }
      }
      if (!updated) {
        newLocks.push(updatedLock);
      }
      state.locks = newLocks;
      state.waiting = false;
    },
    setWaitingCredentials(state) {
      state.waitingCredentials = true;
    },
    setWaitingCardScan(state) {
      state.waitingCardScan = true;
    },
    setWaitingFingerScan(state) {
      state.waitingFingerScan = true;
    },
    setFingerScanProgress(state) {
      state.fingerScanProgress++;
    },
    setWaiting(state) {
      state.waiting = true;
    },
    setCredentials(state, data) {
      if (!data?.address) return;

      if (data.passcodes !== undefined) {
        state.passcodes = {
          ...state.passcodes,
          [data.address]: data.passcodes
        };
      }

      if (data.cards !== undefined) {
        state.cards = {
          ...state.cards,
          [data.address]: data.cards
        };
      }

      if (data.fingers !== undefined) {
        state.fingers = {
          ...state.fingers,
          [data.address]: data.fingers
        };
      }

      state.waitingCredentials = false;
      state.waitingCardScan = false;
      state.waitingFingerScan = false;
      state.fingerScanProgress = 0;
    },
    setError(state, data) {
      state.errors.push(data);
      state.waiting = false;
      state.waitingCredentials = false;
      state.waitingCardScan = false;
      state.waitingFingerScan = false;
      state.fingerScanProgress = 0;
      state.waitingAutoLock = false;
      state.waitingOperations = false;
      state.waitingCalibrate = false;
    },
    clearErrors(state) {
      state.errors = [];
    },
    setNotice(state, data) {
      state.notices.push(data);
    },
    clearNotices(state) {
      state.notices = [];
    },
    setActiveLockAddress(state, lockAddress) {
      state.activeLockAddress = lockAddress;
    },
    setConfig(state, config) {
      state.config = config;
      state.waitingConfig = false;
    },
    setOperations(state, data) {
      let newOperations = {};
      newOperations[data.address] = data.operations;
      for (const address in state.operations) {
        if (address != data.address) {
          newOperations[address] = state.operations[address];
        }
      }
      state.operations = newOperations;
      state.waitingOperations = false;
    },
    setWaitingConfig(state, isWaiting) {
      state.waitingConfig = isWaiting;
    },
    setWaitingAutoLock(state, isWaiting) {
      state.waitingAutoLock = isWaiting;
    },
    setWaitingSettings(state, isWaiting) {
      state.waitingSettings = isWaiting;
    },
    setWaitingCalibrate(state, isWaiting) {
      state.waitingCalibrate = isWaiting;
    },
    setCalibrateSuccess(state, success) {
      state.calibrateSuccess = success;
    },
    setWaitingGatewayRestart(state, isWaiting) {
      state.waitingGatewayRestart = isWaiting;
    },
    setWaitingEsp32Reboot(state, isWaiting) {
      state.waitingEsp32Reboot = isWaiting;
    },
    setWaitingOperations(state, isWaiting) {
      state.waitingOperations = isWaiting;
    },

    clearWaitingFlags(state) {
      state.waiting = false;
      state.waitingCredentials = false;
      state.waitingCardScan = false;
      state.waitingFingerScan = false;
      state.fingerScanProgress = 0;
      state.waitingOperations = false;
      state.waitingConfig = false;
      state.waitingAutoLock = false;
      state.waitingSettings = false;
      state.waitingCalibrate = false;
      state.waitingGatewayRestart = false;
    }
  },
  actions: {
    async init({ commit }) {
      if (!api) {
        api = new Api(store);
        await api.connect();
        commit('setReady');
      }
    },
    async scan({ state }) {
      if (state.waiting) return;
      api.scan();
    },
    async unlock({ state, commit }, lockAddress) {
      if (state.waiting) return;
      commit('setWaiting');
      api.unlock(lockAddress);
    },
    async lock({ state, commit }, lockAddress) {
      if (state.waiting) return;
      commit('setWaiting');
      api.lock(lockAddress);
    },
    async pair({ state, commit }, lockAddress) {
      if (state.waiting) return;
      commit('setWaiting');
      api.pair(lockAddress);
    },
    async setAutoLock({ state, commit }, { lockAddress, time }) {
      if (state.waitingAutoLock) return;
      commit('setWaitingAutoLock', true);
      api.setAutoLock(lockAddress, time);
    },
    async readCredentials({ state, commit }, lockAddress) {
      if (state.waitingCredentials) return;
      commit('setWaitingCredentials');
      api.requestCredentials(lockAddress);
    },
    async setPasscode({ commit }, { lockAddress, passcode }) {
      commit('setWaitingCredentials');
      api.setPasscode(lockAddress, passcode);
    },
    async setCard({ commit }, { lockAddress, card }) {
      commit('setWaitingCredentials');
      api.setCard(lockAddress, card);
    },
    async setFinger({ commit }, { lockAddress, finger }) {
      commit('setWaitingCredentials');
      api.setFinger(lockAddress, finger);
    },
    async loadConfig({ state, commit }) {
      if (state.waitingConfig) return;
      commit('setConfig', '');
      commit('setWaitingConfig', true);
      api.loadConfig();
    },
    async saveConfig({ state, commit }, config) {
      if (state.waitingConfig) return;
      commit('setConfig', '');
      commit('setWaitingConfig', true);
      api.saveConfig(config);
    },
    async saveSettings({ state, commit }, { lockAddress, settings }) {
      if (state.waitingSettings) return;
      commit('setWaitingSettings', true);
      api.saveSettings(lockAddress, settings);
    },
    async calibrateTime({ state, commit }, lockAddress) {
      if (state.waitingCalibrate) return;
      commit('setWaitingCalibrate', true);
      api.calibrateTime(lockAddress);
    },
    async readOperations({ state, commit }, lockAddress) {
      if (state.waiting || state.waitingOperations) return;
      commit('setWaitingOperations', true);
      api.requestOperations(lockAddress);
    },
    async unpair({ state, commit }, lockAddress) {
      if (state.waiting) return;
      commit('setWaiting');
      api.unpair(lockAddress);
    },
    async restartGateway({ state, commit }) {
      if (state.waitingGatewayRestart) return;
      commit('setWaitingGatewayRestart', true);
      api.restartGateway();
    },
    async rebootEsp32({ state, commit }) {
      if (state.waitingEsp32Reboot) return;
      commit('setWaitingEsp32Reboot', true);
      api.rebootEsp32();
    }
  }
});

store.dispatch('init');

export default store;
