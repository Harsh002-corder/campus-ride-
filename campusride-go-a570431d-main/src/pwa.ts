import { registerSW } from "virtual:pwa-register";

export interface PwaRegistrationHandlers {
  onNeedRefresh?: () => void;
  onOfflineReady?: () => void;
  onRegisteredSW?: (swScriptUrl: string, registration: ServiceWorkerRegistration | undefined) => void;
  onRegisterError?: (error: unknown) => void;
}

export function setupPwaServiceWorker(handlers: PwaRegistrationHandlers = {}) {
  return registerSW({
    immediate: true,
    onNeedRefresh: handlers.onNeedRefresh,
    onOfflineReady: handlers.onOfflineReady,
    onRegisteredSW: handlers.onRegisteredSW,
    onRegisterError: handlers.onRegisterError,
  });
}
