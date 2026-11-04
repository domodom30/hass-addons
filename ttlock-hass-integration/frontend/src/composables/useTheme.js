import { computed } from 'vue';
import { useTheme as useVuetifyTheme } from 'vuetify';
import { haThemeActive } from '../plugins/haTheme';

const STORAGE_KEY = 'ttlock_theme';

export function useTheme() {
  const theme = useVuetifyTheme();

  const isDark = computed(() => theme.global.current.value.dark);
  const currentTheme = computed(() => (isDark.value ? 'dark' : 'light'));

  function setTheme(name) {
    theme.global.name.value = name;
    localStorage.setItem(STORAGE_KEY, name);
  }

  function toggleTheme() {
    setTheme(isDark.value ? 'light' : 'dark');
  }

  // Dans Home Assistant, le thème suit celui de HA : pas de bascule manuelle.
  return { isDark, currentTheme, setTheme, toggleTheme, followsHa: haThemeActive };
}
