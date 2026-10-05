<template>
  <div v-if="lock.address">
    <v-row>
      <!-- Settings -->
      <v-col cols="12" md="6">
        <v-card class="pa-0 h-100 d-flex flex-column">
          <div class="px-5 pt-4 pb-2">
            <div class="d-flex align-center ga-2 mb-1">
              <v-icon icon="mdi-tune-variant" size="20" class="text-medium-emphasis" />
              <h2 class="text-subtitle-1 font-weight-bold">{{ $t('settings.title') }}</h2>
            </div>
          </div>
          <v-divider />
          <v-card-text class="flex-grow-1">
            <div class="mb-4">
              <div class="d-flex align-center ga-2 mb-1">
                <v-icon icon="mdi-lock-clock" size="18" class="text-medium-emphasis" />
                <span class="text-body-2 font-weight-medium">{{ $t('settings.autoLockTime') }}</span>
              </div>
              <v-slider
                v-model="autoLockTime"
                :disabled="!lock.hasAutoLock"
                thumb-label="always"
                :hint="autoLockHint"
                persistent-hint
                color="primary"
                max="60"
                min="0"
                class="mt-6"
              />
            </div>

            <v-divider class="mb-3" />

            <v-switch
              v-model="audio"
              prepend-icon="mdi-volume-high"
              :label="$t('lock.sound')"
              persistent-hint
              :hint="$t('settings.soundHint')"
              color="primary"
              density="comfortable"
              hide-details="auto"
            />
          </v-card-text>
          <v-divider />
          <v-card-actions class="px-4 py-3">
            <v-spacer />
            <v-btn
              color="primary"
              variant="flat"
              prepend-icon="mdi-content-save-outline"
              :disabled="!changesMade"
              :loading="waitingSettings"
              @click="saveSettings"
            >{{ $t('common.save') }}</v-btn>
          </v-card-actions>
        </v-card>
      </v-col>

      <!-- Right column -->
      <v-col cols="12" md="6">
        <!-- Sync clock -->
        <v-card class="mb-4">
          <div class="px-5 pt-4 pb-2">
            <div class="d-flex align-center ga-2 mb-1">
              <v-icon icon="mdi-clock-outline" size="20" class="text-medium-emphasis" />
              <h2 class="text-subtitle-1 font-weight-bold">{{ $t('settings.syncClock') }}</h2>
            </div>
          </div>
          <v-divider />
          <v-card-text>
            <div class="d-flex align-center justify-space-between flex-wrap ga-3">
              <div class="text-body-2 text-medium-emphasis">{{ $t('settings.syncClockHint') }}</div>
              <v-btn
                color="primary"
                variant="tonal"
                prepend-icon="mdi-clock-sync-outline"
                :loading="waitingCalibrate"
                @click="calibrateTime"
              >{{ $t('settings.syncClock') }}</v-btn>
            </div>
          </v-card-text>
        </v-card>

        <!-- Device info -->
        <v-card v-if="lock.manufacturer || lock.model || lock.firmware" class="mb-4">
          <div class="px-5 pt-4 pb-2">
            <div class="d-flex align-center ga-2 mb-1">
              <v-icon icon="mdi-information-outline" size="20" class="text-medium-emphasis" />
              <h2 class="text-subtitle-1 font-weight-bold">{{ $t('settings.deviceInfo') }}</h2>
            </div>
          </div>
          <v-divider />
          <v-card-text class="py-2">
            <div v-if="lock.manufacturer" class="d-flex justify-space-between py-2">
              <span class="text-body-2 text-medium-emphasis">{{ $t('settings.manufacturer') }}</span>
              <span class="text-body-2 font-weight-medium">{{ lock.manufacturer }}</span>
            </div>
            <v-divider v-if="lock.manufacturer && (lock.model || lock.firmware)" />
            <div v-if="lock.model" class="d-flex justify-space-between py-2">
              <span class="text-body-2 text-medium-emphasis">{{ $t('settings.model') }}</span>
              <span class="text-body-2 font-weight-medium">{{ lock.model }}</span>
            </div>
            <v-divider v-if="lock.model && lock.firmware" />
            <div v-if="lock.firmware" class="d-flex justify-space-between py-2">
              <span class="text-body-2 text-medium-emphasis">{{ $t('settings.firmware') }}</span>
              <span class="text-body-2 font-weight-medium">{{ lock.firmware }}</span>
            </div>
          </v-card-text>
        </v-card>

        <!-- Danger zone -->
        <v-card class="danger-card">
          <div class="px-5 pt-4 pb-2">
            <div class="d-flex align-center ga-2 mb-1">
              <v-icon icon="mdi-alert-circle-outline" size="20" color="error" />
              <h2 class="text-subtitle-1 font-weight-bold text-error">{{ $t('settings.dangerZone') }}</h2>
            </div>
          </div>
          <v-divider />
          <v-card-text>
            <div class="d-flex align-center justify-space-between flex-wrap ga-3">
              <div class="text-body-2 text-medium-emphasis">{{ $t('settings.unpairWarning') }}</div>
              <v-btn color="error" variant="flat" prepend-icon="mdi-link-off" @click="unpair">
                {{ $t('settings.unpair') }}
              </v-btn>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <ConfirmDlg ref="confirm" />

    <v-snackbar v-model="calibrateSnackbar" :color="calibrateSnackbarColor" timeout="3000" location="bottom">
      {{ calibrateSnackbarText }}
    </v-snackbar>
  </div>
</template>

<script>
import ConfirmDlg from "@/components/ConfirmDlg.vue"

export default {
  name: "SettingsManager",
  components: { ConfirmDlg },
  props: {
    address: { type: String, required: true },
  },
  emits: ["unpaired"],
  data() {
    return {
      autoLockTime: -1,
      audio: false,
      calibrateSnackbar: false,
      calibrateSnackbarColor: 'success',
      calibrateSnackbarText: '',
    }
  },
  computed: {
    lock() {
      return this.$store.state.locks.find(l => l.address == this.address) || {}
    },
    waitingSettings() {
      return this.$store.state.waitingSettings
    },
    waitingCalibrate() {
      return this.$store.state.waitingCalibrate
    },
    calibrateSuccess() {
      return this.$store.state.calibrateSuccess
    },
    autoLockHint() {
      if (this.lock.hasAutoLock) {
        return this.$t('settings.autoLockHint', { value: this.lock.autoLockTime })
      }
      return this.$t('settings.autoLockNotSupported')
    },
    autoLockChanged() {
      return this.autoLockTime != this.lock.autoLockTime
    },
    audioChanged() {
      return this.audio != this.lock.audio
    },
    changesMade() {
      return this.autoLockChanged || this.audioChanged
    },
  },
  created() {
    this.loadForAddress()
  },
  beforeUnmount() {
    this.$store.commit("setActiveLockAddress", "")
  },
  methods: {
    loadForAddress() {
      if (this.lock.address) {
        this.autoLockTime = this.lock.autoLockTime
        this.audio = this.lock.audio
        this.$store.commit("setActiveLockAddress", this.lock.address)
      }
    },
    async unpair() {
      if (await this.$refs.confirm.open(this.$t('common.confirm'), this.$t('settings.confirmUnpair'))) {
        await this.$store.dispatch("unpair", this.lock.address)
        this.$emit("unpaired", this.lock.address)
      }
    },
    calibrateTime() {
      this.$store.dispatch("calibrateTime", this.lock.address)
    },
    saveSettings() {
      const settings = {}
      if (this.autoLockChanged) settings.autolock = this.autoLockTime
      if (this.audioChanged) settings.audio = this.audio
      this.$store.dispatch("saveSettings", { lockAddress: this.lock.address, settings })
    },
  },
  watch: {
    address() {
      this.loadForAddress()
    },
    waitingSettings(newVal) {
      if (newVal === false) {
        this.autoLockTime = this.lock.autoLockTime
        this.audio = this.lock.audio
      }
    },
    calibrateSuccess(newVal) {
      if (newVal === null) return
      if (newVal === true) {
        this.calibrateSnackbarColor = 'success'
        this.calibrateSnackbarText = this.$t('settings.syncClockSuccess')
      } else {
        this.calibrateSnackbarColor = 'error'
        this.calibrateSnackbarText = this.$t('settings.syncClockError')
      }
      this.calibrateSnackbar = true
      this.$store.commit('setCalibrateSuccess', null)
    },
  },
}
</script>

<style scoped>
.danger-card {
  border-color: rgba(239, 68, 68, 0.4) !important;
}
</style>
