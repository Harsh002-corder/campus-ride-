import { useEffect } from "react";
import { toast } from "sonner";
import { setupPwaServiceWorker } from "@/pwa";

const UPDATE_CHECK_INTERVAL_MS = 5 * 60_000;
const SW_RELOAD_FALLBACK_MS = 8_000;

export function usePwaUpdater() {
  useEffect(() => {
    let updateInterval: number | undefined;
    let refreshing = false;

    const onControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };

    navigator.serviceWorker?.addEventListener("controllerchange", onControllerChange);

    const updateSW = setupPwaServiceWorker({
      onRegisteredSW(_swScriptUrl, registration) {
        if (!registration) return;
        updateInterval = window.setInterval(() => {
          void registration.update();
        }, UPDATE_CHECK_INTERVAL_MS);
      },
      onNeedRefresh() {
        toast.info("New update available. Refreshing...", {
          description: "CampusRide is updating to the latest version.",
          duration: 1600,
        });

        // Force immediate activation.
        void updateSW(true);

        // Fallback reload for browsers that miss controllerchange.
        window.setTimeout(() => {
          if (refreshing) return;
          window.location.reload();
        }, SW_RELOAD_FALLBACK_MS);
      },
      onOfflineReady() {
        toast.success("CampusRide is ready for offline use.");
      },
      onRegisterError(error) {
        console.error("Service worker registration failed", error);
      },
    });

    return () => {
      if (updateInterval) window.clearInterval(updateInterval);
      navigator.serviceWorker?.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);
}
