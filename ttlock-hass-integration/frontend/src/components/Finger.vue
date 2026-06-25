<template>
  <v-dialog v-model="localShow" persistent max-width="560px" transition="dialog-bottom-transition">
    <v-card rounded="lg">

      <!-- En-tête -->
      <div class="d-flex align-center pa-5 pb-4 ga-3">
        <v-avatar size="36" color="primary" variant="tonal">
          <v-icon size="20">mdi-fingerprint</v-icon>
        </v-avatar>
        <div>
          <div class="text-subtitle-1 font-weight-bold">
            <template v-if="value == -1">{{ $t('common.add') }}</template>
            <template v-else>{{ $t('common.edit') }}</template>
            {{ $t('finger.title') }}
          </div>
          <div class="text-caption text-medium-emphasis">{{ $t('finger.aliasHint') }}</div>
        </div>
      </div>

      <v-divider />

      <!-- Scan en cours -->
      <template v-if="lockIsScanning">
        <v-alert
          type="info"
          variant="tonal"
          icon="mdi-fingerprint"
          rounded="0"
          class="border-b"
        >
          {{ $t('finger.scanPrompt') }}
        </v-alert>
        <div class="d-flex justify-center align-center py-4 gap-4">
          <v-progress-circular
            :model-value="(100 / 4) * lockScanningProgress"
            :rotate="-90"
            :size="80"
            :width="10"
            color="primary"
          >
            <span class="text-body-2 font-weight-bold">{{ lockScanningProgress }}/4</span>
          </v-progress-circular>
        </div>
        <v-divider />
      </template>

      <v-card-text class="pa-5">
        <!-- Alias -->
        <v-text-field
          v-model="alias"
          :label="$t('finger.alias')"
          :hint="$t('finger.aliasHint')"
          persistent-hint
          prepend-inner-icon="mdi-label-outline"
          variant="outlined"
          density="comfortable"
          class="mb-5"
        />

        <!-- Période de validité -->
        <div class="text-caption text-medium-emphasis text-uppercase font-weight-medium mb-3 d-flex align-center ga-1">
          <v-icon size="14" icon="mdi-calendar-range" />
          {{ $t('finger.validFrom') }} → {{ $t('finger.validTo') }}
        </div>

        <v-row dense>
          <!-- Début -->
          <v-col cols="6">
            <v-menu v-model="startDateMenu" :close-on-content-click="false" transition="scale-transition">
              <template #activator="{ props }">
                <v-text-field
                  v-model="startDate"
                  :label="$t('finger.validFrom')"
                  prepend-inner-icon="mdi-calendar-start"
                  readonly v-bind="props"
                  variant="outlined" density="comfortable"
                />
              </template>
              <v-date-picker v-model="startDate" @update:modelValue="startDateMenu = false" />
            </v-menu>
          </v-col>
          <v-col cols="6">
            <v-menu v-model="startTimeMenu" :close-on-content-click="false" transition="scale-transition">
              <template #activator="{ props }">
                <v-text-field
                  v-model="startTime"
                  :label="$t('finger.time')"
                  prepend-inner-icon="mdi-clock-start"
                  readonly v-bind="props"
                  variant="outlined" density="comfortable"
                />
              </template>
              <v-time-picker v-model="startTime" full-width format="24hr" @update:modelValue="startTimeMenu = false" />
            </v-menu>
          </v-col>

          <!-- Fin -->
          <v-col cols="6">
            <v-menu v-model="endDateMenu" :close-on-content-click="false" transition="scale-transition">
              <template #activator="{ props }">
                <v-text-field
                  v-model="endDate"
                  :label="$t('finger.validTo')"
                  prepend-inner-icon="mdi-calendar-end"
                  readonly v-bind="props"
                  variant="outlined" density="comfortable"
                />
              </template>
              <v-date-picker v-model="endDate" @update:modelValue="endDateMenu = false" />
            </v-menu>
          </v-col>
          <v-col cols="6">
            <v-menu v-model="endTimeMenu" :close-on-content-click="false" transition="scale-transition">
              <template #activator="{ props }">
                <v-text-field
                  v-model="endTime"
                  :label="$t('finger.time')"
                  prepend-inner-icon="mdi-clock-end"
                  readonly v-bind="props"
                  variant="outlined" density="comfortable"
                />
              </template>
              <v-time-picker v-model="endTime" full-width format="24hr" @update:modelValue="endTimeMenu = false" />
            </v-menu>
          </v-col>
        </v-row>
      </v-card-text>

      <v-progress-linear v-if="busy" indeterminate color="primary" height="2" />
      <v-divider v-else />

      <!-- Actions -->
      <v-card-actions class="px-4 py-3">
        <v-btn
          variant="text"
          :disabled="busy"
          @click="$emit('cancel')"
        >
          {{ $t('common.cancel') }}
        </v-btn>
        <v-spacer />
        <v-btn
          variant="flat"
          color="primary"
          prepend-icon="mdi-content-save-outline"
          :loading="busy"
          :disabled="busy"
          @click="saveFinger"
        >
          {{ $t('common.save') }}
        </v-btn>
      </v-card-actions>

    </v-card>
  </v-dialog>
</template>
<script>
import moment from "moment"
import { toRaw } from "vue"

export default {
  name: "Finger",
  props: ["show", "address", "value"],
  data: function () {
    return {
      localShow: false,
      finger: {},
      startDateMenu: false,
      startDate: "",
      startTimeMenu: false,
      startTime: "",
      endDateMenu: false,
      endDate: "",
      endTimeMenu: false,
      endTime: "",
      alias: "",
      busy: false,
    }
  },
  computed: {
    storeIsWaiting() {
      return this.$store.state.waitingCredentials
    },
    lockIsScanning() {
      return this.$store.state.waitingFingerScan
    },
    lockScanningProgress() {
      return this.$store.state.fingerScanProgress
    },
  },
  methods: {
    updateFinger(finger) {
      if (finger == -1) {
        this.finger = {
          fpNumber: -1,
          startDate: "202001010000",
          endDate: "203012312359",
          alias: ""
        }
      } else {
        this.finger = structuredClone(toRaw(finger))
      }
    },
    async saveFinger() {
      if (this.busy) return
      this.busy = true
      // Vuetify 3 v-date-picker / v-time-picker may emit Date objects (not strings)
      // once the user interacts with them — coerce defensively.
      const fmt = (date, time) => {
        const d = date instanceof Date ? moment(date).format("YYYY-MM-DD") : (date || "")
        const t = time instanceof Date ? moment(time).format("HH:mm") : (time || "")
        return d.replaceAll("-", "") + t.replaceAll(":", "")
      }
      this.finger.startDate = fmt(this.startDate, this.startTime)
      this.finger.endDate = fmt(this.endDate, this.endTime)
      this.finger.alias = this.alias
      await this.$store.dispatch("setFinger", {
        lockAddress: this.address,
        finger: this.finger,
      })
    },
  },
  created() {
    this.updateFinger(this.value)
  },
  watch: {
    show(newVal) {
      this.localShow = newVal
    },
    value(newVal) {
      this.updateFinger(newVal)
    },
    storeIsWaiting(newVal) {
      if (newVal === false && this.busy) {
        this.$emit("cancel")
        this.busy = false
      }
    },
    finger(newVal) {
      const startDate = moment(newVal.startDate, "YYYYMMDDHHmm")
      this.startDate = startDate.format("YYYY-MM-DD")
      this.startTime = startDate.format("HH:mm")
      const endDate = moment(newVal.endDate, "YYYYMMDDHHmm")
      this.endDate = endDate.format("YYYY-MM-DD")
      this.endTime = endDate.format("HH:mm")
      this.alias = newVal.alias
    },
  },
}
</script>
