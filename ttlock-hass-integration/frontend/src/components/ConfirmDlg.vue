<template>
  <v-dialog
    v-model="dialog"
    :max-width="options.width"
    :style="{ zIndex: options.zIndex }"
    @keydown.esc="cancel"
  >
    <v-card>
      <div class="d-flex align-center pa-5 pb-3 ga-3">
        <v-avatar size="36" color="warning" variant="tonal">
          <v-icon size="20">mdi-alert-circle-outline</v-icon>
        </v-avatar>
        <div class="text-subtitle-1 font-weight-bold">{{ title }}</div>
      </div>
      <v-divider />
      <v-card-text
        v-show="!!message"
        class="pa-5 text-body-2"
        v-html="message"
      />
      <v-divider />
      <v-card-actions class="px-4 py-3">
        <v-btn
          v-if="!options.noconfirm"
          variant="text"
          @click="cancel"
        >{{ $t('common.cancel') }}</v-btn>
        <v-spacer />
        <v-btn
          variant="flat"
          color="primary"
          @click="agree"
        >{{ $t('common.ok') }}</v-btn>
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
      reject: null,
      message: null,
      title: null,
      options: {
        width: 440,
        zIndex: 200,
        noconfirm: false,
      },
    }
  },
  methods: {
    open(title, message, options) {
      this.dialog = true
      this.title = title
      this.message = message
      this.options = Object.assign(this.options, options)
      return new Promise((resolve, reject) => {
        this.resolve = resolve
        this.reject = reject
      })
    },
    agree() {
      this.resolve(true)
      this.dialog = false
    },
    cancel() {
      this.resolve(false)
      this.dialog = false
    },
  },
}
</script>
