<template>
  <v-dialog
    :model-value="open"
    max-width="600"
    persistent
    transition="dialog-bottom-transition"
  >
    <v-card>
      <!-- Header -->
      <div class="d-flex align-center ga-3 px-5 py-4">
        <v-avatar size="36" color="primary" variant="tonal">
          <v-icon size="20">mdi-plus-network-outline</v-icon>
        </v-avatar>
        <div class="flex-grow-1">
          <div class="text-subtitle-1 font-weight-bold">{{ $t('wizard.title') }}</div>
          <div class="text-caption text-medium-emphasis">{{ $t('wizard.step', { current: step, total: 3 }) }}</div>
        </div>
        <v-btn icon="mdi-close" variant="text" size="small" @click="close" />
      </div>

      <!-- Stepper header -->
      <div class="d-flex align-center px-5 pb-3 ga-2">
        <div
          v-for="s in 3"
          :key="s"
          class="step-dot flex-grow-1"
          :class="{ active: step === s, done: step > s }"
        />
      </div>

      <v-divider />

      <v-window :model-value="step" class="pa-5">
        <!-- Step 1: Scan -->
        <v-window-item :value="1">
          <div class="text-center py-4">
            <v-avatar size="72" :color="isScanning ? 'primary' : 'surface-variant'" variant="tonal" class="mb-4">
              <v-progress-circular v-if="isScanning" indeterminate color="primary" size="40" width="3" />
              <v-icon v-else size="40" color="primary">mdi-bluetooth-connect</v-icon>
            </v-avatar>
            <h3 class="text-subtitle-1 font-weight-bold mb-1">{{ $t('wizard.scanTitle') }}</h3>
            <p class="text-body-2 text-medium-emphasis mb-4 mx-auto" style="max-width: 380px;">
              {{ $t('wizard.scanHint') }}
            </p>
            <v-chip v-if="unpairedLocks.length > 0" color="success" variant="tonal" size="small" class="mb-4">
              <v-icon start size="16">mdi-lock-plus-outline</v-icon>
              {{ $t('wizard.found', { count: unpairedLocks.length }) }}
            </v-chip>
            <div>
              <v-btn
                color="primary"
                variant="tonal"
                prepend-icon="mdi-radar"
                :loading="isScanning"
                @click="startScan"
              >{{ $t('wizard.scanCta') }}</v-btn>
            </div>
          </div>
        </v-window-item>

        <!-- Step 2: Select & pair -->
        <v-window-item :value="2">
          <h3 class="text-subtitle-1 font-weight-bold mb-1">{{ $t('wizard.selectTitle') }}</h3>
          <p class="text-body-2 text-medium-emphasis mb-3">{{ $t('wizard.selectHint') }}</p>

          <div v-if="unpairedLocks.length === 0" class="text-center py-8 text-medium-emphasis">
            {{ $t('wizard.noneFound') }}
          </div>

          <v-list v-else class="border rounded-lg pa-0" density="comfortable">
            <template v-for="(lock, i) in unpairedLocks" :key="lock.address">
              <v-divider v-if="i > 0" />
              <v-list-item>
                <template #prepend>
                  <v-icon color="secondary">mdi-lock-outline</v-icon>
                </template>
                <v-list-item-title class="font-weight-medium">{{ lock.name || $t('wizard.unknownLock') }}</v-list-item-title>
                <v-list-item-subtitle class="font-mono">{{ lock.address }}</v-list-item-subtitle>
                <template #append>
                  <v-btn
                    color="primary"
                    variant="flat"
                    size="small"
                    prepend-icon="mdi-bluetooth-connect"
                    :loading="pairingAddress === lock.address && waiting"
                    :disabled="waiting"
                    @click="pair(lock.address)"
                  >{{ $t('lock.pair') }}</v-btn>
                </template>
              </v-list-item>
            </template>
          </v-list>
        </v-window-item>

        <!-- Step 3: Done -->
        <v-window-item :value="3">
          <div class="text-center py-6">
            <v-avatar size="72" color="success" variant="tonal" class="mb-4">
              <v-icon size="40" color="success">mdi-check-circle-outline</v-icon>
            </v-avatar>
            <h3 class="text-subtitle-1 font-weight-bold mb-1">{{ $t('wizard.doneTitle') }}</h3>
            <p class="text-body-2 text-medium-emphasis mx-auto" style="max-width: 380px;">
              {{ $t('wizard.doneHint', { name: pairedName }) }}
            </p>
          </div>
        </v-window-item>
      </v-window>

      <v-divider />

      <v-card-actions class="px-4 py-3">
        <v-btn v-if="step > 1 && step < 3" variant="text" @click="step--">{{ $t('common.back') }}</v-btn>
        <v-spacer />
        <v-btn v-if="step === 1" variant="text" @click="close">{{ $t('common.cancel') }}</v-btn>
        <v-btn
          v-if="step === 1"
          color="primary"
          variant="flat"
          append-icon="mdi-arrow-right"
          @click="step = 2"
        >{{ $t('common.continue') }}</v-btn>
        <v-btn v-if="step === 3" color="primary" variant="flat" @click="close">{{ $t('common.close') }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
export default {
  name: "AddLockWizard",
  data() {
    return {
      step: 1,
      pairingAddress: null,
      pairedName: "",
    }
  },
  computed: {
    open() {
      return this.$store.state.ui.overlay === "addWizard"
    },
    isScanning() {
      return this.$store.state.scanStatus === 1
    },
    waiting() {
      return this.$store.state.waiting
    },
    unpairedLocks() {
      return this.$store.state.locks.filter(l => !l.paired)
    },
  },
  watch: {
    open(now) {
      if (now) {
        this.step = 1
        this.pairingAddress = null
        this.pairedName = ""
        this.startScan()
      }
    },
    "$store.state.locks": {
      deep: true,
      handler() {
        if (!this.pairingAddress) return
        const lock = this.$store.state.locks.find(l => l.address === this.pairingAddress)
        if (lock && lock.paired) {
          this.pairedName = lock.name || this.pairingAddress
          this.pairingAddress = null
          this.step = 3
        }
      },
    },
  },
  methods: {
    startScan() {
      this.$store.dispatch("scan")
    },
    pair(address) {
      this.pairingAddress = address
      this.$store.dispatch("pair", address)
    },
    close() {
      this.$store.commit("clearOverlay")
    },
  },
}
</script>

<style scoped>
.font-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.72rem;
}
.step-dot {
  height: 4px;
  border-radius: 2px;
  background: rgba(var(--v-theme-on-surface), 0.12);
  transition: background-color 0.25s ease;
}
.step-dot.active { background: rgb(var(--v-theme-primary)); }
.step-dot.done { background: rgba(var(--v-theme-primary), 0.5); }
</style>
