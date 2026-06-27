<template>
  <v-app>
    <AppTopBar />

    <v-main class="bg-background">
      <div class="page-container">
        <router-view />
      </div>
    </v-main>

    <DeviceSettingsDialog />
    <AppSettingsDialog />
    <AdaptersDialog />
    <EventsDialog />
    <LogsDialog />

    <ConfirmDlg ref="confirm" />
    <Errors />
    <Notices />

    <!-- Server reconnect indicator -->
    <v-snackbar
      :model-value="reconnecting"
      :timeout="-1"
      color="warning"
      location="top"
    >
      <v-progress-circular indeterminate size="18" width="2" class="mr-2" />
      {{ $t("reconnect.message") }}
    </v-snackbar>

    <!-- Long-running operation status (e.g. adapter switch / restart) -->
    <v-snackbar
      :model-value="!!status"
      :timeout="-1"
      color="info"
      location="bottom"
    >
      <v-progress-circular indeterminate size="18" width="2" class="mr-2" />
      {{ status }}
    </v-snackbar>
  </v-app>
</template>

<script>
import AppTopBar from "@/components/AppTopBar.vue";
import DeviceSettingsDialog from "@/components/DeviceSettingsDialog.vue";
import AppSettingsDialog from "@/components/AppSettingsDialog.vue";
import AdaptersDialog from "@/components/AdaptersDialog.vue";
import EventsDialog from "@/components/EventsDialog.vue";
import LogsDialog from "@/components/LogsDialog.vue";
import ConfirmDlg from "@/components/ConfirmDlg.vue";
import Errors from "@/components/Errors.vue";
import Notices from "@/components/Notices.vue";

export default {
  name: "App",
  components: {
    AppTopBar,
    DeviceSettingsDialog,
    AppSettingsDialog,
    AdaptersDialog,
    EventsDialog,
    LogsDialog,
    ConfirmDlg,
    Errors,
    Notices,
  },
  // Expose a promise-based confirm() to any descendant (DeviceCard, dialogs).
  provide() {
    return {
      confirm: (title, message, options) =>
        this.$refs.confirm.open(title, message, options),
    };
  },
  computed: {
    reconnecting() {
      return this.$store.state.reconnecting;
    },
    status() {
      return this.$store.state.status;
    },
  },
};
</script>

<style>
.page-container {
  max-width: 1280px;
  margin: 0 auto;
  padding: 24px;
}

@media (max-width: 600px) {
  .page-container {
    padding: 16px;
  }
}

.font-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.75rem;
}

::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: rgba(128, 128, 128, 0.25);
  border-radius: 8px;
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(128, 128, 128, 0.45);
}
</style>
