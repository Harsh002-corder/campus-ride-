import { useContext } from "react";
import { MotionPrefsContext } from "@/contexts/motionPrefsContextValue";

export const useMotionPrefs = () => {
  const ctx = useContext(MotionPrefsContext);
  if (!ctx) throw new Error("useMotionPrefs must be used within MotionPrefsProvider");
  return ctx;
};
