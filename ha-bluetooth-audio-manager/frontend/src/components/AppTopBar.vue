<template>
  <v-app-bar color="surface" flat density="default" border="b-thin" height="56">
    <router-link
      to="/"
      class="d-flex align-center px-3 text-decoration-none home-link"
    >
      <v-tooltip :text="`v${version}`" location="bottom">
        <template #activator="{ props }">
          <v-icon v-bind="props" size="26" color="primary">mdi-bluetooth-audio</v-icon>
        </template>
      </v-tooltip>
      <span class="text-body-1 font-weight-bold ml-2">{{ $t("app.title") }}</span>
    </router-link>

    <v-spacer />

    <div v-if="total > 0" class="badges-group d-flex align-center ga-3 px-3 py-1">
      <v-tooltip :text="$t('dashboard.total')" location="bottom">
        <template #activator="{ props }">
          <div v-bind="props" class="d-flex align-center ga-1 text-caption badge-item">
            <v-icon size="14" color="primary">mdi-speaker</v-icon>
            <span class="font-weight-medium">{{ total }}</span>
          </div>
        </template>
      </v-tooltip>
      <v-divider vertical />
      <v-tooltip
        :text="`${connected}/${total} ${$t('dashboard.connected').toLowerCase()}`"
        location="bottom"
      >
        <template #activator="{ props }">
          <div v-bind="props" class="d-flex align-center ga-1 text-caption badge-item">
            <v-icon size="14" :color="connectedColor">mdi-bluetooth-connect</v-icon>
            <span class="font-weight-medium" :class="`text-${connectedColor}`">
              {{ connected }}/{{ total }}
            </span>
          </div>
        </template>
      </v-tooltip>
    </div>

    <v-spacer />

    <template #append>
      <div class="d-flex align-center ga-1 pr-2">
        <v-tooltip :text="$t('theme.toggle')" location="bottom">
          <template #activator="{ props }">
            <v-btn
              v-bind="props"
              :icon="isDark ? 'mdi-weather-sunny' : 'mdi-weather-night'"
              variant="text"
              size="small"
              @click="toggleTheme"
            />
          </template>
        </v-tooltip>

        <v-menu location="bottom end">
          <template #activator="{ props }">
            <v-btn v-bind="props" icon="mdi-translate" variant="text" size="small" />
          </template>
          <v-list density="compact" min-width="160">
            <v-list-item
              v-for="l in locales"
              :key="l.code"
              :active="currentLocale === l.code"
              @click="setLocale(l.code)"
            >
              <v-list-item-title class="text-caption">{{ l.label }}</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-menu>

        <v-menu location="bottom end">
          <template #activator="{ props }">
            <v-btn v-bind="props" icon="mdi-dots-vertical" variant="text" size="small" />
          </template>
          <v-list density="compact" min-width="220">
            <v-list-item @click="openOverlay('events')">
              <template #prepend>
                <v-icon size="18" class="mr-3" color="indigo">mdi-format-list-bulleted</v-icon>
              </template>
              <v-list-item-title class="text-caption">{{ $t("menu.events") }}</v-list-item-title>
            </v-list-item>

            <v-list-item @click="openOverlay('logs')">
              <template #prepend>
                <v-icon size="18" class="mr-3" color="teal">mdi-text-box-outline</v-icon>
              </template>
              <v-list-item-title class="text-caption">{{ $t("menu.logs") }}</v-list-item-title>
            </v-list-item>

            <v-divider class="my-1" />

            <v-list-item @click="openOverlay('appSettings')">
              <template #prepend>
                <v-icon size="18" class="mr-3" color="deep-purple">mdi-tune-variant</v-icon>
              </template>
              <v-list-item-title class="text-caption">{{ $t("menu.appSettings") }}</v-list-item-title>
            </v-list-item>

            <v-list-item @click="openAdapters">
              <template #prepend>
                <v-icon size="18" class="mr-3" color="cyan-darken-2">mdi-chip</v-icon>
              </template>
              <v-list-item-title class="text-caption">{{ $t("menu.adapters") }}</v-list-item-title>
            </v-list-item>

            <v-divider class="my-1" />

            <v-list-item @click="restart">
              <template #prepend>
                <v-icon size="18" class="mr-3" color="red-darken-2">mdi-restart</v-icon>
              </template>
              <v-list-item-title class="text-caption">{{ $t("menu.restart") }}</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-menu>
      </div>
    </template>
  </v-app-bar>
</template>

<script>
import { useTheme } from "@/composables/useTheme";

export default {
  name: "AppTopBar",
  inject: ["confirm"],
  setup() {
    const { isDark, toggleTheme } = useTheme();
    return { isDark, toggleTheme };
  },
  data() {
    return {
      locales: [
        { code: "en", label: "English" },
        { code: "fr", label: "Français" },
      ],
    };
  },
  computed: {
    version() {
      return this.$store.state.info.version;
    },
    total() {
      return this.$store.getters.managedCount + this.discoveredCount;
    },
    discoveredCount() {
      return this.$store.state.devices.filter(
        (d) => !d.stored && !d.paired && !d.connected,
      ).length;
    },
    connected() {
      return this.$store.getters.connectedCount;
    },
    connectedColor() {
      if (this.total === 0) return "secondary";
      if (this.connected === 0) return "error";
      if (this.connected === this.$store.getters.managedCount) return "success";
      return "warning";
    },
    currentLocale() {
      return this.$i18n.locale;
    },
  },
  methods: {
    openOverlay(overlay) {
      this.$store.commit("setOverlay", { overlay });
    },
    openAdapters() {
      this.$store.commit("setOverlay", { overlay: "adapters" });
      this.$store.dispatch("loadAdapters");
    },
    setLocale(code) {
      this.$i18n.locale = code;
      try {
        localStorage.setItem("bt_audio_locale", code);
      } catch {
        // localStorage inaccessible
      }
    },
    async restart() {
      const ok = await this.confirm(
        this.$t("menu.restart"),
        this.$t("menu.restart") + " ?",
        { color: "error", icon: "mdi-restart", confirmText: this.$t("menu.restart") },
      );
      if (ok) this.$store.dispatch("restart");
    },
  },
};
</script>

<style scoped>
.home-link {
  color: inherit;
  transition: opacity 0.15s ease;
}
.home-link:hover {
  opacity: 0.75;
}
.badges-group {
  background: rgba(var(--v-theme-on-surface), 0.06);
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  border-radius: 10px;
}
.badge-item {
  cursor: default;
  border-radius: 6px;
  padding: 2px 4px;
}
</style>
