<script setup>
import { useDevicesStore } from "@/stores/devices.js";
import Banners from "@/components/Banners.vue";
import AddDeviceTile from "@/components/AddDeviceTile.vue";
import DeviceCard from "@/components/DeviceCard.vue";

const devices = useDevicesStore();
</script>

<template>
  <div class="view-panel">
    <div class="container py-3">
      <Banners />
      <h2 class="mb-3">
        Devices
      </h2>
      <div class="devices-layout">
        <AddDeviceTile />
        <div class="row g-3">
          <DeviceCard
            v-for="d in devices.displayed"
            :key="d.address"
            :device="d"
          />
          <div
            v-if="!devices.displayed.length"
            class="col-12 text-center py-5"
          >
            <p class="text-muted">
              Click "Add Device" to discover nearby Bluetooth audio devices.
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
