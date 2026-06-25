import { createVuetify } from 'vuetify'
import { en, fr } from 'vuetify/locale'
import { aliases, mdi } from 'vuetify/iconsets/mdi'
import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'

const STORAGE_KEY = 'ttlock_theme'

function resolveInitialTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch (_) { /* ignore */ }
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }
  return 'light'
}

const lightTheme = {
  dark: false,
  colors: {
    background: '#FAFAFA',
    surface: '#FFFFFF',
    'surface-bright': '#FFFFFF',
    'surface-variant': '#F4F4F5',
    'on-surface-variant': '#52525B',
    primary: '#2563EB',
    'primary-darken-1': '#1D4ED8',
    secondary: '#71717A',
    'secondary-darken-1': '#52525B',
    accent: '#2563EB',
    error: '#EF4444',
    info: '#3B82F6',
    success: '#10B981',
    warning: '#F59E0B',
    'on-background': '#171717',
    'on-surface': '#171717',
    outline: '#E4E4E7',
    'outline-variant': '#F4F4F5',
  },
  variables: {
    'border-color': '#E4E4E7',
    'border-opacity': 1,
    'high-emphasis-opacity': 0.95,
    'medium-emphasis-opacity': 0.7,
    'theme-overlay-multiplier': 1,
  }
}

const darkTheme = {
  dark: true,
  colors: {
    background: '#0A0A0A',
    surface: '#171717',
    'surface-bright': '#1F1F1F',
    'surface-variant': '#262626',
    'on-surface-variant': '#A1A1AA',
    primary: '#3B82F6',
    'primary-darken-1': '#2563EB',
    secondary: '#A1A1AA',
    'secondary-darken-1': '#71717A',
    accent: '#3B82F6',
    error: '#F87171',
    info: '#60A5FA',
    success: '#10B981',
    warning: '#FBBF24',
    'on-background': '#FAFAFA',
    'on-surface': '#FAFAFA',
    outline: '#262626',
    'outline-variant': '#1F1F1F',
  },
  variables: {
    'border-color': '#262626',
    'border-opacity': 1,
    'high-emphasis-opacity': 0.95,
    'medium-emphasis-opacity': 0.7,
    'theme-overlay-multiplier': 1,
  }
}

export default createVuetify({
  locale: {
    locale: 'en',
    fallback: 'en',
    messages: { en, fr }
  },
  icons: {
    defaultSet: 'mdi',
    aliases,
    sets: { mdi }
  },
  theme: {
    defaultTheme: resolveInitialTheme(),
    themes: {
      light: lightTheme,
      dark: darkTheme,
    }
  },
  defaults: {
    global: {
      ripple: true,
    },
    VCard: {
      elevation: 0,
      rounded: 'lg',
      border: 'thin',
    },
    VBtn: {
      rounded: 'lg',
      class: 'text-none font-weight-medium',
      variant: 'flat',
    },
    VTextField: {
      variant: 'outlined',
      density: 'comfortable',
      color: 'primary',
    },
    VSelect: {
      variant: 'outlined',
      density: 'comfortable',
      color: 'primary',
    },
    VAutocomplete: {
      variant: 'outlined',
      density: 'comfortable',
      color: 'primary',
    },
    VTextarea: {
      variant: 'outlined',
      density: 'comfortable',
      color: 'primary',
    },
    VCombobox: {
      variant: 'outlined',
      density: 'comfortable',
      color: 'primary',
    },
    VFileInput: {
      variant: 'outlined',
      density: 'comfortable',
      color: 'primary',
    },
    VSwitch: {
      color: 'primary',
      inset: true,
    },
    VCheckbox: {
      color: 'primary',
    },
    VSlider: {
      color: 'primary',
      trackColor: 'surface-variant',
    },
    VDataTable: {
      density: 'comfortable',
      hover: true,
    },
    VToolbar: {
      density: 'compact',
    },
    VAppBar: {
      density: 'compact',
      elevation: 0,
      flat: true,
    },
    VNavigationDrawer: {
      elevation: 0,
    },
    VTabs: {
      color: 'primary',
      sliderColor: 'primary',
    },
    VChip: {
      rounded: 'lg',
    },
    VDialog: {
      scrollable: true,
    },
  }
})
