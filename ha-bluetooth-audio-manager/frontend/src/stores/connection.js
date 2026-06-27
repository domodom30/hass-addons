import { defineStore } from "pinia";

let _scanTimer = null;

// Bluetooth discovery (scan) state with a live countdown, driven by scan
// websocket events and the Add Device tile. Ports app.js §5a.
export const useConnectionStore = defineStore("connection", {
  state: () => ({
    scanning: false,
    secondsRemaining: 0,
  }),
  actions: {
    setScanning(scanning, duration) {
      this.scanning = scanning;
      if (scanning && duration) {
        this.secondsRemaining = duration;
        clearInterval(_scanTimer);
        _scanTimer = setInterval(() => {
          this.secondsRemaining--;
          if (this.secondsRemaining <= 0) {
            clearInterval(_scanTimer);
            _scanTimer = null;
          }
        }, 1000);
      } else {
        clearInterval(_scanTimer);
        _scanTimer = null;
        this.secondsRemaining = 0;
      }
    },
  },
});
