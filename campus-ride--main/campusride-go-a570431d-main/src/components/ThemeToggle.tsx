import { MoonStar, SunMedium } from "lucide-react";
import { useTheme } from "next-themes";

const ThemeToggle = () => {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-foreground shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_18px_rgba(255,193,7,0.28)] active:translate-y-0 dark:hover:shadow-[0_8px_18px_rgba(99,102,241,0.35)]"
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      title={`Switch to ${isDark ? "light" : "dark"} mode`}
    >
      {isDark ? <MoonStar className="h-4 w-4" /> : <SunMedium className="h-4 w-4" />}
    </button>
  );
};

export default ThemeToggle;
