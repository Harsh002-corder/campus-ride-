import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { useJsApiLoader, GoogleMap, Marker, DirectionsRenderer, Polygon } from "@react-google-maps/api";
import BrandIcon from "@/components/BrandIcon";
import { ArrowLeft, Clock, Phone, MessageCircle, User, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient, type RideDto } from "@/lib/apiClient";
import { CAMPUS_BOUNDARY_POLYGON, CAMPUS_MAP_CENTER } from "@/lib/campusBoundary";
import { getSocketClient, getSocketConnectErrorMessage } from "@/lib/socketClient";

const GOOGLE_MAPS_API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined)?.trim() || "";

const libraries: ("places" | "geometry" | "drawing")[] = ["places", "geometry"];
const mapContainerStyle = { width: "100%", height: "100%" };

const mapOptions: google.maps.MapOptions = {
  disableDefaultUI: true,
  zoomControl: true,
  fullscreenControl: true,
  streetViewControl: false,
  mapTypeControl: false,
};

const campusBoundaryOptions: google.maps.PolygonOptions = {
  fillColor: "#10b981",
  fillOpacity: 0.08,
  strokeColor: "#10b981",
  strokeOpacity: 0.65,
  strokeWeight: 2,
  clickable: false,
  zIndex: 1,
};

const activeStatuses: RideDto["status"][] = ["scheduled", "pending", "accepted", "in_progress", "requested", "ongoing"];

const isValidLatLng = (value: unknown): value is { lat: number; lng: number } => {
  if (!value || typeof value !== "object") return false;
  const lat = (value as { lat?: unknown }).lat;
  const lng = (value as { lng?: unknown }).lng;
  return typeof lat === "number" && Number.isFinite(lat) && typeof lng === "number" && Number.isFinite(lng);
};

const toPhoneDigits = (value?: string | null) => (value || "").replace(/\D/g, "");

const RideTracking = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const { user } = useAuth();

  const mapRef = useRef<google.maps.Map | null>(null);
  const lastDriverSyncAtRef = useRef(0);
  const syncingDriverLocationRef = useRef(false);

  const [ride, setRide] = useState<RideDto | null>(null);
  const [driverPos, setDriverPos] = useState<{ lat: number; lng: number } | null>(null);
  const [studentPos, setStudentPos] = useState<{ lat: number; lng: number } | null>(null);
  const [devicePos, setDevicePos] = useState<{ lat: number; lng: number } | null>(null);
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);

  const [rideError, setRideError] = useState<string | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [socketInfo, setSocketInfo] = useState<string | null>(null);
  const [isRideInfoVisible, setIsRideInfoVisible] = useState(true);

  const isDriverView = user?.role === "driver";
  const backPath = user?.role === "driver" ? "/driver-dashboard" : user?.role === "admin" ? "/admin" : "/student-dashboard";
  const pickupPos = isValidLatLng(ride?.pickup) ? ride.pickup : null;
  const dropPos = isValidLatLng(ride?.drop) ? ride.drop : null;
  const contactRoleLabel = isDriverView ? "Student" : "Driver";
  const contactPerson = isDriverView ? ride?.student : ride?.driver;
  const contactDisplayName = contactPerson?.name || `${contactRoleLabel} not assigned`;
  const contactPhoneRaw = contactPerson?.phone || "Not available";
  const contactPhoneDigits = toPhoneDigits(contactPerson?.phone);
  const canContactPerson = contactPhoneDigits.length >= 10;
  const callHref = canContactPerson ? `tel:${contactPhoneDigits}` : undefined;
  const chatHref = canContactPerson
    ? `sms:${contactPhoneDigits}?body=${encodeURIComponent(`Hi ${contactDisplayName}, I am tracking this ride.`)}`
    : undefined;
  const rideEtaText = typeof ride?.etaMinutes === "number"
    ? `${ride.etaMinutes} min${ride.etaMinutes === 1 ? "" : "s"}`
    : ride?.status === "in_progress" || ride?.status === "ongoing"
      ? "Arriving soon"
      : "Calculating...";
  const statusText = ride?.status === "in_progress" || ride?.status === "ongoing"
    ? "Ride Ongoing"
    : ride?.status === "accepted"
      ? "Driver Arriving"
      : ride?.status === "pending" || ride?.status === "requested"
        ? "Booked"
        : ride?.status === "scheduled"
          ? "Scheduled"
          : "Ride Active";

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries,
  });

  const onMapLoad = useCallback((map: google.maps.Map) => {
    console.log("Map loaded");
    mapRef.current = map;
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

      if (isValidLatLng(selectedRide?.driverLocation)) {
        setDriverPos(selectedRide.driverLocation);
      } else {
        setDriverPos(null);
      }

      if (isValidLatLng(selectedRide?.studentLocation)) {
        setStudentPos(selectedRide.studentLocation);
      } else {
        setStudentPos(null);
      }
    };

    try {
      if (id) {
        try {
          const response = await apiClient.rides.get(id);
          const foundRide = response.ride || null;
          setRide(foundRide);
          setRideError(foundRide ? null : "Ride not found.");
          if (isValidLatLng(foundRide?.driverLocation)) {
            setDriverPos(foundRide.driverLocation);
          } else {
            setDriverPos(null);
          }

          if (isValidLatLng(foundRide?.studentLocation)) {
            setStudentPos(foundRide.studentLocation);
          } else {
            setStudentPos(null);
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
    const intervalId = window.setInterval(() => {
      void loadRide();
    }, 5000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadRide]);

  useEffect(() => {
    const socket = getSocketClient();
    const rideIdForRoom = ride?.id || id;

    const onConnect = () => {
      setSocketInfo("Realtime connected");
      if (rideIdForRoom) {
        socket.emit("ride:join", rideIdForRoom);
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
      setRideError(null);

      if (isValidLatLng(updatedRide.driverLocation)) {
        setDriverPos(updatedRide.driverLocation);
      } else {
        setDriverPos(null);
      }

      if (isValidLatLng(updatedRide.studentLocation)) {
        setStudentPos(updatedRide.studentLocation);
      } else {
        setStudentPos(null);
      }
    };

    socket.on("connect", onConnect);
    socket.on("connect_error", onConnectError);
    socket.on("ride:updated", onRideUpdated);

    if (socket.connected) {
      onConnect();
    }

    return () => {
      if (rideIdForRoom) {
        socket.emit("ride:leave", rideIdForRoom);
      }
      socket.off("connect", onConnect);
      socket.off("connect_error", onConnectError);
      socket.off("ride:updated", onRideUpdated);
    };
  }, [id, ride?.id]);

  useEffect(() => {
    if (!isLoaded || typeof window === "undefined" || !window.google?.maps) {
      return;
    }

    const directionsService = new google.maps.DirectionsService();
    if (!pickupPos || !dropPos) {
      setDirections(null);
      return;
    }

    directionsService.route(
      {
        origin: pickupPos,
        destination: dropPos,
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          setDirections(result);
          setRouteError(null);
        } else {
          setRouteError("Could not draw route right now.");
        }
      },
    );
  }, [dropPos, isLoaded, pickupPos]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      async (position) => {
        const current = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };

        setDevicePos(current);
        setGeoError(null);

        const shouldSyncRideGps = Boolean(
          ride?.id
            && (ride.status === "accepted" || ride.status === "in_progress" || ride.status === "ongoing")
            && (user?.role === "driver" || user?.role === "student"),
        );

        if (!shouldSyncRideGps) {
          return;
        }

        const now = Date.now();
        if (now - lastDriverSyncAtRef.current < 5000 || syncingDriverLocationRef.current) {
          return;
        }

        lastDriverSyncAtRef.current = now;
        syncingDriverLocationRef.current = true;

        try {
          await apiClient.rides.updateLocation(ride.id, current.lat, current.lng);
          if (isDriverView) {
            setDriverPos(current);
          } else {
            setStudentPos(current);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "";
          if (message) {
            setGeoError(message);
          } else {
            setSocketInfo("Realtime unavailable, GPS sync retrying");
          }
        } finally {
          syncingDriverLocationRef.current = false;
        }
      },
      () => {
        setGeoError("GPS permission denied or unavailable.");
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 5000 },
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [isDriverView, ride?.id, ride?.status, user?.role]);

  useEffect(() => {
    if (ride?.driverLocation && isValidLatLng(ride.driverLocation) && !isDriverView) {
      setDriverPos(ride.driverLocation);
    }

    if (ride?.studentLocation && isValidLatLng(ride.studentLocation) && isDriverView) {
      setStudentPos(ride.studentLocation);
    }
  }, [isDriverView, ride?.driverLocation, ride?.studentLocation]);

  useEffect(() => {
    if (!mapRef.current || !isLoaded || typeof window === "undefined" || !window.google?.maps) {
      return;
    }

    const bounds = new google.maps.LatLngBounds();
    let hasBounds = false;
    if (pickupPos) {
      bounds.extend(pickupPos);
      hasBounds = true;
    }
    if (dropPos) {
      bounds.extend(dropPos);
      hasBounds = true;
    }
    if (driverPos) {
      bounds.extend(driverPos);
      hasBounds = true;
    }
    if (studentPos) {
      bounds.extend(studentPos);
      hasBounds = true;
    }
    if (!hasBounds) {
      return;
    }
    mapRef.current.fitBounds(bounds, 80);
  }, [driverPos, studentPos, dropPos, isLoaded, pickupPos]);

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="card-glass max-w-lg w-full text-center">
          <h1 className="text-lg font-semibold mb-2">Map failed to load</h1>
          <p className="text-sm text-muted-foreground">Missing VITE_GOOGLE_MAPS_API_KEY in your environment.</p>
        </div>
      </div>
    );
  }

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

  const ownPos = isDriverView ? driverPos : studentPos;
  const counterpartPos = isDriverView ? studentPos : driverPos;
  const counterpartLabel = isDriverView ? "Student" : "Driver";

  const mapCenter = pickupPos || dropPos || ownPos || counterpartPos || CAMPUS_MAP_CENTER;

  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
      <div className="absolute inset-0 z-0">
        {!isLoaded && !loadError && (
          <div className="w-full h-full flex items-center justify-center bg-background">
            <div className="card-glass text-center">
              <p className="text-base font-medium">Loading map...</p>
              <p className="text-xs text-muted-foreground mt-1">Please wait while Google Maps initializes.</p>
            </div>
          </div>
        )}

        {loadError && (
          <div className="w-full h-full flex items-center justify-center bg-background p-6">
            <div className="card-glass text-center max-w-lg">
              <p className="text-base font-semibold">Map failed to load</p>
              <p className="text-sm text-muted-foreground mt-1">Please verify your API key and Maps JavaScript API settings.</p>
            </div>
          </div>
        )}

        {isLoaded && !loadError && (
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            zoom={15}
            center={mapCenter}
            options={mapOptions}
            onLoad={onMapLoad}
          >
            <Polygon paths={CAMPUS_BOUNDARY_POLYGON} options={campusBoundaryOptions} />
            {directions && (
              <DirectionsRenderer
                directions={directions}
                options={{
                  suppressMarkers: true,
                }}
              />
            )}

            {pickupPos && <Marker position={pickupPos} title={`Pickup - ${ride.pickup?.label || "Pickup"}`} />}
            {dropPos && <Marker position={dropPos} title={`Drop - ${ride.drop?.label || "Drop"}`} />}
            {counterpartPos && <Marker position={counterpartPos} title={counterpartLabel} label={isDriverView ? "S" : "D"} />}
            {(ownPos || devicePos) && <Marker position={ownPos || devicePos} title={isDriverView ? "You (Driver)" : "You"} label="Y" />}
          </GoogleMap>
        )}
      </div>

      <div className="relative z-10 p-4 flex items-center justify-between">
        <motion.button
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          whileTap={{ scale: 0.93 }}
          onClick={() => navigate(backPath)}
          className="glass w-10 h-10 rounded-xl flex items-center justify-center text-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </motion.button>

        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass px-4 py-2 rounded-xl flex items-center gap-2"
        >
          <BrandIcon className="w-7 h-7 rounded-lg" />
          <span className="font-bold font-display text-sm">
            Campus<span className="gradient-text">Ride</span>
          </span>
        </motion.div>

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

      {isRideInfoVisible && (
        <div className="relative z-10 mt-auto">
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 22, delay: 0.1 }}
            className="glass rounded-t-3xl p-6 space-y-5"
          >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold uppercase tracking-widest ${(ride?.status === "in_progress" || ride?.status === "ongoing") ? "text-green-400" : "text-blue-400"}`}>
                ● {statusText}
              </span>
            </div>
            <div className="flex flex-col items-end gap-1">
              {ride.status !== "cancelled" && ride.status !== "completed" && Boolean(ride.verificationCode) && (
                <span className="text-[11px] font-bold bg-primary/20 text-primary px-2 py-1 rounded-lg">
                  Code: {ride.verificationCode}
                </span>
              )}
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="w-3.5 h-3.5" />
                <span>ETA {rideEtaText}</span>
              </div>
            </div>
          </div>

          {ride?.isDelayed && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2">
              <p className="text-xs font-semibold text-amber-400">Delay alert</p>
              <p className="text-xs text-muted-foreground mt-0.5">{ride.delayReason || "Your ride is delayed. Please stay on this screen for live updates."}</p>
            </div>
          )}

          <div className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2">
            <p className="text-xs font-semibold mb-2">Ride Timeline</p>
            <div className="space-y-2">
              {(ride?.timeline || []).map((step) => (
                <div key={step.key} className="flex items-start gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full mt-1 ${step.reached ? "bg-primary" : "bg-muted-foreground/40"}`} />
                  <div>
                    <p className={`text-xs ${step.reached ? "text-foreground" : "text-muted-foreground"}`}>{step.label}</p>
                    {step.timestamp && <p className="text-[11px] text-muted-foreground">{new Date(step.timestamp).toLocaleString()}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex flex-col items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <div className="w-0.5 h-6 bg-border" />
              <div className="w-3 h-3 rounded-full bg-destructive" />
            </div>
            <div className="flex flex-col gap-3 flex-1">
              <div>
                <p className="text-xs text-muted-foreground">Pickup</p>
                <p className="text-sm font-semibold">{ride.pickup?.label || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Drop-off</p>
                <p className="text-sm font-semibold">{ride.drop?.label || "—"}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Fare</p>
              <p className="text-base font-bold gradient-text">{typeof ride.fareBreakdown?.totalFare === "number" ? `₹${ride.fareBreakdown.totalFare}` : "—"}</p>
              {typeof ride.etaDistanceKm === "number" && (
                <p className="text-[11px] text-muted-foreground mt-0.5">{ride.etaDistanceKm.toFixed(1)} km left</p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between glass rounded-xl p-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl btn-primary-gradient flex items-center justify-center">
                <User className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <p className="font-semibold text-sm">{contactRoleLabel}: {contactDisplayName}</p>
                <p className="text-xs text-muted-foreground">{contactPhoneRaw}</p>
                <p className="text-xs text-muted-foreground mt-1">Driver: {ride.driver?.name || "Not assigned"}</p>
                <p className="text-xs text-muted-foreground">Student: {ride.student?.name || "Not available"}</p>
              </div>
            </div>
            <div className="flex gap-2">
              {callHref ? (
                <motion.a
                  whileTap={{ scale: 0.92 }}
                  href={callHref}
                  className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center text-primary hover:bg-primary/30 transition-colors"
                  title="Call driver"
                >
                  <Phone className="w-4 h-4" />
                </motion.a>
              ) : (
                <button
                  type="button"
                  disabled
                  className="w-9 h-9 rounded-xl bg-muted/50 flex items-center justify-center text-muted-foreground cursor-not-allowed"
                  title="Call unavailable"
                >
                  <Phone className="w-4 h-4" />
                </button>
              )}
              {chatHref ? (
                <motion.a
                  whileTap={{ scale: 0.92 }}
                  href={chatHref}
                  className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center text-primary hover:bg-primary/30 transition-colors"
                  title="Message driver"
                >
                  <MessageCircle className="w-4 h-4" />
                </motion.a>
              ) : (
                <button
                  type="button"
                  disabled
                  className="w-9 h-9 rounded-xl bg-muted/50 flex items-center justify-center text-muted-foreground cursor-not-allowed"
                  title="Chat unavailable"
                >
                  <MessageCircle className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full inline-block bg-green-500" /> Pickup
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full inline-block bg-primary" /> {counterpartLabel}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full inline-block bg-blue-400" /> You
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full inline-block bg-destructive" /> Drop-off
            </span>
          </div>

          <div className="text-[11px] text-muted-foreground text-center space-y-1">
            <p>
              Tracking route between {ride.pickup?.label || "—"} and {ride.drop?.label || "—"}
              {id ? ` · Ride ${id}` : ""}
            </p>
            {rideError && <p>{rideError}</p>}
            {routeError && <p>{routeError}</p>}
            {geoError && <p>{geoError}</p>}
            {socketInfo && <p>{socketInfo}</p>}
          </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default RideTracking;
