<template>
  <v-app-bar color="surface" flat density="default" border="b-thin" height="56">
    <div class="d-flex align-center gap-3 px-3">
      <!-- Logo cliquable -->
      <router-link
        to="/"
        class="text-decoration-none d-flex align-center home-link"
      >
        <v-icon size="26" color="primary"> mdi-lock </v-icon>
      </router-link>

      <!-- Titre + version non cliquables -->
      <div class="d-flex flex-column">
        <span class="text-body-1 font-weight-bold">
          {{ modeTitle }}
        </span>

        <div v-if="!smAndDown" class="d-flex align-center ga-1">
          <span class="version-badge"> v{{ version }} </span>

          <v-tooltip text="GitHub" location="bottom">
            <template #activator="{ props }">
              <a
                v-bind="props"
                :href="github"
                target="_blank"
                rel="noopener noreferrer"
                class="github-link"
              >
                <v-icon size="16">mdi-github</v-icon>
              </a>
            </template>
          </v-tooltip>
        </div>
      </div>
    </div>

    <v-spacer />

    <!-- CENTRE : badges statut serrures -->
    <div
      v-if="totalLocks > 0 && !smAndDown"
      class="badges-group d-flex align-center ga-3 px-3 py-1"
    >
      <!-- Total serrures -->
      <v-tooltip :text="$t('dashboard.totalLocks')" location="bottom">
        <template #activator="{ props }">
          <div
            v-bind="props"
            class="d-flex align-center ga-1 text-caption badge-item"
          >
            <v-icon size="14" color="primary">mdi-lock-outline</v-icon>
            <span class="font-weight-medium">{{ totalLocks }}</span>
          </div>
        </template>
      </v-tooltip>

      <v-divider vertical />

      <!-- Connectées -->
      <v-tooltip
        :text="`${connectedLocks}/${totalLocks} ${$t('dashboard.connected').toLowerCase()}`"
        location="bottom"
      >
        <template #activator="{ props }">
          <div
            v-bind="props"
            class="d-flex align-center ga-1 text-caption badge-item"
          >
            <v-icon size="14" :color="connectedColor"
              >mdi-bluetooth-connect</v-icon
            >
            <span class="font-weight-medium" :class="`text-${connectedColor}`">
              {{ connectedLocks }}/{{ totalLocks }}
            </span>
          </div>
        </template>
      </v-tooltip>

      <!-- Batterie faible (uniquement si > 0) -->
      <template v-if="lowBattery > 0">
        <v-divider vertical />
        <v-tooltip
          :text="`${lowBattery} ${$t('dashboard.lowBattery').toLowerCase()}`"
          location="bottom"
        >
          <template #activator="{ props }">
            <div
              v-bind="props"
              class="d-flex align-center ga-1 text-caption badge-item"
            >
              <v-icon size="14" color="warning"
                >mdi-battery-alert-variant-outline</v-icon
              >
              <span class="font-weight-medium text-warning">{{
                lowBattery
              }}</span>
            </div>
          </template>
        </v-tooltip>
      </template>
    </div>

    <v-spacer />

    <!-- DROITE : boutons d'action -->
    <template #append>
      <div class="d-flex align-center ga-1 pr-2">
        <!-- Indicateur de statut démarrage -->
        <v-tooltip
          v-if="startupStatus !== 0"
          :text="startupStatusTxt"
          location="bottom"
        >
          <template #activator="{ props }">
            <v-chip
              v-bind="props"
              :color="startupStatus === 1 ? 'error' : 'warning'"
              variant="tonal"
              size="small"
              class="mr-1"
            >
              <v-progress-circular
                v-if="startupStatus !== 1"
                indeterminate
                size="14"
                width="2"
                class="mr-1"
              />
              <v-icon v-else start size="14">mdi-alert-circle</v-icon>
              {{ startupStatusShort }}
            </v-chip>
          </template>
        </v-tooltip>

        <!-- Menu statut gateway -->
        <v-menu v-if="showGatewayChip" location="bottom end">
          <template #activator="{ props: menuProps }">
            <v-tooltip :text="gatewayStatusTxt" location="bottom">
              <template #activator="{ props: tooltipProps }">
                <v-btn
                  v-bind="{ ...menuProps, ...tooltipProps }"
                  :icon="
                    isRestartingGateway || isRebootingEsp32 ? null : gatewayIcon
                  "
                  :loading="isRestartingGateway || isRebootingEsp32"
                  :color="gatewayChipColor"
                  variant="text"
                  size="small"
                />
              </template>
            </v-tooltip>
          </template>
          <v-list density="compact" min-width="220">
            <v-list-item
              :disabled="isRestartingGateway || isRebootingEsp32"
              @click="$store.dispatch('restartGateway')"
            >
              <template #prepend>
                <v-icon color="warning" size="18" class="mr-3"
                  >mdi-lan-pending</v-icon
                >
              </template>
              <template #title>
                <span class="text-caption">{{
                  $t("app.gateway.restart")
                }}</span>
              </template>
            </v-list-item>
            <v-list-item
              :disabled="isRestartingGateway || isRebootingEsp32"
              @click="$store.dispatch('rebootEsp32')"
            >
              <template #prepend>
                <v-icon color="error" size="18" class="mr-3"
                  >mdi-restart</v-icon
                >
              </template>
              <template #title>
                <span class="text-caption">{{
                  $t("app.gateway.rebootEsp32")
                }}</span>
              </template>
            </v-list-item>
            <v-divider class="my-1" />
            <v-list-item
              v-if="gatewayWebUrl"
              :href="gatewayWebUrl"
              target="_blank"
              rel="noopener noreferrer"
            >
              <template #prepend>
                <v-icon color="primary" size="18" class="mr-3"
                  >mdi-open-in-new</v-icon
                >
              </template>
              <template #title>
                <span class="text-caption">{{
                  $t("app.gateway.openWeb")
                }}</span>
              </template>
            </v-list-item>
          </v-list>
        </v-menu>

        <!-- Toggle thème -->
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

        <!-- Menu overflow (activité globale, configuration, alias) -->
        <v-menu location="bottom end">
          <template #activator="{ props }">
            <v-btn
              v-bind="props"
              icon="mdi-dots-vertical"
              variant="text"
              size="small"
            />
          </template>
          <v-list density="compact" min-width="240">
            <template v-if="smAndDown && totalLocks > 0">
              <v-list-item>
                <template #prepend>
                  <v-icon size="18" color="primary" class="mr-3">mdi-lock-outline</v-icon>
                </template>
                <v-list-item-title class="text-caption">{{ $t('dashboard.totalLocks') }}: {{ totalLocks }}</v-list-item-title>
              </v-list-item>
              <v-list-item>
                <template #prepend>
                  <v-icon size="18" :color="connectedColor" class="mr-3">mdi-bluetooth-connect</v-icon>
                </template>
                <v-list-item-title class="text-caption">{{ $t('dashboard.connected') }}: {{ connectedLocks }}/{{ totalLocks }}</v-list-item-title>
              </v-list-item>
              <v-list-item v-if="lowBattery > 0">
                <template #prepend>
                  <v-icon size="18" color="warning" class="mr-3">mdi-battery-alert-variant-outline</v-icon>
                </template>
                <v-list-item-title class="text-caption">{{ $t('dashboard.lowBattery') }}: {{ lowBattery }}</v-list-item-title>
              </v-list-item>
              <v-divider class="my-1" />
            </template>
            <v-list-item @click="openGlobalActivity">
              <template #prepend>
                <v-icon color="success" size="18" class="mr-3"
                  >mdi-console-line</v-icon
                >
              </template>
              <v-list-item-title class="text-caption">{{
                $t("operations.allTitle")
              }}</v-list-item-title>
            </v-list-item>
            <v-list-item :disabled="isScanning" @click="editConfig">
              <template #prepend>
                <v-icon color="primary" size="18" class="mr-3"
                  >mdi-tune-variant</v-icon
                >
              </template>
              <v-list-item-title class="text-caption">{{
                $t("app.editConfig")
              }}</v-list-item-title>
            </v-list-item>
            <v-divider class="my-1" />
            <v-list-item @click="exportAliases">
              <template #prepend>
                <v-icon color="primary" size="18" class="mr-3"
                  >mdi-download-outline</v-icon
                >
              </template>
              <v-list-item-title class="text-caption">{{
                $t("aliases.export")
              }}</v-list-item-title>
            </v-list-item>
            <v-list-item @click="$refs.aliasInput.click()">
              <template #prepend>
                <v-icon color="secondary" size="18" class="mr-3"
                  >mdi-upload-outline</v-icon
                >
              </template>
              <v-list-item-title class="text-caption">{{
                $t("aliases.import")
              }}</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-menu>
        <input
          id="aliasFileInput"
          ref="aliasInput"
          type="file"
          accept=".json,application/json"
          hidden
          aria-label="Importer un fichier d'alias"
          @change="importAliases"
        />
      </div>
    </template>
  </v-app-bar>
</template>

<script>
import { useTheme } from "@/composables/useTheme";
import { useDisplay } from "vuetify";

export default {
  name: "AppTopBar",
  setup() {
    const { isDark, toggleTheme } = useTheme();
    const { smAndDown } = useDisplay();
    return { isDark, toggleTheme, smAndDown };
  },
  computed: {
    version() {
      return import.meta.env.VITE_APP_VERSION;
    },
    github() {
      return import.meta.env.VITE_APP_GITHUB;
    },
    startupStatus() {
      return this.$store.state.startupStatus;
    },
    startupStatusTxt() {
      switch (this.startupStatus) {
        case 0:
          return this.$t("app.status.ok");
        case 1:
          return this.$t("app.status.error");
        default:
          return this.$t("app.status.starting");
      }
    },
    startupStatusShort() {
      return this.startupStatus === 1 ? "!" : "...";
    },
    gatewayStatus() {
      return this.$store.state.gatewayStatus;
    },
    gatewayHost() {
      return this.$store.state.gatewayHost;
    },
    gatewayWebUrl() {
      const ip = this.gatewayHost.split(":")[0];
      return ip ? `https://${ip}` : null;
    },
    showGatewayChip() {
      return this.gatewayStatus !== "n/a" && this.gatewayStatus !== "";
    },
    modeTitle() {
      return this.showGatewayChip
        ? this.$t("app.modeGateway")
        : this.$t("app.modeBluetooth");
    },
    gatewayChipColor() {
      switch (this.gatewayStatus) {
        case "connected":
          return "success";
        case "disconnected":
          return "error";
        default:
          return "warning";
      }
    },
    gatewayIcon() {
      switch (this.gatewayStatus) {
        case "connected":
          return "mdi-lan-connect";
        case "disconnected":
          return "mdi-lan-disconnect";
        default:
          return "mdi-help-network";
      }
    },
    gatewayStatusTxt() {
      switch (this.gatewayStatus) {
        case "connected":
          return this.$t("app.gateway.connected", { host: this.gatewayHost });
        case "connecting":
          return this.$t("app.gateway.connecting");
        case "disconnected":
          return this.$t("app.gateway.disconnected");
        case "unknown":
          return this.$t("app.gateway.unknown");
        default:
          return "";
      }
    },
    isScanning() {
      return this.$store.state.scanStatus == 1;
    },
    totalLocks() {
      return this.$store.state.locks.length;
    },
    connectedLocks() {
      return this.$store.state.locks.filter((l) => l.connected).length;
    },
    lowBattery() {
      return this.$store.state.locks.filter(
        (l) => typeof l.battery === "number" && l.battery > 0 && l.battery < 20,
      ).length;
    },
    connectedColor() {
      if (this.totalLocks === 0) return "secondary";
      if (this.connectedLocks === this.totalLocks) return "success";
      if (this.connectedLocks === 0) return "error";
      return "warning";
    },
    isRestartingGateway() {
      return this.$store.state.waitingGatewayRestart;
    },
    isRebootingEsp32() {
      return this.$store.state.waitingEsp32Reboot;
    },
  },
  methods: {
    editConfig() {
      this.$store.commit("setOverlay", { overlay: "config" });
    },
    openGlobalActivity() {
      this.$store.commit("setOverlay", { overlay: "logs", address: null });
    },

    /** Construit l'URL de base de l'API (fonctionne en HA ingress et en dev Vite). */
    _apiBase() {
      const loc = globalThis.location.href.replace(
        globalThis.location.hash,
        "",
      );
      if (loc.includes("/frontend/")) {
        return loc.replace(/\/frontend\/.*$/, "/");
      }
      return "/";
    },

    exportAliases() {
      const url = this._apiBase() + "api/aliases";
      const a = document.createElement("a");

      a.href = url;
      a.download = "aliasData.json";

      document.body.appendChild(a);
      a.click();
      a.remove();
    },

    async importAliases(event) {
      const file = event.target.files[0];
      // Réinitialiser l'input pour permettre de re-sélectionner le même fichier
      event.target.value = "";
      if (!file) return;

      try {
        const text = await file.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch {
          this.$store.commit("setError", {
            message: this.$t("aliases.importErrorJson"),
          });
          return;
        }

        if (
          !data ||
          typeof data !== "object" ||
          Array.isArray(data) ||
          typeof data.lock !== "object" ||
          Array.isArray(data.lock) ||
          typeof data.card !== "object" ||
          Array.isArray(data.card) ||
          typeof data.finger !== "object" ||
          Array.isArray(data.finger)
        ) {
          this.$store.commit("setError", {
            message: this.$t("aliases.importErrorFormat"),
          });
          return;
        }

        const url = this._apiBase() + "api/aliases";
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          this.$store.commit("setError", {
            message: this.$t("aliases.importErrorServer"),
          });
          return;
        }

        this.$store.commit("setNotice", { message: "aliases.importSuccess" });
      } catch {
        this.$store.commit("setError", {
          message: this.$t("aliases.importErrorServer"),
        });
      }
    },
  },
};
</script>

<style scoped>
/* Lien logo → accueil */
.home-link {
  color: inherit;
  transition: opacity 0.15s ease;
}

.home-link:hover {
  opacity: 0.75;
}

.version-badge {
  display: inline-block;
  align-self: flex-start;
  margin-top: 2px;
  padding: 1px 8px;
  border-radius: 999px;
  background: rgba(var(--v-theme-primary), 0.15);
  color: rgb(var(--v-theme-primary));
  font-size: 10px;
  font-weight: 600;
  line-height: 16px;
}

.github-link {
  display: flex;
  align-items: center;
  color: rgb(var(--v-theme-on-surface));
  opacity: 0.7;
  transition: opacity 0.15s ease;
}

.github-link:hover {
  opacity: 1;
}

/* Groupe de badges centré */
.badges-group {
  background: rgba(var(--v-theme-on-surface), 0.06);
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  border-radius: 10px;
}

/* Chaque badge individuel */
.badge-item {
  cursor: default;
  border-radius: 6px;
  padding: 2px 4px;
  transition: background-color 0.15s ease;
}
.badge-item:hover {
  background-color: rgba(var(--v-theme-on-surface), 0.08);
}
</style>
