'use strict';

import ReconnectingWebSocket from 'reconnecting-websocket';

class Api {
  store;
  /**
   * @type {ReconnectingWebSocket}
   */
  ws;

  constructor(store, url) {
    this.store = store;
    if (url === undefined) {
      let path = globalThis.location.href.replace('http', 'ws').replace(globalThis.location.hash, '').replace('/frontend/', '/api');
      // local development (addon has to be started also)
      if (!path.endsWith('/api')) {
        path += 'api';
      }
      console.log('Discovered WS API path', path);
      this.url = path;
    } else {
      this.url = url;
    }
  }

  async connect() {
    if (this.ws === undefined) {
      this.ws = new ReconnectingWebSocket(this.url, [], {
        startClosed: true
      });

      this.ws.addEventListener('message', this._onMessage.bind(this));
      // When the socket drops (e.g. dev proxy ECONNRESET, page sleep) the in-flight
      // request's reply lands in a closed socket and is silently dropped server-side.
      // Clear waiting flags so the UI can recover instead of spinning forever.
      this.ws.addEventListener('close', this._onClose.bind(this));
      // After reconnect, re-issue the last pending request so the active view (Operations,
      // Credentials, Config) refreshes its data without the user having to click again.
      this.ws.addEventListener('open', this._onOpen.bind(this));
    }

    this.ws.reconnect();
  }

  _onClose() {
    this.store.commit('clearWaitingFlags');
  }

  _onOpen() {
    const pending = this._pendingRequest;
    if (!pending) return;
    this._pendingRequest = null;
    if (pending.type === 'operations') {
      this.store.dispatch('readOperations', pending.address);
    } else if (pending.type === 'credentials') {
      this.store.dispatch('readCredentials', pending.address);
    } else if (pending.type === 'config') {
      this.store.dispatch('loadConfig');
    }
  }

  _rememberPending(type, address) {
    this._pendingRequest = { type, address };
  }

  async scan() {
    this.ws.send(
      JSON.stringify({
        type: 'scan'
      })
    );
  }

  async lock(address) {
    this.ws.send(
      JSON.stringify({
        type: 'lock',
        data: {
          address: address
        }
      })
    );
  }

  async unlock(address) {
    this.ws.send(
      JSON.stringify({
        type: 'unlock',
        data: {
          address: address
        }
      })
    );
  }

  async pair(address) {
    this.ws.send(
      JSON.stringify({
        type: 'pair',
        data: {
          address: address
        }
      })
    );
  }

  async setAutoLock(address, time) {
    this.ws.send(
      JSON.stringify({
        type: 'settings',
        data: {
          address: address,
          settings: {
            autolock: time
          }
        }
      })
    );
  }

  async calibrateTime(address) {
    this.ws.send(
      JSON.stringify({
        type: 'settings',
        data: {
          address: address,
          settings: {
            calibrate: true
          }
        }
      })
    );
  }

  async requestCredentials(address) {
    this._rememberPending('credentials', address);
    this.ws.send(
      JSON.stringify({
        type: 'credentials',
        data: {
          address: address
        }
      })
    );
  }

  async setPasscode(address, passcode) {
    this.ws.send(
      JSON.stringify({
        type: 'passcode',
        data: {
          address: address,
          passcode: passcode
        }
      })
    );
  }

  async setCard(address, card) {
    this.ws.send(
      JSON.stringify({
        type: 'card',
        data: {
          address: address,
          card: card
        }
      })
    );
  }

  async setFinger(address, finger) {
    this.ws.send(
      JSON.stringify({
        type: 'finger',
        data: {
          address: address,
          finger: finger
        }
      })
    );
  }

  async loadConfig() {
    this._rememberPending('config');
    this.ws.send(
      JSON.stringify({
        type: 'config',
        data: {
          get: true
        }
      })
    );
  }

  async saveConfig(config) {
    this.ws.send(
      JSON.stringify({
        type: 'config',
        data: {
          set: config
        }
      })
    );
  }

  async saveSettings(address, settings) {
    this.ws.send(
      JSON.stringify({
        type: 'settings',
        data: {
          address: address,
          settings: settings
        }
      })
    );
  }

  async requestOperations(address) {
    this._rememberPending('operations', address);
    this.ws.send(
      JSON.stringify({
        type: 'operations',
        data: {
          address: address
        }
      })
    );
  }

  async unpair(address) {
    this.ws.send(
      JSON.stringify({
        type: 'unpair',
        data: {
          address: address
        }
      })
    );
  }

  async rename(address, name) {
    this.ws.send(
      JSON.stringify({
        type: 'rename',
        data: {
          address: address,
          name: name
        }
      })
    );
  }

  async restartGateway() {
    this.ws.send(
      JSON.stringify({
        type: 'restartGateway'
      })
    );
  }

  async rebootEsp32() {
    this.ws.send(
      JSON.stringify({
        type: 'rebootEsp32'
      })
    );
  }

  async _onMessage(messageEvent) {
    try {
      const message = JSON.parse(messageEvent.data);
      if (message.type) {
        this._handleMessage(message);
      }
    } catch (error) {
      console.error(error);
    }
  }

  _handleMessage(message) {
    switch (message.type) {
      case 'status':
        this._onStatus(message.data);
        break;
      case 'lockStatus':
        this._onLockStatus(message.data);
        break;
      case 'autolock':
        this._onAutolock();
        break;
      case 'credentials':
        this._onCredentials(message.data);
        break;
      case 'cardScan':
        this._onCardScan();
        break;
      case 'fingerScan':
        this._onFingerScan();
        break;
      case 'fingerScanProgress':
        this._onFingerScanProgress();
        break;
      case 'settings':
        this._onSettings(message.data);
        break;
      case 'error':
        this._onError(message.data);
        break;
      case 'notice':
        this._onNotice(message.data);
        break;
      case 'config':
        this._onConfig(message.data);
        break;
      case 'operations':
        this._onOperations(message.data);
        break;
      case 'gatewayRestart':
        this._onGatewayRestart(message.data);
        break;
      case 'esp32Reboot':
        this._onEsp32Reboot(message.data);
        break;
    }
  }

  _onStatus(data) {
    if (!data) return;
    if (data.startup !== undefined) {
      this.store.commit('setStartupStatus', data.startup);
    }
    if (data.scan !== undefined) {
      this.store.commit('setScanStatus', data.scan);
    }
    if (data.gateway !== undefined) {
      this.store.commit('setGatewayStatus', data.gateway);
    }
    if (data.gatewayHost !== undefined) {
      this.store.commit('setGatewayHost', data.gatewayHost);
    }
    if (data.locks !== undefined) {
      this.store.commit('setLocks', data.locks);
    }
  }

  _onLockStatus(data) {
    if (data) {
      this.store.commit('setLock', data);
    }
  }

  _onAutolock() {
    this.store.commit('setWaitingAutoLock', false);
  }

  _onCredentials(data) {
    if (this._pendingRequest?.type === 'credentials') this._pendingRequest = null;
    if (data?.address !== undefined) {
      this.store.commit('setCredentials', data);
    }
  }

  _onCardScan() {
    this.store.commit('setWaitingCardScan');
  }

  _onFingerScan() {
    this.store.commit('setWaitingFingerScan');
  }

  _onFingerScanProgress() {
    this.store.commit('setFingerScanProgress');
  }

  _onSettings(data) {
    this.store.commit('setWaitingSettings', false);
    if (this.store.state.waitingCalibrate) {
      this.store.commit('setCalibrateSuccess', data?.settings?.calibrate === true);
    }
    this.store.commit('setWaitingCalibrate', false);
  }

  _onError(data) {
    this._pendingRequest = null;
    this.store.commit('setError', data);
  }

  _onNotice(data) {
    this.store.commit('setNotice', data);
  }

  _onConfig(data) {
    if (this._pendingRequest?.type === 'config') this._pendingRequest = null;
    if (data.config === undefined) {
      this.store.commit('setWaitingConfig', false);
      if (data.set !== true) {
        this.store.commit('setError', data.set);
      }
    } else {
      this.store.commit('setConfig', data.config);
    }
  }

  _onOperations(data) {
    if (this._pendingRequest?.type === 'operations') this._pendingRequest = null;
    if (data?.address !== undefined && data?.operations !== undefined) {
      this.store.commit('setOperations', data);
    }
  }

  _onGatewayRestart(data) {
    this.store.commit('setWaitingGatewayRestart', false);
    if (!data?.success) {
      this.store.commit('setError', { message: 'Gateway reconnection failed (timeout)' });
    }
  }

  _onEsp32Reboot(data) {
    if (!data?.success) {
      this.store.commit('setWaitingEsp32Reboot', false);
      this.store.commit('setError', { message: 'ESP32 reboot request failed (unreachable or auth error)' });
    } else {
      // Keep spinner until the WS reconnects (cleared by setGatewayStatus → 'connected').
      // Safety fallback: clear after 60 s if the ESP32 never comes back.
      if (this._esp32RebootTimeout) clearTimeout(this._esp32RebootTimeout);
      this._esp32RebootTimeout = setTimeout(() => {
        this._esp32RebootTimeout = null;
        this.store.commit('setWaitingEsp32Reboot', false);
      }, 60000);
    }
  }
}

export default Api;
