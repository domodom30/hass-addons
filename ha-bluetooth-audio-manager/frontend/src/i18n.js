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

export function createI18n() {
  let saved = null;
  try {
    saved = localStorage.getItem(STORAGE_KEY);
  } catch {
    // localStorage inaccessible
  }
  const locale = saved || getBrowserLocale();
  return _createI18n({ legacy: true, locale, fallbackLocale: "en", messages });
}
