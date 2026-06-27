// Bluetooth profile UUIDs and human labels. Ports app.js §6.

export const A2DP_SINK = "0000110b-0000-1000-8000-00805f9b34fb";
export const A2DP_SOURCE = "0000110a-0000-1000-8000-00805f9b34fb";
export const AVRCP_TARGET = "0000110c-0000-1000-8000-00805f9b34fb";
export const AVRCP_CONTROLLER = "0000110e-0000-1000-8000-00805f9b34fb";
export const HFP_UUID = "0000111e-0000-1000-8000-00805f9b34fb";
export const HSP_UUID = "00001108-0000-1000-8000-00805f9b34fb";

export const BT_PROFILES = {
  [A2DP_SINK]: "A2DP Sink",
  [A2DP_SOURCE]: "A2DP Source",
  [AVRCP_TARGET]: "AVRCP Target",
  [AVRCP_CONTROLLER]: "AVRCP Controller",
  [HFP_UUID]: "HFP",
  [HSP_UUID]: "HSP",
};

export function profileLabels(uuids) {
  if (!uuids || uuids.length === 0) return "";
  const labels = uuids.map((u) => BT_PROFILES[u.toLowerCase()]).filter(Boolean);
  return labels.length > 0 ? "Supports: " + labels.join(" · ") : "";
}

export function hasAvrcp(uuids) {
  return (uuids || []).some(
    (u) => u.toLowerCase().startsWith("0000110c") ||
      u.toLowerCase().startsWith("0000110e"),
  );
}

export function hasHfpHsp(uuids) {
  const lower = (uuids || []).map((u) => u.toLowerCase());
  return lower.includes(HFP_UUID) || lower.includes(HSP_UUID);
}
