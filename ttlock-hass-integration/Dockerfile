ARG BUILD_FROM=ghcr.io/home-assistant/amd64-base:3.19
FROM ${BUILD_FROM}

ENV LANG=C.UTF-8

# =========================
# 🔧 System deps (ALPINE)
# =========================
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

# =========================
# 🧠 Fix BLE / noble
# =========================
ENV NODE_OPTIONS=--dns-result-order=ipv4first

# =========================
# 📦 App
# =========================
WORKDIR /app

COPY addon/ /app/
COPY start.sh /start.sh

RUN chmod +x /start.sh

# install npm deps (BLE needs build tools)
# NPM_CONFIG_INCLUDE=dev ensures devDependencies (typescript) are available
# for the SDK's prepare/build script when installing from GitHub source.
# Once built, devDependencies are no longer needed at runtime.
RUN NPM_CONFIG_INCLUDE=dev npm install --build-from-source

# =========================
# 🚀 entrypoint
# =========================
ENTRYPOINT ["/start.sh"]