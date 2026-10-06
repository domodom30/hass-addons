import { createI18n as _createI18n } from 'vue-i18n'
import moment from 'moment'
// Locale ESM : Vite résout `moment` vers dist/moment.js (champ jsnext:main), alors que
// `moment/locale/fr` (UMD) s'enregistrait sur une autre copie (moment.js) — moment.locale('fr')
// restait sans effet et les dates relatives s'affichaient en anglais (« 3 hours ago »).
import 'moment/dist/locale/fr'
import en from './locales/en.json'
import fr from './locales/fr.json'

const messages = { en, fr }
const supported = Object.keys(messages)

function getBrowserLocale() {
  const lang = (navigator.language || 'en').split('-')[0].toLowerCase()
  return supported.includes(lang) ? lang : 'en'
}

export function createI18n() {
  const saved = localStorage.getItem('ttlock_locale')
  const locale = saved || getBrowserLocale()
  moment.locale(locale)
  return _createI18n({ legacy: true, locale, fallbackLocale: 'en', messages })
}
