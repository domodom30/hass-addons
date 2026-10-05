# ── Local development launcher ────────────────────────────────────────────────
# Copy this file and rename it start-dev.local.ps1 (gitignored) to set your own values.
# Run with: .\start-dev.ps1  (from the addon/ directory)

$env:DATA_PATH = "$PSScriptRoot\dev-data"   # local folder instead of /data

# Noble BLE gateway — set to "noble" to use a remote noble-websocket gateway
# Leave as "none" to use the local BLE adapter directly

# $env:GATEWAY      = "none"

$env:GATEWAY = "noble"
$env:GATEWAY_HOST = "192.168.135.111" # IP or hostname of the noble gateway
$env:GATEWAY_PORT = "8080"            # WebSocket port (default 8080)
$env:GATEWAY_KEY = "9A9578A93853A038C175CA1AB17B6EB5"   # AES key configured in the gateway
$env:GATEWAY_USER = "admin"        # WebSocket auth username (if any)
$env:GATEWAY_PASS = "admin"        # WebSocket auth password (if any)

# Create the local data folder if it doesn't exist
if (-not (Test-Path $env:DATA_PATH)) {
    New-Item -ItemType Directory -Path $env:DATA_PATH | Out-Null
    Write-Host "Created dev data folder: $env:DATA_PATH"
}

Write-Host "Starting TTLock addon (dev mode)..."
node "$PSScriptRoot\index.js"
