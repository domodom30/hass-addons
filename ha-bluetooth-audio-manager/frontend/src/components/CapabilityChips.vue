<template>
  <div class="d-flex flex-wrap ga-1">
    <v-chip
      v-for="(c, i) in chips"
      :key="i"
      :color="c.color"
      :title="c.title"
      size="x-small"
      variant="tonal"
      label
    >
      {{ c.text }}
    </v-chip>
  </div>
</template>

<script>
export default {
  name: "CapabilityChips",
  props: {
    device: { type: Object, required: true },
  },
  computed: {
    hfpSwitching() {
      return this.$store.state.info.hfpSwitchingEnabled;
    },
    chips() {
      const d = this.device;
      const connected = d.connected;
      const out = [];

      if (d.bearers) {
        for (const b of d.bearers) {
          out.push({
            color: "secondary",
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

      if (hasA2dp) {
        if (connected && (!this.hfpSwitching || activeProfile === "a2dp")) {
          out.push({ color: "success", title: "A2DP stereo audio (active)", text: "A2DP ✓" });
        } else {
          out.push({ color: "info", title: "A2DP stereo audio available", text: "A2DP" });
        }
      }

      if (hasHfpHsp) {
        if (connected && this.hfpSwitching && activeProfile === "hfp") {
          out.push({ color: "success", title: "HFP/HSP mono + mic (active)", text: "HFP ✓" });
        } else if (!connected || this.hfpSwitching) {
          out.push({ color: "info", title: "Hands-Free / Headset Profile available", text: "HFP" });
        }
      }

      const hasAvrcpCap = uuids.some(
        (u) => u.startsWith("0000110c") || u.startsWith("0000110e"),
      );
      if (hasAvrcpCap) {
        if (!connected) {
          out.push({ color: "info", title: "AVRCP media control available", text: "AVRCP" });
        } else if (d.avrcp_enabled !== false) {
          out.push({ color: "success", title: "Media buttons enabled", text: "AVRCP ✓" });
        } else {
          out.push({ color: "warning", title: "Media buttons disabled", text: "AVRCP ✗" });
        }
      }

      return out;
    },
  },
};
</script>
