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
            title: b === "BR/EDR" ? this.$t("capability.classic") : this.$t("capability.le"),
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
          out.push({ color: "success", title: this.$t("capability.a2dpActive"), text: "A2DP ✓" });
        } else {
          out.push({ color: "info", title: this.$t("capability.a2dpAvailable"), text: "A2DP" });
        }
      }

      if (hasHfpHsp) {
        if (connected && this.hfpSwitching && activeProfile === "hfp") {
          out.push({ color: "success", title: this.$t("capability.hfpActive"), text: "HFP ✓" });
        } else if (!connected || this.hfpSwitching) {
          out.push({ color: "info", title: this.$t("capability.hfpAvailable"), text: "HFP" });
        }
      }

      const hasAvrcpCap = uuids.some(
        (u) => u.startsWith("0000110c") || u.startsWith("0000110e"),
      );
      if (hasAvrcpCap) {
        if (!connected) {
          out.push({ color: "info", title: this.$t("capability.avrcpAvailable"), text: "AVRCP" });
        } else if (d.avrcp_enabled !== false) {
          out.push({ color: "success", title: this.$t("capability.avrcpEnabled"), text: "AVRCP ✓" });
        } else {
          out.push({ color: "warning", title: this.$t("capability.avrcpDisabled"), text: "AVRCP ✗" });
        }
      }

      return out;
    },
  },
};
</script>
