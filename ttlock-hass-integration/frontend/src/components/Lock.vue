<template>
  <v-card :loading="busy" class="lock-card pa-0 d-flex flex-column h-100">
    <!-- Header -->
    <div class="d-flex align-start pa-4 pb-3">
      <div class="flex-grow-1 overflow-hidden">
        <div class="text-subtitle-1 font-weight-bold text-truncate">{{ lock.name }}</div>
        <div class="text-caption text-medium-emphasis font-mono text-truncate">{{ lock.address }}</div>
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
    <div class="lock-visual flex-grow-1 d-flex flex-column align-center justify-center px-4 py-4">
      <div class="lock-icon-wrap mb-3" :class="`bg-${stateColor}-tonal`">
        <v-icon :icon="stateIcon" :color="stateColor" size="36" />
      </div>
      <div class="d-flex align-center ga-2 flex-wrap justify-center">
        <v-chip
          v-if="typeof lock.battery === 'number' && lock.battery >= 0"
          size="x-small" :color="batteryColor" variant="tonal"
        >
          <v-icon start size="14" :icon="batteryIcon" />
          {{ lock.battery }}%
        </v-chip>
        <v-chip
          v-if="typeof lock.rssi === 'number'"
          size="x-small" :color="rssiColor" variant="tonal"
        >
          <v-icon start size="14" :icon="rssiIcon" />
          {{ lock.rssi }}dB
        </v-chip>
        <v-chip
          v-if="lock.hasAutoLock && lock.autoLockTime >= 0"
          size="x-small" variant="tonal" color="secondary"
          prepend-icon="mdi-lock-clock"
        >
          {{ lock.autoLockTime > 0 ? lock.autoLockTime + 's' : $t('lock.autoLockOff') }}
        </v-chip>
        <v-chip
          v-if="lock.hasAudio && lock.audio !== undefined"
          size="x-small" variant="tonal"
          :color="lock.audio ? 'success' : 'secondary'"
          :prepend-icon="lock.audio ? 'mdi-volume-high' : 'mdi-volume-off'"
        >
          {{ lock.audio ? $t('lock.soundOn') : $t('lock.soundOff') }}
        </v-chip>
      </div>
    </div>

    <!-- Footer actions -->
    <v-divider />
    <div class="d-flex align-center pa-3 ga-2">
      <v-btn
        v-if="canUnlock"
        size="default" variant="flat" color="primary"
        prepend-icon="mdi-lock-open-variant"
        :loading="waiting" :disabled="waiting"
        class="flex-grow-1"
        @click="unlockLock"
      >{{ $t('lock.unlock') }}</v-btn>

      <v-btn
        v-else-if="canLock"
        size="default" variant="tonal" color="primary"
        prepend-icon="mdi-lock"
        :loading="waiting" :disabled="waiting"
        class="flex-grow-1"
        @click="lockLock"
      >{{ $t('lock.lock') }}</v-btn>

      <v-btn
        v-else-if="canPair"
        size="default" variant="flat" color="primary"
        prepend-icon="mdi-bluetooth-connect"
        :loading="busy" :disabled="busy"
        class="flex-grow-1"
        @click="pairLock"
      >{{ $t('lock.pair') }}</v-btn>

      <v-btn
        v-else
        size="default" variant="tonal" color="secondary"
        prepend-icon="mdi-lock-question"
        disabled
        class="flex-grow-1"
      >{{ stateLabel }}</v-btn>

      <template v-if="!canPair">
        <!-- Menu contextuel -->
        <v-menu>
          <template #activator="{ props }">
            <v-btn v-bind="props" icon="mdi-dots-vertical" variant="text" size="small" />
          </template>
          <v-list density="comfortable">
            <v-list-item @click="openOverlay('logs')">
              <template #prepend>
                <v-icon color="success" size="18" class="mr-3">mdi-console-line</v-icon>
              </template>
              <v-list-item-title class="text-caption">{{ $t('lock.operationLog') }}</v-list-item-title>
            </v-list-item>
            <v-list-item @click="openOverlay('settings')">
              <template #prepend>
                <v-icon color="primary" size="18" class="mr-3">mdi-cog-outline</v-icon>
              </template>
              <v-list-item-title class="text-caption">{{ $t('lock.settings') }}</v-list-item-title>
            </v-list-item>
            <v-divider class="my-1" />
            <v-list-item @click="openOverlay('credentials')">
              <template #prepend>
                <v-icon color="warning" size="18" class="mr-3">mdi-key-chain</v-icon>
              </template>
              <v-list-item-title class="text-caption">{{ $t('lock.credentials') }}</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-menu>
      </template>
    </div>
  </v-card>
</template>

<script>
export default {
  props: ["lock"],
  data() {
    return { busy: false }
  },
  computed: {
    canLock() {
      return this.lock.paired && this.lock.locked === 1
    },
    canUnlock() {
      return this.lock.paired && this.lock.locked === 0
    },
    canPair() {
      return !this.lock.paired
    },
    waiting() {
      return this.$store.state.waiting || this.$store.state.waitingCredentials || this.$store.state.scanStatus == 1
    },
    batteryIcon() {
      const b = this.lock.battery
      if (b > 90) return 'mdi-battery-bluetooth'
      if (b > 80) return 'mdi-battery-90-bluetooth'
      if (b > 70) return 'mdi-battery-80-bluetooth'
      if (b > 60) return 'mdi-battery-70-bluetooth'
      if (b > 50) return 'mdi-battery-60-bluetooth'
      if (b > 40) return 'mdi-battery-50-bluetooth'
      if (b > 30) return 'mdi-battery-40-bluetooth'
      if (b > 20) return 'mdi-battery-30-bluetooth'
      return 'mdi-battery-alert-bluetooth'
    },
    batteryColor() {
      const b = this.lock.battery
      if (b > 50) return 'success'
      if (b > 20) return 'warning'
      return 'error'
    },
    rssiIcon() {
      const r = this.lock.rssi
      if (r < -86) return 'mdi-signal-cellular-outline'
      if (r < -80) return 'mdi-signal-cellular-1'
      if (r < -70) return 'mdi-signal-cellular-2'
      return 'mdi-signal-cellular-3'
    },
    rssiColor() {
      const r = this.lock.rssi
      if (r < -86) return 'error'
      if (r < -80) return 'warning'
      return 'success'
    },
    stateIcon() {
      if (this.lock.locked === 0) return 'mdi-lock'
      if (this.lock.locked === 1) return 'mdi-lock-open-variant'
      return 'mdi-lock-question'
    },
    stateBadgeIcon() {
      if (this.lock.locked === 0) return 'mdi-lock'
      if (this.lock.locked === 1) return 'mdi-lock-open-variant'
      return 'mdi-help-circle-outline'
    },
    stateColor() {
      if (this.canPair) return 'secondary'
      if (this.lock.locked === 0) return 'error'
      if (this.lock.locked === 1) return 'success'
      return 'secondary'
    },
    stateLabel() {
      if (this.canPair) return this.$t('lock.unknown')
      if (this.lock.locked === 0) return this.$t('lock.locked')
      if (this.lock.locked === 1) return this.$t('lock.unlocked')
      return this.$t('lock.unknown')
    },
  },
  methods: {
    async unlockLock() {
      if (this.busy) return
      this.busy = true
      try {
        await this.$store.dispatch("unlock", this.lock.address)
      } catch (error) {
        console.error(error)
      }
    },
    async lockLock() {
      if (this.busy) return
      this.busy = true
      try {
        await this.$store.dispatch("lock", this.lock.address)
      } catch (error) {
        console.error(error)
      }
    },
    async pairLock() {
      if (this.busy) return
      this.busy = true
      try {
        await this.$store.dispatch("pair", this.lock.address)
      } catch (error) {
        console.error(error)
      }
    },
    openOverlay(overlay) {
      this.$store.commit("setOverlay", { overlay, address: this.lock.address })
    },
  },
  watch: {
    waiting(newVal) {
      if (!newVal) this.busy = false
    },
  },
}
</script>

<style scoped>
.lock-card {
  transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
}
.lock-card:hover {
  transform: translateY(-2px);
  border-color: rgb(var(--v-theme-primary));
  box-shadow: 0 4px 18px -8px rgba(16, 185, 129, 0.25);
}
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
.bg-success-tonal { background: rgba(16, 185, 129, 0.12); }
.bg-error-tonal { background: rgba(239, 68, 68, 0.12); }
.bg-secondary-tonal { background: rgba(113, 113, 122, 0.12); }
</style>
