import { ReactNode, useEffect, useMemo, useState } from "react";
import { MotionPrefsContext } from "@/contexts/motionPrefsContextValue";

const STORAGE_KEY = "campusride_reduced_motion";

export const MotionPrefsProvider = ({ children }: { children: ReactNode }) => {
  const [reducedMotion, setReducedMotionState] = useState<boolean>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "true") return true;
    if (stored === "false") return false;
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }
    return false;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(reducedMotion));
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("reduced-motion", reducedMotion);
    }
  }, [reducedMotion]);

  const value = useMemo(
    () => ({
      reducedMotion,
      setReducedMotion: setReducedMotionState,
      toggleReducedMotion: () => setReducedMotionState((prev) => !prev),
    }),
    [reducedMotion],
  );

  return <MotionPrefsContext.Provider value={value}>{children}</MotionPrefsContext.Provider>;
};
