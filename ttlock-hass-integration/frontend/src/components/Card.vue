<template>
  <v-dialog v-model="localShow" persistent max-width="560px" transition="dialog-bottom-transition">
    <v-card rounded="lg">

      <!-- En-tête -->
      <div class="d-flex align-center pa-5 pb-4 ga-3">
        <v-avatar size="36" color="primary" variant="tonal">
          <v-icon size="20">mdi-credit-card-wireless</v-icon>
        </v-avatar>
        <div>
          <div class="text-subtitle-1 font-weight-bold">
            <template v-if="value == -1">{{ $t('common.add') }}</template>
            <template v-else>{{ $t('common.edit') }}</template>
            {{ $t('card.title') }}
          </div>
          <div class="text-caption text-medium-emphasis">{{ $t('card.aliasHint') }}</div>
        </div>
      </div>

      <v-divider />

      <!-- Alerte scan en cours -->
      <v-alert
        v-if="lockIsScanning"
        type="info"
        variant="tonal"
        icon="mdi-credit-card-scan"
        rounded="0"
        class="border-b"
      >
        {{ $t('card.scanPrompt') }}
      </v-alert>

      <v-card-text class="pa-5">
        <!-- Alias -->
        <v-text-field
          v-model="alias"
          :label="$t('card.alias')"
          :hint="$t('card.aliasHint')"
          persistent-hint
          prepend-inner-icon="mdi-label-outline"
          variant="outlined"
          density="comfortable"
          class="mb-5"
        />

        <!-- Période de validité -->
        <div class="text-caption text-medium-emphasis text-uppercase font-weight-medium mb-3 d-flex align-center ga-1">
          <v-icon size="14" icon="mdi-calendar-range" />
          {{ $t('card.validFrom') }} → {{ $t('card.validTo') }}
        </div>

        <v-row dense>
          <!-- Début -->
          <v-col cols="6">
            <v-menu v-model="startDateMenu" :close-on-content-click="false" transition="scale-transition">
              <template #activator="{ props }">
                <v-text-field
                  v-model="startDate"
                  :label="$t('card.validFrom')"
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
                  :label="$t('card.validTo')"
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
          :disabled="busy"
          @click="saveCard"
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
  name: "Card",
  props: ["show", "address", "value"],
  data: function () {
    return {
      localShow: false,
      card: {},
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
      return this.$store.state.waitingCardScan
    },
  },
  methods: {
    updateCard(card) {
      if (card == -1) {
        this.card = {
          cardNumber: -1,
          startDate: "202001010000",
          endDate: "209912312359",
          alias: ""
        }
      } else {
        this.card = structuredClone(toRaw(card))
      }
    },
    async saveCard() {
      if (this.busy) return
      this.busy = true

      const fmt = (date, time) => {
        const d = date instanceof Date ? moment(date).format("YYYY-MM-DD") : (date || "")
        const t = time instanceof Date ? moment(time).format("HH:mm") : (time || "")
        return d.replaceAll("-", "") + t.replaceAll(":", "")
      }
      this.card.startDate = fmt(this.startDate, this.startTime)
      this.card.endDate = fmt(this.endDate, this.endTime)
      this.card.alias = this.alias
      await this.$store.dispatch("setCard", {
        lockAddress: this.address,
        card: this.card,
      })
    },
  },
  created() {
    this.updateCard(this.value)
  },
  watch: {
    show(newVal) {
      this.localShow = newVal
    },
    value(newVal) {
      this.updateCard(newVal)
    },
    storeIsWaiting(newVal) {
      if (newVal === false && this.busy) {
        this.$emit("cancel")
        this.busy = false
      }
    },
    card(newVal) {
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
