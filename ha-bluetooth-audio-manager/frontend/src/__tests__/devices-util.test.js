import { describe, it, expect, beforeEach } from "vitest";
import { sortStable, mergeStale, isDuplicateVolume } from "@/devices-util.js";

describe("sortStable", () => {
  it("orders connected > paired/stored > discovered, then by address", () => {
    const out = sortStable([
      { address: "CC:CC:CC:CC:CC:CC" },
      { address: "AA:AA:AA:AA:AA:AA", connected: true },
      { address: "BB:BB:BB:BB:BB:BB", paired: true },
    ]);
    expect(out.map((d) => d.address)).toEqual([
      "AA:AA:AA:AA:AA:AA",
      "BB:BB:BB:BB:BB:BB",
      "CC:CC:CC:CC:CC:CC",
    ]);
  });
});

describe("mergeStale", () => {
  let lastSeen;
  let cache;
  beforeEach(() => {
    lastSeen = new Map();
    cache = new Map();
  });

  it("keeps a recently vanished discovered device, flagged _stale", () => {
    mergeStale([{ address: "DD:DD:DD:DD:DD:DD" }], lastSeen, cache, 1000);
    const out = mergeStale([], lastSeen, cache, 2000);
    const stale = out.find((d) => d.address === "DD:DD:DD:DD:DD:DD");
    expect(stale).toBeTruthy();
    expect(stale._stale).toBe(true);
  });

  it("drops a stale device once past the 20s window", () => {
    mergeStale([{ address: "DD:DD:DD:DD:DD:DD" }], lastSeen, cache, 1000);
    const out = mergeStale([], lastSeen, cache, 1000 + 21000);
    expect(out).toHaveLength(0);
  });

  it("never retains a connected device as stale", () => {
    mergeStale([{ address: "EE:EE:EE:EE:EE:EE", connected: true }], lastSeen, cache, 1000);
    const out = mergeStale([], lastSeen, cache, 2000);
    expect(out).toHaveLength(0);
  });
});

describe("isDuplicateVolume", () => {
  it("suppresses an identical reading within the window", () => {
    const seen = {};
    expect(isDuplicateVolume(seen, "AA", 50, 1000)).toBe(false);
    expect(isDuplicateVolume(seen, "AA", 50, 1200)).toBe(true);
  });

  it("allows a changed value or one past the window", () => {
    const seen = {};
    isDuplicateVolume(seen, "AA", 50, 1000);
    expect(isDuplicateVolume(seen, "AA", 60, 1100)).toBe(false);
    expect(isDuplicateVolume(seen, "AA", 60, 1100 + 1600)).toBe(false);
  });
});
