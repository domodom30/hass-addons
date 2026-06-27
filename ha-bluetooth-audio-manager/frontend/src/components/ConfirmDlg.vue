<template>
  <v-dialog v-model="dialog" :max-width="options.width" @keydown.esc="cancel">
    <v-card>
      <div class="d-flex align-center pa-5 pb-3 ga-3">
        <v-avatar size="36" :color="options.color" variant="tonal">
          <v-icon size="20">{{ options.icon }}</v-icon>
        </v-avatar>
        <div class="text-subtitle-1 font-weight-bold">{{ title }}</div>
      </div>
      <v-divider />
      <v-card-text v-show="!!message" class="pa-5 text-body-2">{{ message }}</v-card-text>
      <v-divider />
      <v-card-actions class="px-4 py-3">
        <v-btn variant="text" @click="cancel">{{ $t("common.cancel") }}</v-btn>
        <v-spacer />
        <v-btn variant="flat" :color="options.color" @click="agree">
          {{ options.confirmText || $t("common.ok") }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
export default {
  name: "ConfirmDlg",
  data() {
    return {
      dialog: false,
      resolve: null,
      title: null,
      message: null,
      options: { width: 440, color: "warning", icon: "mdi-alert-circle-outline", confirmText: "" },
    };
  },
  methods: {
    open(title, message, options) {
      this.dialog = true;
      this.title = title;
      this.message = message;
      this.options = Object.assign(
        { width: 440, color: "warning", icon: "mdi-alert-circle-outline", confirmText: "" },
        options,
      );
      return new Promise((resolve) => {
        this.resolve = resolve;
      });
    },
    agree() {
      this.resolve(true);
      this.dialog = false;
    },
    cancel() {
      this.resolve(false);
      this.dialog = false;
    },
  },
};
</script>
