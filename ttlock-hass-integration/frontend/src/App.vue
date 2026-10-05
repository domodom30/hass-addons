<template>
  <v-app>
    <AppTopBar />

    <v-main class="bg-background">
      <div class="page-container">
        <router-view />
      </div>

      <!-- Bouton d'ajout (assistant d'appairage) -->
      <v-btn
        class="add-fab"
        color="primary"
        prepend-icon="mdi-plus"
        elevation="0"
        @click="openWizard"
      >{{ $t('wizard.title') }}</v-btn>

      <!-- Overlays (modèle page unique façon ESPHome) -->
      <ConfigDlg :show="overlay === 'config'" @cancel="clearOverlay" />
      <LockLogsDialog />
      <AddLockWizard />

      <!-- Credentials overlay -->
      <v-dialog
        :model-value="overlay === 'credentials'"
        max-width="760"
        scrollable
        transition="dialog-bottom-transition"
        @update:model-value="clearOverlay"
      >
        <v-card>
          <div class="d-flex align-center ga-3 px-5 py-3">
            <v-avatar size="36" color="warning" variant="tonal">
              <v-icon size="20">mdi-key-chain</v-icon>
            </v-avatar>
            <div class="flex-grow-1 overflow-hidden">
              <div class="text-subtitle-1 font-weight-bold text-truncate">{{ $t('lock.credentials') }}</div>
              <div class="text-caption text-medium-emphasis text-truncate">
                {{ activeLockName }} · <span class="font-mono">{{ overlayAddress }}</span>
              </div>
            </div>
            <v-tooltip :text="$t('app.refreshCredentials')" location="bottom">
              <template #activator="{ props }">
                <v-btn
                  v-bind="props"
                  :icon="waitingCredentials ? null : 'mdi-refresh'"
                  :loading="waitingCredentials"
                  variant="text"
                  size="small"
                  @click="refreshCredentials"
                />
              </template>
            </v-tooltip>
            <v-btn icon="mdi-close" variant="text" size="small" @click="clearOverlay" />
          </div>
          <v-divider />
          <v-card-text class="pa-4">
            <CredentialsManager v-if="overlay === 'credentials' && overlayAddress" :key="overlayAddress" :address="overlayAddress" />
          </v-card-text>
        </v-card>
      </v-dialog>

      <!-- Settings overlay -->
      <v-dialog
        :model-value="overlay === 'settings'"
        max-width="900"
        scrollable
        transition="dialog-bottom-transition"
        @update:model-value="clearOverlay"
      >
        <v-card>
          <div class="d-flex align-center ga-3 px-5 py-3">
            <v-avatar size="36" color="info" variant="tonal">
              <v-icon size="20">mdi-cog-outline</v-icon>
            </v-avatar>
            <div class="flex-grow-1 overflow-hidden">
              <div class="text-subtitle-1 font-weight-bold text-truncate">{{ $t('lock.settings') }}</div>
              <div class="text-caption text-medium-emphasis text-truncate">
                {{ activeLockName }} · <span class="font-mono">{{ overlayAddress }}</span>
              </div>
            </div>
            <v-btn icon="mdi-close" variant="text" size="small" @click="clearOverlay" />
          </div>
          <v-divider />
          <v-card-text class="pa-4">
            <SettingsManager
              v-if="overlay === 'settings' && overlayAddress"
              :key="overlayAddress"
              :address="overlayAddress"
              @unpaired="clearOverlay"
            />
          </v-card-text>
        </v-card>
      </v-dialog>

      <Errors />
      <Notices />
    </v-main>
  </v-app>
</template>

<script>
import AppTopBar from "@/components/AppTopBar.vue"
import ConfigDlg from "@/components/ConfigDlg.vue"
import LockLogsDialog from "@/components/LockLogsDialog.vue"
import AddLockWizard from "@/components/AddLockWizard.vue"
import CredentialsManager from "@/components/CredentialsManager.vue"
import SettingsManager from "@/components/SettingsManager.vue"
import Errors from "@/components/Errors.vue"
import Notices from "@/components/Notices.vue"

export default {
  components: {
    AppTopBar, ConfigDlg, LockLogsDialog, AddLockWizard,
    CredentialsManager, SettingsManager, Errors, Notices,
  },
  computed: {
    overlay() {
      return this.$store.state.ui.overlay
    },
    overlayAddress() {
      return this.$store.state.ui.address
    },
    activeLockName() {
      const lock = this.$store.state.locks.find(l => l.address === this.overlayAddress)
      return lock?.name || this.overlayAddress
    },
    waitingCredentials() {
      return this.$store.state.waitingCredentials
    },
  },
  methods: {
    openWizard() {
      this.$store.commit("setOverlay", { overlay: "addWizard" })
    },
    clearOverlay() {
      this.$store.commit("clearOverlay")
    },
    refreshCredentials() {
      if (this.overlayAddress) {
        this.$store.dispatch("readCredentials", this.overlayAddress)
      }
    },
  },
}
</script>

<style>
.page-container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 24px;
}

@media (max-width: 600px) {
  .page-container {
    padding: 16px;
  }
}

.add-fab {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 1006;
}

.font-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.72rem;
}

/* Soft scrollbar tuned for both themes */
::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb {
  background: rgba(128, 128, 128, 0.25);
  border-radius: 8px;
}
::-webkit-scrollbar-thumb:hover { background: rgba(128, 128, 128, 0.45); }
</style>
