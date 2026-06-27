import { describe, it, expect, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useDevicesStore } from "@/stores/devices.js";
import { useEventsStore } from "@/stores/events.js";
import { AVRCP_TARGET } from "@/profiles.js";

beforeEach(() => {
  setActivePinia(createPinia());
  // The fade-out bookkeeping lives in module-level Maps; clear it between tests.
  useDevicesStore().resetTracking();
});

describe("devices store", () => {
  it("sorts connected > paired > discovered, then by address", () => {
    const devices = useDevicesStore();
    devices.applyDevices([
      { address: "CC:CC:CC:CC:CC:CC" }, // discovered
      { address: "AA:AA:AA:AA:AA:AA", connected: true },
      { address: "BB:BB:BB:BB:BB:BB", paired: true },
    ]);
    expect(devices.displayed.map((d) => d.address)).toEqual([
      "AA:AA:AA:AA:AA:AA",
      "BB:BB:BB:BB:BB:BB",
      "CC:CC:CC:CC:CC:CC",
    ]);
  });

  it("keeps a recently vanished discovered device as stale", () => {
    const devices = useDevicesStore();
    devices.applyDevices([{ address: "DD:DD:DD:DD:DD:DD" }]);
    devices.applyDevices([]); // device disappears
    const stale = devices.displayed.find(
      (d) => d.address === "DD:DD:DD:DD:DD:DD",
    );
    expect(stale).toBeTruthy();
    expect(stale._stale).toBe(true);
  });

  it("does not retain a connected device as stale once gone", () => {
    const devices = useDevicesStore();
    devices.applyDevices([{ address: "EE:EE:EE:EE:EE:EE", connected: true }]);
    devices.applyDevices([]);
    expect(devices.displayed).toHaveLength(0);
  });

  it("matches a PulseAudio sink to a device by normalized MAC", () => {
    const devices = useDevicesStore();
    devices.setSinks([{ name: "bluez_sink.aa_bb_cc_dd_ee_ff.a2dp_sink" }]);
    expect(devices.sinkForAddress("AA:BB:CC:DD:EE:FF")).toBeTruthy();
    expect(devices.sinkForAddress("11:22:33:44:55:66")).toBeFalsy();
  });
});

describe("events store volume de-duplication", () => {
  it("suppresses an identical volume event within the 1.5s window", () => {
    const devices = useDevicesStore();
    devices.applyDevices([
      { address: "AA:BB:CC:DD:EE:FF", connected: true, uuids: [AVRCP_TARGET] },
    ]);
    const events = useEventsStore();
    const base = { property: "Volume", address: "AA:BB:CC:DD:EE:FF", value: 50 };

    events.addAvrcp({ ...base, ts: 1000 });
    events.addAvrcp({ ...base, ts: 1000 }); // duplicate
    expect(events.entries).toHaveLength(1);

    events.addAvrcp({ ...base, value: 60, ts: 1000 }); // changed value
    expect(events.entries).toHaveLength(2);
  });

  it("labels devices without AVRCP UUIDs as Transport", () => {
    const devices = useDevicesStore();
    devices.applyDevices([
      { address: "11:22:33:44:55:66", connected: true, uuids: [] },
    ]);
    const events = useEventsStore();
    events.addAvrcp({ property: "Volume", address: "11:22:33:44:55:66", value: 30 });
    expect(events.entries[0].kind).toBe("transport");
  });
});
