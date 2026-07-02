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

        <v-btn-toggle v-model="filter" density="compact" variant="outlined" divided mandatory class="filter-toggle ga-2">
          <v-btn value="ALL" size="small" variant="tonal">
            <template #prepend>
              <v-icon color="warning">mdi-filter-variant</v-icon>
            </template>
            {{ $t('operations.typeAll') }}
          </v-btn>

          <v-btn value="UNLOCK" size="small" variant="tonal">
            <template #prepend>
              <v-icon color="success">mdi-lock-open-variant</v-icon>
            </template>
            {{ $t('operations.typeUnlock') }}
          </v-btn>

          <v-btn value="LOCK" size="small" variant="tonal">
            <template #prepend>
              <v-icon color="error">mdi-lock</v-icon>
            </template>
            {{ $t('operations.typeLock') }}
          </v-btn>
        </v-btn-toggle>

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

    rawOperations() {
      const ops = this.$store.state.operations
      const collected = []
      const addresses = this.address ? [this.address] : Object.keys(ops)
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
      return this.rawOperations
        .filter(op => this.filter === "ALL" || op.recordTypeCategory === this.filter)
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
            tag: op.recordTypeCategory || "OTHER",
            time: m.isValid() ? m.format("DD-MM HH:mm:ss") : "—",
            lockName: op._lockName,
            message: op.recordTypeName || "—",
            credential: credential.trim(),
          }
        })
    },
  },
  watch: {
    open(now) {
      if (now) {
        this.filter = "ALL"
        this.loadOperations()
        this.scrollToBottom()
      }
    },
    lines() {
      this.scrollToBottom()
    },
  },
  methods: {
    loadOperations() {
      const addresses = this.address
        ? [this.address]
        : this.$store.state.locks.filter(l => l.paired).map(l => l.address)
      for (const addr of addresses) {
        this.$store.dispatch("readOperations", addr)
      }
    },
    refresh() {
      this.loadOperations()
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
.filter-toggle :deep(.v-btn) {
  padding-inline: 12px;
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
