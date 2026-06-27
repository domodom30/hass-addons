// Pure helpers for the device list: stable sorting and the "stale" fade-out
// merge that keeps recently-vanished discovered devices visible for a while.
// Extracted from the store so they can be unit-tested in isolation.

export const DEVICE_STALE_MS = 20000;
export const VOLUME_DEDUP_MS = 1500;

export function priority(d) {
  return d.connected ? 0 : d.paired || d.stored ? 1 : 2;
}

// Connected (0) > paired/stored (1) > discovered (2), then by address.
export function sortStable(devices) {
  return devices.slice().sort((a, b) => {
    const pa = priority(a);
    const pb = priority(b);
    if (pa !== pb) return pa - pb;
    return a.address.localeCompare(b.address);
  });
}

// Merge the freshly received list with cached devices that disappeared less
// than DEVICE_STALE_MS ago (discovered-only — never paired/stored/connected).
// `lastSeen` and `cache` are caller-owned Maps mutated in place; `now` is
// injectable for deterministic tests.
export function mergeStale(devices, lastSeen, cache, now = Date.now()) {
  if (devices) {
    for (const d of devices) {
      lastSeen.set(d.address, now);
      cache.set(d.address, d);
    }
  }
  const merged = devices ? [...devices] : [];
  const seen = new Set(merged.map((d) => d.address));
  for (const [addr, ts] of lastSeen) {
    if (seen.has(addr)) continue;
    if (now - ts < DEVICE_STALE_MS) {
      const cached = cache.get(addr);
      if (cached && !cached.paired && !cached.stored && !cached.connected) {
        merged.push({ ...cached, _stale: true });
        seen.add(addr);
      }
    } else {
      lastSeen.delete(addr);
      cache.delete(addr);
    }
  }
  return sortStable(merged);
}

// Returns true when an identical volume reading arrived within the dedup
// window. `seen` is a caller-owned record (address -> {value, ts}).
export function isDuplicateVolume(seen, address, value, now = Date.now()) {
  const prev = seen[address];
  if (prev && prev.value === String(value) && now - prev.ts < VOLUME_DEDUP_MS) {
    return true;
  }
  seen[address] = { value: String(value), ts: now };
  return false;
}
