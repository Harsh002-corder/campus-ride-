import { useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getSocketClient } from "@/lib/socketClient";
import { playEventAlertTone, playRideRequestLoop, stopRideRequestLoop } from "@/lib/soundManager";

type RealtimeRidePayload = {
  id?: string;
  status?: string;
  acceptedAt?: string | null;
  ongoingAt?: string | null;
  cancelledAt?: string | null;
  arrivedAt?: string | null;
};

function vibrateRideRequest() {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") {
    return;
  }

  navigator.vibrate([300, 100, 300]);
}

function isAppVisible() {
  if (typeof document === "undefined") {
    return true;
  }
  return document.visibilityState === "visible";
}

export function useRealtimeRideAlerts() {
  const { isAuthenticated, user } = useAuth();
  const seenKeys = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!isAuthenticated) {
      stopRideRequestLoop();
      return;
    }

    const socket = getSocketClient();

    const onNewRideRequest = (ride: RealtimeRidePayload) => {
      if (user?.role !== "driver") {
        return;
      }

      if (!isAppVisible()) {
        return;
      }

      const dedupeKey = `new:${ride?.id || "unknown"}`;
      if (seenKeys.current.has(dedupeKey)) {
        return;
      }
      seenKeys.current.add(dedupeKey);

      playRideRequestLoop(12_000);
      vibrateRideRequest();
    };

    const onRideUpdated = (ride: RealtimeRidePayload) => {
      if (!isAppVisible()) {
        return;
      }

      const status = String(ride?.status || "").toLowerCase();
      const isArrived = Boolean(ride?.arrivedAt);
      const shouldNotify = ["accepted", "in_progress", "ongoing", "cancelled"].includes(status) || isArrived;

      if (!shouldNotify) {
        return;
      }

      const dedupeKey = `update:${ride?.id || "unknown"}:${status}:${ride?.arrivedAt || ""}:${ride?.cancelledAt || ""}`;
      if (seenKeys.current.has(dedupeKey)) {
        return;
      }
      seenKeys.current.add(dedupeKey);

      if ((status === "accepted" || isArrived) && user?.role === "student") {
        vibrateRideRequest();
      }

      playEventAlertTone();
      if (status !== "pending" && status !== "requested") {
        stopRideRequestLoop();
      }
    };

    const onPushForeground = (event: Event) => {
      if (!isAppVisible()) {
        return;
      }

      const customEvent = event as CustomEvent<{ data?: Record<string, string> }>;
      const type = String(customEvent.detail?.data?.type || "").toLowerCase();

      if (type === "ride_request") {
        playRideRequestLoop(12_000);
        vibrateRideRequest();
      } else {
        playEventAlertTone();
      }
    };

    const onVisibilityChange = () => {
      if (!isAppVisible()) {
        stopRideRequestLoop();
      }
    };

    socket.on("newRideRequest", onNewRideRequest);
    socket.on("ride:requested", onNewRideRequest);
    socket.on("new-ride", onNewRideRequest);
    socket.on("ride:updated", onRideUpdated);
    socket.on("ride-updated", onRideUpdated);

    window.addEventListener("campusride:push-foreground", onPushForeground as EventListener);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      stopRideRequestLoop();
      socket.off("newRideRequest", onNewRideRequest);
      socket.off("ride:requested", onNewRideRequest);
      socket.off("new-ride", onNewRideRequest);
      socket.off("ride:updated", onRideUpdated);
      socket.off("ride-updated", onRideUpdated);

      window.removeEventListener("campusride:push-foreground", onPushForeground as EventListener);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [isAuthenticated, user?.role]);
}
