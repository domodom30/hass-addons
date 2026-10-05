<template>
  <v-dialog v-model="localShow" persistent max-width="560px" transition="dialog-bottom-transition">
    <v-card rounded="lg">

      <!-- En-tête -->
      <div class="d-flex align-center pa-5 pb-4 ga-3">
        <v-avatar size="36" color="primary" variant="tonal">
          <v-icon size="20">mdi-gesture-tap</v-icon>
        </v-avatar>
        <div>
          <div class="text-subtitle-1 font-weight-bold">
            <template v-if="value == -1">{{ $t('common.add') }}</template>
            <template v-else>{{ $t('common.edit') }}</template>
            {{ $t('passcode.title') }}
          </div>
          <div class="text-caption text-medium-emphasis">{{ $t('passcode.hint') }}</div>
        </div>
      </div>

      <v-divider />

      <v-card-text class="pa-5">
        <v-select
          v-model="passcode.type"
          :items="passcodeTypes"
          :label="$t('passcode.type')"
          prepend-inner-icon="mdi-format-list-bulleted-type"
          variant="outlined"
          density="comfortable"
          class="mb-4"
        />
        <v-text-field
          v-model="passcode.newPassCode"
          :label="value == -1 ? $t('passcode.title') : $t('passcode.newCode')"
          :hint="$t('passcode.hint')"
          persistent-hint
          prepend-inner-icon="mdi-numeric"
          variant="outlined"
          density="comfortable"
          inputmode="numeric"
          clearable
          class="mb-5"
        />

        <!-- Période de validité -->
        <div class="text-caption text-medium-emphasis text-uppercase font-weight-medium mb-3 d-flex align-center ga-1">
          <v-icon size="14" icon="mdi-calendar-range" />
          {{ $t('credentials.validFrom') }} → {{ $t('credentials.validTo') }}
        </div>

        <v-row dense>
          <!-- Début -->
          <v-col cols="6">
            <v-menu v-model="startDateMenu" :close-on-content-click="false" transition="scale-transition">
              <template #activator="{ props }">
                <v-text-field
                  v-model="startDate"
                  :label="$t('credentials.validFrom')"
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
                  :label="$t('card.time')"
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
                  :label="$t('credentials.validTo')"
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
                  :label="$t('card.time')"
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
          :disabled="busy || !passcode.newPassCode || passcode.newPassCode.trim() === ''"
          @click="savePasscode"
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
  name: "Passcode",
  props: ["show", "address", "value"],
  data: function () {
    return {
      localShow: false,
      passcode: {},
      startDateMenu: false,
      startDate: "",
      startTimeMenu: false,
      startTime: "",
      endDateMenu: false,
      endDate: "",
      endTimeMenu: false,
      endTime: "",
      busy: false,
    }
  },
  computed: {
    passcodeTypes() {
      return [
        { title: this.$t('passcode.permanent'), value: 1 },
        { title: this.$t('passcode.count'), value: 2, disabled: true },
        { title: this.$t('passcode.timed'), value: 3, disabled: true },
        { title: this.$t('passcode.cyclic'), value: 4, disabled: true },
      ]
    },
    storeIsWaiting() {
      return this.$store.state.waitingCredentials
    },
  },
  methods: {
    updatePasscode(passcode) {
      if (passcode == -1) {
        this.passcode = {
          type: 1,
          newPassCode: "",
          passCode: -1,
          startDate: moment().format("YYYYMMDDHHmm"),
          endDate: "203012312359",
        }
      } else {
        this.passcode = structuredClone(toRaw(passcode))
        this.passcode.passCode = passcode.newPassCode || passcode.passCode || -1
        this.passcode.newPassCode = ""
        this.passcode.startDate = passcode.startDate || moment().format("YYYYMMDDHHmm")
        this.passcode.endDate = passcode.endDate || "203012312359"
      }
    },
    async savePasscode() {
      if (this.busy) return
      if (!this.passcode.newPassCode || this.passcode.newPassCode.trim() === "") {
        return
      }
      // S'assurer que passCode est explicitement -1 (nombre) pour un ajout
      if (this.passcode.passCode == null || this.passcode.passCode === "") {
        this.passcode.passCode = -1
      }
      // Vuetify 3 v-date-picker / v-time-picker may emit Date objects (not strings)
      // once the user interacts with them — coerce defensively.
      const fmt = (date, time) => {
        const d = date instanceof Date ? moment(date).format("YYYY-MM-DD") : (date || "")
        const t = time instanceof Date ? moment(time).format("HH:mm") : (time || "")
        return d.replaceAll("-", "") + t.replaceAll(":", "")
      }
      this.passcode.startDate = fmt(this.startDate, this.startTime)
      this.passcode.endDate = fmt(this.endDate, this.endTime)
      this.busy = true
      this._errorCount = this.$store.state.errors.length
      await this.$store.dispatch("setPasscode", {
        lockAddress: this.address,
        passcode: this.passcode,
      })
    },
  },
  created() {
    this.updatePasscode(this.value)
  },
  watch: {
    show(newVal) {
      this.localShow = newVal
    },
    value(newVal) {
      this.updatePasscode(newVal)
    },
    storeIsWaiting(newVal) {
      if (newVal === false && this.busy) {
        this.busy = false
        if (this.$store.state.errors.length === this._errorCount) {
          this.$emit("cancel")
        }
      }
    },
    passcode(newVal) {
      const startDate = moment(newVal.startDate, "YYYYMMDDHHmm")
      this.startDate = startDate.isValid() ? startDate.format("YYYY-MM-DD") : moment().format("YYYY-MM-DD")
      this.startTime = startDate.isValid() ? startDate.format("HH:mm") : "00:00"
      const endDate = moment(newVal.endDate, "YYYYMMDDHHmm")
      this.endDate = endDate.isValid() ? endDate.format("YYYY-MM-DD") : "2030-12-31"
      this.endTime = endDate.isValid() ? endDate.format("HH:mm") : "23:59"
    },
  },
}
</script>
