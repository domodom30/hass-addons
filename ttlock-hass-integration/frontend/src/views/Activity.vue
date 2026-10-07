<template>
  <v-card class="logs-card d-flex flex-column">
    <!-- Header -->
    <div class="d-flex align-center ga-3 px-5 py-3">
      <v-tooltip :text="$t('common.back')" location="bottom">
        <template #activator="{ props }">
          <v-btn v-bind="props" icon="mdi-arrow-left" variant="text" size="small" @click="back" />
        </template>
      </v-tooltip>
      <v-avatar size="36" color="success" variant="tonal">
        <v-icon size="20">mdi-console-line</v-icon>
      </v-avatar>
      <div class="flex-grow-1 overflow-hidden">
        <div class="text-subtitle-1 font-weight-bold text-truncate">{{ $t('logs.title') }}</div>
        <div class="text-caption text-medium-emphasis text-truncate">
          <template v-if="address">{{ lockName }} · <span class="font-mono">{{ address }}</span></template>
          <template v-else>{{ $t('logs.allLocks') }}</template>
        </div>
      </div>

      <v-tooltip :text="$t('common.refresh')" location="bottom">
        <template #activator="{ props }">
          <v-btn
            v-bind="props"
            icon="mdi-refresh"
            color="primary"
            variant="text"
            size="small"
            :loading="waitingOperations"
            @click="refresh"
          />
        </template>
      </v-tooltip>
    </div>

    <div class="d-flex align-center flex-wrap ga-3 px-5 pb-3">
      <v-select
        v-model="filter"
        :items="filterOptions"
        item-title="title"
        item-value="value"
        :label="$t('operations.filterByType')"
        density="compact"
        variant="outlined"
        hide-details
        style="max-width: 180px"
      />

      <v-select
        v-if="!address"
        v-model="lockFilter"
        :items="lockOptions"
        item-title="title"
        item-value="value"
        :label="$t('operations.filterByLock')"
        density="compact"
        variant="outlined"
        hide-details
        style="max-width: 180px"
      />

      <v-menu v-model="dateFromMenu" :close-on-content-click="false" transition="scale-transition">
        <template #activator="{ props }">
          <v-text-field
            :model-value="displayDay(dateFrom)"
            :label="$t('operations.dateFrom')"
            prepend-inner-icon="mdi-calendar-start"
            readonly
            clearable
            v-bind="props"
            density="compact"
            variant="outlined"
            hide-details
            style="max-width: 180px"
            @click:clear="dateFrom = ''"
          />
        </template>
        <v-date-picker v-model="dateFrom" @update:modelValue="dateFromMenu = false" />
      </v-menu>

      <v-menu v-model="dateToMenu" :close-on-content-click="false" transition="scale-transition">
        <template #activator="{ props }">
          <v-text-field
            :model-value="displayDay(dateTo)"
            :label="$t('operations.dateTo')"
            prepend-inner-icon="mdi-calendar-end"
            readonly
            clearable
            v-bind="props"
            density="compact"
            variant="outlined"
            hide-details
            style="max-width: 180px"
            @click:clear="dateTo = ''"
          />
        </template>
        <v-date-picker v-model="dateTo" @update:modelValue="dateToMenu = false" />
      </v-menu>
    </div>

    <v-divider opacity="0.08" />

    <!-- Journal des opérations : même structure que « Activité récente » (Home.vue) -->
    <template v-if="mdAndUp && lines.length > 0">
      <div
        class="activity-grid activity-head px-5 py-2 text-caption text-medium-emphasis text-uppercase font-weight-medium"
        :class="{ 'no-lock': address }"
      >
        <span>{{ $t('dashboard.activity.event') }}</span>
        <span v-if="!address">{{ $t('dashboard.activity.lock') }}</span>
        <span>{{ $t('dashboard.activity.credential') }}</span>
        <span class="text-end">{{ $t('dashboard.activity.when') }}</span>
      </div>
      <v-divider opacity="0.08" />
    </template>

    <div ref="terminal" class="logs-scroll flex-grow-1">
      <div v-if="lines.length === 0" class="logs-empty">
        <span class="text-medium-emphasis">{{ waitingOperations ? $t('logs.loading') : $t('operations.empty') }}</span>
      </div>
      <template v-else>
        <div v-for="(row, i) in lines" :key="row.key">
          <v-divider v-if="i > 0" opacity="0.06" />

          <!-- Ordinateur / tablette : colonnes -->
          <div v-if="mdAndUp" class="activity-grid align-center px-5 py-1" :class="{ 'no-lock': address }">
            <div class="d-flex align-center ga-3 min-w-0">
              <v-avatar size="32" :color="row.color" variant="tonal" class="flex-shrink-0">
                <v-icon size="18" :icon="row.icon" />
              </v-avatar>
              <span class="text-body-2 font-weight-medium text-truncate">{{ row.label }}</span>
            </div>
            <span v-if="!address" class="text-body-2 text-truncate">{{ row.lockName }}</span>
            <span class="text-body-2 text-truncate" :class="{ 'text-medium-emphasis': !row.credential }">
              {{ row.credential || '—' }}
            </span>
            <div class="text-end">
              <div class="text-body-2">{{ row.relative }}</div>
              <div class="text-caption text-medium-emphasis">{{ row.date }}</div>
            </div>
          </div>

          <!-- Mobile : empilé -->
          <div v-else class="d-flex align-center ga-3 px-4 py-3">
            <v-avatar size="32" :color="row.color" variant="tonal" class="flex-shrink-0">
              <v-icon size="18" :icon="row.icon" />
            </v-avatar>
            <div class="min-w-0 flex-grow-1">
              <div class="text-body-2 font-weight-medium">{{ row.label }}</div>
              <div class="text-caption text-medium-emphasis">
                {{ [address ? null : row.lockName, row.credential].filter(Boolean).join(' · ') }}
              </div>
            </div>
            <div class="text-end flex-shrink-0">
              <div class="text-caption">{{ row.relative }}</div>
              <div class="text-caption text-medium-emphasis">{{ row.date }}</div>
            </div>
          </div>
        </div>
      </template>
    </div>

    <v-divider opacity="0.08" />
    <div class="d-flex align-center px-5 py-2">
      <span class="text-caption text-medium-emphasis">{{ $t('operations.totalEntries', { count: lines.length }) }}</span>
    </div>
  </v-card>
</template>

<script>
import moment from "moment"
import { useDisplay } from "vuetify"
import { operationMeta, operationMoment } from "@/utils/operations"

export default {
  name: "Activity",
  setup() {
    const { mdAndUp } = useDisplay()
    return { mdAndUp }
  },
  data() {
    return {
      filter: "ALL",
      lockFilter: "ALL",
      dateFrom: "",
      dateFromMenu: false,
      dateTo: "",
      dateToMenu: false,
    }
  },
  computed: {
    address() {
      return this.$route.params.address || null
    },
    waitingOperations() {
      return this.$store.state.waitingOperations
    },
    lockName() {
      const lock = this.$store.state.locks.find(l => l.address === this.address)
      return lock?.name || this.address
    },

    filterOptions() {
      return [
        { title: this.$t('operations.typeAll'), value: 'ALL' },
        { title: this.$t('operations.typeUnlock'), value: 'UNLOCK' },
        { title: this.$t('operations.typeLock'), value: 'LOCK' },
        { title: this.$t('operations.typeAlarm'), value: 'ALARM' },
        { title: this.$t('operations.typeFailed'), value: 'FAILED' },
        { title: this.$t('operations.typeOther'), value: 'OTHER' },
      ]
    },
    pairedAddresses() {
      return this.$store.state.locks.filter(l => l.paired).map(l => l.address).join(",")
    },
    lockOptions() {
      return [
        { title: this.$t('operations.typeAll'), value: 'ALL' },
        ...this.$store.state.locks
          .filter(l => l.paired)
          .map(l => ({ title: l.name || l.address, value: l.address })),
      ]
    },
    rawOperations() {
      const ops = this.$store.state.operations
      const collected = []
      let addresses = this.address ? [this.address] : Object.keys(ops)
      if (!this.address && this.lockFilter !== "ALL") {
        addresses = addresses.filter(a => a === this.lockFilter)
      }
      for (const addr of addresses) {
        const lock = this.$store.state.locks.find(l => l.address === addr)
        const name = lock?.name || addr
        for (const op of ops[addr] || []) {
          collected.push({ ...op, _lockName: name, _lockAddress: addr })
        }
      }
      return collected.sort((a, b) => {
        // Plus récent en haut, comme « Activité récente » (Home.vue).
        if (a.operateDate > b.operateDate) return -1
        if (a.operateDate < b.operateDate) return 1
        if (a.recordNumber > b.recordNumber) return -1
        if (a.recordNumber < b.recordNumber) return 1
        return 0
      })
    },
    lines() {
      return this.rawOperations
        .filter(op => this.filter === "ALL" || op.recordTypeCategory === this.filter)
        .filter(op => this.inDateRange(op.operateDate))
        .map(op => {
          const meta = operationMeta(op.recordTypeCategory)
          const m = operationMoment(op)
          let credential = ""
          if (op.passwordName) credential = op.passwordName
          if (op.password) credential += ` (${op.password})`
          return {
            key: `${op._lockAddress}-${op.recordNumber}-${op.operateDate}`,
            icon: meta.icon,
            color: meta.color,
            label: op.recordTypeName || this.$t(meta.tagKey),
            lockName: op._lockName,
            credential: credential.trim(),
            relative: m.isValid() ? m.fromNow() : "—",
            date: m.isValid() ? m.format("DD/MM/YYYY HH:mm:ss") : "",
          }
        })
    },
  },
  created() {
    this.init()
  },
  watch: {
    address() {
      this.init()
    },
    // Accès direct à l'URL : les serrures peuvent arriver après le montage.
    pairedAddresses() {
      this.loadOperations()
    },
  },
  methods: {
    init() {
      this.filter = "ALL"
      this.lockFilter = "ALL"
      this.dateFrom = ""
      this.dateTo = ""
      this.loadOperations()
      this.scrollToTop()
    },
    loadOperations(reload = false) {
      const addresses = this.address
        ? [this.address]
        : this.$store.state.locks.filter(l => l.paired).map(l => l.address)
      for (const addr of addresses) {
        this.$store.dispatch("readOperations", { address: addr, reload })
      }
    },
    refresh() {
      this.loadOperations(true)
    },
    toDay(val) {
      if (!val) return null
      return val instanceof Date
        ? moment(val).format("YYYYMMDD")
        : moment(val, "YYYY-MM-DD").format("YYYYMMDD")
    },
    displayDay(val) {
      if (!val) return ""
      const m = val instanceof Date ? moment(val) : moment(val, "YYYY-MM-DD")
      return m.isValid() ? m.format("DD/MM/YYYY") : ""
    },
    inDateRange(operateDate) {
      if (!operateDate) return true
      const day = operateDate.slice(0, 8)
      const from = this.toDay(this.dateFrom)
      const to = this.toDay(this.dateTo)
      if (from && day < from) return false
      if (to && day > to) return false
      return true
    },
    back() {
      this.$router.push({ name: "Home" })
    },
    scrollToTop() {
      this.$nextTick(() => {
        const el = this.$refs.terminal
        if (el) el.scrollTop = 0
      })
    },
  },
}
</script>

<style scoped>
.logs-card {
  /* Pleine page : hauteur de la fenêtre moins barre du haut et marges */
  height: calc(100vh - 56px - 48px);
  min-height: 420px;
}
.font-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.72rem;
}
.activity-grid {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1.4fr) minmax(0, 1.4fr) minmax(0, 1fr);
  column-gap: 16px;
}
.activity-grid.no-lock {
  grid-template-columns: minmax(0, 2fr) minmax(0, 1.4fr) minmax(0, 1fr);
}
.activity-head {
  letter-spacing: 0.04em;
}
.min-w-0 {
  min-width: 0;
}
.logs-scroll {
  overflow-y: auto;
}
.logs-empty {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
