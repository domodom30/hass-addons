#!/usr/bin/env python3
"""Sync add-on version numbers from each add-on's config (the source of truth)
into the documentation/manifest files that reference them.

Source of truth:
  - Bluetooth Audio Manager: ha-bluetooth-audio-manager/bluetooth_audio_manager/config.yaml
  - TTLock:                   ttlock-hass-integration/config.yaml

Targets kept in sync:
  - README.md (root)                     version cells in the add-ons table
  - ttlock-hass-integration/README.md    shields.io version badge
  - ha-bluetooth-audio-manager/frontend/ package.json + package-lock.json version

Usage:
  python3 scripts/sync_versions.py          # rewrite files in place
  python3 scripts/sync_versions.py --check  # exit 1 if anything is out of sync
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SEMVER = r"\d+\.\d+\.\d+"

BT_CONFIG = ROOT / "ha-bluetooth-audio-manager/bluetooth_audio_manager/config.yaml"
TTLOCK_CONFIG = ROOT / "ttlock-hass-integration/config.yaml"


def read_yaml_version(path: Path) -> str:
    m = re.search(r'^version:\s*"?([^"\n]+)"?', path.read_text(), re.M)
    if not m:
        sys.exit(f"No 'version:' found in {path}")
    return m.group(1).strip()


def set_table_version(text: str, link_marker: str, version: str) -> str:
    """Replace the first backticked semver on the README table row that links
    to the add-on directory (e.g. ``](./ha-bluetooth-audio-manager)``)."""
    lines = text.splitlines(keepends=True)
    for i, line in enumerate(lines):
        if link_marker in line:
            lines[i] = re.sub(rf"`{SEMVER}`", f"`{version}`", line, count=1)
            break
    return "".join(lines)


def main() -> int:
    check = "--check" in sys.argv[1:]

    bt = read_yaml_version(BT_CONFIG)
    ttlock = read_yaml_version(TTLOCK_CONFIG)

    edits: list[tuple[Path, str]] = []

    # Root README table
    readme = ROOT / "README.md"
    text = readme.read_text()
    text = set_table_version(text, "](./ttlock-hass-integration)", ttlock)
    text = set_table_version(text, "](./ha-bluetooth-audio-manager)", bt)
    edits.append((readme, text))

    # TTLock README shields badge: version-X.Y.Z-blue
    tt_readme = ROOT / "ttlock-hass-integration/README.md"
    edits.append(
        (
            tt_readme,
            re.sub(
                rf"version-{SEMVER}-blue",
                f"version-{ttlock}-blue",
                tt_readme.read_text(),
            ),
        )
    )

    # BT-audio frontend manifests (package.json: first version; lock: top two)
    pkg = ROOT / "ha-bluetooth-audio-manager/frontend/package.json"
    edits.append(
        (
            pkg,
            re.sub(
                rf'("version":\s*"){SEMVER}(")',
                rf"\g<1>{bt}\g<2>",
                pkg.read_text(),
                count=1,
            ),
        )
    )
    lock = ROOT / "ha-bluetooth-audio-manager/frontend/package-lock.json"
    edits.append(
        (
            lock,
            re.sub(
                rf'(^\s*"version":\s*"){SEMVER}(",?)$',
                rf"\g<1>{bt}\g<2>",
                lock.read_text(),
                count=2,
                flags=re.M,
            ),
        )
    )

    stale = [p for p, new in edits if p.read_text() != new]

    if check:
        if stale:
            print("Out of sync:")
            for p in stale:
                print(f"  - {p.relative_to(ROOT)}")
            print("Run: python3 scripts/sync_versions.py")
            return 1
        print("Versions in sync.")
        return 0

    for p, new in edits:
        if p.read_text() != new:
            p.write_text(new)
            print(f"Updated {p.relative_to(ROOT)}")
    if not stale:
        print("Already in sync, nothing to do.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
