import { createVuetify } from "vuetify";
import { en, fr } from "vuetify/locale";
import { aliases, mdi } from "vuetify/iconsets/mdi";
import "vuetify/styles";
import "@mdi/font/css/materialdesignicons.css";

const STORAGE_KEY = "ttlock_theme";

function resolveInitialTheme() {
  try {
    const savedTheme = localStorage.getItem(STORAGE_KEY);

    if (savedTheme === "light" || savedTheme === "dark") {
      return savedTheme;
    }
  } catch {
    // localStorage inaccessible
  }

  return globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

const lightTheme = {
  dark: false,
  colors: {
    background: "#F4F5F7",

    surface: "#FFFFFF",
    "surface-bright": "#FFFFFF",
    "surface-variant": "#EEF1F4",

    "on-background": "#202124",
    "on-surface": "#202124",
    "on-surface-variant": "#666A70",

    primary: "#00A9E0",
    accent: "#00B7F2",

    secondary: "#6E737A",
    "secondary-darken-1": "#4E5359",

    success: "#30D158",
    warning: "#FF9F0A",
    error: "#e62b0fff",
    info: "#64D2FF",

    outline: "#D5DADF",
    "outline-variant": "#E7EBEF",
  },

  variables: {
    "border-color": "#D5DADF",
    "border-opacity": 1,
    "high-emphasis-opacity": 0.95,
    "medium-emphasis-opacity": 0.72,
    "theme-overlay-multiplier": 1,
  },
};

const darkTheme = {
  dark: true,
  colors: {
    background: "#111111",

    surface: "#1D1D1D",
    "surface-bright": "#242424",
    "surface-variant": "#2C2C2C",

    "on-background": "#F2F2F2",
    "on-surface": "#F2F2F2",
    "on-surface-variant": "#B8B8B8",

    primary: "#00A9E0",
    accent: "#00B7F2",

    secondary: "#8D8D8D",
    "secondary-darken-1": "#727272",

    success: "#30D158",
    warning: "#FF9F0A",
    error: "#e62c0fff",
    info: "#64D2FF",

    outline: "#353535",
    "outline-variant": "#2B2B2B",
  },

  variables: {
    "border-color": "#353535",
    "border-opacity": 1,
    "high-emphasis-opacity": 0.95,
    "medium-emphasis-opacity": 0.72,
    "theme-overlay-multiplier": 1,
  },
};

export default createVuetify({
  locale: {
    locale: "en",
    fallback: "en",
    messages: { en, fr },
  },
  icons: {
    defaultSet: "mdi",
    aliases,
    sets: { mdi },
  },
  theme: {
    defaultTheme: resolveInitialTheme(),
    themes: {
      light: lightTheme,
      dark: darkTheme,
    },
  },
  defaults: {
    global: {
      ripple: true,
    },
    VCard: {
      elevation: 0,
      rounded: "lg",
      border: "thin",
    },
    VBtn: {
      rounded: "lg",
      class: "text-none font-weight-medium",
      variant: "flat",
    },
    VTextField: {
      variant: "outlined",
      density: "comfortable",
      color: "primary",
    },
    VSelect: {
      variant: "outlined",
      density: "comfortable",
      color: "primary",
    },
    VAutocomplete: {
      variant: "outlined",
      density: "comfortable",
      color: "primary",
    },
    VTextarea: {
      variant: "outlined",
      density: "comfortable",
      color: "primary",
    },
    VCombobox: {
      variant: "outlined",
      density: "comfortable",
      color: "primary",
    },
    VFileInput: {
      variant: "outlined",
      density: "comfortable",
      color: "primary",
    },
    VSwitch: {
      color: "primary",
      density: "compact",
      trueIcon: "mdi-check",
      falseIcon: "mdi-close",
    },
    VCheckbox: {
      color: "primary",
    },
    VSlider: {
      color: "primary",
      trackColor: "surface-variant",
      thumbLabel: "hover",
    },
    VDataTable: {
      density: "comfortable",
      hover: true,
    },
    VToolbar: {
      density: "compact",
    },
    VAppBar: {
      density: "compact",
      elevation: 0,
      flat: true,
    },
    VNavigationDrawer: {
      elevation: 0,
    },
    VTabs: {
      color: "primary",
      sliderColor: "primary",
    },
    VChip: {
      rounded: "lg",
    },
    VDialog: {
      scrollable: true,
    },
  },
});
