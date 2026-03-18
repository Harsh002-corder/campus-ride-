import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type NavigatorWithStandalone = Navigator & {
  standalone?: boolean;
};

const isStandaloneMode = () => (
  window.matchMedia("(display-mode: standalone)").matches
  || (window.navigator as NavigatorWithStandalone).standalone === true
);

export function useInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(() => isStandaloneMode());
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };

    const onInstalled = () => {
      setIsInstalled(true);
      setInstallEvent(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const promptInstall = async () => {
    if (!installEvent || isInstalling) return;

    setIsInstalling(true);

    try {
      await installEvent.prompt();
      const { outcome } = await installEvent.userChoice;

      if (outcome === "accepted") {
        setInstallEvent(null);
      }
    } finally {
      setIsInstalling(false);
    }
  };

  return {
    canInstall: !isInstalled && Boolean(installEvent),
    isInstalling,
    promptInstall,
  };
}
