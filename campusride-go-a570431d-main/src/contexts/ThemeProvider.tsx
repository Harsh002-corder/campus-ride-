import { useEffect, type PropsWithChildren } from "react";
import { initializeTheme, setTheme, THEME_STORAGE_KEY, type ThemeMode } from "@/hooks/useTheme";

const ThemeProvider = ({ children }: PropsWithChildren) => {
  useEffect(() => {
    initializeTheme();

    const root = document.documentElement;
    const rafId = window.requestAnimationFrame(() => {
      root.classList.add("theme-ready");
    });

    const syncThemeFromStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY) return;
      if (event.newValue === "light" || event.newValue === "dark") {
        setTheme(event.newValue as ThemeMode, false);
      }
    };

    window.addEventListener("storage", syncThemeFromStorage);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("storage", syncThemeFromStorage);
    };
  }, []);

  return <>{children}</>;
};

export default ThemeProvider;
