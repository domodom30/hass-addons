<template>
  <div>
    <h2 class="text-h5 font-weight-bold mb-4">{{ $t("dashboard.devices") }}</h2>

    <v-row dense>
      <v-col v-for="d in devices" :key="d.address" cols="12" sm="6" lg="4">
        <DeviceCard :device="d" />
      </v-col>
    </v-row>

    <v-alert
      v-if="devices.length === 0"
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
  computed: {
    // Only managed devices on the grid; discovery/pairing lives in the wizard.
    devices() {
      return this.$store.getters.managedDevices;
    },
  },
};
</script>
