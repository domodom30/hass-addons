import { describe, it, expect } from "vitest";
import { tokenizeLogMessage } from "@/log-format.js";

describe("tokenizeLogMessage", () => {
  it("unwraps a Python set holding one address", () => {
    expect(tokenizeLogMessage("Connected: {'C0:E3:50:9E:49:D0'}")).toEqual([
      { type: "text", value: "Connected: " },
      { type: "mac", value: "C0:E3:50:9E:49:D0" },
    ]);
  });

  it("splits a list of several addresses into separate tokens", () => {
    expect(tokenizeLogMessage("got ['AA:BB:CC:DD:EE:FF', 'aa:bb:cc:dd:ee:00'] ok")).toEqual([
      { type: "text", value: "got " },
      { type: "mac", value: "AA:BB:CC:DD:EE:FF" },
      { type: "mac", value: "aa:bb:cc:dd:ee:00" },
      { type: "text", value: " ok" },
    ]);
  });

  it("highlights bare and quoted addresses", () => {
    expect(tokenizeLogMessage("Device AA:BB:CC:DD:EE:FF and '11:22:33:44:55:66'")).toEqual([
      { type: "text", value: "Device " },
      { type: "mac", value: "AA:BB:CC:DD:EE:FF" },
      { type: "text", value: " and " },
      { type: "mac", value: "11:22:33:44:55:66" },
    ]);
  });

  it("highlights BlueZ D-Bus object paths", () => {
    expect(tokenizeLogMessage("Transport /org/bluez/hci0/dev_AA_BB_CC_DD_EE_FF/fd0, state")).toEqual([
      { type: "text", value: "Transport " },
      { type: "path", value: "/org/bluez/hci0/dev_AA_BB_CC_DD_EE_FF/fd0" },
      { type: "text", value: ", state" },
    ]);
  });

  it("returns plain text untouched", () => {
    expect(tokenizeLogMessage("Nothing special 12:30")).toEqual([
      { type: "text", value: "Nothing special 12:30" },
    ]);
    expect(tokenizeLogMessage("")).toEqual([]);
  });
});
