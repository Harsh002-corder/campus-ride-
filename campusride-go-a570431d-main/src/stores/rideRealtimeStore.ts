import { create } from "zustand";
import { type RideDto } from "@/lib/apiClient";

type DriverCoords = {
  lat: number;
  lng: number;
};

type RideRealtimeState = {
  availableRides: RideDto[];
  myRides: RideDto[];
  lastNewRideId: string | null;
  socketConnected: boolean;
  nearbyFilterEnabled: boolean;
  nearbyRadiusKm: number;
  driverCoords: DriverCoords | null;
  hydrateDriverData: (myRides: RideDto[], availableRides: RideDto[]) => void;
  markSocketConnected: (connected: boolean) => void;
  applyNewRide: (ride: RideDto) => void;
  applyRideUpdated: (ride: RideDto, currentDriverId?: string | null) => void;
  removeAvailableRide: (rideId: string) => void;
  upsertMyRide: (ride: RideDto) => void;
  patchMyRide: (rideId: string, patcher: (ride: RideDto) => RideDto) => void;
  consumeLastNewRide: () => void;
  setNearbyFilter: (enabled: boolean, radiusKm?: number) => void;
  setDriverCoords: (coords: DriverCoords | null) => void;
};

const isIncomingRide = (ride: RideDto) => ["pending", "requested"].includes(ride.status) && !ride.driverId;

const sortIncoming = (rides: RideDto[]) => rides
  .filter(isIncomingRide)
  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

const sortQueue = (rides: RideDto[]) => rides
  .slice()
  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

const toUniqueById = (rides: RideDto[]) => {
  const map = new Map<string, RideDto>();
  for (const ride of rides) {
    if (ride?.id) {
      map.set(ride.id, ride);
    }
  }
  return Array.from(map.values());
};

const toRadians = (value: number) => (value * Math.PI) / 180;

const getDistanceKm = (from: DriverCoords, to: DriverCoords) => {
  const earthRadiusKm = 6371;
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);

  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const isNearbyRide = (ride: RideDto, enabled: boolean, coords: DriverCoords | null, radiusKm: number) => {
  if (!enabled) return true;
  if (!coords) return true;
  const pickup = ride.pickup;
  if (!pickup || typeof pickup.lat !== "number" || typeof pickup.lng !== "number") {
    return true;
  }
  return getDistanceKm(coords, { lat: pickup.lat, lng: pickup.lng }) <= radiusKm;
};

export const useRideRealtimeStore = create<RideRealtimeState>((set, get) => ({
  availableRides: [],
  myRides: [],
  lastNewRideId: null,
  socketConnected: false,
  nearbyFilterEnabled: false,
  nearbyRadiusKm: 4,
  driverCoords: null,

  hydrateDriverData: (myRides, availableRides) => {
    const uniqueMyRides = sortQueue(toUniqueById(myRides || []));
    const { nearbyFilterEnabled, driverCoords, nearbyRadiusKm } = get();
    const uniqueAvailableRides = sortIncoming(
      toUniqueById(availableRides || []).filter((ride) => isNearbyRide(ride, nearbyFilterEnabled, driverCoords, nearbyRadiusKm))
    );

    set({
      myRides: uniqueMyRides,
      availableRides: uniqueAvailableRides,
    });
  },

  markSocketConnected: (connected) => {
    set({ socketConnected: connected });
  },

  applyNewRide: (ride) => {
    if (!ride?.id || !isIncomingRide(ride)) {
      return;
    }

    const { nearbyFilterEnabled, driverCoords, nearbyRadiusKm } = get();
    if (!isNearbyRide(ride, nearbyFilterEnabled, driverCoords, nearbyRadiusKm)) {
      return;
    }

    const existing = get().availableRides;
    const hasRide = existing.some((item) => item.id === ride.id);
    const next = hasRide
      ? existing.map((item) => (item.id === ride.id ? ride : item))
      : [ride, ...existing];

    set({
      availableRides: sortIncoming(toUniqueById(next)),
      lastNewRideId: hasRide ? get().lastNewRideId : ride.id,
    });
  },

  applyRideUpdated: (ride, currentDriverId) => {
    if (!ride?.id) return;

    const { nearbyFilterEnabled, driverCoords, nearbyRadiusKm } = get();

    set((state) => {
      const rideInRange = isNearbyRide(ride, nearbyFilterEnabled, driverCoords, nearbyRadiusKm);
      const isIncoming = isIncomingRide(ride) && rideInRange;
      const availableNext = isIncoming
        ? sortIncoming(toUniqueById([...state.availableRides.filter((item) => item.id !== ride.id), ride]))
        : state.availableRides.filter((item) => item.id !== ride.id);

      const belongsToDriver = Boolean(currentDriverId) && ride.driverId === currentDriverId;
      const myRideExists = state.myRides.some((item) => item.id === ride.id);
      const myRides = belongsToDriver
        ? sortQueue(toUniqueById(myRideExists ? state.myRides.map((item) => (item.id === ride.id ? ride : item)) : [...state.myRides, ride]))
        : sortQueue(state.myRides.filter((item) => item.id !== ride.id));

      return {
        availableRides: availableNext,
        myRides,
      };
    });
  },

  removeAvailableRide: (rideId) => {
    set((state) => ({
      availableRides: state.availableRides.filter((ride) => ride.id !== rideId),
    }));
  },

  upsertMyRide: (ride) => {
    if (!ride?.id) return;

    set((state) => {
      const exists = state.myRides.some((item) => item.id === ride.id);
      const next = exists
        ? state.myRides.map((item) => (item.id === ride.id ? ride : item))
        : [...state.myRides, ride];

      return {
        myRides: sortQueue(toUniqueById(next)),
      };
    });
  },

  patchMyRide: (rideId, patcher) => {
    set((state) => {
      let changed = false;
      const next = state.myRides.map((ride) => {
        if (ride.id !== rideId) return ride;
        changed = true;
        return patcher(ride);
      });

      if (!changed) {
        return state;
      }

      return {
        myRides: sortQueue(toUniqueById(next)),
      };
    });
  },

  consumeLastNewRide: () => {
    set({ lastNewRideId: null });
  },

  setNearbyFilter: (enabled, radiusKm) => {
    set((state) => ({
      nearbyFilterEnabled: enabled,
      nearbyRadiusKm: typeof radiusKm === "number" && Number.isFinite(radiusKm)
        ? Math.max(0.5, Math.min(radiusKm, 30))
        : state.nearbyRadiusKm,
    }));
  },

  setDriverCoords: (coords) => {
    set({ driverCoords: coords });
  },
}));
