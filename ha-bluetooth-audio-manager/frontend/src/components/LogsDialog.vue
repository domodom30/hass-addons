<template>
  <v-dialog v-model="show" max-width="900" scrollable>
    <v-card>
      <div class="d-flex align-center ga-3 px-5 py-3 flex-wrap">
        <v-avatar size="36" color="primary" variant="tonal">
          <v-icon size="20">mdi-text-box-outline</v-icon>
        </v-avatar>
        <div class="text-subtitle-1 font-weight-bold">{{ $t("logs.title") }}</div>
        <v-spacer />
        <v-btn icon="mdi-close" variant="text" size="small" @click="show = false" />
      </div>
      <v-divider />

      <div class="px-5 py-2 d-flex align-center ga-3 flex-wrap bg-surface-variant">
        <v-select
          v-model="levelFilter"
          :items="levelItems"
          item-title="label"
          item-value="value"
          density="compact"
          hide-details
          style="max-width: 160px"
        />
        <v-text-field
          v-model="search"
          :placeholder="$t('logs.search')"
          prepend-inner-icon="mdi-magnify"
          density="compact"
          hide-details
          clearable
          style="min-width: 200px; flex: 1"
        />
        <v-switch v-model="autoScroll" :label="$t('logs.autoScroll')" density="compact" hide-details color="primary" />
        <v-switch v-model="live" :label="$t('logs.live')" density="compact" hide-details color="primary" />
        <v-chip size="small" variant="tonal">{{ displayed.length }}</v-chip>
      </div>
      <v-divider />

      <v-card-text ref="container" class="logs-container font-mono pa-2">
        <div v-if="displayed.length === 0" class="text-center text-medium-emphasis py-6">
          {{ $t("logs.empty") }}
        </div>
        <div v-for="e in displayed" :key="e.id" class="log-row d-flex align-center ga-2">
          <span class="text-medium-emphasis log-ts">{{ ts(e) }}</span>
          <v-chip size="x-small" :color="levelColor(e.level)" variant="tonal" label class="log-level">
            {{ e.level }}
          </v-chip>
          <span class="text-medium-emphasis log-logger">{{ shortLogger(e.logger) }}</span>
          <span class="flex-grow-1">{{ e.message }}</span>
        </div>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script>
export default {
  name: "LogsDialog",
  data() {
    return {
      levelFilter: "",
      search: "",
      live: true,
      autoScroll: true,
      frozen: null,
    };
  },
  computed: {
    show: {
      get() {
        return this.$store.state.ui.overlay === "logs";
      },
      set(v) {
        if (!v) this.$store.commit("clearOverlay");
      },
    },
    levelItems() {
      return [
        { value: "", label: this.$t("logs.allLevels") },
        { value: "DEBUG", label: this.$t("logs.debug") },
        { value: "INFO", label: this.$t("logs.info") },
        { value: "WARNING", label: this.$t("logs.warning") },
        { value: "ERROR", label: this.$t("logs.error") },
      ];
    },
    filtered() {
      const search = (this.search || "").toLowerCase();
      return this.$store.state.logs.filter((e) => {
        if (this.levelFilter && e.level !== this.levelFilter) return false;
        if (
          search &&
          !e.message.toLowerCase().includes(search) &&
          !(e.logger || "").toLowerCase().includes(search)
        ) {
          return false;
        }
        return true;
      });
    },
    displayed() {
      return this.live ? this.filtered : this.frozen || [];
    },
  },
  watch: {
    live(on) {
      this.frozen = on ? null : [...this.filtered];
    },
    "displayed.length"() {
      if (!this.autoScroll) return;
      this.$nextTick(() => {
        const el = this.$refs.container?.$el || this.$refs.container;
        if (el) el.scrollTop = el.scrollHeight;
      });
    },
  },
  methods: {
    ts(e) {
      const d = new Date(e.ts * 1000);
      return d.toLocaleTimeString() + "." + String(d.getMilliseconds()).padStart(3, "0");
    },
    shortLogger(logger) {
      return (logger || "").split(".").pop();
    },
    levelColor(level) {
      switch (level) {
        case "ERROR":
          return "error";
        case "WARNING":
          return "warning";
        case "DEBUG":
          return "secondary";
        default:
          return "info";
      }
    },
  },
};
</script>

<style scoped>
.logs-container {
  height: 65vh;
  overflow-y: auto;
  font-size: 0.78rem;
}
.log-row {
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.05);
  padding: 1px 0;
}
.log-ts {
  white-space: nowrap;
  flex: 0 0 auto;
}
.log-level {
  width: 64px;
  flex: 0 0 64px;
  justify-content: center;
}
.log-logger {
  width: 120px;
  flex: 0 0 120px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
