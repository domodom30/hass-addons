<template>
  <v-snackbar v-model="hasErrors" :vertical="true" :timeout="-1" color="error" theme="dark">
    <v-list-item v-for="error of errors" :key="error.message" :title="error.message">
    </v-list-item>

    <template v-slot:actions>
      <v-btn color="black" variant="text" @click="clearErrors"> {{ $t('common.close') }} </v-btn>
    </template>
  </v-snackbar>
</template>
<script>
export default {
  name: "Errors",
  computed: {
    hasErrors() {
      return this.errors.length > 0
    },
    errors() {
      return this.$store.state.errors
    },
  },
  methods: {
    clearErrors() {
      this.$store.commit("clearErrors")
    },
  }
}
</script>
