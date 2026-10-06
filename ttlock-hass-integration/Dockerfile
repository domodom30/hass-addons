ARG BUILD_FROM=ghcr.io/home-assistant/amd64-base:3.24

# =========================
# 🔨 Build stage: npm deps + native BLE modules
# =========================
# Compilers and headers only live here; the runtime image below gets the
# compiled node_modules without them.
FROM ${BUILD_FROM} AS build

RUN apk add --no-cache \
    nodejs \
    npm \
    python3 \
    py3-pip \
    make \
    g++ \
    gcc \
    linux-headers \
    pkgconfig \
    dbus \
    bluez \
    bluez-dev \
    eudev-dev \
    git

WORKDIR /app

# Manifests first: the dependency layer is rebuilt only when they change.
COPY addon/package.json addon/package-lock.json ./

# The SDK comes prebuilt from the npm registry (@domodom30/ttlock-sdk-js);
# NPM_CONFIG_INCLUDE=dev is kept for native BLE modules built from source.
# npm ci installs exactly what addon/package-lock.json pins (and fails if it is
# out of sync with package.json), so every build gets the same dependency tree.
RUN NPM_CONFIG_INCLUDE=dev npm ci --build-from-source

# =========================
# 🚀 Runtime stage
# =========================
FROM ${BUILD_FROM}

ENV LANG=C.UTF-8

# nodejs pulls libstdc++/libgcc (bluetooth-hci-socket native binding);
# eudev-libs provides libudev for the `usb` binding (only loaded in HCI-over-USB
# mode); dbus/bluez kept as in the previous single-stage image.
RUN apk add --no-cache \
    nodejs \
    dbus \
    bluez \
    eudev-libs

# =========================
# 🧠 Fix BLE / noble
# =========================
ENV NODE_OPTIONS=--dns-result-order=ipv4first

# =========================
# 📦 App
# =========================
WORKDIR /app

COPY --from=build /app/node_modules /app/node_modules
COPY addon/ /app/
COPY start.sh /start.sh

RUN chmod +x /start.sh

# =========================
# 🚀 entrypoint
# =========================
ENTRYPOINT ["/start.sh"]
