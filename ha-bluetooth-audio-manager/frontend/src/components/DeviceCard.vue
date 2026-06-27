<script setup>
import { computed, ref, onBeforeUnmount } from "vue";
import { useDevicesStore } from "@/stores/devices.js";
import { useModalsStore } from "@/stores/modals.js";
import { useDeviceActions } from "@/composables/useDeviceActions.js";
import { profileLabels } from "@/profiles.js";
import CapabilityBadges from "./CapabilityBadges.vue";
import RssiIndicator from "./RssiIndicator.vue";

const props = defineProps({
  device: { type: Object, required: true },
});

const devices = useDevicesStore();
const modals = useModalsStore();
const actions = useDeviceActions();

const statusBadge = computed(() => {
  const d = props.device;
  if (d.connected) return { cls: "badge-connected", text: "Connected" };
  if (d.paired) return { cls: "badge-paired", text: "Paired" };
  return { cls: "badge-discovered", text: "Discovered" };
});

const showKebab = computed(() => props.device.stored || props.device.paired);

const profilesText = computed(() => profileLabels(props.device.uuids));

const profilesState = computed(() => {
  const d = props.device;
  if (d.cod_matched && !d.paired) {
    return {
      cls: "text-warning-emphasis",
      icon: "fas fa-info-circle",
      text: "Detected by device class — pair to confirm audio support",
    };
  }
  if (d.paired && !profilesText.value) {
    return {
      cls: "text-warning-emphasis",
      icon: "fas fa-exclamation-triangle",
      text: "Paired but no audio profiles found",
    };
  }
  if (profilesText.value) {
    return { cls: "text-muted", icon: null, text: profilesText.value };
  }
  return null;
});

const sinkInfo = computed(() => {
  if (!props.device.connected) return null;
  const sink = devices.sinkForAddress(props.device.address);
  if (!sink) return null;
  const parts = [
    sink.sample_rate ? `${(sink.sample_rate / 1000).toFixed(1)} kHz` : null,
    sink.channels ? `${sink.channels}ch` : null,
    sink.format || null,
  ].filter(Boolean);
  const stateMap = { running: "Streaming", idle: "Idle", suspended: "Suspended" };
  return {
    parts: parts.join(" / "),
    vol: sink.mute ? "Muted" : `${sink.volume}%`,
    stateLabel: stateMap[sink.state] || sink.state,
  };
});

const featureBadges = computed(() => {
  const d = props.device;
  const out = [];
  const im = d.idle_mode || "default";
  if (im === "power_save") {
    out.push({ cls: "border-info text-info", icon: "fas fa-moon", text: "Power Save" });
  } else if (im === "keep_alive" && d.keep_alive_active) {
    out.push({ cls: "border-danger text-danger", icon: "fas fa-heartbeat", text: "Stay Awake" });
  } else if (im === "auto_disconnect") {
    out.push({ cls: "border-warning text-warning", icon: "fas fa-plug", text: "Auto-Disconnect" });
  }
  if (d.mpd_enabled) {
    out.push({
      cls: "border-primary text-primary",
      icon: "fas fa-music",
      text: `MPD :${d.mpd_port || "?"}`,
    });
  }
  return out;
});

// --- Kebab dropdown (replaces Bootstrap's JS dropdown) ---
const menuOpen = ref(false);
function toggleMenu() {
  menuOpen.value = !menuOpen.value;
  if (menuOpen.value) document.addEventListener("click", closeMenu);
}
function closeMenu() {
  menuOpen.value = false;
  document.removeEventListener("click", closeMenu);
}
onBeforeUnmount(() => document.removeEventListener("click", closeMenu));
</script>

<template>
  <div class="col-md-6 col-lg-4">
    <div
      class="card device-card h-100"
      :class="{ 'device-stale': device._stale }"
    >
      <div class="card-body">
        <div class="device-slot-header">
          <h5
            class="card-title mb-0"
            :title="device.name"
          >
            {{ device.name }}
          </h5>
          <div class="d-flex align-items-center gap-1">
            <span
              class="badge"
              :class="statusBadge.cls"
            >{{ statusBadge.text }}</span>
            <div
              v-if="showKebab"
              class="dropdown"
            >
              <button
                class="btn btn-sm btn-link text-muted p-0 ms-2"
                type="button"
                title="Device options"
                @click.stop="toggleMenu"
              >
                <i class="fas fa-ellipsis-v" />
              </button>
              <ul
                class="dropdown-menu dropdown-menu-end"
                :class="{ show: menuOpen }"
                style="position: absolute; right: 0"
              >
                <li>
                  <a
                    class="dropdown-item"
                    href="#"
                    @click.prevent="modals.openDeviceSettings(device)"
                  >
                    <i class="fas fa-cog me-2" />Settings
                  </a>
                </li>
                <li v-if="device.connected">
                  <a
                    class="dropdown-item"
                    href="#"
                    @click.prevent="actions.forceReconnect(device.address)"
                  >
                    <i class="fas fa-sync me-2" />Force Reconnect
                  </a>
                </li>
                <li><hr class="dropdown-divider"></li>
                <li>
                  <a
                    class="dropdown-item text-danger"
                    href="#"
                    @click.prevent="modals.openForget(device.address)"
                  >
                    <i class="fas fa-trash me-2" />Forget Device
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div class="device-slot-badges">
          <CapabilityBadges :device="device" />
        </div>

        <div class="device-slot-meta device-meta-text font-monospace text-muted">
          {{ device.address
          }}<RssiIndicator
            v-if="device.rssi != null"
            class="ms-1"
            :device="device"
          /><template v-if="device.adapter">
            on {{ device.adapter }}
          </template>
        </div>

        <div class="device-slot-profiles device-meta-text">
          <span
            v-if="profilesState"
            :class="profilesState.cls"
          >
            <i
              v-if="profilesState.icon"
              :class="profilesState.icon"
              class="me-1"
            />{{
              profilesState.text
            }}
          </span>
        </div>

        <div
          v-if="device.signal_warning"
          class="device-slot-warning device-meta-text text-warning-emphasis"
        >
          <i class="fas fa-exclamation-triangle me-1" />{{ device.signal_warning }}
        </div>

        <div
          v-if="sinkInfo"
          class="device-slot-sink small text-muted"
        >
          <i class="fas fa-music me-1" />
          <template v-if="sinkInfo.parts">
            {{ sinkInfo.parts }} &middot;
          </template>{{ sinkInfo.vol }}
          <span class="badge bg-secondary ms-1">{{ sinkInfo.stateLabel }}</span>
        </div>

        <div
          v-if="featureBadges.length"
          class="device-slot-features device-feature-badges d-flex gap-2 flex-wrap"
        >
          <span
            v-for="(b, i) in featureBadges"
            :key="i"
            class="feature-badge"
            :class="b.cls"
          >
            <i
              :class="b.icon"
              class="me-1"
            />{{ b.text }}
          </span>
        </div>

        <div class="device-actions">
          <button
            v-if="device.connected"
            type="button"
            class="btn btn-sm btn-outline-danger"
            @click="actions.disconnect(device.address)"
          >
            <i class="fas fa-unlink me-1" />Disconnect
          </button>
          <button
            v-else-if="device.paired || device.stored"
            type="button"
            class="btn btn-sm btn-success"
            @click="actions.connect(device.address)"
          >
            <i class="fas fa-link me-1" />Connect
          </button>
          <template v-else>
            <button
              type="button"
              class="btn btn-sm btn-primary"
              @click="actions.pair(device.address)"
            >
              <i class="fas fa-handshake me-1" />Pair
            </button>
            <button
              type="button"
              class="btn btn-sm btn-outline-secondary"
              title="Dismiss"
              @click="actions.dismiss(device.address)"
            >
              <i class="fas fa-times" />
            </button>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>
