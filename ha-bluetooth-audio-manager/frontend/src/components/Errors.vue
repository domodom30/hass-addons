<template>
  <v-snackbar
    :model-value="hasErrors"
    :timeout="-1"
    color="error"
    theme="dark"
    location="bottom"
    @update:model-value="onUpdate"
  >
    <div v-for="(e, i) in errors" :key="i">{{ e.message }}</div>
    <template #actions>
      <v-btn variant="text" @click="clear">{{ $t("common.close") }}</v-btn>
    </template>
  </v-snackbar>
</template>

<script>
export default {
  name: "Errors",
  computed: {
    errors() {
      return this.$store.state.errors;
    },
    hasErrors() {
      return this.errors.length > 0;
    },
  },
  methods: {
    clear() {
      this.$store.commit("clearErrors");
    },
    onUpdate(v) {
      if (!v) this.clear();
    },
  },
};
</script>
