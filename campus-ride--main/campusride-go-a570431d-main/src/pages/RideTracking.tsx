import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import L from "leaflet";
import { CircleMarker, MapContainer, Marker, Polygon, Polyline, TileLayer, useMap } from "react-leaflet";
import BrandIcon from "@/components/BrandIcon";
import ThemeToggle from "@/components/ThemeToggle";
import { ArrowLeft, Clock, MessageCircle, Phone, User, Eye, EyeOff, CarFront } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient, type RideDto } from "@/lib/apiClient";
import { CAMPUS_BOUNDARY_POLYGON, CAMPUS_MAP_CENTER, isWithinCampusBoundary } from "@/lib/campusBoundary";
import { getSocketClient, getSocketConnectErrorMessage } from "@/lib/socketClient";

type MapMode = "searching" | "accepted" | "driver_arriving" | "ride_started" | "completed";

type LatLngPoint = { lat: number; lng: number };

type DriverLocationSocketPayload = {
  rideId: string;
  driverId?: string | null;
  lat: number;
  lng: number;
  heading?: number | null;
  speed?: number | null;
  timestamp?: string;
  etaMinutes?: number | null;
  etaDistanceKm?: number | null;
  status?: RideDto["status"];
  mapMode?: MapMode;
};

const activeStatuses: RideDto["status"][] = ["scheduled", "pending", "accepted", "in_progress", "requested", "ongoing"];
const DRIVER_SOCKET_EMIT_INTERVAL_MS = 4000;
const DRIVER_API_SYNC_INTERVAL_MS = 15000;

const isValidLatLng = (value: unknown): value is LatLngPoint => {
  if (!value || typeof value !== "object") return false;
  const lat = (value as { lat?: unknown }).lat;
  const lng = (value as { lng?: unknown }).lng;
  return typeof lat === "number" && Number.isFinite(lat) && typeof lng === "number" && Number.isFinite(lng);
};

const toPhoneDigits = (value?: string | null) => (value || "").replace(/\D/g, "");

const toRad = (value: number) => (value * Math.PI) / 180;
const toDeg = (value: number) => (value * 180) / Math.PI;

const distanceKm = (from: LatLngPoint | null, to: LatLngPoint | null) => {
  if (!from || !to) return null;
  const earthRadiusKm = 6371;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const bearingDeg = (from: LatLngPoint, to: LatLngPoint) => {
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);
  const dLng = toRad(to.lng - from.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const brng = (toDeg(Math.atan2(y, x)) + 360) % 360;
  return brng;
};

const interpolatePoint = (from: LatLngPoint, to: LatLngPoint, progress: number): LatLngPoint => ({
  lat: from.lat + (to.lat - from.lat) * progress,
  lng: from.lng + (to.lng - from.lng) * progress,
});

const getMapMode = (status?: RideDto["status"]): MapMode => {
  if (status === "pending" || status === "requested" || status === "scheduled") return "searching";
  if (status === "accepted") return "driver_arriving";
  if (status === "in_progress" || status === "ongoing") return "ride_started";
  if (status === "completed" || status === "cancelled") return "completed";
  return "accepted";
};

const createVehicleIcon = (heading = 0) => L.divIcon({
  className: "driver-vehicle-icon",
  html: `<div style="width:34px;height:34px;border-radius:999px;background:#2563eb;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 18px rgba(0,0,0,.28);transform:rotate(${heading}deg);transition:transform 180ms linear;"><span style="display:block;color:#fff;font-size:16px;line-height:1;">?</span></div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

const createPinIcon = (color: string, label: string) => L.divIcon({
  className: "ride-pin-icon",
  html: `<div style="width:26px;height:26px;border-radius:999px;background:${color};color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;border:2px solid rgba(255,255,255,.85);box-shadow:0 6px 12px rgba(0,0,0,.22);">${label}</div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

function FitBounds({ points }: { points: LatLngPoint[] }) {
  const map = useMap();

  useEffect(() => {
    if (!points.length) return;
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 17 });
  }, [map, points]);

  return null;
}

async function fetchDrivingRoute(origin: LatLngPoint, destination: LatLngPoint) {
  const response = await fetch(
    `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`,
  );
  const payload = await response.json();
  const route = payload?.routes?.[0];
  if (!route?.geometry?.coordinates?.length) {
    throw new Error("No route geometry");
  }

  const path = route.geometry.coordinates.map((coord: [number, number]) => ({ lat: coord[1], lng: coord[0] }));
  return {
    path,
    distanceKm: Number((Number(route.distance || 0) / 1000).toFixed(2)),
    etaMinutes: Math.max(1, Math.round(Number(route.duration || 0) / 60)),
  };
}

const RideTracking = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const { user } = useAuth();

  const [ride, setRide] = useState<RideDto | null>(null);
  const [rideError, setRideError] = useState<string | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [socketInfo, setSocketInfo] = useState<string | null>(null);
  const [geofenceWarning, setGeofenceWarning] = useState<string | null>(null);
  const [isRideInfoVisible, setIsRideInfoVisible] = useState(true);
  const [pageIntroVisible, setPageIntroVisible] = useState(true);

  const [driverTargetPos, setDriverTargetPos] = useState<LatLngPoint | null>(null);
  const [driverRenderPos, setDriverRenderPos] = useState<LatLngPoint | null>(null);
  const [driverHeading, setDriverHeading] = useState(0);
  const [studentPos, setStudentPos] = useState<LatLngPoint | null>(null);
  const [devicePos, setDevicePos] = useState<LatLngPoint | null>(null);
  const [mapMode, setMapMode] = useState<MapMode>("searching");
  const [routePath, setRoutePath] = useState<LatLngPoint[]>([]);
  const [liveEtaMinutes, setLiveEtaMinutes] = useState<number | null>(null);
  const [liveDistanceKm, setLiveDistanceKm] = useState<number | null>(null);
  const [pulseRadius, setPulseRadius] = useState(12);

  const animationFrameRef = useRef<number | null>(null);
  const driverSocketEmitAtRef = useRef(0);
  const driverApiSyncAtRef = useRef(0);
  const routeOriginRef = useRef<LatLngPoint | null>(null);
  const introTimeoutRef = useRef<number | null>(null);

  const isDriverView = user?.role === "driver";
  const backPath = user?.role === "driver" ? "/driver-dashboard" : user?.role === "super_admin" ? "/super-admin-dashboard" : user?.role === "sub_admin" ? "/sub-admin-dashboard" : user?.role === "admin" ? "/admin" : "/student-dashboard";

  const pickupPos = useMemo(() => (isValidLatLng(ride?.pickup) ? ride.pickup : null), [ride?.pickup]);
  const dropPos = useMemo(() => (isValidLatLng(ride?.drop) ? ride.drop : null), [ride?.drop]);

  const rideStatus = ride?.status;

  const contactRoleLabel = isDriverView ? "Student" : "Driver";
  const contactPerson = isDriverView ? ride?.student : ride?.driver;
  const contactDisplayName = contactPerson?.name || `${contactRoleLabel} not assigned`;
  const contactPhoneRaw = contactPerson?.phone || "Not available";
  const contactPhoneDigits = toPhoneDigits(contactPerson?.phone);
  const canContactPerson = contactPhoneDigits.length >= 10;
  const callHref = canContactPerson ? `tel:${contactPhoneDigits}` : undefined;
  const chatHref = canContactPerson ? `sms:${contactPhoneDigits}?body=${encodeURIComponent(`Hi ${contactDisplayName}, I am tracking this ride.`)}` : undefined;

  const statusText = mapMode === "searching"
    ? "Searching Driver"
    : mapMode === "driver_arriving"
      ? "Driver Arriving"
      : mapMode === "ride_started"
        ? "Ride In Progress"
        : mapMode === "completed"
          ? "Ride Completed"
          : "Ride Active";

  const timelineSteps = ["Searching", "Assigned", "On Trip", "Completed"];
  const statusStepIndex = mapMode === "searching"
    ? 0
    : mapMode === "driver_arriving" || mapMode === "accepted"
      ? 1
      : mapMode === "ride_started"
        ? 2
        : 3;
  const statusProgressPercent = (statusStepIndex / (timelineSteps.length - 1)) * 100;

  const introPickupLabel = ride?.pickup?.label || "Campus pickup";
  const introDropLabel = ride?.drop?.label || "Campus destination";
  const introDriverName = contactDisplayName || "Assigned contact";

  useEffect(() => {
    introTimeoutRef.current = window.setTimeout(() => {
      setPageIntroVisible(false);
    }, 980);

    return () => {
      if (introTimeoutRef.current) {
        window.clearTimeout(introTimeoutRef.current);
      }
    };
  }, []);

  const loadRide = useCallback(async () => {
    const loadFromMyRides = async () => {
      const response = await apiClient.rides.my();
      const rides = response.rides || [];
      const selectedRide = id
        ? rides.find((item) => item.id === id) || null
        : rides.find((item) => activeStatuses.includes(item.status)) || null;

      setRide(selectedRide);
      setRideError(selectedRide ? null : "No active ride found.");
      if (selectedRide) {
        setMapMode(getMapMode(selectedRide.status));
        if (isValidLatLng(selectedRide.driverLocation)) {
          setDriverTargetPos(selectedRide.driverLocation);
          setLiveEtaMinutes(typeof selectedRide.etaMinutes === "number" ? selectedRide.etaMinutes : null);
          setLiveDistanceKm(typeof selectedRide.etaDistanceKm === "number" ? selectedRide.etaDistanceKm : null);
          if (typeof selectedRide.driverLocation.heading === "number") {
            setDriverHeading(selectedRide.driverLocation.heading);
          }
        }
        if (isValidLatLng(selectedRide.studentLocation)) {
          setStudentPos(selectedRide.studentLocation);
        }
      }
    };

    try {
      if (id) {
        try {
          const response = await apiClient.rides.get(id);
          const foundRide = response.ride || null;
          setRide(foundRide);
          setRideError(foundRide ? null : "Ride not found.");
          if (foundRide) {
            setMapMode(getMapMode(foundRide.status));
            if (isValidLatLng(foundRide.driverLocation)) {
              setDriverTargetPos(foundRide.driverLocation);
              setLiveEtaMinutes(typeof foundRide.etaMinutes === "number" ? foundRide.etaMinutes : null);
              setLiveDistanceKm(typeof foundRide.etaDistanceKm === "number" ? foundRide.etaDistanceKm : null);
              if (typeof foundRide.driverLocation.heading === "number") {
                setDriverHeading(foundRide.driverLocation.heading);
              }
            }
            if (isValidLatLng(foundRide.studentLocation)) {
              setStudentPos(foundRide.studentLocation);
            }
          }
          return;
        } catch {
          await loadFromMyRides();
          return;
        }
      }

      await loadFromMyRides();
    } catch {
      setRideError("Could not load ride details right now.");
    }
  }, [id]);

  useEffect(() => {
    void loadRide();
  }, [loadRide]);

  useEffect(() => {
    const pollId = window.setInterval(() => {
      void loadRide();
    }, 8000);

    return () => {
      window.clearInterval(pollId);
    };
  }, [loadRide]);

  useEffect(() => {
    if (!driverTargetPos) {
      setDriverRenderPos(null);
      return;
    }

    const start = driverRenderPos || driverTargetPos;
    const end = driverTargetPos;
    const startHeading = driverHeading;
    const endHeading = typeof (ride?.driverLocation as { heading?: number } | undefined)?.heading === "number"
      ? Number((ride?.driverLocation as { heading?: number }).heading)
      : bearingDeg(start, end);

    if (!driverRenderPos) {
      setDriverRenderPos(driverTargetPos);
      setDriverHeading(endHeading);
      return;
    }

    const duration = 1200;
    const animationStart = performance.now();

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    const animate = (now: number) => {
      const progress = Math.min(1, (now - animationStart) / duration);
      setDriverRenderPos(interpolatePoint(start, end, progress));
      setDriverHeading(startHeading + (endHeading - startHeading) * progress);
      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [driverTargetPos]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setPulseRadius((prev) => (prev >= 18 ? 12 : prev + 1));
    }, 160);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const socket = getSocketClient();
    const roomRideId = ride?.id || id;

    const onConnect = () => {
      setSocketInfo("Realtime connected");
      if (roomRideId) {
        socket.emit("ride:join", roomRideId);
      }
    };

    const onConnectError = (error: unknown) => {
      setSocketInfo(getSocketConnectErrorMessage(error));
    };

    const onRideUpdated = (updatedRide: RideDto) => {
      const expectedRideId = ride?.id || id;
      if (!updatedRide?.id || (expectedRideId && updatedRide.id !== expectedRideId)) {
        return;
      }

      setRide(updatedRide);
      setMapMode(getMapMode(updatedRide.status));
      setRideError(null);

      if (isValidLatLng(updatedRide.driverLocation)) {
        setDriverTargetPos(updatedRide.driverLocation);
        if (typeof updatedRide.driverLocation.heading === "number") {
          setDriverHeading(updatedRide.driverLocation.heading);
        }
      }

      if (isValidLatLng(updatedRide.studentLocation)) {
        setStudentPos(updatedRide.studentLocation);
      }

      setLiveEtaMinutes(typeof updatedRide.etaMinutes === "number" ? updatedRide.etaMinutes : null);
      setLiveDistanceKm(typeof updatedRide.etaDistanceKm === "number" ? updatedRide.etaDistanceKm : null);
    };

    const onDriverLocation = (locationData: DriverLocationSocketPayload) => {
      const expectedRideId = ride?.id || id;
      if (!locationData?.rideId || (expectedRideId && locationData.rideId !== expectedRideId)) {
        return;
      }

      setDriverTargetPos({ lat: locationData.lat, lng: locationData.lng });
      if (typeof locationData.heading === "number") {
        setDriverHeading(locationData.heading);
      }
      if (typeof locationData.etaMinutes === "number") {
        setLiveEtaMinutes(locationData.etaMinutes);
      }
      if (typeof locationData.etaDistanceKm === "number") {
        setLiveDistanceKm(locationData.etaDistanceKm);
      }
    };

    socket.on("connect", onConnect);
    socket.on("connect_error", onConnectError);
    socket.on("ride:updated", onRideUpdated);
    socket.on("driver-location", onDriverLocation);

    if (socket.connected) {
      onConnect();
    }

    return () => {
      if (roomRideId) {
        socket.emit("ride:leave", roomRideId);
      }
      socket.off("connect", onConnect);
      socket.off("connect_error", onConnectError);
      socket.off("ride:updated", onRideUpdated);
      socket.off("driver-location", onDriverLocation);
    };
  }, [id, ride?.id]);

  useEffect(() => {
    if (!rideStatus || !ride?.id) {
      return;
    }

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      return;
    }

    const socket = getSocketClient();

    const watchId = navigator.geolocation.watchPosition(
      async (position) => {
        const current = { lat: position.coords.latitude, lng: position.coords.longitude };
        setDevicePos(current);
        setGeoError(null);

        if (!isWithinCampusBoundary(current)) {
          setGeofenceWarning("Location is outside campus boundary.");
        } else {
          setGeofenceWarning(null);
        }

        const nowMs = Date.now();

        if (isDriverView && ["accepted", "in_progress", "ongoing"].includes(rideStatus)) {
          if (nowMs - driverSocketEmitAtRef.current >= DRIVER_SOCKET_EMIT_INTERVAL_MS) {
            const heading = typeof position.coords.heading === "number" && Number.isFinite(position.coords.heading)
              ? position.coords.heading
              : undefined;
            const speedKmh = typeof position.coords.speed === "number" && Number.isFinite(position.coords.speed) && position.coords.speed >= 0
              ? position.coords.speed * 3.6
              : undefined;

            socket.emit("driver-location-update", {
              driverId: user?.id,
              rideId: ride.id,
              lat: current.lat,
              lng: current.lng,
              heading,
              speed: speedKmh,
              timestamp: new Date(nowMs).toISOString(),
            });

            driverSocketEmitAtRef.current = nowMs;
          }

          if (nowMs - driverApiSyncAtRef.current >= DRIVER_API_SYNC_INTERVAL_MS) {
            try {
              await apiClient.rides.updateLocation(ride.id, current.lat, current.lng, {
                heading: typeof position.coords.heading === "number" ? position.coords.heading : undefined,
                speed: typeof position.coords.speed === "number" && position.coords.speed >= 0
                  ? position.coords.speed * 3.6
                  : undefined,
                timestamp: new Date(nowMs).toISOString(),
              });
              driverApiSyncAtRef.current = nowMs;
            } catch {
              setSocketInfo("Realtime location sync degraded; retrying...");
            }
          }

          setDriverTargetPos(current);
          return;
        }

        if (!isDriverView && ["accepted", "in_progress", "ongoing"].includes(rideStatus) && ride?.id) {
          try {
            await apiClient.rides.updateLocation(ride.id, current.lat, current.lng, {
              timestamp: new Date(nowMs).toISOString(),
            });
            setStudentPos(current);
          } catch {
            setSocketInfo("Student location sync pending...");
          }
        }
      },
      () => {
        setGeoError("GPS permission denied or unavailable.");
      },
      { enableHighAccuracy: true, timeout: 9000, maximumAge: 2500 },
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [isDriverView, ride?.id, rideStatus, user?.id]);

  useEffect(() => {
    if (!driverRenderPos) return;

    if (!isWithinCampusBoundary(driverRenderPos)) {
      setGeofenceWarning("Warning: driver location moved outside campus boundary.");
      return;
    }

    setGeofenceWarning(null);
  }, [driverRenderPos]);

  useEffect(() => {
    const origin = mapMode === "driver_arriving"
      ? driverRenderPos
      : mapMode === "ride_started"
        ? pickupPos
        : null;

    const destination = mapMode === "driver_arriving"
      ? pickupPos
      : mapMode === "ride_started"
        ? dropPos
        : null;

    if (!origin || !destination) {
      setRoutePath([]);
      if (mapMode === "completed") {
        setRouteError(null);
      }
      return;
    }

    const deviationKm = distanceKm(routeOriginRef.current, origin);
    const shouldRecalculate = mapMode === "ride_started"
      || !routeOriginRef.current
      || typeof deviationKm !== "number"
      || deviationKm > 0.12;

    if (!shouldRecalculate) {
      return;
    }

    let active = true;
    routeOriginRef.current = origin;

    fetchDrivingRoute(origin, destination)
      .then((route) => {
        if (!active) return;
        setRoutePath(route.path.filter((point) => isWithinCampusBoundary(point) || mapMode === "ride_started"));
        setRouteError(null);
        setLiveDistanceKm(route.distanceKm);
        setLiveEtaMinutes(route.etaMinutes);
      })
      .catch(() => {
        if (!active) return;
        setRoutePath([origin, destination]);
        setRouteError("Route service unavailable. Showing direct path.");
      });

    return () => {
      active = false;
    };
  }, [mapMode, driverRenderPos, pickupPos, dropPos]);

  if (!ride) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="card-glass max-w-lg w-full text-center">
          <h1 className="text-lg font-semibold mb-2">No ride to track</h1>
          <p className="text-sm text-muted-foreground">Track page only shows real active ride details.</p>
          {rideError && <p className="text-xs text-muted-foreground mt-2">{rideError}</p>}
          <button
            type="button"
            onClick={() => navigate(backPath)}
            className="mt-4 btn-primary-gradient px-4 py-2 rounded-xl text-sm font-semibold"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  const ownPos = isDriverView ? (driverRenderPos || devicePos) : (studentPos || devicePos);
  const counterpartPos = isDriverView ? studentPos : driverRenderPos;
  const counterpartLabel = isDriverView ? "Student" : "Driver";

  const pointsForBounds = [pickupPos, dropPos, ownPos, counterpartPos].filter((point): point is LatLngPoint => Boolean(point));
  const mapCenter = pickupPos || dropPos || ownPos || counterpartPos || CAMPUS_MAP_CENTER;

  const pickupDistanceKm = distanceKm(driverRenderPos, pickupPos);
  const dropDistanceKm = distanceKm(driverRenderPos, dropPos);

  const rideEtaText = typeof liveEtaMinutes === "number"
    ? `${liveEtaMinutes} min${liveEtaMinutes === 1 ? "" : "s"}`
    : typeof ride?.etaMinutes === "number"
      ? `${ride.etaMinutes} min${ride.etaMinutes === 1 ? "" : "s"}`
      : "Calculating...";

  const vehicleType = (ride as unknown as { driver?: { vehicleType?: string; vehicleNumber?: string } }).driver?.vehicleType || "Campus Cab";
  const vehicleNumber = (ride as unknown as { driver?: { vehicleType?: string; vehicleNumber?: string } }).driver?.vehicleNumber || "Not provided";

  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
      <div className="absolute inset-0 z-0">
        <MapContainer
          center={[mapCenter.lat, mapCenter.lng]}
          zoom={15}
          className="w-full h-full"
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <FitBounds points={pointsForBounds} />

          <Polygon
            positions={CAMPUS_BOUNDARY_POLYGON.map((point) => [point.lat, point.lng] as [number, number])}
            pathOptions={{
              color: "#10b981",
              weight: 2,
              fillColor: "#10b981",
              fillOpacity: 0.08,
            }}
          />

          {pickupPos && <Marker position={[pickupPos.lat, pickupPos.lng]} icon={createPinIcon("#16a34a", "P")} />}
          {dropPos && <Marker position={[dropPos.lat, dropPos.lng]} icon={createPinIcon("#dc2626", "D")} />}

          {counterpartPos && (
            <Marker
              position={[counterpartPos.lat, counterpartPos.lng]}
              icon={createPinIcon("#f59e0b", counterpartLabel === "Driver" ? "R" : "S")}
            />
          )}

          {ownPos && <Marker position={[ownPos.lat, ownPos.lng]} icon={createPinIcon("#2563eb", "Y")} />}

          {driverRenderPos && (
            <Marker position={[driverRenderPos.lat, driverRenderPos.lng]} icon={createVehicleIcon(driverHeading)} />
          )}

          {routePath.length >= 2 && (
            <Polyline
              positions={routePath.map((point) => [point.lat, point.lng] as [number, number])}
              pathOptions={{ color: mapMode === "ride_started" ? "#2563eb" : "#14b8a6", weight: 5, opacity: 0.8 }}
            />
          )}

          {mapMode === "searching" && pickupPos && (
            <CircleMarker
              center={[pickupPos.lat, pickupPos.lng]}
              radius={pulseRadius}
              pathOptions={{ color: "#22c55e", fillOpacity: 0.2, weight: 2 }}
            />
          )}
        </MapContainer>
      </div>

      <AnimatePresence>
        {pageIntroVisible && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28 }}
            className="absolute inset-0 z-20 flex items-center justify-center px-6"
          >
            <div className="absolute inset-0 bg-background/72 backdrop-blur-xl" />
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 8 }}
              transition={{ duration: 0.34, ease: "easeOut" }}
              className="relative w-full max-w-md overflow-hidden rounded-[30px] border border-primary/20 bg-background/88 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.24)]"
            >
              <motion.div
                aria-hidden="true"
                className="absolute -left-10 top-0 h-full w-24 bg-primary/10 blur-2xl"
                animate={{ x: [0, 260, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              />

              <div className="relative z-10 space-y-5">
                <div className="flex items-center justify-center">
                  <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                    <motion.span
                      aria-hidden="true"
                      className="absolute inset-0 rounded-full border border-primary/25"
                      animate={{ scale: [1, 1.18, 1.3], opacity: [0.55, 0.2, 0] }}
                      transition={{ duration: 1.25, repeat: Infinity, ease: "easeOut" }}
                    />
                    <motion.div
                      animate={{ rotate: [0, -8, 0, 8, 0], y: [0, -2, 0] }}
                      transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
                      className="relative z-10 rounded-full bg-primary text-primary-foreground p-3 shadow-lg"
                    >
                      <CarFront className="h-7 w-7" />
                    </motion.div>
                  </div>
                </div>

                <div className="space-y-1 text-center">
                  <h2 className="text-xl font-bold font-display text-foreground">Live Ride Tracking</h2>
                  <p className="text-sm text-muted-foreground">Syncing route progress, driver position, and ETA.</p>
                </div>

                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3 text-sm">
                  <div className="min-w-0 text-left">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary/70">From</p>
                    <p className="truncate font-semibold text-foreground">{introPickupLabel}</p>
                  </div>
                  <motion.div
                    aria-hidden="true"
                    animate={{ x: [0, 4, 0] }}
                    transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
                    className="rounded-full bg-primary/10 p-1.5 text-primary"
                  >
                    <ArrowLeft className="h-4 w-4 rotate-180" />
                  </motion.div>
                  <div className="min-w-0 text-right">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary/70">To</p>
                    <p className="truncate font-semibold text-foreground">{introDropLabel}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-border/60 bg-muted/35 px-4 py-4">
                  <div className="relative h-8">
                    <div className="absolute left-2 right-2 top-1/2 h-[2px] -translate-y-1/2 rounded-full bg-primary/15" />
                    <motion.div
                      aria-hidden="true"
                      className="absolute left-2 top-1/2 h-[2px] -translate-y-1/2 rounded-full bg-primary"
                      animate={{ width: ["18%", "86%"] }}
                      transition={{ duration: 0.95, repeat: Infinity, ease: "easeInOut" }}
                    />
                    <motion.div
                      aria-hidden="true"
                      className="absolute left-2 top-1/2 -translate-y-1/2"
                      animate={{ x: [0, 220] }}
                      transition={{ duration: 0.95, repeat: Infinity, ease: "easeInOut" }}
                    >
                      <div className="rounded-full bg-primary p-1.5 text-primary-foreground shadow-md">
                        <Navigation className="h-3.5 w-3.5" />
                      </div>
                    </motion.div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-muted/30 px-4 py-3 text-sm">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Contact</p>
                    <p className="font-medium text-foreground">{introDriverName}</p>
                  </div>
                  <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
                    {statusText}
                  </span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-10 p-3 sm:p-4 flex items-center justify-between gap-2">
        <motion.button
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          whileTap={{ scale: 0.93 }}
          onClick={() => navigate(backPath)}
          className="glass w-10 h-10 rounded-xl flex items-center justify-center text-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </motion.button>

        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass px-3 sm:px-4 py-2 rounded-xl flex items-center gap-2 min-w-0">
          <BrandIcon className="w-7 h-7 rounded-lg" />
          <span className="font-bold font-display text-xs sm:text-sm truncate">
            Campus<span className="gradient-text">Ride</span>
          </span>
        </motion.div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <motion.button
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            whileTap={{ scale: 0.93 }}
            onClick={() => setIsRideInfoVisible((prev) => !prev)}
            className="glass px-3 py-2 rounded-xl flex items-center gap-2 text-xs text-foreground hover:text-primary transition-colors"
            title={isRideInfoVisible ? "Hide ride info" : "Show ride info"}
          >
            {isRideInfoVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            <span className="hidden sm:inline">{isRideInfoVisible ? "Hide Info" : "Show Info"}</span>
          </motion.button>
        </div>
      </div>

      {isRideInfoVisible && (
        <div className="relative z-10 mt-auto">
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 22, delay: 0.1 }}
            className="glass rounded-t-3xl p-4 sm:p-6 space-y-4 sm:space-y-5"
          >
            <div className="flex items-center justify-between gap-3">
              <span className={`text-xs sm:text-sm font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg ${mapMode === "ride_started" ? "bg-green-500/20 text-green-400" : "bg-blue-500/20 text-blue-400"}`}>
                ✓ {statusText}
              </span>
              <div className="flex flex-col items-end gap-2">
                {ride.status !== "cancelled" && ride.status !== "completed" && Boolean(ride.verificationCode) && (
                  <span className="text-xs font-bold bg-primary/20 text-primary px-3 py-1.5 rounded-lg">
                    🔐 Code: {ride.verificationCode}
                  </span>
                )}
                <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground bg-muted/40 px-3 py-1.5 rounded-lg font-medium">
                  <Clock className="w-4 h-4" />
                  <span>ETA {rideEtaText}</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/20 px-3 py-3 sm:px-4">
              <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                <span>Trip Progress</span>
                <span>{Math.round(statusProgressPercent)}%</span>
              </div>
              <div className="relative mb-3 h-7">
                <div className="absolute left-1 right-1 top-1/2 h-[2px] -translate-y-1/2 rounded-full bg-primary/20" />
                <motion.div
                  className="absolute left-1 top-1/2 h-[2px] -translate-y-1/2 rounded-full bg-primary"
                  initial={{ width: "0%" }}
                  animate={{ width: `calc(${statusProgressPercent}% - 0.25rem)` }}
                  transition={{ duration: 0.45, ease: "easeOut" }}
                />
                <motion.div
                  className="absolute top-1/2 -translate-y-1/2"
                  initial={{ left: "0%" }}
                  animate={{ left: `calc(${statusProgressPercent}% - 0.6rem)` }}
                  transition={{ duration: 0.45, ease: "easeOut" }}
                >
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
                    className="rounded-full bg-primary p-1 text-primary-foreground shadow-md"
                  >
                    <CarFront className="h-3.5 w-3.5" />
                  </motion.div>
                </motion.div>
                <div className="absolute left-1 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full border border-primary/45 bg-background" />
                <div className="absolute right-1 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full border border-primary/45 bg-background" />
              </div>
              <div className="grid grid-cols-4 gap-2 text-[11px]">
                {timelineSteps.map((step, index) => (
                  <div key={step} className={`text-center font-medium ${index <= statusStepIndex ? "text-primary" : "text-muted-foreground"}`}>
                    {step}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs sm:text-sm">
              <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
                <p className="text-muted-foreground font-medium mb-1">Distance to Pickup</p>
                <p className="font-bold text-foreground text-lg">{typeof pickupDistanceKm === "number" ? `${Math.round(pickupDistanceKm * 1000)} m` : "-"}</p>
              </div>
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
                <p className="text-muted-foreground font-medium mb-1">Distance to Drop</p>
                <p className="font-bold text-foreground text-lg">{typeof dropDistanceKm === "number" ? `${dropDistanceKm.toFixed(2)} km` : "-"}</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/20 px-4 py-3">
                <p className="text-muted-foreground font-medium mb-1">Live ETA</p>
                <p className="font-bold text-foreground text-lg">{rideEtaText}</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/20 px-4 py-3">
                <p className="text-muted-foreground font-medium mb-1">Mode</p>
                <p className="font-bold text-foreground text-lg capitalize">{mapMode.replace("_", " ")}</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 glass rounded-xl p-4 sm:p-5">
              <div className="flex items-center gap-4 flex-1">
                <div className="w-12 h-12 rounded-lg btn-primary-gradient flex-shrink-0 flex items-center justify-center">
                  <User className="w-6 h-6 text-primary-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm sm:text-base text-foreground">{contactRoleLabel}: {contactDisplayName}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">{contactPhoneRaw}</p>
                  <p className="text-xs text-muted-foreground mt-1.5">🚗 {vehicleType} • {vehicleNumber}</p>
                </div>
              </div>
              <div className="flex gap-3 w-full sm:w-auto">
                {callHref ? (
                  <motion.a whileTap={{ scale: 0.9 }} href={callHref} className="flex-1 sm:flex-none px-4 py-2.5 rounded-lg bg-primary/20 text-primary hover:bg-primary/30 transition-colors flex items-center justify-center gap-2 font-medium text-sm" title="Call driver">
                    <Phone className="w-4 h-4" />
                    <span className="sm:hidden">Call</span>
                  </motion.a>
                ) : (
                  <button type="button" disabled className="flex-1 sm:flex-none px-4 py-2.5 rounded-lg bg-muted/50 text-muted-foreground flex items-center justify-center gap-2 font-medium text-sm cursor-not-allowed" title="Call unavailable">
                    <Phone className="w-4 h-4" />
                    <span className="sm:hidden">Call</span>
                  </button>
                )}
                {chatHref ? (
                  <motion.a whileTap={{ scale: 0.9 }} href={chatHref} className="flex-1 sm:flex-none px-4 py-2.5 rounded-lg bg-primary/20 text-primary hover:bg-primary/30 transition-colors flex items-center justify-center gap-2 font-medium text-sm" title="Message driver">
                    <MessageCircle className="w-4 h-4" />
                    <span className="sm:hidden">Chat</span>
                  </motion.a>
                ) : (
                  <button type="button" disabled className="flex-1 sm:flex-none px-4 py-2.5 rounded-lg bg-muted/50 text-muted-foreground flex items-center justify-center gap-2 font-medium text-sm cursor-not-allowed" title="Chat unavailable">
                    <MessageCircle className="w-4 h-4" />
                    <span className="sm:hidden">Chat</span>
                  </button>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 sm:py-4">
              <div className="flex items-center gap-2 mb-2">
                <CarFront className="w-5 h-5 text-primary" />
                <p className="text-sm sm:text-base font-semibold text-foreground">Live Tracking Panel</p>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">Driver movement is updated via Socket.IO and animated locally for smooth motion.</p>
            </div>

            <div className="text-[11px] text-muted-foreground text-center space-y-1">
              <p>Tracking ride {ride.id}</p>
              {rideError && <p>{rideError}</p>}
              {routeError && <p>{routeError}</p>}
              {geoError && <p>{geoError}</p>}
              {geofenceWarning && <p>{geofenceWarning}</p>}
              {socketInfo && <p>{socketInfo}</p>}
              {typeof liveDistanceKm === "number" && <p>Route distance: {liveDistanceKm.toFixed(2)} km</p>}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default RideTracking;
