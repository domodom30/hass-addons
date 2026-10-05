import WebSocket from 'ws';
import manager from '../src/manager.js';
import store from '../src/store.js';
import Lock from './Lock.js';
import Message from './Message.js';
import { sleep } from '@domodom30/ttlock-sdk-js';

class WsApi {
  /**
   *
   * @param {WebSocket} ws
   */
  constructor(ws) {
    this.ws = ws;
  }

  /**
   * Send a JSON message safely, ignoring errors if the socket is already closed.
   * @param {string} json
   */
  _send(json) {
    try {
      this.ws.send(json);
    } catch (err) {
      console.debug('_send: socket already closed', err.message);
    }
  }

  /**
   * Send status update and lock list
   * @param {WebSocket.Server} wss
   */
  static async sendStatus(wss) {
    const message = new Message();
    message.setType('status');
    message.setData({
      startup: manager.getStartupStatus(),
      scan: manager.getIsScanning() ? 1 : 0,
      gateway: manager.getGatewayStatus(),
      gatewayHost: manager.getGatewayHost(),
      locks: await WsApi.getLocks()
    });
    for (let ws of wss.clients) {
      try {
        ws.send(message.toJSON());
      } catch (err) {
        console.debug('sendStatus: client already closed', err.message);
      }
    }
  }

  /**
   * @param {WebSocket.Server} wss
   * @param {import('ttlock-sdk-js').TTLock} lock
   */
  static async sendLockStatus(wss, lock) {
    const message = new Message();
    message.setType('lockStatus');
    message.setData(await Lock.fromTTLock(lock));
    for (let ws of wss.clients) {
      try {
        ws.send(message.toJSON());
      } catch (err) {
        console.debug('sendLockStatus: client already closed', err.message);
      }
    }
  }

  async sendCredentials(address, credentials) {
    const message = new Message();
    message.setType('credentials');
    message.setData({
      address: address,
      passcodes: credentials.passcodes,
      cards: credentials.cards,
      fingers: credentials.fingers
    });
    this._send(message.toJSON());
  }

  async sendPasscodes(address, passcodes) {
    const message = new Message();
    message.setType('credentials');
    message.setData({
      address: address,
      passcodes: passcodes
    });
    this._send(message.toJSON());
  }

  async sendCards(address, cards) {
    const message = new Message();
    message.setType('credentials');
    message.setData({
      address: address,
      cards: cards
    });
    this._send(message.toJSON());
  }

  async sendCardScan(address) {
    const message = new Message();
    message.setType('cardScan');
    message.setData({
      address: address
    });
    this._send(message.toJSON());
  }

  async sendFingers(address, fingers) {
    const message = new Message();
    message.setType('credentials');
    message.setData({
      address: address,
      fingers: fingers
    });
    this._send(message.toJSON());
  }

  async sendFingerScan(address) {
    const message = new Message();
    message.setType('fingerScan');
    message.setData({
      address: address
    });
    this._send(message.toJSON());
  }

  async sendFingerScanProgress(address) {
    const message = new Message();
    message.setType('fingerScanProgress');
    message.setData({
      address: address
    });
    this._send(message.toJSON());
  }

  async sendSettingsConfirmation(address, settings) {
    const message = new Message();
    message.setType('settings');
    message.setData({
      address: address,
      settings: settings
    });
    this._send(message.toJSON());
  }

  async sendError(error, originalMessage) {
    const message = new Message();
    message.setType('error');
    message.setData({
      message: error,
      originalMessage: originalMessage
    });
    this._send(message.toJSON());
  }

  async sendNotice(messageKey) {
    const message = new Message();
    message.setType('notice');
    message.setData({
      message: messageKey
    });
    this._send(message.toJSON());
  }

  async sendConfig() {
    const message = new Message();
    message.setType('config');
    message.setData({
      config: JSON.stringify(store.getLockData())
    });
    this._send(message.toJSON());
  }

  async sendConfigConfirm(error) {
    const message = new Message();
    message.setType('config');
    message.setData({
      set: error === undefined ? true : error
    });
    this._send(message.toJSON());
  }

  async sendEsp32Reboot(success) {
    const message = new Message();
    message.setType('esp32Reboot');
    message.setData({ success });
    this._send(message.toJSON());
  }

  async sendGatewayRestart(success) {
    const message = new Message();
    message.setType('gatewayRestart');
    message.setData({ success });
    this._send(message.toJSON());
  }

  async sendOperationLog(address, operations) {
    const message = new Message();
    message.setType('operations');
    message.setData({
      address: address,
      operations: operations
    });
    this._send(message.toJSON());
  }

  static async getLocks() {
    const newVisibleLocks = manager.getNewVisible();
    const pairedVisibleLocks = manager.getPairedVisible();
    let locks = [];
    const seen = new Set();
    for (let [, lock] of newVisibleLocks) {
      try {
        const l = await Lock.fromTTLock(lock);
        locks.push(l);
        seen.add(l.address);
      } catch (err) {
        console.debug('getLocks: lock not yet connected', err.message);
      }
    }
    for (let [, lock] of pairedVisibleLocks) {
      try {
        const l = await Lock.fromTTLock(lock);
        locks.push(l);
        seen.add(l.address);
      } catch (err) {
        console.debug('getLocks: lock not yet connected', err.message);
      }
    }
    // Persisted-but-offline locks: keep paired locks visible so their cached
    // operation log (lockData.json) stays reachable even when the lock is not
    // advertising / the gateway is down. BLE-visible entries take precedence.
    for (const entry of store.getLockData()) {
      if (!entry?.address || seen.has(entry.address)) continue;
      seen.add(entry.address);
      locks.push(Lock.fromStoreEntry(entry));
    }
    return locks;
  }

  static async _devLocks() {
    await sleep(1000);
    return JSON.parse(
      '[{"address":"E1:58:1B:3A:60:5E","rssi":-73,"battery":63,"name":"S202F_5e603a","paired":true,"connected":true,"locked":0,"autoLockTime":5,"hasAutoLock":true,"hasSound":true,"audio":true,"manufacturer":"SCIENER","model":"S202F","firmware":"V3.3.8.2"}]'
    );
  }

  static async _devSendCredentials(ws) {
    await sleep(2000);
    ws.send(
      '{"type":"credentials","data":{"address":"E1:58:1B:3A:60:5E","passcodes":[{"type":1,"newPassCode":"654321","passCode":"654321","startDate":"200001010000"},{"type":1,"newPassCode":"123456","passCode":"123456","startDate":"200001010000"}],"cards":[{"cardNumber":"1978662719","startDate":"200001010000","endDate":"209912012359"},{"cardNumber":"167741690","startDate":"200001010000","endDate":"202212312359"},{"cardNumber":"147943900","startDate":"200001010000","endDate":"202212312359"}],"fingers":[{"fpNumber":"43431281557504","startDate":"200001010000","endDate":"202212312359"}]}}'
    );
  }
}

export default WsApi;
