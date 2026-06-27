<template>
  <div>
    <h2 class="text-h5 font-weight-bold mb-4">{{ $t("dashboard.devices") }}</h2>

    <v-row dense>
      <v-col cols="12" sm="6" lg="4">
        <v-card
          class="add-tile d-flex align-center justify-center"
          :class="{ scanning }"
          height="100%"
          min-height="120"
          role="button"
          @click="scan"
        >
          <div class="d-flex flex-column align-center ga-2 py-6">
            <v-progress-circular v-if="scanning" indeterminate size="28" width="3" color="primary" />
            <v-icon v-else size="32" color="primary">mdi-plus</v-icon>
            <span class="text-body-2 font-weight-medium">{{ addLabel }}</span>
          </div>
        </v-card>
      </v-col>

      <v-col v-for="d in devices" :key="d.address" cols="12" sm="6" lg="4">
        <DeviceCard :device="d" />
      </v-col>
    </v-row>

    <v-alert
      v-if="devices.length === 0 && !scanning"
      type="info"
      variant="tonal"
      class="mt-4"
    >
      {{ $t("dashboard.emptyHint") }}
    </v-alert>
  </div>
</template>

<script>
import DeviceCard from "@/components/DeviceCard.vue";

export default {
  name: "HomeView",
  components: { DeviceCard },
  data() {
    return { now: Date.now(), timer: null };
  },
  computed: {
    devices() {
      return this.$store.state.devices;
    },
    scanning() {
      return this.$store.state.scanning;
    },
    remaining() {
      const ends = this.$store.state.scanEndsAt;
      if (!this.scanning || !ends) return 0;
      return Math.max(0, Math.ceil((ends - this.now) / 1000));
    },
    addLabel() {
      if (!this.scanning) return this.$t("dashboard.addDevice");
      return this.remaining > 0
        ? this.$t("dashboard.scanning", { n: this.remaining })
        : this.$t("dashboard.finishing");
    },
  },
  mounted() {
    this.timer = setInterval(() => {
      this.now = Date.now();
    }, 1000);
  },
  beforeUnmount() {
    clearInterval(this.timer);
  },
  methods: {
    scan() {
      this.$store.dispatch("scan");
    },
  },
};
</script>

<style scoped>
.add-tile {
  border-style: dashed !important;
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}
.add-tile:hover,
.add-tile.scanning {
  border-color: rgb(var(--v-theme-primary)) !important;
  background-color: rgba(var(--v-theme-primary), 0.04);
}
</style>
