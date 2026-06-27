<template>
  <v-dialog v-model="show" max-width="760" scrollable>
    <v-card>
      <div class="d-flex align-center ga-3 px-5 py-3">
        <v-avatar size="36" color="primary" variant="tonal">
          <v-icon size="20">mdi-format-list-bulleted</v-icon>
        </v-avatar>
        <div class="text-subtitle-1 font-weight-bold flex-grow-1">
          {{ $t("events.title") }}
          <v-chip size="x-small" class="ml-1" variant="tonal">{{ events.length }}</v-chip>
        </div>
        <v-btn variant="text" size="small" prepend-icon="mdi-delete-outline" @click="clear">
          {{ $t("events.clear") }}
        </v-btn>
        <v-btn icon="mdi-close" variant="text" size="small" @click="show = false" />
      </div>
      <v-divider />
      <v-card-text ref="log" class="events-log font-mono pa-3">
        <div v-if="events.length === 0" class="text-center text-medium-emphasis py-6">
          <v-icon size="32" class="mb-2 d-block mx-auto">mdi-satellite-uplink</v-icon>
          {{ $t("events.empty") }}
        </div>
        <div v-for="e in events" :key="e.id" class="event-row d-flex align-center ga-2 py-1">
          <span class="text-medium-emphasis">{{ e.time }}</span>
          <v-chip size="x-small" :color="kindColor(e.kind)" variant="tonal" label>
            {{ kindLabel(e.kind) }}
          </v-chip>
          <span class="flex-grow-1">
            <template v-if="e.kind === 'mpris'">
              <strong>{{ e.command }}</strong>
              <span v-if="e.detail" class="text-medium-emphasis"> {{ e.detail }}</span>
            </template>
            <template v-else>
              <strong>{{ e.property }}</strong> =
              <span class="text-success">{{ e.value }}</span>
            </template>
            <span v-if="e.name" class="text-medium-emphasis"> [{{ e.name }}]</span>
          </span>
        </div>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script>
export default {
  name: "EventsDialog",
  computed: {
    show: {
      get() {
        return this.$store.state.ui.overlay === "events";
      },
      set(v) {
        if (!v) this.$store.commit("clearOverlay");
      },
    },
    events() {
      return this.$store.state.events;
    },
  },
  watch: {
    "events.length"() {
      this.$nextTick(() => {
        const el = this.$refs.log?.$el || this.$refs.log;
        if (el) el.scrollTop = el.scrollHeight;
      });
    },
  },
  methods: {
    clear() {
      this.$store.commit("clearEvents");
    },
    kindColor(kind) {
      if (kind === "mpris") return "primary";
      if (kind === "avrcp") return "info";
      return "secondary";
    },
    kindLabel(kind) {
      if (kind === "mpris") return "MPRIS";
      if (kind === "avrcp") return "AVRCP";
      return "Transport";
    },
  },
};
</script>

<style scoped>
.events-log {
  height: 60vh;
  overflow-y: auto;
  font-size: 0.8rem;
}
.event-row {
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.06);
}
</style>
