<template>
  <v-dialog
    :model-value="open"
    max-width="920"
    scrollable
    transition="dialog-bottom-transition"
    @update:model-value="close"
  >
    <v-card class="logs-card d-flex flex-column">
      <!-- Header -->
      <div class="d-flex align-center ga-3 px-5 py-3">
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
        <v-btn icon="mdi-close" variant="text" size="small" @click="close" />
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
          style="max-width: 170px"
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
          style="max-width: 220px"
        />

        <v-menu v-model="dateFromMenu" :close-on-content-click="false" transition="scale-transition">
          <template #activator="{ props }">
            <v-text-field
              v-model="dateFrom"
              :label="$t('operations.dateFrom')"
              prepend-inner-icon="mdi-calendar-start"
              readonly
              clearable
              v-bind="props"
              density="compact"
              variant="outlined"
              hide-details
              style="max-width: 170px"
              @click:clear="dateFrom = ''"
            />
          </template>
          <v-date-picker v-model="dateFrom" @update:modelValue="dateFromMenu = false" />
        </v-menu>

        <v-menu v-model="dateToMenu" :close-on-content-click="false" transition="scale-transition">
          <template #activator="{ props }">
            <v-text-field
              v-model="dateTo"
              :label="$t('operations.dateTo')"
              prepend-inner-icon="mdi-calendar-end"
              readonly
              clearable
              v-bind="props"
              density="compact"
              variant="outlined"
              hide-details
              style="max-width: 170px"
              @click:clear="dateTo = ''"
            />
          </template>
          <v-date-picker v-model="dateTo" @update:modelValue="dateToMenu = false" />
        </v-menu>
      </div>

      <v-divider />

      <!-- Journal des opérations -->
      <div ref="terminal" class="logs-scroll flex-grow-1">
        <div v-if="lines.length === 0" class="logs-empty">
          <span class="text-medium-emphasis">{{ waitingOperations ? $t('logs.loading') : $t('operations.empty') }}</span>
        </div>
        <v-list v-else density="compact" bg-color="transparent" class="py-0">
          <v-list-item
            v-for="(op, i) in lines"
            :key="i"
            class="log-item px-5"
          >
            <template #prepend>
              <v-icon :icon="op.icon" :color="op.color" size="20" class="me-3" />
            </template>

            <div class="d-flex align-center flex-wrap ga-2">
              <v-chip :color="op.color" size="x-small" variant="tonal" label class="font-weight-bold">
                {{ op.tag }}
              </v-chip>
              <v-chip v-if="op.lockName" size="x-small" variant="tonal" color="secondary" label>
                {{ op.lockName }}
              </v-chip>
              <span class="text-body-2">{{ op.message }}</span>
              <span v-if="op.credential" class="text-caption text-medium-emphasis font-mono">{{ op.credential }}</span>
            </div>

            <template #append>
              <span class="text-caption text-medium-emphasis font-mono">{{ op.time }}</span>
            </template>
          </v-list-item>
        </v-list>
      </div>

      <v-divider />
      <div class="d-flex align-center px-5 py-2">
        <span class="text-caption text-medium-emphasis">{{ $t('operations.totalEntries', { count: lines.length }) }}</span>
        <v-spacer />
        <v-switch
          v-model="autoScroll"
          true-icon="mdi-check"
          false-icon="mdi-close"
          hide-details
          color="info"
        >
          <template #label>
            <span class="text-caption text-medium-emphasis">{{ $t('logs.autoScroll') }}</span>
          </template>
        </v-switch>
      </div>
    </v-card>
  </v-dialog>
</template>

<script>
import moment from "moment"

export default {
  name: "LockLogsDialog",
  data() {
    return {
      filter: "ALL",
      autoScroll: true,
      lockFilter: "ALL",
      dateFrom: "",
      dateFromMenu: false,
      dateTo: "",
      dateToMenu: false,
    }
  },
  computed: {
    open() {
      return this.$store.state.ui.overlay === "logs"
    },
    address() {
      return this.$store.state.ui.address
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
          collected.push({ ...op, _lockName: this.address ? null : name })
        }
      }
      return collected.sort((a, b) => {
        if (a.operateDate < b.operateDate) return -1
        if (a.operateDate > b.operateDate) return 1
        if (a.recordNumber < b.recordNumber) return -1
        if (a.recordNumber > b.recordNumber) return 1
        return 0
      })
    },
    lines() {
      const KIND_MAP = {
        UNLOCK: "unlock",
        LOCK:   "lock",
        ALARM:  "alarm",
        FAILED: "failed",
      }
      const ICONS = {
        unlock: { icon: 'mdi-lock-open-variant',   color: 'success' },
        lock:   { icon: 'mdi-lock',                color: 'error' },
        alarm:  { icon: 'mdi-bell-alert',          color: 'warning' },
        failed: { icon: 'mdi-alert-circle',        color: 'warning' },
        other:  { icon: 'mdi-information-outline', color: 'info' },
      }
      const TAG_KEYS = {
        unlock: 'operations.typeUnlock',
        lock:   'operations.typeLock',
        alarm:  'operations.typeAlarm',
        failed: 'operations.typeFailed',
        other:  'operations.typeOther',
      }
      return this.rawOperations
        .filter(op => this.filter === "ALL" || op.recordTypeCategory === this.filter)
        .filter(op => this.inDateRange(op.operateDate))
        .map(op => {
          const kind = KIND_MAP[op.recordTypeCategory] ?? "other"
          const m = moment(op.operateDate, "YYYYMMDDHHmmss")
          let credential = ""
          if (op.passwordName) credential = op.passwordName
          if (op.password) credential += ` (${op.password})`
          return {
            kind,
            icon: ICONS[kind].icon,
            color: ICONS[kind].color,
            tag: this.$t(TAG_KEYS[kind]),
            time: m.isValid() ? m.format("DD-MM HH:mm:ss") : "—",
            lockName: op._lockName,
            message: this.$te(`operations.logType.${op.recordType}`)
              ? this.$t(`operations.logType.${op.recordType}`)
              : (op.recordTypeName || "—"),
            credential: credential.trim(),
          }
        })
    },
  },
  watch: {
    open(now) {
      if (now) {
        this.filter = "ALL"
        this.lockFilter = "ALL"
        this.dateFrom = ""
        this.dateTo = ""
        this.loadOperations()
        this.scrollToBottom()
      }
    },
    lines() {
      this.scrollToBottom()
    },
  },
  methods: {
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
    inDateRange(operateDate) {
      if (!operateDate) return true
      const day = operateDate.slice(0, 8)
      const from = this.toDay(this.dateFrom)
      const to = this.toDay(this.dateTo)
      if (from && day < from) return false
      if (to && day > to) return false
      return true
    },
    close() {
      this.$store.commit("clearOverlay")
    },
    scrollToBottom() {
      if (!this.autoScroll) return
      this.$nextTick(() => {
        const el = this.$refs.terminal
        if (el) el.scrollTop = el.scrollHeight
      })
    },
  },
}
</script>

<style scoped>
.logs-card {
  height: min(78vh, 760px);
}
.font-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.72rem;
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
.log-item {
  border-bottom: thin solid rgba(var(--v-border-color), var(--v-border-opacity));
}
</style>
