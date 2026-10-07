<template>
  <div>
    <!-- Chargement : même disposition que la page (serrures, puis activité) -->
    <template v-if="!locksLoaded">
      <v-row>
        <v-col v-for="n in 3" :key="n" cols="12" sm="6" lg="4">
          <v-skeleton-loader type="card" />
        </v-col>
      </v-row>
      <v-skeleton-loader type="list-item-two-line@4" class="mt-8" />
    </template>

    <v-card v-else-if="totalLocks === 0" class="pa-8 text-center">
      <v-avatar size="64" color="primary" variant="tonal" class="mb-4">
        <v-icon size="32">mdi-lock-plus-outline</v-icon>
      </v-avatar>
      <h2 class="text-h6 font-weight-bold mb-2">{{ $t('dashboard.empty.title') }}</h2>
      <p class="text-body-2 text-medium-emphasis mb-6 mx-auto" style="max-width: 420px;">
        {{ $t('dashboard.empty.subtitle') }}
      </p>
      <v-btn
        color="primary"
        variant="flat"
        prepend-icon="mdi-lock-plus-outline"
        @click="openWizard"
      >
        {{ $t('wizard.title') }}
      </v-btn>
    </v-card>

    <template v-else>
      <!-- Serrures : pleine largeur, toujours en premier (y compris sur mobile) -->
      <section>
        <div class="mb-4">
          <h2 class="text-subtitle-1 font-weight-bold">{{ $t('dashboard.yourLocks') }}</h2>
          <div class="text-caption text-medium-emphasis">{{ $t('dashboard.yourLocksHint') }}</div>
        </div>
        <v-row>
          <v-col v-for="lock in locks" :key="lock.address" cols="12" sm="6" lg="4">
            <Lock :lock="lock" />
          </v-col>
        </v-row>
      </section>

      <!-- Activité récente : ligne dédiée, pleine largeur -->
      <section class="mt-8">
        <v-card>
          <div class="d-flex align-center justify-space-between ga-2 px-4 py-3">
            <div class="d-flex align-center ga-2">
              <v-avatar size="28" color="info" variant="tonal">
                <v-icon size="16">mdi-history</v-icon>
              </v-avatar>
              <h2 class="text-subtitle-1 font-weight-bold">{{ $t('dashboard.recentActivity') }}</h2>
            </div>
            <v-btn
              variant="text"
              size="small"
              color="primary"
              append-icon="mdi-chevron-right"
              @click="openGlobalActivity"
            >{{ $t('dashboard.viewAll') }}</v-btn>
          </div>
          <v-divider opacity="0.08" />

          <div v-if="recentRows.length === 0" class="d-flex flex-column align-center text-center py-8">
            <v-icon size="28" color="medium-emphasis" class="mb-2">mdi-history</v-icon>
            <span class="text-body-2 text-medium-emphasis">{{ $t('dashboard.noActivity') }}</span>
          </div>

          <template v-else>
            <template v-if="mdAndUp">
              <div class="activity-grid activity-head px-4 py-2 text-caption text-medium-emphasis text-uppercase font-weight-medium">
                <span>{{ $t('dashboard.activity.event') }}</span>
                <span>{{ $t('dashboard.activity.lock') }}</span>
                <span>{{ $t('dashboard.activity.credential') }}</span>
                <span class="text-end">{{ $t('dashboard.activity.when') }}</span>
              </div>
              <v-divider opacity="0.08" />
            </template>

            <div v-for="(row, i) in recentRows" :key="row.key">
              <v-divider v-if="i > 0" opacity="0.06" />

              <!-- Ordinateur / tablette : colonnes -->
              <div v-if="mdAndUp" class="activity-grid align-center px-4 py-1">
                <div class="d-flex align-center ga-3 min-w-0">
                  <v-avatar size="32" :color="row.color" variant="tonal" class="flex-shrink-0">
                    <v-icon size="18" :icon="row.icon" />
                  </v-avatar>
                  <span class="text-body-2 font-weight-medium text-truncate">{{ row.label }}</span>
                </div>
                <span class="text-body-2 text-truncate">{{ row.lockName }}</span>
                <span class="text-body-2 text-truncate" :class="{ 'text-medium-emphasis': !row.credential }">
                  {{ row.credential || '—' }}
                </span>
                <div class="text-end">
                  <div class="text-body-2">{{ row.relative }}</div>
                  <div class="text-caption text-medium-emphasis">{{ row.date }}</div>
                </div>
              </div>

              <!-- Mobile : empilé -->
              <div v-else class="d-flex align-center ga-3 px-4 py-3">
                <v-avatar size="32" :color="row.color" variant="tonal" class="flex-shrink-0">
                  <v-icon size="18" :icon="row.icon" />
                </v-avatar>
                <div class="min-w-0 flex-grow-1">
                  <div class="text-body-2 font-weight-medium">{{ row.label }}</div>
                  <div class="text-caption text-medium-emphasis">
                    {{ [row.lockName, row.credential].filter(Boolean).join(' · ') }}
                  </div>
                </div>
                <div class="text-end flex-shrink-0">
                  <div class="text-caption">{{ row.relative }}</div>
                  <div class="text-caption text-medium-emphasis">{{ row.date }}</div>
                </div>
              </div>
            </div>
          </template>
        </v-card>
      </section>
    </template>
  </div>
</template>

<script>
import { useDisplay } from "vuetify"
import Lock from "@/components/Lock.vue"
import { operationMeta, operationMoment } from "@/utils/operations"

const RECENT_COUNT = 8

export default {
  name: "Home",
  components: { Lock },
  setup() {
    const { mdAndUp } = useDisplay()
    return { mdAndUp }
  },
  computed: {
    locks() {
      return this.$store.state.locks
    },
    pairedLocks() {
      return this.$store.state.locks.filter(l => l.paired)
    },
    totalLocks() {
      return this.locks.length
    },
    locksLoaded() {
      return this.$store.state.locksLoaded
    },
    recentActions() {
      const all = []
      const ops = this.$store.state.operations
      for (const addr in ops) {
        const lock = this.$store.state.locks.find(l => l.address === addr)
        const lockName = lock?.name || addr
        for (const op of ops[addr] || []) {
          if (op.operateDate) all.push({ ...op, lockName, lockAddress: addr })
        }
      }
      return all
        .sort((a, b) => {
          if (a.operateDate > b.operateDate) return -1
          if (a.operateDate < b.operateDate) return 1
          if (a.recordNumber > b.recordNumber) return -1
          if (a.recordNumber < b.recordNumber) return 1
          return 0
        })
        .slice(0, RECENT_COUNT)
    },
    recentRows() {
      return this.recentActions.map(op => {
        const meta = operationMeta(op.recordTypeCategory)
        const m = operationMoment(op)
        return {
          key: `${op.lockAddress}-${op.recordNumber}-${op.operateDate}`,
          icon: meta.icon,
          color: meta.color,
          label: op.recordTypeName || this.$t(meta.tagKey),
          lockName: op.lockName,
          // Alias de l'identifiant uniquement : le code PIN brut (op.password) n'est
          // jamais affiché sur le tableau de bord.
          credential: op.passwordName || "",
          relative: m.isValid() ? m.fromNow() : "—",
          date: m.isValid() ? m.format("DD/MM/YYYY HH:mm") : "",
        }
      })
    },
  },
  created() {
    this.autoLoad(this.pairedLocks)
  },
  watch: {
    pairedLocks(newVal) {
      this.autoLoad(newVal)
    },
  },
  methods: {
    autoLoad(locks) {
      for (const lock of locks) {
        if (!this.$store.state.operations[lock.address]) {
          // Dashboard : cache seul (reload=false), jamais de lecture BLE par serrure au démarrage.
          this.$store.dispatch("readOperations", { address: lock.address, reload: false })
        }
      }
    },
    openWizard() {
      this.$store.commit('setOverlay', { overlay: 'addWizard' })
    },
    openGlobalActivity() {
      this.$router.push({ name: "Activity" })
    },
  },
}
</script>

<style scoped>
.activity-grid {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1.4fr) minmax(0, 1.4fr) minmax(0, 1fr);
  column-gap: 16px;
}
.activity-head {
  letter-spacing: 0.04em;
}
.min-w-0 {
  min-width: 0;
}
</style>
