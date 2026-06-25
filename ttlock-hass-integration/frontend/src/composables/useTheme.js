import { computed } from 'vue';
import { useTheme as useVuetifyTheme } from 'vuetify';

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

  return { isDark, currentTheme, setTheme, toggleTheme };
}
