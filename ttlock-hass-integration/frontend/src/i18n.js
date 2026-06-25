import { createI18n as _createI18n } from 'vue-i18n'
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
  return _createI18n({ legacy: true, locale, fallbackLocale: 'en', messages })
}
