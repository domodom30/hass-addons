import { createI18n as _createI18n } from "vue-i18n";
import en from "./locales/en.json";
import fr from "./locales/fr.json";

const messages = { en, fr };
const supported = Object.keys(messages);

const STORAGE_KEY = "bt_audio_locale";

function getBrowserLocale() {
  const lang = (navigator.language || "en").split("-")[0].toLowerCase();
  return supported.includes(lang) ? lang : "en";
}

function getInitialLocale() {
  let saved = null;
  try {
    saved = localStorage.getItem(STORAGE_KEY);
  } catch {
    // localStorage inaccessible
  }
  return saved || getBrowserLocale();
}

// Shared singleton so non-component modules (store, api) can translate via the
// same instance that the app uses — locale changes made in components are
// reflected everywhere.
export const i18n = _createI18n({
  legacy: true,
  locale: getInitialLocale(),
  fallbackLocale: "en",
  messages,
});

// Translation helper for use outside Vue components (store actions, api).
export const t = (key, params) => i18n.global.t(key, params);
