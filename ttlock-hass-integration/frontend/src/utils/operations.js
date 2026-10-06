// Affichage des opérations du journal : source unique pour le tableau de bord
// (views/Home.vue) et le journal complet (components/LockLogsDialog.vue).
//
// Couleurs alignées sur l'état des serrures : verrouillé = sûr (success),
// déverrouillé = attention (warning), échec et alarme = erreur.

import moment from "moment"

const META = {
  LOCK:   { kind: "lock",   icon: "mdi-lock",                color: "success", tagKey: "operations.typeLock" },
  UNLOCK: { kind: "unlock", icon: "mdi-lock-open-variant",   color: "warning", tagKey: "operations.typeUnlock" },
  ALARM:  { kind: "alarm",  icon: "mdi-bell-alert",          color: "error",   tagKey: "operations.typeAlarm" },
  FAILED: { kind: "failed", icon: "mdi-alert-circle",        color: "error",   tagKey: "operations.typeFailed" },
}
const OTHER = { kind: "other", icon: "mdi-information-outline", color: "info", tagKey: "operations.typeOther" }

/**
 * @param {string} category recordTypeCategory renvoyé par l'add-on
 * @returns {{kind: string, icon: string, color: string, tagKey: string}}
 */
export function operationMeta(category) {
  return META[category] ?? OTHER
}

/**
 * Date d'une opération (operateDate au format YYYYMMDDHHmmss, heure locale de la serrure).
 * @param {{operateDate?: string|number}} op
 * @returns {import("moment").Moment}
 */
export function operationMoment(op) {
  return moment(op.operateDate, "YYYYMMDDHHmmss")
}
