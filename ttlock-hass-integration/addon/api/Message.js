/**
 * @typedef {'status'|'scan'|'pair'|'lock'|'unlock'|'lockStatus'
 * |'credentials'|'passcode'|'card'|'finger'|'error'|'config'
 * |'settings'|'operations'|'unpair'} MessageType
 */

class Message {
  /**
   * @type {MessageType} Message type
   */
  type;

  /**
   * @type {Object|undefined} Data payload
   */
  data;

  /**
   * @type {boolean} Message is valid
   */
  valid = false;

  /**
   *
   * @param {import('ws').Data} payload
   */
  constructor(payload) {
    if (payload === undefined) return;
    try {
      const json = JSON.parse(payload);
      if (json.type !== undefined) {
        this.type = json.type;
        if (json.data !== undefined) {
          this.data = json.data;
        }
        this.valid = true;
      }
    } catch (error) {
      console.error('Error parsing Message payload', error);
    }
  }

  getType() {
    return this.type;
  }

  /**
   *
   * @param {MessageType} type
   */
  setType(type) {
    this.type = type;
  }

  getData() {
    return this.data;
  }

  setData(data) {
    this.data = data;
  }

  isValid() {
    return this.valid;
  }

  toJSON() {
    const obj = {
      type: this.type,
      data: this.data
    };

    return JSON.stringify(obj);
  }
}

export default Message;
