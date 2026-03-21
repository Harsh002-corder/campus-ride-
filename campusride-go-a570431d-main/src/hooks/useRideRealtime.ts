import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { type RideDto } from "@/lib/apiClient";
import { getSocketClient } from "@/lib/socketClient";
import { ENABLE_REALTIME } from "@/lib/runtimeConfig";
import { useRideRealtimeStore } from "@/stores/rideRealtimeStore";

export function useRideRealtime() {
  const { user, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!ENABLE_REALTIME || !isAuthenticated) {
      useRideRealtimeStore.getState().markSocketConnected(false);
      return;
    }

    const socket = getSocketClient();
    const state = useRideRealtimeStore.getState();

    const onConnect = () => {
      state.markSocketConnected(true);
    };

    const onDisconnect = () => {
      useRideRealtimeStore.getState().markSocketConnected(false);
    };

    const onNewRide = (ride: RideDto) => {
      useRideRealtimeStore.getState().applyNewRide(ride);
    };

    const onRideUpdated = (ride: RideDto) => {
      useRideRealtimeStore.getState().applyRideUpdated(ride, user?.id || null);
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    socket.on("newRideRequest", onNewRide);
    socket.on("ride:requested", onNewRide);
    socket.on("new-ride", onNewRide);

    socket.on("ride:updated", onRideUpdated);
    socket.on("ride-updated", onRideUpdated);

    if (socket.connected) {
      state.markSocketConnected(true);
    }

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);

      socket.off("newRideRequest", onNewRide);
      socket.off("ride:requested", onNewRide);
      socket.off("new-ride", onNewRide);

      socket.off("ride:updated", onRideUpdated);
      socket.off("ride-updated", onRideUpdated);
    };
  }, [isAuthenticated, user?.id]);
}
