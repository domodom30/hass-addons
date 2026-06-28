<template>
  <v-app-bar color="surface" flat density="default" border="b-thin" height="56">
    <div class="d-flex align-center px-3">
      <router-link to="/" class="d-flex align-center text-decoration-none home-link">
        <v-icon size="26" color="primary">mdi-bluetooth-audio</v-icon>
      </router-link>
      <div class="d-flex flex-column ml-2">
        <router-link to="/" class="text-decoration-none home-link">
          <span class="text-body-1 font-weight-bold title-line">{{ $t("app.title") }}</span>
        </router-link>
        <div class="d-flex align-center ga-2">
          <span v-if="version" class="version-badge text-caption">v{{ version }}</span>
          <v-tooltip text="GitHub" location="bottom">
            <template #activator="{ props }">
              <a v-bind="props" :href="repoUrl" target="_blank" rel="noopener noreferrer"
                class="github-link d-inline-flex align-center" aria-label="GitHub">
                <v-icon size="16">mdi-github</v-icon>
              </a>
            </template>
          </v-tooltip>
        </div>
      </div>
    </div>

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
      <v-tooltip :text="`${connected}/${total} ${$t('dashboard.connected').toLowerCase()}`" location="bottom">
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
            <v-btn v-bind="props" :icon="isDark ? 'mdi-weather-sunny' : 'mdi-weather-night'" variant="text" size="small"
              @click="toggleTheme" />
          </template>
        </v-tooltip>

        <v-menu location="bottom end">
          <template #activator="{ props }">
            <v-btn v-bind="props" icon="mdi-translate" variant="text" size="small" />
          </template>
          <v-list density="compact" min-width="160">
            <v-list-item v-for="l in locales" :key="l.code" :active="currentLocale === l.code" active-color="primary"
              @click="setLocale(l.code)">
              <!-- Ajout d'une petite icône coche pour la langue active (optionnel mais super propre) -->
              <template v-if="currentLocale === l.code" #prepend>
                <v-icon size="16" color="primary" class="mr-2">mdi-check</v-icon>
              </template>
              <v-list-item-title class="text-caption">{{ l.label }}</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-menu>

        <v-menu location="bottom end">
          <template #activator="{ props }">
            <v-btn v-bind="props" icon="mdi-dots-vertical" variant="text" size="small" />
          </template>
          <v-list density="compact" min-width="220">

            <!-- Événements : Bleu / Info (Historique, données informatives) -->
            <v-list-item @click="openOverlay('events')">
              <template #prepend>
                <v-icon size="18" class="mr-3" color="info">mdi-format-list-bulleted</v-icon>
              </template>
              <v-list-item-title class="text-caption">{{ $t("menu.events") }}</v-list-item-title>
            </v-list-item>

            <!-- Logs : Teinte neutre / Secondary (Fichiers textes, data brute) -->
            <v-list-item @click="openOverlay('logs')">
              <template #prepend>
                <v-icon size="18" class="mr-3" color="secondary">mdi-text-box-outline</v-icon>
              </template>
              <v-list-item-title class="text-caption">{{ $t("menu.logs") }}</v-list-item-title>
            </v-list-item>

            <v-divider class="my-1" />

            <!-- Configuration Application : Couleur de la marque / Primary -->
            <v-list-item @click="openOverlay('appSettings')">
              <template #prepend>
                <v-icon size="18" class="mr-3" color="primary">mdi-tune-variant</v-icon>
              </template>
              <v-list-item-title class="text-caption">{{ $t("menu.appSettings") }}</v-list-item-title>
            </v-list-item>

            <!-- Adaptateurs / Matériel : Vert / Success (Composants opérationnels, techno) -->
            <v-list-item @click="openAdapters">
              <template #prepend>
                <v-icon size="18" class="mr-3" color="success">mdi-chip</v-icon>
              </template>
              <v-list-item-title class="text-caption">{{ $t("menu.adapters") }}</v-list-item-title>
            </v-list-item>

            <v-divider class="my-1" />

            <!-- Redémarrer : Orange / Warning (Action critique mais non destructive) -->
            <!-- Note : On applique "base-color" sur l'item pour colorer harmonieusement tout le bouton au survol -->
            <v-list-item base-color="warning" @click="restart">
              <template #prepend>
                <v-icon size="18" class="mr-3">mdi-restart</v-icon>
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
      repoUrl:
        "https://github.com/domodom30/hass-addons/tree/master/ha-bluetooth-audio-manager",
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
      return this.$store.getters.managedDevices.length;
    },
    connected() {
      return this.$store.getters.connectedCount;
    },
    connectedColor() {
      if (this.total === 0) return "secondary";
      if (this.connected === 0) return "error";
      if (this.connected === this.total) return "success";
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

.title-line {
  line-height: 1.1;
}

.version-badge {
  align-self: flex-start;
  line-height: 1;
  padding: 1px 6px;
  border-radius: 6px;
  color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.12);
}

.github-link {
  color: rgb(var(--v-theme-on-surface));
  opacity: 0.6;
  transition: opacity 0.15s ease;
}

.github-link:hover {
  opacity: 1;
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
