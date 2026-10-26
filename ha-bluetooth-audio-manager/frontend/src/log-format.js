// Pure helper for the logs dialog: splits a log message into plain text and
// highlightable tokens (Bluetooth MAC addresses, BlueZ D-Bus object paths).
// Python's repr of a set/list/str of addresses — {'AA:..'}, ['AA:..', 'BB:..'],
// 'AA:..' — is unwrapped so only the bare addresses are shown.

const MAC = "[0-9A-F]{2}(?::[0-9A-F]{2}){5}";
const QUOTED_MAC = `'${MAC}'`;
const MAC_GROUP = `[{[]${QUOTED_MAC}(?:, ${QUOTED_MAC})*[}\\]]`;
const PATH = "/org/bluez/[^\\s,;'\"\\])}]+";

const TOKEN_RE = new RegExp(`${MAC_GROUP}|${QUOTED_MAC}|${MAC}|${PATH}`, "gi");
const MAC_RE = new RegExp(MAC, "gi");

export function tokenizeLogMessage(message) {
  const text = message || "";
  const tokens = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN_RE)) {
    if (m.index > last) tokens.push({ type: "text", value: text.slice(last, m.index) });
    if (m[0].startsWith("/")) {
      tokens.push({ type: "path", value: m[0] });
    } else {
      for (const mac of m[0].match(MAC_RE)) tokens.push({ type: "mac", value: mac });
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) tokens.push({ type: "text", value: text.slice(last) });
  return tokens;
}
