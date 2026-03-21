import { useEffect } from "react";
import { toast } from "sonner";
import { setupPwaServiceWorker } from "@/pwa";

const UPDATE_CHECK_INTERVAL_MS = 5 * 60_000;
const SW_RELOAD_FALLBACK_MS = 8_000;

async function disablePwaForLocalDev() {
  if (!("serviceWorker" in navigator)) return;

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));

    if ("caches" in window) {
      const cacheKeys = await caches.keys();
      await Promise.all(cacheKeys.map((key) => caches.delete(key)));
    }

    console.info("[PWA] Disabled and cleared service worker caches for local development.");
  } catch (error) {
    console.warn("[PWA] Failed to clear local dev service workers.", error);
  }
}

export function usePwaUpdater() {
  useEffect(() => {
    const isLocalhost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
    if (import.meta.env.DEV || isLocalhost) {
      void disablePwaForLocalDev();
      return;
    }

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
