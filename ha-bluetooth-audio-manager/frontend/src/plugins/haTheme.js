/*
 * Suit le thème Home Assistant actif quand l'interface est ouverte par Ingress.
 *
 * L'iframe Ingress est servie depuis la même origine que Home Assistant : on peut
 * donc lire les variables CSS du thème sur le document parent. On en tire :
 *   - un thème Vuetify « ha » (couleurs, mode clair/sombre) ;
 *   - des variables --haui-* (fond de page, verre des cartes, en-tête, dialogues)
 *     utilisées par la feuille de style injectée plus bas.
 * Le thème est réappliqué dès que Home Assistant change de thème ou de mode.
 * Hors de Home Assistant (dev, accès direct), rien ne change : thèmes light/dark.
 */
import { ref } from "vue";

export const haThemeActive = ref(false);

// Couleurs Vuetify ← variables du thème HA (première valeur valide retenue).
const COLOR_VARS = {
  background: ["--primary-background-color"],
  surface: ["--card-background-color", "--primary-background-color"],
  "surface-bright": ["--card-background-color"],
  "surface-variant": ["--secondary-background-color"],
  "on-background": ["--primary-text-color"],
  "on-surface": ["--primary-text-color"],
  "on-surface-variant": ["--secondary-text-color"],
  primary: ["--primary-color"],
  accent: ["--accent-color", "--primary-color"],
  secondary: ["--secondary-text-color"],
  success: ["--success-color"],
  warning: ["--warning-color"],
  error: ["--error-color"],
  info: ["--info-color"],
  outline: ["--divider-color"],
  "outline-variant": ["--divider-color"],
};

// Variables copiées telles quelles (dégradés, images, ombres, flous compris).
const STYLE_VARS = {
  "--haui-page": ["--lovelace-background", "--primary-background-color"],
  "--haui-card": ["--ha-card-background", "--card-background-color"],
  "--haui-card-border": ["--ha-card-border-color", "--divider-color"],
  "--haui-card-shadow": ["--ha-card-box-shadow"],
  "--haui-card-blur": ["--ha-card-backdrop-filter"],
  "--haui-radius": ["--ha-card-border-radius"],
  "--haui-header": ["--app-header-background-color"],
  "--haui-header-blur": ["--app-header-backdrop-filter"],
  "--haui-dialog": ["--ha-dialog-surface-background", "--card-background-color"],
  "--haui-dialog-blur": ["--ha-dialog-surface-backdrop-filter"],
};

const CSS = `
html.ha-theme-sync .v-application,
html.ha-theme-sync .v-main.bg-background {
  background: var(--haui-page, rgb(var(--v-theme-background))) !important;
}
html.ha-theme-sync .v-app-bar.bg-surface {
  background: var(--haui-header, rgb(var(--v-theme-surface))) !important;
  -webkit-backdrop-filter: var(--haui-header-blur, none);
  backdrop-filter: var(--haui-header-blur, none);
}
html.ha-theme-sync .v-main .v-card.v-card--variant-elevated:not([class*="bg-"]),
html.ha-theme-sync .v-main .v-card.v-card--variant-flat:not([class*="bg-"]) {
  background: var(--haui-card, rgb(var(--v-theme-surface))) !important;
  border-color: var(--haui-card-border, rgba(var(--v-border-color), var(--v-border-opacity))) !important;
  box-shadow: var(--haui-card-shadow, none) !important;
  border-radius: var(--haui-radius, 12px) !important;
  -webkit-backdrop-filter: var(--haui-card-blur, none);
  backdrop-filter: var(--haui-card-blur, none);
}
html.ha-theme-sync .v-main .v-card .v-card {
  background: transparent !important;
  box-shadow: none !important;
  -webkit-backdrop-filter: none;
  backdrop-filter: none;
}
html.ha-theme-sync .v-overlay__content > .v-card:not([class*="bg-"]) {
  background: var(--haui-dialog, rgb(var(--v-theme-surface))) !important;
  border-radius: var(--haui-radius, 12px) !important;
  -webkit-backdrop-filter: var(--haui-dialog-blur, none);
  backdrop-filter: var(--haui-dialog-blur, none);
}
`;

/** Racine du document Home Assistant parent, ou null hors Ingress. */
function haRoot() {
  try {
    if (window.parent === window) return null;
    const doc = window.parent.document; // lève une erreur si l'origine diffère
    return doc.querySelector("home-assistant") ? doc.documentElement : null;
  } catch {
    return null;
  }
}

let ctx;
/** Couleur CSS quelconque → #rrggbb (alpha ignoré), ou null si ce n'est pas une couleur. */
function toHex(value) {
  if (!value) return null;
  ctx ??= document.createElement("canvas").getContext("2d");
  if (!ctx) return null;
  const probe = (sentinel) => {
    ctx.fillStyle = sentinel;
    ctx.fillStyle = value;
    return ctx.fillStyle;
  };
  const a = probe("#010203");
  if (a !== probe("#040506")) return null; // valeur refusée (dégradé, var() vide…)
  if (a.startsWith("#")) return a.slice(0, 7);
  const m = a.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  return (
    "#" +
    m[1]
      .split(",")
      .slice(0, 3)
      .map((x) => Math.round(parseFloat(x)).toString(16).padStart(2, "0"))
      .join("")
  );
}

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function signature(cs) {
  return [...Object.values(COLOR_VARS), ...Object.values(STYLE_VARS)]
    .flat()
    .map((n) => cs.getPropertyValue(n))
    .join("|");
}

function apply(vuetify, root) {
  const cs = getComputedStyle(root);
  const read = (names) => names.map((n) => cs.getPropertyValue(n).trim()).find(Boolean) || "";

  const colors = {};
  for (const [key, names] of Object.entries(COLOR_VARS)) {
    const hex = toHex(read(names));
    if (hex) colors[key] = hex;
  }
  if (!colors.background || !colors.primary) return false;

  const dark = luminance(colors.background) < 0.4;
  const themes = vuetify.theme.themes.value;
  const base = themes[dark ? "dark" : "light"] || {};
  themes.ha = {
    dark,
    colors: { ...base.colors, ...colors },
    variables: { ...base.variables, "border-color": colors.outline || base.variables?.["border-color"] },
  };
  vuetify.theme.global.name.value = "ha";

  const el = document.documentElement;
  for (const [name, names] of Object.entries(STYLE_VARS)) {
    const value = read(names);
    if (value) el.style.setProperty(name, value);
    else el.style.removeProperty(name);
  }
  el.classList.add("ha-theme-sync");
  el.style.colorScheme = dark ? "dark" : "light";
  return true;
}

/**
 * Démarre la synchronisation. Renvoie true si l'interface suit Home Assistant.
 * À appeler après app.use(vuetify).
 */
export function startHaThemeSync(vuetify) {
  const root = haRoot();
  if (!root || !apply(vuetify, root)) return false;
  haThemeActive.value = true;

  const style = document.createElement("style");
  style.id = "ha-theme-sync";
  style.textContent = CSS;
  document.head.appendChild(style);

  let last = signature(getComputedStyle(root));
  const refresh = () => {
    const sig = signature(getComputedStyle(root));
    if (sig !== last) {
      last = sig;
      apply(vuetify, root);
    }
  };
  let timer;
  const soon = () => {
    clearTimeout(timer);
    timer = setTimeout(refresh, 50);
  };
  // Home Assistant pose les variables du thème sur <html> ; filet de sécurité toutes les 5 s.
  new MutationObserver(soon).observe(root, { attributes: true, attributeFilter: ["style", "class"] });
  window.parent.matchMedia?.("(prefers-color-scheme: dark)")?.addEventListener?.("change", soon);
  setInterval(refresh, 5000);
  return true;
}
