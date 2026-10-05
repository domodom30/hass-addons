import store from './store.js';

const SUPPORTED_LANGUAGES = ['en', 'fr'];
const REQUEST_TIMEOUT_MS = 5000;

/**
 * Detects Home Assistant's configured UI language via the Supervisor-proxied
 * Core API (allowed by `homeassistant_api: true` in config.yaml) and stores it
 * so MQTT payloads can be localized. Always resolves — falls back to 'en' on
 * any failure (missing token, network error, unsupported language) so it never
 * blocks addon startup.
 */
export async function detectLanguage() {
  const token = process.env.SUPERVISOR_TOKEN;
  if (!token) {
    console.warn('[HA] Language detection skipped (no SUPERVISOR_TOKEN), defaulting to en');
    store.setLanguage('en');
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch('http://supervisor/core/api/config', {
      headers: { Authorization: 'Bearer ' + token },
      signal: controller.signal
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const config = await res.json();
    const lang = (config.language || 'en').slice(0, 2).toLowerCase();
    const resolved = SUPPORTED_LANGUAGES.includes(lang) ? lang : 'en';
    store.setLanguage(resolved);
    console.log('[HA] Detected language:', resolved);
  } catch (err) {
    console.warn('[HA] Language detection failed, defaulting to en:', err.message);
    store.setLanguage('en');
  } finally {
    clearTimeout(timeout);
  }
}
