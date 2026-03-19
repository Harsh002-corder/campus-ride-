import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { GoogleMap, Marker, DirectionsRenderer, Polygon, useJsApiLoader } from "@react-google-maps/api";
import { Clock, MapPin, Navigation } from "lucide-react";
import BrandIcon from "@/components/BrandIcon";
import { apiClient, type RideDto } from "@/lib/apiClient";
import { CAMPUS_BOUNDARY_POLYGON, CAMPUS_MAP_CENTER } from "@/lib/campusBoundary";
import { getSocketClient, getSocketConnectErrorMessage } from "@/lib/socketClient";

const GOOGLE_MAPS_API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined)?.trim() || "";
const mapContainerStyle = { width: "100%", height: "100%" };
const libraries: ("places" | "geometry" | "drawing")[] = ["places", "geometry"];
const campusBoundaryOptions: google.maps.PolygonOptions = {
  fillColor: "#10b981",
  fillOpacity: 0.08,
  strokeColor: "#10b981",
  strokeOpacity: 0.65,
  strokeWeight: 2,
  clickable: false,
  zIndex: 1,
};

const isLatLng = (point: unknown): point is { lat: number; lng: number } => {
  if (!point || typeof point !== "object") return false;
  const { lat, lng } = point as { lat?: unknown; lng?: unknown };
  return typeof lat === "number" && Number.isFinite(lat) && typeof lng === "number" && Number.isFinite(lng);
};

const PublicRideTracking = () => {
  const { token = "" } = useParams<{ token: string }>();
  const mapRef = useRef<google.maps.Map | null>(null);
  const [ride, setRide] = useState<RideDto | null>(null);
  const [otp, setOtp] = useState("");
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpBusy, setOtpBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [socketInfo, setSocketInfo] = useState<string | null>(null);
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);

  const pickup = isLatLng(ride?.pickup) ? ride.pickup : null;
  const drop = isLatLng(ride?.drop) ? ride.drop : null;
  const driverPos = isLatLng(ride?.driverLocation) ? ride.driverLocation : null;

  const center = useMemo(() => {
    if (driverPos) return driverPos;
    if (pickup) return pickup;
    return CAMPUS_MAP_CENTER;
  }, [driverPos, pickup]);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries,
  });

  const loadTracking = useCallback(async () => {
    if (!otpVerified) return;

    try {
      const response = await apiClient.public.tracking(token, otp);
      setRide(response.ride || null);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load tracking link");
    }
  }, [otp, otpVerified, token]);

  const verifyOtpAndLoad = useCallback(async () => {
    if (!otp.trim()) {
      setError("Enter tracking OTP to continue");
      return;
    }

    setOtpBusy(true);
    try {
      const response = await apiClient.public.tracking(token, otp);
      setRide(response.ride || null);
      setOtpVerified(true);
      setError(null);
    } catch (loadError) {
      setOtpVerified(false);
      setRide(null);
      setError(loadError instanceof Error ? loadError.message : "Unable to verify tracking OTP");
    } finally {
      setOtpBusy(false);
    }
  }, [otp, token]);

  useEffect(() => {
    if (!token || !otpVerified) return;
    void loadTracking();
  }, [loadTracking, otpVerified, token]);

  useEffect(() => {
    if (!token || !otpVerified) return;

    const socket = getSocketClient(true);
    const onConnect = () => {
      setSocketInfo("Realtime connected");
      socket.emit("ride:join-share", token);
    };

    const onConnectError = (error: unknown) => {
      setSocketInfo(getSocketConnectErrorMessage(error));
    };

    const onTrackingUpdate = (updatedRide: RideDto) => {
      if (!updatedRide?.id) return;
      setRide((prev) => (prev ? { ...prev, ...updatedRide } : updatedRide));
    };

    socket.on("connect", onConnect);
    socket.on("connect_error", onConnectError);
    socket.on("ride:tracking-update", onTrackingUpdate);

    if (socket.connected) {
      onConnect();
    }

    return () => {
      socket.emit("ride:leave-share", token);
      socket.off("connect", onConnect);
      socket.off("connect_error", onConnectError);
      socket.off("ride:tracking-update", onTrackingUpdate);
    };
  }, [otpVerified, token]);

  useEffect(() => {
    if (!isLoaded || !pickup || !drop || typeof window === "undefined" || !window.google?.maps) {
      return;
    }

    const service = new google.maps.DirectionsService();
    service.route(
      {
        origin: pickup,
        destination: drop,
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          setDirections(result);
        }
      },
    );
  }, [drop, isLoaded, pickup]);

  useEffect(() => {
    if (!mapRef.current || !pickup || !drop) return;
    const bounds = new google.maps.LatLngBounds();
    bounds.extend(pickup);
    bounds.extend(drop);
    if (driverPos) bounds.extend(driverPos);
    mapRef.current.fitBounds(bounds, 70);
  }, [pickup, drop, driverPos]);

  if (!GOOGLE_MAPS_API_KEY) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Google Maps key missing</div>;
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="absolute inset-0 [background:var(--gradient-hero)]" />
      <div className="relative z-10 max-w-6xl mx-auto p-3 sm:p-4 md:p-6 space-y-4">
        <div className="glass rounded-2xl px-3 sm:px-4 py-3 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <BrandIcon className="w-8 h-8" />
            <div>
              <p className="font-semibold">CampusRide Live Tracking</p>
              <p className="text-xs text-muted-foreground">Public secure link</p>
            </div>
          </div>
          <span className={`text-xs px-2 py-1 rounded-full ${(ride?.status === "in_progress" || ride?.status === "ongoing") ? "bg-green-500/20 text-green-400" : "bg-primary/20 text-primary"}`}>
            {ride?.status || "pending"}
          </span>
        </div>

        {error && <div className="glass rounded-xl px-4 py-3 text-sm text-destructive">{error}</div>}
        {socketInfo && <div className="glass rounded-xl px-4 py-3 text-sm text-muted-foreground">{socketInfo}</div>}

        {!otpVerified && (
          <div className="glass rounded-2xl p-4 sm:p-5 space-y-3">
            <p className="text-sm font-semibold">Enter Ride OTP</p>
            <p className="text-xs text-muted-foreground">Tracking is protected. Ask the rider for the OTP code.</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={otp}
                onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                maxLength={6}
                placeholder="Enter OTP"
                className="w-full bg-muted/50 border border-border rounded-xl py-2.5 px-3 text-sm"
              />
              <button
                type="button"
                onClick={() => void verifyOtpAndLoad()}
                disabled={otpBusy}
                className="btn-primary-gradient px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-60"
              >
                {otpBusy ? "Verifying..." : "Verify OTP"}
              </button>
            </div>
          </div>
        )}

        <div className={`grid lg:grid-cols-3 gap-4 ${!otpVerified ? "opacity-60 pointer-events-none" : ""}`}>
          <div className="lg:col-span-2 h-[55vh] min-h-[300px] max-h-[520px] glass rounded-2xl overflow-hidden">
            {isLoaded && (
              <GoogleMap
                mapContainerStyle={mapContainerStyle}
                center={center}
                zoom={15}
                onLoad={(map) => {
                  mapRef.current = map;
                }}
                options={{ disableDefaultUI: true, zoomControl: true, fullscreenControl: true }}
              >
                <Polygon paths={CAMPUS_BOUNDARY_POLYGON} options={campusBoundaryOptions} />
                {directions && <DirectionsRenderer directions={directions} options={{ suppressMarkers: true }} />}
                {pickup && <Marker position={pickup} title={ride?.pickup?.label || "Pickup"} />}
                {drop && <Marker position={drop} title={ride?.drop?.label || "Drop"} />}
                {driverPos && <Marker position={driverPos} title="Driver" />}
              </GoogleMap>
            )}
          </div>

          <div className="glass rounded-2xl p-3 sm:p-4 space-y-4">
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
              <p className="text-sm font-semibold">Route</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {ride?.pickup?.label || "—"}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Navigation className="w-3.5 h-3.5" /> {ride?.drop?.label || "—"}</p>
            </motion.div>

            <div className="rounded-xl bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">ETA</p>
              <p className="font-semibold text-sm flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {typeof ride?.etaMinutes === "number" ? `${ride.etaMinutes} min` : "Calculating..."}</p>
              {typeof ride?.etaDistanceKm === "number" && <p className="text-xs text-muted-foreground mt-1">Distance left: {ride.etaDistanceKm.toFixed(1)} km</p>}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold">Timeline</p>
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

            {ride?.isDelayed && <p className="text-xs text-amber-400 bg-amber-500/10 rounded-lg px-2 py-1">{ride.delayReason || "Delay detected"}</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublicRideTracking;
