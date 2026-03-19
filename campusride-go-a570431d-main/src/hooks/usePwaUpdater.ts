import { useEffect } from "react";
import { toast } from "sonner";
import { setupPwaServiceWorker } from "@/pwa";

const UPDATE_CHECK_INTERVAL_MS = 60_000;

export function usePwaUpdater() {
  useEffect(() => {
    let updateInterval: number | undefined;

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

        // Force immediate activation, then reload to avoid stale UI.
        void updateSW(true);
        window.setTimeout(() => {
          window.location.reload();
        }, 900);
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
    };
  }, []);
}
