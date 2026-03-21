import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { MoonStar, SunMedium } from "lucide-react";
import RippleEffect from "@/components/RippleEffect";
import { useTheme, type ThemeMode } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";

type RippleState = {
  x: number;
  y: number;
  color: string;
} | null;

interface ThemeToggleProps {
  className?: string;
}

const MIDPOINT_MS = 350;
const RIPPLE_DURATION_MS = 700;

const getThemeSurfaceColor = (theme: ThemeMode) => {
  if (typeof document === "undefined") {
    return theme === "dark" ? "#0F172A" : "#FFFFFF";
  }

  const root = document.documentElement;
  const rootStyle = getComputedStyle(root);

  if (theme === "dark") {
    return rootStyle.getPropertyValue("--dark-bg-primary").trim() || "#0F172A";
  }

  return rootStyle.getPropertyValue("--light-bg-primary").trim() || "#FFFFFF";
};

const ThemeToggle = ({ className }: ThemeToggleProps) => {
  const { theme, setTheme } = useTheme();
  const [ripple, setRipple] = useState<RippleState>(null);
  const timeoutRef = useRef<number | null>(null);

  const icon = useMemo(() => {
    if (theme === "dark") {
      return <MoonStar className="h-4 w-4" />;
    }
    return <SunMedium className="h-4 w-4" />;
  }, [theme]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const onToggle = (event: MouseEvent<HTMLButtonElement>) => {
    const nextTheme: ThemeMode = theme === "dark" ? "light" : "dark";
    const x = event.clientX;
    const y = event.clientY;

    setRipple({
      x,
      y,
      color: getThemeSurfaceColor(nextTheme),
    });

    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = window.setTimeout(() => {
      setTheme(nextTheme);
      timeoutRef.current = null;
    }, MIDPOINT_MS);
  };

  return (
    <>
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-foreground shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_18px_rgba(255,193,7,0.28)] active:translate-y-0 dark:hover:shadow-[0_8px_18px_rgba(99,102,241,0.35)]",
          className,
        )}
        aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      >
        {icon}
      </button>

      <RippleEffect
        active={Boolean(ripple)}
        x={ripple?.x ?? 0}
        y={ripple?.y ?? 0}
        color={ripple?.color ?? "transparent"}
        durationMs={RIPPLE_DURATION_MS}
        onComplete={() => setRipple(null)}
      />
    </>
  );
};

export default ThemeToggle;
