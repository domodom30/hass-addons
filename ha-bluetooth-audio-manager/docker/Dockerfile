# ARG global — must be before first FROM to be usable in FROM instructions
ARG BUILD_FROM=ghcr.io/home-assistant/amd64-base:3.20

# ---------------------------------------------------------------------------
# Frontend build stage — Vue 3 + Vite.
# Pinned to --platform=$BUILDPLATFORM so it always runs natively on the build
# host (the CI runner) instead of under QEMU emulation for arm targets. The
# output is a set of static, architecture-independent assets.
# ---------------------------------------------------------------------------
FROM --platform=$BUILDPLATFORM node:20-alpine AS frontend-build
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM ${BUILD_FROM}

# Pull bluez and mpd from Alpine edge (newer than base 3.20)
RUN apk add --no-cache \
    --repository=https://dl-cdn.alpinelinux.org/alpine/edge/main \
    --repository=https://dl-cdn.alpinelinux.org/alpine/edge/community \
    bluez \
    bluez-btmon \
    bluez-libs \
    mpd \
    && rm -f /etc/mpd.conf \
    && apk add --no-cache \
    dbus-libs \
    pulseaudio-utils \
    python3 \
    py3-pip

COPY docker/requirements.txt /tmp/
RUN pip3 install --no-cache-dir --break-system-packages -r /tmp/requirements.txt \
    && rm /tmp/requirements.txt

RUN mkdir -p /data /root/.config/pulse

COPY docker/rootfs /
COPY src/ /usr/src/

# Built Vue frontend (index.html + content-hashed assets under res/).
COPY --from=frontend-build /build/dist /usr/src/bt_audio_manager/web/static

# Fix permissions — COPY from macOS/git can strip execute bits, and
# overlapping directory metadata can affect the base image's /init
RUN chmod +x /init \
    && chmod +x /etc/s6-overlay/s6-rc.d/bt-audio-manager/run \
    && chmod +x /etc/s6-overlay/s6-rc.d/bt-audio-manager/finish \
    && chmod +x /etc/cont-init.d/01-verify-dbus.sh \
    && chmod +x /etc/cont-init.d/02-init-storage.sh

ENV PYTHONPATH="/usr/src"

# Keep add-on in STARTUP state until the web server is listening.
# The Supervisor only transitions to STARTED (showing "Open Web UI")
# once Docker reports the container as healthy.
HEALTHCHECK --interval=5s --timeout=2s --start-period=10s --retries=3 \
  CMD curl -sf http://127.0.0.1:8099/api/health || exit 1

ARG BUILD_ARCH
ARG BUILD_DATE
ARG BUILD_VERSION
ARG BUILD_SHA=""
ENV BUILD_VERSION="${BUILD_VERSION}" \
    BUILD_SHA="${BUILD_SHA}" \
    PYTHONUNBUFFERED="1"
LABEL \
    io.hass.name="Bluetooth Audio Manager" \
    io.hass.type="addon" \
    io.hass.arch="${BUILD_ARCH}" \
    io.hass.version="${BUILD_VERSION}" \
    org.opencontainers.image.title="Bluetooth Audio Manager" \
    org.opencontainers.image.created="${BUILD_DATE}" \
    org.opencontainers.image.version="${BUILD_VERSION}"
