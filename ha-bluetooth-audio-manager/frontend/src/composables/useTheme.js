import { computed } from "vue";
import { useTheme as useVuetifyTheme } from "vuetify";

const STORAGE_KEY = "bt_audio_theme";

export function useTheme() {
  const theme = useVuetifyTheme();

  const isDark = computed(() => theme.global.current.value.dark);
  const currentTheme = computed(() => (isDark.value ? "dark" : "light"));

  function setTheme(name) {
    theme.global.name.value = name;
    try {
      localStorage.setItem(STORAGE_KEY, name);
    } catch {
      // localStorage inaccessible
    }
  }

  function toggleTheme() {
    setTheme(isDark.value ? "light" : "dark");
  }

  return { isDark, currentTheme, setTheme, toggleTheme };
}
