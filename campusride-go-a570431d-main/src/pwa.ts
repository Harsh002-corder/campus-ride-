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

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  try {
    const updateServiceWorker = registerSW({
      immediate: true,
      onNeedRefresh() {
        updateServiceWorker(true);
      },
      onRegisteredSW(_swUrl, registration) {
        if (!registration) return;

        window.setInterval(() => {
          void registration.update();
        }, 60 * 60 * 1000);
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