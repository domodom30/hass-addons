<script setup>
import { reactive, ref, computed, watch } from "vue";
import { apiPut } from "@/api/client.js";
import { useModalsStore } from "@/stores/modals.js";
import { useUiStore } from "@/stores/ui.js";
import { useInfoStore } from "@/stores/info.js";
import { useDevicesStore } from "@/stores/devices.js";
import { AVRCP_TARGET, AVRCP_CONTROLLER, HFP_UUID, HSP_UUID } from "@/profiles.js";
import BaseModal from "./BaseModal.vue";

const modals = useModalsStore();
const ui = useUiStore();
const info = useInfoStore();
const devices = useDevicesStore();

const address = ref("");
const name = ref("");
const lowerUuids = ref([]);
const saving = ref(false);

const form = reactive({
  audioProfile: "a2dp",
  idleMode: "default",
  kaMethod: "infrasound",
  powerSaveDelay: "0",
  autoDisconnectMinutes: "30",
  mpdEnabled: false,
  mpdHwVolume: 100,
  mpdPort: "",
  avrcpEnabled: true,
});

// Initialize the form from the selected device each time the modal opens.
watch(
  () => modals.deviceSettings.open,
  (open) => {
    if (!open) return;
    const d = modals.deviceSettings.device || {};
    address.value = d.address;
    name.value = d.name;
    lowerUuids.value = (d.uuids || []).map((u) => u.toLowerCase());
    form.audioProfile = d.audio_profile || "a2dp";
    form.idleMode = d.idle_mode || "default";
    form.kaMethod = d.keep_alive_method || "infrasound";
    form.powerSaveDelay = String(d.power_save_delay ?? 0);
    form.autoDisconnectMinutes = String(d.auto_disconnect_minutes ?? 30);
    form.mpdEnabled = d.mpd_enabled || false;
    form.mpdHwVolume = d.mpd_hw_volume ?? 100;
    form.mpdPort = d.mpd_port || "";
    form.avrcpEnabled = hasAvrcp.value ? (d.avrcp_enabled ?? true) : false;
  },
);

const showAudioProfile = computed(() => info.hfpSwitchingEnabled);
const hasHfp = computed(
  () => lowerUuids.value.includes(HFP_UUID) || lowerUuids.value.includes(HSP_UUID),
);
const hasAvrcp = computed(
  () =>
    lowerUuids.value.includes(AVRCP_TARGET) ||
    lowerUuids.value.includes(AVRCP_CONTROLLER),
);

const audioProfileHelp = computed(() =>
  form.audioProfile === "hfp"
    ? "Mono audio with microphone input. Use with Wyoming Satellite for voice assistant."
    : "Stereo high-quality audio for music and media playback.",
);

const IDLE_HELP = {
  default:
    "No action taken when audio stops. Whether the speaker sleeps depends on its own hardware idle timer.",
  power_save:
    "Suspends the audio sink after the delay to release the A2DP transport. The speaker's own internal sleep timer determines when it actually powers down.",
  keep_alive:
    "Streams inaudible audio to prevent the speaker from auto-shutting down during silence.",
  auto_disconnect:
    "Fully disconnects the Bluetooth device after the specified idle timeout.",
};
const idleModeHelp = computed(() => IDLE_HELP[form.idleMode] || "");

const avrcpHelp = computed(() =>
  hasAvrcp.value
    ? "Track playback state and accept media-button commands from the speaker. Media buttons may or may not work reliably depending on hardware."
    : "Device does not support AVRCP media buttons.",
);

const mpdPasswordDisplay = computed(() =>
  info.mpdPasswordSet ? "**********" : "None",
);

// Pre-fill the next free MPD port when enabling MPD for the first time
// (port toggleMpdConfigVisibility §11c).
watch(
  () => form.mpdEnabled,
  (enabled) => {
    if (!enabled || form.mpdPort) return;
    const used = devices.usedMpdPorts(address.value);
    for (let p = 6600; p <= 6609; p++) {
      if (!used.has(p)) {
        form.mpdPort = p;
        break;
      }
    }
  },
);

async function save() {
  if (!address.value) return;
  saving.value = true;
  const settings = {
    idle_mode: form.idleMode,
    keep_alive_method: form.kaMethod,
    power_save_delay: parseInt(form.powerSaveDelay, 10) || 0,
    auto_disconnect_minutes: parseInt(form.autoDisconnectMinutes, 10) || 30,
    mpd_enabled: form.mpdEnabled,
  };
  if (settings.mpd_enabled) {
    settings.mpd_hw_volume = parseInt(form.mpdHwVolume, 10) || 100;
    if (form.mpdPort) settings.mpd_port = parseInt(form.mpdPort, 10);
  }
  if (info.hfpSwitchingEnabled) {
    settings.audio_profile = form.audioProfile;
  }
  if (hasAvrcp.value) {
    settings.avrcp_enabled = form.avrcpEnabled;
  }
  try {
    const resp = await apiPut(
      `/api/devices/${encodeURIComponent(address.value)}/settings`,
      settings,
    );
    const port = resp.settings?.mpd_port;
    if (settings.mpd_enabled && port) {
      ui.addToast(`Settings saved — MPD on port ${port}`, "success");
    } else {
      ui.addToast("Device settings saved", "success");
    }
    modals.closeDeviceSettings();
  } catch (e) {
    ui.addToast(`Failed to save settings: ${e.message}`, "error");
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <BaseModal
    :show="modals.deviceSettings.open"
    @close="modals.closeDeviceSettings()"
  >
    <template #title>
      <i class="fas fa-cog me-2" />Device Settings
    </template>

    <h6 class="fw-semibold mb-1">
      {{ name }}
    </h6>
    <p class="font-monospace small text-muted mb-3">
      {{ address }}
    </p>

    <div
      v-if="showAudioProfile"
      class="mb-3"
    >
      <label
        class="form-label"
        for="setting-audio-profile"
      ><strong>Audio Profile</strong></label>
      <select
        id="setting-audio-profile"
        v-model="form.audioProfile"
        class="form-select"
      >
        <option value="a2dp">
          A2DP (stereo music)
        </option>
        <option
          value="hfp"
          :disabled="!hasHfp"
        >
          HFP (mono + microphone)
        </option>
      </select>
      <div class="form-text">
        {{ audioProfileHelp }}
      </div>
    </div>

    <hr
      v-if="showAudioProfile"
      class="my-3"
    >

    <div class="mb-3">
      <label
        class="form-label"
        for="setting-idle-mode"
      ><strong>When Idle</strong></label>
      <select
        id="setting-idle-mode"
        v-model="form.idleMode"
        class="form-select"
      >
        <option value="default">
          Default (do nothing)
        </option>
        <option value="power_save">
          Power Save (let speaker sleep)
        </option>
        <option value="keep_alive">
          Stay Awake
        </option>
        <option value="auto_disconnect">
          Auto-Disconnect
        </option>
      </select>
      <div class="form-text">
        {{ idleModeHelp }}
      </div>
    </div>

    <div
      v-if="form.idleMode === 'power_save'"
      class="mb-3"
    >
      <label
        class="form-label"
        for="setting-power-save-delay"
      >Delay before suspending</label>
      <select
        id="setting-power-save-delay"
        v-model="form.powerSaveDelay"
        class="form-select"
      >
        <option value="0">
          Immediately
        </option>
        <option value="30">
          30 seconds
        </option>
        <option value="60">
          1 minute
        </option>
        <option value="300">
          5 minutes
        </option>
      </select>
    </div>

    <div
      v-if="form.idleMode === 'keep_alive'"
      class="mb-3"
    >
      <label
        class="form-label"
        for="setting-keep-alive-method"
      >Method</label>
      <select
        id="setting-keep-alive-method"
        v-model="form.kaMethod"
        class="form-select"
      >
        <option value="infrasound">
          Infrasound (2 Hz tone — recommended)
        </option>
        <option value="silence">
          Silence (PCM zeros)
        </option>
      </select>
    </div>

    <div
      v-if="form.idleMode === 'auto_disconnect'"
      class="mb-3"
    >
      <label
        class="form-label"
        for="setting-auto-disconnect-minutes"
      >Disconnect after</label>
      <select
        id="setting-auto-disconnect-minutes"
        v-model="form.autoDisconnectMinutes"
        class="form-select"
      >
        <option value="5">
          5 minutes
        </option>
        <option value="15">
          15 minutes
        </option>
        <option value="30">
          30 minutes
        </option>
        <option value="60">
          1 hour
        </option>
      </select>
    </div>

    <hr class="my-3">

    <div class="mb-3">
      <div class="form-check form-switch">
        <input
          id="setting-mpd-enabled"
          v-model="form.mpdEnabled"
          class="form-check-input"
          type="checkbox"
        >
        <label
          class="form-check-label"
          for="setting-mpd-enabled"
        >
          <strong>MPD Media Player</strong>
        </label>
      </div>
      <div class="form-text">
        Route MPD audio output to this speaker. Add the
        <a
          href="https://www.home-assistant.io/integrations/mpd/"
          target="_blank"
          rel="noopener"
        >HA MPD integration</a>
        to create a <code>media_player</code> entity for TTS and media playback.
      </div>
    </div>

    <div v-if="form.mpdEnabled">
      <div class="mb-3">
        <label
          class="form-label"
          for="setting-mpd-hw-volume"
        >Hardware Volume (%)</label>
        <input
          id="setting-mpd-hw-volume"
          v-model="form.mpdHwVolume"
          type="number"
          class="form-control"
          min="1"
          max="100"
          step="1"
        >
        <div class="form-text">
          Sets speaker hardware volume when MPD starts (1–100%). MPD then controls
          perceived loudness as a single volume knob. Default: 100%.
        </div>
      </div>
      <div class="mb-3">
        <label
          class="form-label"
          for="setting-mpd-port"
        >MPD Port</label>
        <input
          id="setting-mpd-port"
          v-model="form.mpdPort"
          type="number"
          class="form-control"
          min="6600"
          max="6609"
          step="1"
        >
        <div class="form-text">
          Port for this speaker's MPD instance (6600–6609). Auto-assigned on first
          enable.
        </div>
      </div>
      <div
        v-if="form.mpdPort"
        class="alert alert-info py-2 mb-0"
      >
        <i class="fas fa-info-circle me-1" />
        Use port <strong>{{ form.mpdPort }}</strong> when adding the HA MPD
        integration.<br>
        <span class="form-text">Host: <code>{{ info.mpdHostname }}</code></span><br>
        <span class="form-text">Password: <code>{{ mpdPasswordDisplay }}</code></span>
      </div>
    </div>

    <hr class="my-3">

    <div class="mb-3">
      <div class="form-check form-switch">
        <input
          id="setting-avrcp-enabled"
          v-model="form.avrcpEnabled"
          class="form-check-input"
          type="checkbox"
          :disabled="!hasAvrcp"
        >
        <label
          class="form-check-label"
          for="setting-avrcp-enabled"
        >
          <strong>Media Buttons (AVRCP)</strong>
        </label>
      </div>
      <div class="form-text">
        {{ avrcpHelp }}
      </div>
    </div>

    <template #footer>
      <button
        type="button"
        class="btn btn-secondary"
        @click="modals.closeDeviceSettings()"
      >
        Cancel
      </button>
      <button
        type="button"
        class="btn btn-primary"
        :disabled="saving"
        @click="save"
      >
        <span
          v-if="saving"
          class="spinner-border spinner-border-sm me-1"
        />
        <i
          v-else
          class="fas fa-save me-1"
        />Save
      </button>
    </template>
  </BaseModal>
</template>
