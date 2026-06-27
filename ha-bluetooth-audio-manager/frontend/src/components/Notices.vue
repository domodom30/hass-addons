<template>
  <v-snackbar
    v-model="visible"
    :timeout="3000"
    color="success"
    theme="dark"
    location="bottom"
  >
    {{ currentMessage }}
    <template #actions>
      <v-btn variant="text" @click="visible = false">{{ $t("common.close") }}</v-btn>
    </template>
  </v-snackbar>
</template>

<script>
export default {
  name: "Notices",
  data() {
    return { visible: false };
  },
  computed: {
    notices() {
      return this.$store.state.notices;
    },
    currentMessage() {
      return this.notices[0]?.message || "";
    },
  },
  watch: {
    notices: {
      handler(list) {
        if (list.length > 0 && !this.visible) this.visible = true;
      },
      deep: true,
    },
    visible(v) {
      if (!v) this.$store.commit("clearNotices");
    },
  },
};
</script>
