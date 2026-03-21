import { registerSW } from "virtual:pwa-register";

const DEV_UPDATE_CHECK_INTERVAL_MS = 60 * 1000;
const PROD_UPDATE_CHECK_INTERVAL_MS = 5 * 60 * 1000;
const SW_RELOAD_FALLBACK_MS = 8000;

const SW_MIGRATION_KEY = "campusride_sw_migration_20260311";

const getNeedsSwMigration = () => {
  try {
    return localStorage.getItem(SW_MIGRATION_KEY) !== "done";
  } catch {
    return false;
  }
};

const markMigrationDone = () => {
  try {
    localStorage.setItem(SW_MIGRATION_KEY, "done");
  } catch {
    // Ignore localStorage failures (private mode, strict browser settings).
  }
};

async function runOneTimeSwMigration() {
  if (!("serviceWorker" in navigator) || !getNeedsSwMigration()) {
    return false;
  }

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));

    if ("caches" in window) {
      const cacheKeys = await caches.keys();
      await Promise.all(cacheKeys.map((cacheKey) => caches.delete(cacheKey)));
    }

    markMigrationDone();
    window.location.reload();
    return true;
  } catch (error) {
    console.warn("[PWA] Service worker migration failed", error);
    return false;
  }
}

async function setupPwa() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  const migrated = await runOneTimeSwMigration();
  if (migrated) {
    return;
  }

  let refreshing = false;

  // Auto-reload when new SW takes over.
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    console.log("[PWA] New service worker activated, reloading...");
    window.location.reload();
  });

  try {
    const updateServiceWorker = registerSW({
      immediate: true,
      onNeedRefresh() {
        // Immediately activate waiting SW so users get updates without reinstalling.
        console.log("[PWA] Update available, applying automatically");
        void updateServiceWorker(true);

        // Keep the existing event for backward-compatible UI hooks.
        window.dispatchEvent(new CustomEvent("pwa-update-available", {
          detail: {
            applyUpdate: () => {
              void updateServiceWorker(true);
            },
          },
        }));

        // Fallback reload if controllerchange is missed by some browsers.
        window.setTimeout(() => {
          if (refreshing) return;
          window.location.reload();
        }, SW_RELOAD_FALLBACK_MS);
      },
      onRegisteredSW(_swUrl, registration) {
        if (!registration) return;

        const checkInterval = import.meta.env.DEV ? DEV_UPDATE_CHECK_INTERVAL_MS : PROD_UPDATE_CHECK_INTERVAL_MS;
        window.setInterval(() => {
          void registration.update();
        }, checkInterval);
      },
      onRegisterError(error) {
        console.warn("[PWA] Service worker registration failed", error);
      },
    });
  } catch (error) {
    console.warn("[PWA] Service worker registration threw", error);
  }
}

void setupPwa();