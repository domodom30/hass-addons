<template>
  <div>

    <div class="d-flex flex-wrap align-end justify-space-between mb-4 ga-3">
    </div>

    <v-row v-if="!locksLoaded" align="start">
      <v-col cols="12" md="8" lg="9">
        <v-row>
          <v-col v-for="n in 3" :key="n" cols="12" sm="6" lg="4">
            <v-skeleton-loader type="card" />
          </v-col>
        </v-row>
      </v-col>
      <v-col cols="12" md="4" lg="3">
        <v-skeleton-loader type="list-item-two-line@3" />
      </v-col>
    </v-row>

    <v-card v-else-if="totalLocks === 0" class="pa-8 text-center">
      <v-avatar size="64" color="primary" variant="tonal" class="mb-4">
        <v-icon size="32">mdi-lock-plus-outline</v-icon>
      </v-avatar>
      <h2 class="text-h6 font-weight-bold mb-2">{{ $t('dashboard.empty.title') }}</h2>
      <p class="text-body-2 text-medium-emphasis mb-6 mx-auto" style="max-width: 420px;">
        {{ $t('dashboard.empty.subtitle') }}
      </p>
      <v-btn
        color="primary"
        variant="flat"
        prepend-icon="mdi-lock-plus-outline"
        @click="openWizard"
      >
        {{ $t('wizard.title') }}
      </v-btn>
    </v-card>

    <v-row v-else align="start">

      <v-col cols="12" :order="2" :order-md="1" md="8" lg="9">
        <div class="d-flex align-end justify-space-between mb-4">
          <div>
            <h2 class="text-subtitle-1 font-weight-bold">{{ $t('dashboard.yourLocks') }}</h2>
            <div class="text-caption text-medium-emphasis">{{ $t('dashboard.yourLocksHint') }}</div>
          </div>
        </div>
        <v-row>
          <v-col v-for="lock in locks" :key="lock.address" cols="12" sm="6" lg="4">
            <Lock :lock="lock" />
          </v-col>
        </v-row>
      </v-col>

      <v-col cols="12" :order="1" :order-md="2" md="4" lg="3">
        <v-card class="pa-4">
          <div class="d-flex align-center justify-space-between mb-3">
            <span class="text-caption text-medium-emphasis text-uppercase font-weight-medium">
              {{ $t('dashboard.recentActivity') }}
            </span>
            <div class="d-flex align-center ga-1">
              <v-avatar size="28" color="info" variant="tonal">
                <v-icon size="16">mdi-clock-time-four-outline</v-icon>
              </v-avatar>
              <v-btn
                variant="text"
                size="x-small"
                color="primary"
                @click="openGlobalActivity"
              >{{ $t('dashboard.viewAll') }}</v-btn>
            </div>
          </div>

          <div v-if="lastFiveActions.length === 0" class="d-flex flex-column align-center text-center py-6">
            <v-icon size="28" color="medium-emphasis" class="mb-2">mdi-history</v-icon>
            <span class="text-caption text-medium-emphasis">{{ $t('dashboard.noActivity') }}</span>
          </div>

          <template v-for="(op, i) in lastFiveActions" :key="i">
            <v-divider v-if="i > 0" class="my-2" />
            <div class="d-flex align-center ga-2">
              <v-icon
                size="18"
                :color="opColor(op)"
                :icon="opIcon(op)"
                class="flex-shrink-0"
              />
              <div class="min-w-0" style="flex: 1">
                <v-tooltip :text="opLabel(op)" location="top">
                  <template #activator="{ props }">
                    <div v-bind="props" class="text-caption font-weight-medium text-truncate">
                      {{ opLabel(op) }}
                    </div>
                  </template>
                </v-tooltip>
                <div class="text-caption text-medium-emphasis d-flex align-center justify-space-between ga-1">
                  <v-tooltip :text="opRelativeTime(op)" location="top">
                    <template #activator="{ props }">
                      <span v-bind="props">{{ opDateTime(op) }}</span>
                    </template>
                  </v-tooltip>
                  <span v-if="op.lockName" class="text-truncate" style="max-width: 80px; opacity: 0.7">{{ op.lockName }}</span>
                </div>
              </div>
            </div>
          </template>
        </v-card>
      </v-col>

    </v-row>
  </div>
</template>

<script>
import moment from "moment"
import Lock from "@/components/Lock.vue"

export default {
  name: "Home",
  components: { Lock },
  computed: {
    locks() {
      return this.$store.state.locks
    },
    pairedLocks() {
      return this.$store.state.locks.filter(l => l.paired)
    },
    isScanning() {
      return this.$store.state.scanStatus == 1
    },
    totalLocks() {
      return this.locks.length
    },
    locksLoaded() {
      return this.$store.state.locksLoaded
    },
    lastFiveActions() {
      const all = []
      const ops = this.$store.state.operations
      for (const addr in ops) {
        const lock = this.$store.state.locks.find(l => l.address === addr)
        const lockName = lock?.name || addr
        for (const op of ops[addr] || []) {
          if (op.operateDate) all.push({ ...op, lockName })
        }
      }
      return all
        .sort((a, b) => {
          if (a.operateDate > b.operateDate) return -1
          if (a.operateDate < b.operateDate) return 1
          if (a.recordNumber > b.recordNumber) return -1
          if (a.recordNumber < b.recordNumber) return 1
          return 0
        })
        .slice(0, 5)
    },
  },
  created() {
    this.autoLoad(this.pairedLocks)
  },
  watch: {
    pairedLocks(newVal) {
      this.autoLoad(newVal)
    },
  },
  methods: {
    autoLoad(locks) {
      for (const lock of locks) {
        if (!this.$store.state.operations[lock.address]) {
          // Dashboard : cache seul (reload=false), jamais de lecture BLE par serrure au démarrage.
          this.$store.dispatch("readOperations", { address: lock.address, reload: false })
        }
      }
    },
    openWizard() {
      this.$store.commit('setOverlay', { overlay: 'addWizard' })
    },
    startScan() {
      this.$store.dispatch("scan")
    },
    openGlobalActivity() {
      this.$store.commit("setOverlay", { overlay: "logs", address: null })
    },
    opLabel(op) {
      return op.recordTypeName || '—'
    },
    opIcon(op) {
      if (op.recordTypeCategory === 'LOCK')   return 'mdi-lock'
      if (op.recordTypeCategory === 'UNLOCK') return 'mdi-lock-open-variant'
      if (op.recordTypeCategory === 'ALARM')  return 'mdi-bell-alert'
      if (op.recordTypeCategory === 'FAILED') return 'mdi-alert-circle'
      return 'mdi-information-outline'
    },
    opColor(op) {
      if (op.recordTypeCategory === 'LOCK')   return 'error'
      if (op.recordTypeCategory === 'UNLOCK') return 'success'
      if (op.recordTypeCategory === 'ALARM')  return 'warning'
      if (op.recordTypeCategory === 'FAILED') return 'deep-orange'
      return 'info'
    },
    _opMoment(op) {
      return moment(op.operateDate, "YYYYMMDDHHmmss")
    },
    opDateTime(op) {
      const m = this._opMoment(op)
      return m.isValid() ? m.format("DD-MM-YYYY HH:mm") : '—'
    },
    opRelativeTime(op) {
      const m = this._opMoment(op)
      return m.isValid() ? m.fromNow() : '—'
    },
  },
}
</script>

