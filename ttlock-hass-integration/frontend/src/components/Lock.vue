<template>
  <v-card :loading="waiting" class="lock-card pa-0 d-flex flex-column h-100">
    <!-- Header -->
    <div class="d-flex align-start pa-4 pb-3">
      <div class="flex-grow-1 overflow-hidden">
        <div class="text-subtitle-1 font-weight-bold text-truncate">
          {{ lock.name }}
        </div>
        <div class="text-caption text-medium-emphasis font-mono text-truncate">
          {{ lock.address }}
        </div>
      </div>
      <v-chip
        :color="stateColor"
        variant="tonal"
        size="small"
        class="flex-shrink-0"
        :prepend-icon="stateBadgeIcon"
      >
        {{ stateLabel }}
      </v-chip>
    </div>

    <!-- Center: lock state -->
    <div
      class="lock-visual flex-grow-1 d-flex flex-column align-center justify-center px-4 py-4"
    >
      <div class="lock-icon-wrap mb-3" :class="`bg-${stateColor}-tonal`">
        <transition name="icon-swap" mode="out-in">
          <v-icon :key="stateIcon" :icon="stateIcon" :color="stateColor" size="36" />
        </transition>
      </div>
      <!-- Informations : libellé explicite pour chaque valeur -->
      <div v-if="stats.length" class="lock-stats w-100">
        <div v-for="stat in stats" :key="stat.key" class="lock-stat d-flex align-center ga-2">
          <v-icon size="18" :icon="stat.icon" :color="stat.color" class="flex-shrink-0" />
          <div class="min-w-0">
            <div class="text-caption text-medium-emphasis lh-tight text-truncate">{{ stat.label }}</div>
            <div
              class="text-body-2 font-weight-medium lh-tight text-truncate"
              :class="stat.color ? `text-${stat.color}` : ''"
            >{{ stat.value }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer actions -->
    <v-divider />
    <div class="d-flex align-center pa-3 ga-2">
      <v-btn
        v-if="canUnlock"
        size="default"
        variant="flat"
        color="primary"
        prepend-icon="mdi-lock-open-variant"
        :loading="waiting"
        :disabled="waiting"
        class="flex-grow-1"
        @click="unlockLock"
        >{{ $t("lock.unlock") }}</v-btn
      >

      <v-btn
        v-else-if="canLock"
        size="default"
        variant="tonal"
        color="primary"
        prepend-icon="mdi-lock"
        :loading="waiting"
        :disabled="waiting"
        class="flex-grow-1"
        @click="lockLock"
        >{{ $t("lock.lock") }}</v-btn
      >

      <v-btn
        v-else-if="canPair"
        size="default"
        variant="flat"
        color="primary"
        prepend-icon="mdi-bluetooth-connect"
        :loading="waiting"
        :disabled="waiting"
        class="flex-grow-1"
        @click="pairLock"
        >{{ $t("lock.pair") }}</v-btn
      >

      <v-btn
        v-else
        size="default"
        variant="tonal"
        color="secondary"
        prepend-icon="mdi-lock-question"
        disabled
        class="flex-grow-1"
        >{{ stateLabel }}</v-btn
      >

      <template v-if="!canPair">
        <!-- Menu contextuel -->
        <v-menu>
          <template #activator="{ props }">
            <v-btn
              v-bind="props"
              icon="mdi-dots-vertical"
              variant="text"
              size="small"
            />
          </template>
          <v-list density="comfortable">
            <v-list-item @click="openActivity">
              <template #prepend>
                <v-icon color="success" size="18" class="mr-3"
                  >mdi-console-line</v-icon
                >
              </template>
              <v-list-item-title class="text-caption">{{
                $t("lock.operationLog")
              }}</v-list-item-title>
            </v-list-item>
            <v-list-item @click="openOverlay('settings')">
              <template #prepend>
                <v-icon color="primary" size="18" class="mr-3"
                  >mdi-cog-outline</v-icon
                >
              </template>
              <v-list-item-title class="text-caption">{{
                $t("lock.settings")
              }}</v-list-item-title>
            </v-list-item>
            <v-list-item @click="openRename">
              <template #prepend>
                <v-icon color="info" size="18" class="mr-3"
                  >mdi-rename-box</v-icon
                >
              </template>
              <v-list-item-title class="text-caption">{{
                $t("lock.rename")
              }}</v-list-item-title>
            </v-list-item>
            <v-divider class="my-1" />
            <v-list-item @click="openOverlay('credentials')">
              <template #prepend>
                <v-icon color="warning" size="18" class="mr-3"
                  >mdi-key-chain</v-icon
                >
              </template>
              <v-list-item-title class="text-caption">{{
                $t("lock.credentials")
              }}</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-menu>
      </template>
    </div>

    <!-- Dialogue de renommage -->
    <v-dialog v-model="renameDialog" max-width="420">
      <v-card>
        <v-card-title class="text-subtitle-1">{{
          $t("lock.renameTitle")
        }}</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="renameValue"
            :label="$t('lock.renameLabel')"
            :placeholder="lock.address"
            variant="outlined"
            density="comfortable"
            autofocus
            counter="64"
            maxlength="64"
            hide-details="auto"
            @keyup.enter="saveRename"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="renameDialog = false">{{
            $t("common.cancel")
          }}</v-btn>
          <v-btn color="primary" variant="flat" @click="saveRename">{{
            $t("common.save")
          }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-card>
</template>

<script>
export default {
  props: ["lock"],
  data() {
    return { renameDialog: false, renameValue: "" };
  },
  computed: {
    canLock() {
      return this.lock.paired && this.lock.locked === 1;
    },
    canUnlock() {
      return this.lock.paired && this.lock.locked === 0;
    },
    canPair() {
      return !this.lock.paired;
    },
    waiting() {
      return (
        this.$store.state.waiting &&
        this.$store.state.waitingAddress === this.lock.address
      );
    },
    batteryIcon() {
      const b = this.lock.battery;
      if (b > 90) return "mdi-battery-bluetooth";
      if (b > 80) return "mdi-battery-90-bluetooth";
      if (b > 70) return "mdi-battery-80-bluetooth";
      if (b > 60) return "mdi-battery-70-bluetooth";
      if (b > 50) return "mdi-battery-60-bluetooth";
      if (b > 40) return "mdi-battery-50-bluetooth";
      if (b > 30) return "mdi-battery-40-bluetooth";
      if (b > 20) return "mdi-battery-30-bluetooth";
      return "mdi-battery-alert-bluetooth";
    },
    batteryColor() {
      const b = this.lock.battery;
      if (b > 50) return "success";
      if (b > 20) return "warning";
      return "error";
    },
    rssiIcon() {
      const r = this.lock.rssi;
      if (r < -86) return "mdi-signal-cellular-outline";
      if (r < -80) return "mdi-signal-cellular-1";
      if (r < -70) return "mdi-signal-cellular-2";
      return "mdi-signal-cellular-3";
    },
    rssiColor() {
      const r = this.lock.rssi;
      if (r < -86) return "error";
      if (r < -80) return "warning";
      return "success";
    },
    stateIcon() {
      if (this.lock.locked === 0) return "mdi-lock";
      if (this.lock.locked === 1) return "mdi-lock-open-variant";
      return "mdi-lock-question";
    },
    stateBadgeIcon() {
      if (this.lock.locked === 0) return "mdi-lock";
      if (this.lock.locked === 1) return "mdi-lock-open-variant";
      return "mdi-help-circle-outline";
    },
    // Verrouillé = état sûr (vert), déverrouillé = attention (orange).
    stateColor() {
      if (this.canPair) return "secondary";
      if (this.lock.locked === 0) return "success";
      if (this.lock.locked === 1) return "warning";
      return "secondary";
    },
    stats() {
      const stats = [];
      if (typeof this.lock.battery === "number" && this.lock.battery >= 0) {
        stats.push({
          key: "battery",
          icon: this.batteryIcon,
          color: this.batteryColor,
          label: this.$t("lock.battery"),
          value: `${this.lock.battery} %`,
        });
      }
      if (typeof this.lock.rssi === "number") {
        stats.push({
          key: "rssi",
          icon: this.rssiIcon,
          color: this.rssiColor,
          label: this.$t("lock.signal"),
          value: `${this.lock.rssi} dBm`,
        });
      }
      if (this.lock.hasAutoLock && this.lock.autoLockTime >= 0) {
        stats.push({
          key: "autolock",
          icon: "mdi-lock-clock",
          color: null,
          label: this.$t("lock.autoLockTime"),
          value:
            this.lock.autoLockTime > 0
              ? `${this.lock.autoLockTime} s`
              : this.$t("lock.autoLockOff"),
        });
      }
      if (this.lock.hasAudio && this.lock.audio !== undefined) {
        stats.push({
          key: "audio",
          icon: this.lock.audio ? "mdi-volume-high" : "mdi-volume-off",
          color: null,
          label: this.$t("lock.sound"),
          value: this.lock.audio ? this.$t("lock.soundOn") : this.$t("lock.soundOff"),
        });
      }
      return stats;
    },
    stateLabel() {
      if (this.canPair) return this.$t("lock.unknown");
      if (this.lock.locked === 0) return this.$t("lock.locked");
      if (this.lock.locked === 1) return this.$t("lock.unlocked");
      return this.$t("lock.unknown");
    },
  },
  methods: {
    async unlockLock() {
      if (this.waiting) return;
      try {
        await this.$store.dispatch("unlock", this.lock.address);
      } catch (error) {
        console.error(error);
      }
    },
    async lockLock() {
      if (this.waiting) return;
      try {
        await this.$store.dispatch("lock", this.lock.address);
      } catch (error) {
        console.error(error);
      }
    },
    async pairLock() {
      if (this.waiting) return;
      try {
        await this.$store.dispatch("pair", this.lock.address);
      } catch (error) {
        console.error(error);
      }
    },
    openActivity() {
      this.$router.push({ name: "Activity", params: { address: this.lock.address } });
    },
    openOverlay(overlay) {
      this.$store.commit("setOverlay", { overlay, address: this.lock.address });
    },
    openRename() {
      this.renameValue =
        this.lock.name === this.lock.address ? "" : this.lock.name;
      this.renameDialog = true;
    },
    async saveRename() {
      this.renameDialog = false;
      try {
        await this.$store.dispatch("rename", {
          lockAddress: this.lock.address,
          name: this.renameValue.trim(),
        });
      } catch (error) {
        console.error(error);
      }
    },
  },
};
</script>

<style scoped>
.font-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.72rem;
}
.lock-icon-wrap {
  width: 72px;
  height: 72px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.bg-success-tonal {
  background: rgba(var(--v-theme-success), 0.12);
}
.bg-warning-tonal {
  background: rgba(var(--v-theme-warning), 0.12);
}
.lock-stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 12px;
}
.lock-stat {
  padding: 6px 10px;
  border-radius: 10px;
  background: rgba(var(--v-theme-on-surface), 0.04);
}
.lh-tight {
  line-height: 1.25;
}
.min-w-0 {
  min-width: 0;
}
.bg-secondary-tonal {
  background: rgba(var(--v-theme-secondary), 0.12);
}
.icon-swap-enter-active,
.icon-swap-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.icon-swap-enter-from,
.icon-swap-leave-to {
  opacity: 0;
  transform: scale(0.75);
}
</style>
