import { createContext } from "react";

export type MotionPrefsContextType = {
  reducedMotion: boolean;
  setReducedMotion: (value: boolean) => void;
  toggleReducedMotion: () => void;
};

export const MotionPrefsContext = createContext<MotionPrefsContextType | null>(null);
