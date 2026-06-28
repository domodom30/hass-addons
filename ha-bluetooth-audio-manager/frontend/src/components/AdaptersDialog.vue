<template>
  <v-dialog v-model="show" max-width="760" scrollable>
    <v-card>
      <DialogHeader
        icon="mdi-chip"
        color="info"
        :title="$t('adapters.title')"
        @close="show = false"
      />
      <v-divider />
      <v-card-text class="pa-5">
        <v-alert type="warning" variant="tonal" density="compact" class="mb-3">
          <strong>{{ $t("adapters.recommendation") }}</strong> {{ $t("adapters.recommendationBody") }}
        </v-alert>
         <v-alert type="info" variant="tonal" density="compact" class="mb-3">
          {{ $t("adapters.onlyOne") }}
        </v-alert>

        <div v-if="adapters === null" class="text-center py-6">
          <v-progress-circular indeterminate color="primary" />
          <p class="mt-2 text-medium-emphasis">{{ $t("adapters.loading") }}</p>
        </div>
        <p v-else-if="rows.length === 0" class="text-center text-medium-emphasis py-4">
          {{ $t("adapters.none") }}
        </p>
        <v-card
          v-for="a in rows"
          v-else
          :key="a.address"
          class="mb-2"
          variant="tonal"
        >
          <div class="d-flex justify-space-between align-center pa-3">
            <div class="overflow-hidden">
              <div v-if="a.friendlyName" class="font-weight-medium text-truncate">{{ a.friendlyName }}</div>
              <div :class="a.friendlyName ? 'text-caption text-medium-emphasis' : 'font-weight-medium'">
                {{ a.techLine }}
              </div>
              <div class="font-mono text-caption text-medium-emphasis">{{ a.address }}</div>
            </div>
            <div class="d-flex align-center ga-2 flex-shrink-0">
              <v-chip :color="a.powered ? 'success' : 'secondary'" size="x-small" variant="tonal" label>
                {{ a.powered ? $t("adapters.powered") : $t("adapters.off") }}
              </v-chip>
              <v-chip v-if="a.selected" color="success" size="x-small" variant="flat" label>{{ $t("adapters.inUse") }}</v-chip>
              <v-chip v-if="a.ha_managed" color="info" size="x-small" variant="tonal" label>{{ $t("adapters.haBluetooth") }}</v-chip>
              <v-chip v-if="a.ble_scanning" color="warning" size="x-small" variant="tonal" label>{{ $t("adapters.bleScanning") }}</v-chip>
              <v-btn v-if="a.showSelect" color="primary" size="small" prepend-icon="mdi-check" @click="select(a)">
                {{ $t("adapters.select") }}
              </v-btn>
            </div>
          </div>
        </v-card>
      </v-card-text>
      <v-divider />
      <v-card-actions class="px-4 py-3">
        <v-spacer />
        <v-btn color="error" variant="flat" @click="show = false">{{ $t("common.close") }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import DialogHeader from "@/components/base/DialogHeader.vue";

export default {
  name: "AdaptersDialog",
  components: { DialogHeader },
  inject: ["confirm"],
  computed: {
    show: {
      get() {
        return this.$store.state.ui.overlay === "adapters";
      },
      set(v) {
        if (!v) this.$store.commit("clearOverlay");
      },
    },
    adapters() {
      return this.$store.state.adapters;
    },
    rows() {
      return (this.adapters || []).map((a) => {
        const hwResolved = a.hw_model && a.hw_model !== a.modalias;
        const aliasUseful = a.alias && a.alias !== a.name && !a.alias.includes(".");
        const friendlyName = hwResolved ? a.hw_model : aliasUseful ? a.alias : "";
        const techParts = [a.name];
        if (a.modalias) techParts.push(a.modalias);
        return {
          ...a,
          friendlyName,
          techLine: techParts.join(" — "),
          displayLabel: friendlyName || a.name,
          showSelect: !a.selected && a.powered,
        };
      });
    },
  },
  methods: {
    async select(a) {
      if (this.$store.getters.hasStoredOrPaired) {
        const ok = await this.confirm(
          this.$t("adapters.switchTitle"),
          this.$t("adapters.switchBody", { name: a.displayLabel }),
          { color: "warning", icon: "mdi-swap-horizontal", confirmText: this.$t("adapters.switchConfirm") },
        );
        if (!ok) return;
        this.$store.dispatch("setAdapter", { mac: a.address, label: a.displayLabel, clean: true });
      } else {
        this.$store.dispatch("setAdapter", { mac: a.address, label: a.displayLabel, clean: false });
      }
      this.show = false;
    },
  },
};
</script>
