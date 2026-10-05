<template>
  <div v-if="lock.name">
    <v-card>
      <v-tabs v-model="tab" color="primary" align-tabs="start" density="comfortable" class="px-2 pt-1">
        <v-tab v-if="lock.hasPasscode" value="pins" prepend-icon="mdi-gesture-tap">{{ $t('credentials.pins') }}</v-tab>
        <v-tab v-if="lock.hasCard" value="cards" prepend-icon="mdi-credit-card-wireless">{{ $t('credentials.cards') }}</v-tab>
        <v-tab v-if="lock.hasFinger" value="fingers" prepend-icon="mdi-fingerprint">{{ $t('credentials.fingers') }}</v-tab>
      </v-tabs>
      <v-divider />

      <v-window v-model="tab">
        <!-- PINs -->
        <v-window-item v-if="lock.hasPasscode" value="pins">
          <div class="d-flex align-center justify-space-between px-5 py-3">
            <div class="text-body-2 text-medium-emphasis">{{ $t('credentials.pins') }}</div>
            <div class="d-flex align-center ga-2">
              <v-progress-circular v-if="passcodes === -1" indeterminate color="primary" size="20" width="2" />
              <v-btn
                v-else
                color="primary" variant="flat" prepend-icon="mdi-plus"
                size="small"
                @click="showEditPasscodeDialog"
              >{{ $t('credentials.addPin') }}</v-btn>
            </div>
          </div>
          <v-divider />
          <div v-if="passcodes === -1" class="text-center py-10">
            <v-progress-circular indeterminate color="primary" />
            <div class="mt-2 text-medium-emphasis">{{ $t('credentials.loading') }}</div>
          </div>
          <div v-else-if="!passcodes || passcodes.length === 0" class="text-center py-10 text-medium-emphasis">
            {{ $t('credentials.empty') }}
          </div>
          <v-table v-else density="comfortable" class="cred-table">
            <thead>
              <tr>
                <th class="text-left">{{ $t('credentials.type') }}</th>
                <th class="text-left">{{ $t('credentials.pinCode') }}</th>
                <th class="text-left">{{ $t('credentials.validFrom') }}</th>
                <th class="text-left">{{ $t('credentials.validTo') }}</th>
                <th class="text-right">{{ $t('common.actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="passcode in passcodes" :key="passcode.newPassCode">
                <td><v-chip size="x-small" variant="tonal" color="primary">{{ passcodeTypeText[passcode.type] }}</v-chip></td>
                <td><code class="font-weight-bold">{{ passcode.newPassCode }}</code></td>
                <td class="text-caption">{{ dateTime(passcode.startDate) }}</td>
                <td class="text-caption">{{ dateTime(passcode.endDate) }}</td>
                <td class="text-right">
                  <v-tooltip :text="$t('credentials.changePin')">
                    <template #activator="{ props }">
                      <v-btn v-bind="props" icon="mdi-pencil-outline" size="x-small" variant="text" class="mr-1" @click="showEditPasscodeDialog(passcode)" />
                    </template>
                  </v-tooltip>
                  <v-tooltip :text="$t('credentials.deletePin')">
                    <template #activator="{ props }">
                      <v-btn v-bind="props" icon="mdi-trash-can-outline" size="x-small" variant="text" color="error" @click="showDeletePasscodeDialog(passcode)" />
                    </template>
                  </v-tooltip>
                </td>
              </tr>
            </tbody>
          </v-table>
        </v-window-item>

        <!-- Cards -->
        <v-window-item v-if="lock.hasCard" value="cards">
          <div class="d-flex align-center justify-space-between px-5 py-3">
            <div class="text-body-2 text-medium-emphasis">{{ $t('credentials.cards') }}</div>
            <div class="d-flex align-center ga-2">
              <v-progress-circular v-if="cards === -1" indeterminate color="primary" size="20" width="2" />
              <v-btn
                v-else
                color="primary" variant="flat" prepend-icon="mdi-plus"
                size="small"
                @click="showEditCardDialog"
              >{{ $t('credentials.addCard') }}</v-btn>
            </div>
          </div>
          <v-divider />
          <div v-if="cards === -1" class="text-center py-10">
            <v-progress-circular indeterminate color="primary" />
            <div class="mt-2 text-medium-emphasis">{{ $t('credentials.loading') }}</div>
          </div>
          <div v-else-if="!cards || cards.length === 0" class="text-center py-10 text-medium-emphasis">
            {{ $t('credentials.empty') }}
          </div>
          <v-table v-else density="comfortable" class="cred-table">
            <thead>
              <tr>
                <th class="text-left">{{ $t('credentials.cardSn') }}</th>
                <th class="text-left">{{ $t('credentials.validFrom') }}</th>
                <th class="text-left">{{ $t('credentials.validTo') }}</th>
                <th class="text-right">{{ $t('common.actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="card of cards" :key="card.cardNumber">
                <td>
                  <span class="font-weight-medium">{{ card.alias != card.cardNumber ? card.alias : card.cardNumber }}</span>
                  <div v-if="card.alias != card.cardNumber" class="text-caption text-medium-emphasis">{{ card.cardNumber }}</div>
                </td>
                <td class="text-caption">{{ dateTime(card.startDate) }}</td>
                <td class="text-caption">{{ dateTime(card.endDate) }}</td>
                <td class="text-right">
                  <v-tooltip :text="$t('credentials.editCard')">
                    <template #activator="{ props }">
                      <v-btn v-bind="props" icon="mdi-pencil-outline" size="x-small" variant="text" class="mr-1" @click="showEditCardDialog(card)" />
                    </template>
                  </v-tooltip>
                  <v-tooltip :text="$t('credentials.deleteCard')">
                    <template #activator="{ props }">
                      <v-btn v-bind="props" icon="mdi-trash-can-outline" size="x-small" variant="text" color="error" @click="showDeleteCardDialog(card)" />
                    </template>
                  </v-tooltip>
                </td>
              </tr>
            </tbody>
          </v-table>
        </v-window-item>

        <!-- Fingers -->
        <v-window-item v-if="lock.hasFinger" value="fingers">
          <div class="d-flex align-center justify-space-between px-5 py-3">
            <div class="text-body-2 text-medium-emphasis">{{ $t('credentials.fingers') }}</div>
            <div class="d-flex align-center ga-2">
              <v-progress-circular v-if="fingers === -1" indeterminate color="primary" size="20" width="2" />
              <v-btn
                v-else
                color="primary" variant="flat" prepend-icon="mdi-plus"
                size="small"
                @click="showEditFingerDialog"
              >{{ $t('credentials.addFinger') }}</v-btn>
            </div>
          </div>
          <v-divider />
          <div v-if="fingers === -1" class="text-center py-10">
            <v-progress-circular indeterminate color="primary" />
            <div class="mt-2 text-medium-emphasis">{{ $t('credentials.loading') }}</div>
          </div>
          <div v-else-if="!fingers || fingers.length === 0" class="text-center py-10 text-medium-emphasis">
            {{ $t('credentials.empty') }}
          </div>
          <v-table v-else density="comfortable" class="cred-table">
            <thead>
              <tr>
                <th class="text-left">{{ $t('credentials.fingerprintId') }}</th>
                <th class="text-left">{{ $t('credentials.validFrom') }}</th>
                <th class="text-left">{{ $t('credentials.validTo') }}</th>
                <th class="text-right">{{ $t('common.actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="finger of fingers" :key="finger.fpNumber">
                <td>
                  <span class="font-weight-medium">{{ finger.alias != finger.fpNumber ? finger.alias : finger.fpNumber }}</span>
                  <div v-if="finger.alias != finger.fpNumber" class="text-caption text-medium-emphasis">{{ finger.fpNumber }}</div>
                </td>
                <td class="text-caption">{{ dateTime(finger.startDate) }}</td>
                <td class="text-caption">{{ dateTime(finger.endDate) }}</td>
                <td class="text-right">
                  <v-tooltip :text="$t('credentials.editFinger')">
                    <template #activator="{ props }">
                      <v-btn v-bind="props" icon="mdi-pencil-outline" size="x-small" variant="text" class="mr-1" @click="showEditFingerDialog(finger)" />
                    </template>
                  </v-tooltip>
                  <v-tooltip :text="$t('credentials.deleteFinger')">
                    <template #activator="{ props }">
                      <v-btn v-bind="props" icon="mdi-trash-can-outline" size="x-small" variant="text" color="error" @click="showDeleteFingerDialog(finger)" />
                    </template>
                  </v-tooltip>
                </td>
              </tr>
            </tbody>
          </v-table>
        </v-window-item>
      </v-window>
    </v-card>

    <Passcode :address="address" :value="editPasscode" :show="showEditPasscode" v-on:cancel="cancelEditPasscodeDialog" />
    <Card :address="address" :value="editCard" :show="showEditCard" v-on:cancel="cancelEditCardDialog" />
    <Finger :address="address" :value="editFinger" :show="showEditFinger" v-on:cancel="cancelEditFingerDialog" />
    <ConfirmDlg ref="confirm" />
  </div>
</template>

<script>
import moment from "moment"
import { toRaw } from "vue"
import Passcode from "@/components/Passcode.vue"
import Card from "@/components/Card.vue"
import Finger from "@/components/Finger.vue"
import ConfirmDlg from "@/components/ConfirmDlg.vue"

export default {
  name: "CredentialsManager",
  components: { Passcode, Card, Finger, ConfirmDlg },
  props: {
    address: { type: String, required: true },
  },
  data() {
    return {
      tab: 'pins',
      passcodes: -1,
      cards: -1,
      fingers: -1,
      editPasscode: -1,
      showEditPasscode: false,
      editCard: -1,
      showEditCard: false,
      editFinger: -1,
      showEditFinger: false,
    }
  },
  computed: {
    lock() {
      return this.$store.state.locks.find(l => l.address == this.address) || {}
    },
    waitingCredentials() {
      return this.$store.state.waitingCredentials
    },
    passcodeTypeText() {
      return {
        1: this.$t('passcode.permanent'),
        2: this.$t('passcode.count'),
        3: this.$t('passcode.timed'),
        4: this.$t('passcode.cyclic'),
      }
    },
  },
  created() {
    this.loadForAddress()
  },
  beforeUnmount() {
    this.$store.commit("setActiveLockAddress", "")
  },
  methods: {
    loadForAddress() {
      if (!this.lock.name) return
      this.$store.commit("setActiveLockAddress", this.lock.address)

      this.passcodes = -1
      this.cards = -1
      this.fingers = -1
      this.$store.dispatch("readCredentials", this.lock.address)

      if (this.lock.hasPasscode) this.tab = 'pins'
      else if (this.lock.hasCard) this.tab = 'cards'
      else if (this.lock.hasFinger) this.tab = 'fingers'

      const cached = this.$store.state.passcodes[this.address]
      if (cached !== undefined) this.passcodes = cached
      const cardsCached = this.$store.state.cards[this.address]
      if (cardsCached !== undefined) this.cards = cardsCached
      const fingersCached = this.$store.state.fingers[this.address]
      if (fingersCached !== undefined) this.fingers = fingersCached
    },
    dateTime(str) {
      if (!str) return "—"
      const m = moment(str, "YYYYMMDDHHmm", true)
      return m.isValid() ? m.format("DD-MM-YYYY HH:mm") : "—"
    },
    showEditPasscodeDialog(passcode) {
      this.editPasscode = passcode ?? -1
      this.showEditPasscode = true
    },
    async showDeletePasscodeDialog(passcode) {
      if (passcode !== undefined) {
        const codeValue = passcode.newPassCode || passcode.passCode
        const details = `${this.$t('credentials.confirmDeletePin')}<br><br>
          <b>${this.$t('credentials.pinCode')} :</b> <code>${codeValue}</code><br>
          <b>${this.$t('credentials.type')} :</b> ${this.passcodeTypeText[passcode.type]}`
        if (await this.$refs.confirm.open(this.$t('common.confirm'), details)) {
          const p = structuredClone(toRaw(passcode))
          p.passCode = codeValue
          p.newPassCode = -1
          this.$store.dispatch("setPasscode", { lockAddress: this.address, passcode: p })
          this.passcodes = -1
        }
      }
    },
    cancelEditPasscodeDialog() {
      this.editPasscode = -1
      this.showEditPasscode = false
    },
    showEditCardDialog(card) {
      this.editCard = card ?? -1
      this.showEditCard = true
    },
    async showDeleteCardDialog(card) {
      if (card !== undefined) {
        const label = card.alias && card.alias !== card.cardNumber ? `${card.alias} (${card.cardNumber})` : card.cardNumber
        const details = `${this.$t('credentials.confirmDeleteCard')}<br><br>
          <b>${this.$t('credentials.cardSn')} :</b> ${label}`
        if (await this.$refs.confirm.open(this.$t('common.confirm'), details)) {
          const c = structuredClone(toRaw(card))
          c.startDate = -1
          this.$store.dispatch("setCard", { lockAddress: this.address, card: c })
          this.cards = -1
        }
      }
    },
    cancelEditCardDialog() {
      this.editCard = -1
      this.showEditCard = false
    },
    showEditFingerDialog(finger) {
      this.editFinger = finger ?? -1
      this.showEditFinger = true
    },
    async showDeleteFingerDialog(finger) {
      if (finger !== undefined) {
        const label = finger.alias && finger.alias !== finger.fpNumber ? `${finger.alias} (${finger.fpNumber})` : finger.fpNumber
        const details = `${this.$t('credentials.confirmDeleteFinger')}<br><br>
          <b>${this.$t('credentials.fingerprintId')} :</b> ${label}`
        if (await this.$refs.confirm.open(this.$t('common.confirm'), details)) {
          const f = structuredClone(toRaw(finger))
          f.startDate = -1
          this.$store.dispatch("setFinger", { lockAddress: this.address, finger: f })
          this.fingers = -1
        }
      }
    },
    cancelEditFingerDialog() {
      this.editFinger = -1
      this.showEditFinger = false
    },
  },
  watch: {
    address() {
      this.loadForAddress()
    },
    waitingCredentials(newVal) {
      if (newVal === false) {
        this.passcodes = this.$store.state.passcodes[this.address]
        this.cards = this.$store.state.cards[this.address]
        this.fingers = this.$store.state.fingers[this.address]
      }
    },
  },
}
</script>

<style scoped>
.cred-table :deep(thead th) {
  font-weight: 600 !important;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-size: 0.7rem !important;
  color: rgb(var(--v-theme-on-surface-variant)) !important;
}
</style>
