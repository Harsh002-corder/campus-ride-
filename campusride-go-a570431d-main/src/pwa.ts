import { registerSW } from "virtual:pwa-register";

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

  // Auto-reload when new SW takes over (after user accepts update)
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
        // Emit custom event with updater callback so UI can trigger skipWaiting.
        console.log("[PWA] Update available, notifying user");
        window.dispatchEvent(new CustomEvent("pwa-update-available", {
          detail: {
            applyUpdate: () => {
              void updateServiceWorker(true);
            },
          },
        }));
      },
      onRegisteredSW(_swUrl, registration) {
        if (!registration) return;

        // Check for updates more frequently during development/testing
        const checkInterval = import.meta.env.DEV ? 60 * 1000 : 60 * 60 * 1000;
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