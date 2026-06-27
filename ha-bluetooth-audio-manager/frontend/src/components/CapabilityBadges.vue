<script setup>
import { computed } from "vue";
import { useInfoStore } from "@/stores/info.js";

const props = defineProps({
  device: { type: Object, required: true },
});

const info = useInfoStore();

// Port of buildCapBadges (app.js §6): bearer + A2DP/HFP/AVRCP availability,
// with a checkmark only when the matching profile is active.
const badges = computed(() => {
  const d = props.device;
  const connected = d.connected;
  const out = [];

  if (d.bearers) {
    for (const b of d.bearers) {
      out.push({
        cls: "cap-badge bg-secondary",
        title: b === "BR/EDR" ? "Classic Bluetooth" : "Bluetooth Low Energy",
        text: b,
      });
    }
  }

  const uuids = (d.uuids || []).map((u) => u.toLowerCase());
  const activeProfile = d.audio_profile || "a2dp";
  const hasA2dp = uuids.some((u) => u.startsWith("0000110b"));
  const hasHfpHsp = uuids.some(
    (u) => u.startsWith("0000111e") || u.startsWith("00001108"),
  );
  const hfpSwitching = info.hfpSwitchingEnabled;

  if (hasA2dp) {
    if (!connected) {
      out.push({ cls: "cap-badge bg-info", title: "A2DP stereo audio available", text: "A2DP" });
    } else if (hfpSwitching && activeProfile !== "a2dp") {
      out.push({ cls: "cap-badge bg-info", title: "A2DP stereo audio available", text: "A2DP" });
    } else {
      out.push({ cls: "cap-badge bg-success", title: "A2DP stereo audio (active)", text: "A2DP ✓" });
    }
  }

  if (hasHfpHsp) {
    if (!connected) {
      out.push({ cls: "cap-badge bg-info", title: "Hands-Free / Headset Profile available", text: "HFP" });
    } else if (hfpSwitching && activeProfile === "hfp") {
      out.push({ cls: "cap-badge bg-success", title: "HFP/HSP mono + mic (active)", text: "HFP ✓" });
    } else if (hfpSwitching) {
      out.push({ cls: "cap-badge bg-info", title: "Hands-Free / Headset Profile available", text: "HFP" });
    }
  }

  const hasAvrcpCap = uuids.some(
    (u) => u.startsWith("0000110c") || u.startsWith("0000110e"),
  );
  if (hasAvrcpCap) {
    if (!connected) {
      out.push({ cls: "cap-badge bg-info", title: "AVRCP media control available", text: "AVRCP" });
    } else if (d.avrcp_enabled !== false) {
      out.push({ cls: "cap-badge bg-success", title: "Media buttons enabled", text: "AVRCP ✓" });
    } else {
      out.push({ cls: "cap-badge bg-warning text-dark", title: "Media buttons disabled", text: "AVRCP ✗" });
    }
  }

  return out;
});
</script>

<template>
  <span
    v-for="(b, i) in badges"
    :key="i"
    :class="b.cls"
    :title="b.title"
  >{{ b.text }}</span>
  <span
    v-if="badges.length === 0"
    class="cap-badge"
    style="visibility: hidden"
  >&nbsp;</span>
</template>
