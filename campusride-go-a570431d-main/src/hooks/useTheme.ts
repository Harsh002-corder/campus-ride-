import { useCallback, useSyncExternalStore } from "react";

export type ThemeMode = "light" | "dark";

export const THEME_STORAGE_KEY = "campusride-theme";

const THEME_META_COLORS: Record<ThemeMode, string> = {
  light: "#FFC107",
  dark: "#0F172A",
};

const isThemeMode = (value: unknown): value is ThemeMode => value === "light" || value === "dark";

const readInitialTheme = (): ThemeMode => {
  if (typeof document === "undefined") return "light";

  const root = document.documentElement;
  if (root.classList.contains("dark")) return "dark";
  if (root.classList.contains("light")) return "light";

  return "light";
};

let currentTheme: ThemeMode = readInitialTheme();
const listeners = new Set<() => void>();

const notifyListeners = () => {
  listeners.forEach((listener) => listener());
};

const applyThemeToDocument = (theme: ThemeMode, persist: boolean) => {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(theme);
  root.dataset.theme = theme;
  root.style.colorScheme = theme;

  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) {
    themeMeta.setAttribute("content", THEME_META_COLORS[theme]);
  }

  if (persist) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore storage errors in privacy mode.
    }
  }
};

export const initializeTheme = () => {
  if (typeof window === "undefined") return currentTheme;

  const root = document.documentElement;
  const domTheme: ThemeMode = root.classList.contains("dark") ? "dark" : "light";

  let storedTheme: ThemeMode | null = null;
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemeMode(value)) {
      storedTheme = value;
    }
  } catch {
    storedTheme = null;
  }

  currentTheme = storedTheme || domTheme;
  applyThemeToDocument(currentTheme, true);
  return currentTheme;
};

export const getTheme = () => currentTheme;

export const setTheme = (theme: ThemeMode, persist = true) => {
  if (!isThemeMode(theme)) return;
  if (theme === currentTheme) return;

  currentTheme = theme;
  applyThemeToDocument(theme, persist);
  notifyListeners();
};

export const toggleTheme = () => {
  const nextTheme: ThemeMode = currentTheme === "dark" ? "light" : "dark";
  setTheme(nextTheme);
  return nextTheme;
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const getSnapshot = () => currentTheme;

const getServerSnapshot = (): ThemeMode => "light";

export const useTheme = () => {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setThemeMode = useCallback((nextTheme: ThemeMode) => {
    setTheme(nextTheme);
  }, []);

  const toggleThemeMode = useCallback(() => toggleTheme(), []);

  return {
    theme,
    isDark: theme === "dark",
    setTheme: setThemeMode,
    toggleTheme: toggleThemeMode,
  };
};
