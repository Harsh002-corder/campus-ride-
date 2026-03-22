import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getToken, onMessage } from "firebase/messaging";
import { useAuth } from "@/contexts/AuthContext";
import { useAppToast } from "@/hooks/use-app-toast";
import { apiClient } from "@/lib/apiClient";
import { getFirebaseMessagingClient, isFirebaseClientConfigured } from "@/lib/firebase";

const ASK_PERMISSION_KEY = "campusride_notification_permission_prompted";
const PUSH_TOKEN_KEY = "campusride_fcm_token";

function isNotificationSupported() {
  return typeof window !== "undefined"
    && "Notification" in window
    && "serviceWorker" in navigator;
}

function normalizeNotificationData(input: Record<string, unknown>) {
  const normalized: Record<string, string> = {};
  Object.entries(input || {}).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }
    normalized[key] = typeof value === "string" ? value : String(value);
  });
  return normalized;
}

export function usePushNotifications() {
  const { isAuthenticated, user } = useAuth();
  const toast = useAppToast();
  const [permission, setPermission] = useState<NotificationPermission>(() => {
    if (!isNotificationSupported()) {
      return "denied";
    }
    return Notification.permission;
  });
  const [isConfigured, setIsConfigured] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const foregroundSeenRef = useRef<Set<string>>(new Set());

  const canUsePush = isNotificationSupported() && isFirebaseClientConfigured();

  const syncFcmToken = useCallback(async () => {
    if (!isAuthenticated || !canUsePush || Notification.permission !== "granted") {
      return;
    }

    const vapidKey = String(import.meta.env.VITE_FIREBASE_VAPID_KEY || "").trim();
    if (!vapidKey) {
      return;
    }

    setSyncing(true);
    try {
      const messaging = await getFirebaseMessagingClient();
      if (!messaging) {
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const token = await getToken(messaging, {
        vapidKey,
        serviceWorkerRegistration: registration,
      });

      if (!token) {
        return;
      }

      const previousToken = localStorage.getItem(PUSH_TOKEN_KEY);
      if (previousToken === token) {
        setIsConfigured(true);
        return;
      }

      await apiClient.notifications.registerToken(token);
      localStorage.setItem(PUSH_TOKEN_KEY, token);
      setIsConfigured(true);
    } catch (error) {
      toast.error("Push setup failed", error, "Could not configure device notifications.");
    } finally {
      setSyncing(false);
    }
  }, [canUsePush, isAuthenticated, toast]);

  const requestPermission = useCallback(async () => {
    if (!canUsePush) {
      return;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === "granted") {
        await syncFcmToken();
      }
    } catch {
      setPermission("denied");
    }
  }, [canUsePush, syncFcmToken]);

  useEffect(() => {
    if (!canUsePush || !isAuthenticated) {
      return;
    }

    const prompted = localStorage.getItem(ASK_PERMISSION_KEY) === "done";
    if (!prompted) {
      localStorage.setItem(ASK_PERMISSION_KEY, "done");
      void requestPermission();
      return;
    }

    if (Notification.permission === "granted") {
      void syncFcmToken();
    } else {
      setPermission(Notification.permission);
    }
  }, [canUsePush, isAuthenticated, requestPermission, syncFcmToken]);

  useEffect(() => {
    if (!canUsePush || !isAuthenticated || permission !== "granted") {
      return;
    }

    let unsubscribe: (() => void) | null = null;

    void (async () => {
      const messaging = await getFirebaseMessagingClient();
      if (!messaging) {
        return;
      }

      unsubscribe = onMessage(messaging, (payload) => {
        const title = payload.notification?.title || "Ride update";
        const body = payload.notification?.body || "You have a new ride notification.";
        const data = normalizeNotificationData(payload.data || {});
        const dedupeKey = `${data.notificationId || ""}:${title}:${body}`;

        if (foregroundSeenRef.current.has(dedupeKey)) {
          return;
        }
        foregroundSeenRef.current.add(dedupeKey);
        if (foregroundSeenRef.current.size > 60) {
          foregroundSeenRef.current.clear();
        }

        toast.info(title, body);

        window.dispatchEvent(new CustomEvent("campusride:push-foreground", {
          detail: { title, body, data },
        }));
      });
    })();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [canUsePush, isAuthenticated, permission, toast]);

  useEffect(() => {
    if (isAuthenticated) {
      return;
    }

    const token = localStorage.getItem(PUSH_TOKEN_KEY);
    if (!token) {
      setIsConfigured(false);
      return;
    }

    void apiClient.notifications.removeToken(token).finally(() => {
      localStorage.removeItem(PUSH_TOKEN_KEY);
      setIsConfigured(false);
    });
  }, [isAuthenticated]);

  const sendTestNotification = useCallback(async () => {
    if (!isAuthenticated || !user) {
      return;
    }

    try {
      await apiClient.notifications.test();
      toast.success("Test notification sent", "Check your notification bell and device notifications.");
    } catch (error) {
      toast.error("Test notification failed", error);
    }
  }, [isAuthenticated, toast, user]);

  return useMemo(() => ({
    permission,
    canUsePush,
    isConfigured,
    syncing,
    requestPermission,
    sendTestNotification,
  }), [permission, canUsePush, isConfigured, syncing, requestPermission, sendTestNotification]);
}
