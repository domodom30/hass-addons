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

        <v-btn-toggle v-model="filter" density="compact" variant="outlined" divided mandatory>
          <v-btn value="ALL" size="small" class="text-caption">{{ $t('operations.typeAll') }}</v-btn>
          <v-btn value="UNLOCK" size="small" class="text-caption">{{ $t('operations.typeUnlock') }}</v-btn>
          <v-btn value="LOCK" size="small" class="text-caption">{{ $t('operations.typeLock') }}</v-btn>
        </v-btn-toggle>

        <v-tooltip :text="$t('common.refresh')" location="bottom">
          <template #activator="{ props }">
            <v-btn
              v-bind="props"
              icon="mdi-refresh"
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

      <!-- Terminal -->
      <div ref="terminal" class="terminal flex-grow-1">
        <div v-if="lines.length === 0" class="terminal-empty">
          <span class="text-medium-emphasis">{{ waitingOperations ? $t('logs.loading') : $t('operations.empty') }}</span>
        </div>
        <div
          v-for="(op, i) in lines"
          :key="i"
          class="term-line"
          :class="`term-${op.kind}`"
        >
          <v-icon :icon="op.icon" size="14" class="term-icon" :style="{ color: op.iconColor }" />
          <span class="term-time">{{ op.time }}</span>
          <span class="term-tag" :class="`tag-${op.kind}`">{{ op.tag }}</span>
          <span v-if="op.lockName" class="term-lock">{{ op.lockName }}</span>
          <span class="term-msg">{{ op.message }}</span>
          <span v-if="op.credential" class="term-cred">{{ op.credential }}</span>
        </div>
      </div>

      <v-divider />
      <div class="d-flex align-center px-5 py-2">
        <span class="text-caption text-medium-emphasis">{{ $t('operations.totalEntries', { count: lines.length }) }}</span>
        <v-spacer />
        <v-switch
          v-model="autoScroll"
          :label="$t('logs.autoScroll')"
          true-icon="mdi-check"
          false-icon="mdi-close"
          hide-details
          color="info"
        />
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
    // Opérations brutes (une serrure ou agrégées), triées de l'ancien au récent
    // pour un défilement de type terminal (le plus récent en bas).
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
      const ICONS = {
        unlock: { icon: 'mdi-lock-open-variant',   color: '#22c55e' },
        lock:   { icon: 'mdi-lock',                color: '#f87171' },
        alarm:  { icon: 'mdi-bell-alert',          color: '#fbbf24' },
        failed: { icon: 'mdi-alert-circle',        color: '#fb923c' },
        other:  { icon: 'mdi-information-outline', color: '#60a5fa' },
      }
      return this.rawOperations
        .filter(op => this.filter === "ALL" || op.recordTypeCategory === this.filter)
        .map(op => {
          const kind = op.recordTypeCategory === "UNLOCK" ? "unlock"
            : op.recordTypeCategory === "LOCK"   ? "lock"
            : op.recordTypeCategory === "ALARM"  ? "alarm"
            : op.recordTypeCategory === "FAILED" ? "failed"
            : "other"
          const m = moment(op.operateDate, "YYYYMMDDHHmmss")
          let credential = ""
          if (op.passwordName) credential = op.passwordName
          if (op.password) credential += ` (${op.password})`
          return {
            kind,
            icon: ICONS[kind].icon,
            iconColor: ICONS[kind].color,
            tag: (op.recordTypeCategory || "OTHER").padEnd(6, " "),
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
.terminal {
  overflow-y: auto;
  background: #0b0f14;
  color: #d6deeb;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.8rem;
  line-height: 1.55;
  padding: 14px 18px;
}
.terminal-empty {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.term-line {
  white-space: pre-wrap;
  word-break: break-word;
}
.term-time {
  color: #5f7e97;
  margin-right: 10px;
}
.term-tag {
  display: inline-block;
  margin-right: 10px;
  font-weight: 700;
  white-space: pre;
}
.tag-unlock { color: #22c55e; }
.tag-lock   { color: #f87171; }
.tag-alarm  { color: #fbbf24; }
.tag-failed { color: #fb923c; }
.tag-other  { color: #60a5fa; }
.term-icon  { margin-right: 6px; vertical-align: middle; }
.term-lock {
  color: #c792ea;
  margin-right: 10px;
}
.term-msg { color: #d6deeb; }
.term-cred {
  color: #8aa0b3;
  margin-left: 8px;
  font-style: italic;
}
</style>
