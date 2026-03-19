import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useAppToast } from "@/hooks/use-app-toast";
import { useCountUp } from "@/hooks/useCountUp";
import PageTransition from "@/components/PageTransition";
import RideHistoryTabs from "@/components/ride/RideHistoryTabs";
import RideCompletionPopup from "@/components/ride/RideCompletionPopup";
import StopTypeahead from "@/components/ride/StopTypeahead";
import ProfileDialog from "@/components/ProfileDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import BrandIcon from "@/components/BrandIcon";
import NotificationBell from "@/components/NotificationBell";
import { apiClient, type AuthUser, type FavoriteLocation, type RideDto, type RideIssueDto } from "@/lib/apiClient";
import { CAMPUS_BOUNDARY_POLYGON, getDistanceMeters, pointInPolygon } from "@/lib/campusBoundary";
import { CAMPUS_STOPS, type CampusStop } from "@/lib/stops";
import { getSocketClient } from "@/lib/socketClient";
import { API_BASE_URL } from "@/config/api";
import {
  MapPin, Clock, LogOut, Navigation,
  Calendar, CreditCard, Shield, ChevronRight, Search, Map as MapIcon,
  ArrowUpDown, Users, XCircle, Phone, MessageCircle, UserCircle2,
} from "lucide-react";

const toPhoneDigits = (value?: string | null) => (value || "").replace(/\D/g, "");

const toNumber = (value: unknown, fallback: number) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

type GpsVerificationState = {
  state: "idle" | "checking" | "verified" | "failed";
  message: string;
};

type TrackRideSplashState = {
  open: boolean;
  targetPath: string;
  pickupLabel: string;
  dropLabel: string;
  statusLabel: string;
  driverName: string;
};

// Removed 200m pickup distance enforcement
const COARSE_GPS_ACCURACY_THRESHOLD_METERS = 1200;
// TODO: set back to false before going live
const SKIP_GPS_VERIFICATION = false;

function resolveStop(value: string, selectedStop: CampusStop | null, stops: CampusStop[]) {
  if (selectedStop && selectedStop.name === value) {
    return selectedStop;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  return stops.find((stop) => stop.name.toLowerCase() === normalized) || null;
}

function normalizeStops(value: unknown, fallback: CampusStop[]): CampusStop[] {
  if (!Array.isArray(value)) return fallback;
  const rows = value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const name = String((item as { name?: unknown }).name || "").trim();
      const lat = Number((item as { lat?: unknown }).lat);
      const lng = Number((item as { lng?: unknown }).lng);
      if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return { name, lat, lng };
    })
    .filter(Boolean) as CampusStop[];

  return rows.length > 0 ? rows : fallback;
}

function normalizeBoundary(value: unknown, fallback = CAMPUS_BOUNDARY_POLYGON) {
  if (!Array.isArray(value)) return fallback;

  const rows = value
    .map((point) => {
      if (Array.isArray(point) && point.length >= 2) {
        const lat = Number(point[0]);
        const lng = Number(point[1]);
        if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
      }

      if (point && typeof point === "object") {
        const lat = Number((point as { lat?: unknown }).lat);
        const lng = Number((point as { lng?: unknown }).lng);
        if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
      }

      return null;
    })
    .filter(Boolean) as Array<{ lat: number; lng: number }>;

  if (rows.length < 3) return fallback;
  return rows;
}

function isWithinBoundary(point: { lat: number; lng: number }, polygon: Array<{ lat: number; lng: number }>) {
  if (!point || !Array.isArray(polygon) || polygon.length < 3) return false;
  const latitudes = polygon.map((item) => item.lat);
  const longitudes = polygon.map((item) => item.lng);
  const insideBounds = point.lat >= Math.min(...latitudes)
    && point.lat <= Math.max(...latitudes)
    && point.lng >= Math.min(...longitudes)
    && point.lng <= Math.max(...longitudes);
  return insideBounds && pointInPolygon(point, polygon);
}

function getCurrentPosition(): Promise<{ lat: number; lng: number; accuracy: number | null }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported on this device."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
        });
      },
      (error) => {
        reject(new Error(error.message || "Unable to get your current location."));
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 5000 },
    );
  });
}

const StudentDashboard = () => {
  const { user, logout, login } = useAuth();
  const toast = useAppToast();
  const navigate = useNavigate();
  const [pickup, setPickup] = useState("");
  const [drop, setDrop] = useState("");
  const [pickupStop, setPickupStop] = useState<CampusStop | null>(null);
  const [dropStop, setDropStop] = useState<CampusStop | null>(null);
  const [booking, setBooking] = useState(false);
  const [rides, setRides] = useState<RideDto[]>([]);
  const [passengers, setPassengers] = useState(1);
  const [passengerNamesText, setPassengerNamesText] = useState("");
  const [splitFare, setSplitFare] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [activeRide, setActiveRide] = useState<RideDto | null>(null);
  const [showCompletionPopup, setShowCompletionPopup] = useState(false);
  const [feedbackRide, setFeedbackRide] = useState<RideDto | null>(null);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [rideBookingEnabled, setRideBookingEnabled] = useState(true);
  const [rideMaxPassengers, setRideMaxPassengers] = useState(4);
  const [rideSupportPhone, setRideSupportPhone] = useState("+91 90000 00000");
  const [rideSecurityPhone, setRideSecurityPhone] = useState("+91 100");
  const [rideAmbulancePhone, setRideAmbulancePhone] = useState("+91 108");
  const [runtimeStops, setRuntimeStops] = useState<CampusStop[]>(CAMPUS_STOPS);
  const [campusBoundary, setCampusBoundary] = useState(CAMPUS_BOUNDARY_POLYGON);
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [outsideCampusAlertOpen, setOutsideCampusAlertOpen] = useState(false);
  const [cancelReasonKey, setCancelReasonKey] = useState("change_of_plans");
  const [cancelCustomReason, setCancelCustomReason] = useState("");
  const [issueRideId, setIssueRideId] = useState("");
  const [issueCategory, setIssueCategory] = useState<RideIssueDto["category"]>("route_issue");
  const [issueDescription, setIssueDescription] = useState("");
  const [submittingIssue, setSubmittingIssue] = useState(false);
  const [trackRideSplash, setTrackRideSplash] = useState<TrackRideSplashState>({
    open: false,
    targetPath: "",
    pickupLabel: "Pickup",
    dropLabel: "Drop-off",
    statusLabel: "Tracking",
    driverName: "Driver",
  });
  const [gpsVerification, setGpsVerification] = useState<GpsVerificationState>({
    state: "idle",
    message: "Select pickup to verify GPS",
  });
  const [favorites, setFavorites] = useState<FavoriteLocation[]>([]);
  const [recentLocations, setRecentLocations] = useState<Array<{ name: string; lat: number; lng: number }>>([]);
  const trackRideTimeoutRef = useRef<number | null>(null);
  const logoutTimeoutRef = useRef<number | null>(null);
  const [logoutTransitionOpen, setLogoutTransitionOpen] = useState(false);

  const cancellationReasons = [
    { key: "driver_delayed", label: "Driver delayed" },
    { key: "change_of_plans", label: "Change of plans" },
    { key: "emergency", label: "Emergency" },
    { key: "wrong_booking", label: "Wrong booking" },
    { key: "personal_reason", label: "Personal reason" },
    { key: "other", label: "Other" },
  ];

  const issueCategories: Array<{ key: RideIssueDto["category"]; label: string }> = [
    { key: "overcharge", label: "Overcharge" },
    { key: "driver_behavior", label: "Driver behavior" },
    { key: "route_issue", label: "Route issue" },
    { key: "safety", label: "Safety concern" },
    { key: "app_issue", label: "App issue" },
    { key: "other", label: "Other" },
  ];

  const loadRideSettings = useCallback(async () => {
    try {
      const response = await apiClient.settings.list() as { settings?: Array<{ key: string; value: unknown }> };
      const settingsMap = new Map((response.settings || []).map((item) => [item.key, item.value]));

      const bookingSetting = settingsMap.get("ride_booking_enabled");
      const maxPassengersSetting = settingsMap.get("ride_max_passengers");
      const supportPhoneSetting = settingsMap.get("ride_support_phone");
      const securityPhoneSetting = settingsMap.get("ride_security_phone");
      const ambulancePhoneSetting = settingsMap.get("ride_ambulance_phone");
      const stopsSetting = settingsMap.get("ride_pickup_drop_stops");
      const boundarySetting = settingsMap.get("ride_campus_boundary_polygon");

      setRideBookingEnabled(bookingSetting === undefined ? true : bookingSetting === true || String(bookingSetting).toLowerCase() === "true");
      setRideMaxPassengers(Math.max(1, Math.min(6, toNumber(maxPassengersSetting, 4))));
      setRideSupportPhone(String(supportPhoneSetting || "+91 90000 00000"));
      setRideSecurityPhone(String(securityPhoneSetting || "+91 100"));
      setRideAmbulancePhone(String(ambulancePhoneSetting || "+91 108"));
      setRuntimeStops(normalizeStops(stopsSetting, CAMPUS_STOPS));
      setCampusBoundary(normalizeBoundary(boundarySetting, CAMPUS_BOUNDARY_POLYGON));
    } catch {
      setRideBookingEnabled(true);
      setRideMaxPassengers(4);
      setRideSupportPhone("+91 90000 00000");
      setRideSecurityPhone("+91 100");
      setRideAmbulancePhone("+91 108");
      setRuntimeStops(CAMPUS_STOPS);
      setCampusBoundary(CAMPUS_BOUNDARY_POLYGON);
    }
  }, []);

  const loadFavorites = useCallback(async () => {
    try {
      const { favorites: favs } = await apiClient.users.favorites();
      setFavorites(favs ?? []);
    } catch {
      // silently ignore — favorites are non-critical
    }
  }, []);

  const loadMyRides = useCallback(async () => {
    try {
      const response = await apiClient.rides.my();
      const allRides = response.rides || [];
      setRides(allRides);
      const active = allRides.find((ride) => ["scheduled", "accepted", "in_progress", "pending", "ongoing", "requested"].includes(ride.status));
      setActiveRide(active || null);

      const pendingFeedbackRide = allRides.find((ride) => ride.status === "completed" && !ride.studentRating);
      if (pendingFeedbackRide) {
        setFeedbackRide(pendingFeedbackRide);
        setShowCompletionPopup(true);
      }
    } catch (error) {
      toast.error("Unable to load your rides", error, "Please refresh and try again.");
    }
  }, [toast]);

  useEffect(() => {
    void loadMyRides();
  }, [loadMyRides]);

  useEffect(() => {
    void loadRideSettings();
  }, [loadRideSettings]);

  useEffect(() => {
    void loadFavorites();
  }, [loadFavorites]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("campusride_recent");
      if (stored) setRecentLocations(JSON.parse(stored) as Array<{ name: string; lat: number; lng: number }>);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    setPassengers((prev) => Math.min(prev, rideMaxPassengers));
  }, [rideMaxPassengers]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void loadMyRides();
    }, 5000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadMyRides]);

  useEffect(() => {
    const socket = getSocketClient();

    const onRideUpdated = (updatedRide: RideDto) => {
      if (!updatedRide?.id) {
        void loadMyRides();
        return;
      }

      if (!user?.id || updatedRide.studentId !== user.id) {
        return;
      }

      setRides((prev) => {
        const exists = prev.some((ride) => ride.id === updatedRide.id);
        const next = exists
          ? prev.map((ride) => (ride.id === updatedRide.id ? updatedRide : ride))
          : [updatedRide, ...prev];

        const nextActive = next.find((ride) => ["scheduled", "accepted", "in_progress", "pending", "ongoing", "requested"].includes(ride.status));
        setActiveRide(nextActive || null);

        const pendingFeedbackRide = next.find((ride) => ride.status === "completed" && !ride.studentRating);
        if (pendingFeedbackRide) {
          setFeedbackRide(pendingFeedbackRide);
          setShowCompletionPopup(true);
        }

        return next;
      });
    };

    socket.on("ride:updated", onRideUpdated);

    return () => {
      socket.off("ride:updated", onRideUpdated);
    };
  }, [loadMyRides, user?.id]);

  useEffect(() => () => {
    if (trackRideTimeoutRef.current) {
      window.clearTimeout(trackRideTimeoutRef.current);
    }
    if (logoutTimeoutRef.current) {
      window.clearTimeout(logoutTimeoutRef.current);
    }
  }, []);

  const rideStats = useMemo(() => {
    const total = rides.length;
    const completed = rides.filter((ride) => ride.status === "completed").length;
    const cancelled = rides.filter((ride) => ride.status === "cancelled").length;
    const active = rides.filter((ride) => ["scheduled", "pending", "accepted", "in_progress", "requested", "ongoing"].includes(ride.status)).length;

    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    const cancellationRate = total > 0 ? Math.round((cancelled / total) * 100) : 0;

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const thisMonth = rides.filter((ride) => {
      const createdAt = new Date(ride.createdAt);
      return createdAt.getMonth() === currentMonth && createdAt.getFullYear() === currentYear;
    }).length;

    return { total, completed, cancelled, active, completionRate, cancellationRate, thisMonth };
  }, [rides]);

  const issueEligibleRides = useMemo(
    () => rides.filter((ride) => ["completed", "cancelled"].includes(ride.status)).slice(0, 40),
    [rides],
  );

  const animatedTotal = useCountUp(rideStats.total, 900, true);
  const animatedCompleted = useCountUp(rideStats.completed, 900, true);
  const animatedCancelled = useCountUp(rideStats.cancelled, 900, true);
  const animatedActive = useCountUp(rideStats.active, 900, true);
  const animatedCompletionRate = useCountUp(rideStats.completionRate, 900, true);
  const animatedCancellationRate = useCountUp(rideStats.cancellationRate, 900, true);

  const quickActions = [
    { icon: MapPin, label: "Book a Ride", desc: "Find your next campus ride", gradient: true },
    { icon: Clock, label: "Ride History", desc: `${rideStats.total} rides`, gradient: false },
    { icon: Navigation, label: "Active", desc: `${rideStats.active} pending/in-progress`, gradient: false },
    { icon: CreditCard, label: "Completed", desc: `${rideStats.completed} completed`, gradient: false },
    { icon: Calendar, label: "Cancelled", desc: `${rideStats.cancelled} cancelled`, gradient: false },
    { icon: Shield, label: "Safety", desc: "Emergency contacts", gradient: false },
  ];

  const tapSoft = {
    whileTap: { scale: 0.97 },
    transition: { duration: 0.12 },
  };

  const tapSnap = {
    whileTap: { scale: 0.93 },
  };

  const playTrackRideSplash = useCallback((targetPath: string, ride?: RideDto | null) => {
    if (trackRideTimeoutRef.current) {
      window.clearTimeout(trackRideTimeoutRef.current);
    }

    setTrackRideSplash({
      open: true,
      targetPath,
      pickupLabel: ride?.pickup?.label || "Campus pickup",
      dropLabel: ride?.drop?.label || "Campus destination",
      statusLabel: ride?.status ? ride.status.replace(/_/g, " ") : "Tracking",
      driverName: ride?.driver?.name || "Assigned driver",
    });

    trackRideTimeoutRef.current = window.setTimeout(() => {
      setTrackRideSplash((prev) => ({ ...prev, open: false, targetPath: "" }));
      navigate(targetPath);
    }, 1150);
  }, [navigate]);

  const handleQuickAction = (label: string) => {
    if (label === "Book a Ride") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (label === "Ride History") {
      navigate("/rides", { state: { tab: "all" } });
      return;
    }

    if (label === "Active") {
      if (activeRide && ["scheduled", "pending", "accepted", "in_progress", "requested", "ongoing"].includes(activeRide.status)) {
        playTrackRideSplash(activeRide.id ? `/ride-tracking/${activeRide.id}` : "/ride-tracking", activeRide);
      } else {
        toast.info("No active ride", "You don’t have an ongoing ride right now.");
      }
      return;
    }

    if (label === "Completed") {
      navigate("/rides", { state: { tab: "completed" } });
      return;
    }

    if (label === "Cancelled") {
      navigate("/rides", { state: { tab: "cancelled" } });
      return;
    }

    if (label === "Safety") {
      setEmergencyOpen(true);
      return;
    }
  };

  const handleSwapLocations = () => {
    setPickup(drop);
    setDrop(pickup);
    setPickupStop(dropStop);
    setDropStop(pickupStop);
    setGpsVerification({ state: "idle", message: "Select pickup to verify GPS" });
  };

  const handleFindRide = async () => {
    if (!rideBookingEnabled) {
      toast.info("Ride booking disabled", "Admin has temporarily paused ride booking.");
      return;
    }

    const resolvedPickup = resolveStop(pickup, pickupStop, runtimeStops);
    const resolvedDrop = resolveStop(drop, dropStop, runtimeStops);

    if (!resolvedPickup || !resolvedDrop) {
      setGpsVerification({ state: "failed", message: "Select pickup and drop first" });
      toast.info("Select valid stops", "Choose pickup and drop-off from stop suggestions.");
      return;
    }

    if (!SKIP_GPS_VERIFICATION && !isWithinBoundary({ lat: resolvedPickup.lat, lng: resolvedPickup.lng }, campusBoundary)) {
      setGpsVerification({ state: "failed", message: "Pickup outside campus boundary" });
      setOutsideCampusAlertOpen(true);
      return;
    }

    if (resolvedPickup.lat === resolvedDrop.lat && resolvedPickup.lng === resolvedDrop.lng) {
      setGpsVerification({ state: "failed", message: "Pickup and drop cannot be the same" });
      toast.info("Invalid route", "Pickup and drop locations cannot be the same.");
      return;
    }

    let gpsLocation: { lat: number; lng: number; accuracy: number | null };

    if (SKIP_GPS_VERIFICATION) {
      // GPS check disabled for testing — use pickup stop coords as fake GPS
      gpsLocation = { lat: resolvedPickup.lat, lng: resolvedPickup.lng, accuracy: null };
      setGpsVerification({ state: "verified", message: "GPS check bypassed (test mode)" });
    } else {
      setGpsVerification({ state: "checking", message: "Verifying pickup with GPS..." });
      try {
        gpsLocation = await getCurrentPosition();
      } catch (error) {
        setGpsVerification({ state: "failed", message: "GPS access required for booking" });
        toast.error("Unable to verify your location", error, "Enable location access to book rides.");
        return;
      }

      const isCoarseGps = !Number.isFinite(gpsLocation.accuracy || NaN)
        || (gpsLocation.accuracy || 0) > COARSE_GPS_ACCURACY_THRESHOLD_METERS;

      if (!isWithinBoundary({ lat: gpsLocation.lat, lng: gpsLocation.lng }, campusBoundary) && !isCoarseGps) {
        setGpsVerification({ state: "failed", message: "Your current GPS is outside campus" });
        setOutsideCampusAlertOpen(true);
        return;
      }

      // 200m pickup distance check permanently removed; any pickup allowed

      setGpsVerification({
        state: "verified",
        message: isCoarseGps
          ? "Low GPS accuracy detected; pickup stop verification accepted"
          : `GPS verified`,
      });

      if (isCoarseGps) {
        toast.info("Low GPS accuracy", "Proceeding with selected pickup stop because device GPS is coarse.");
      }
    }

    const passengerNames = passengerNamesText
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean)
      .slice(0, passengers);

    setBooking(true);
    try {
      const response = await apiClient.rides.book({
        pickup: { lat: resolvedPickup.lat, lng: resolvedPickup.lng, label: resolvedPickup.name || pickup },
        drop: { lat: resolvedDrop.lat, lng: resolvedDrop.lng, label: resolvedDrop.name || drop },
        studentGps: { lat: gpsLocation.lat, lng: gpsLocation.lng, accuracy: gpsLocation.accuracy || undefined },
        passengers,
        passengerNames,
        splitFare,
        scheduledAt: scheduledAt || undefined,
      });

      toast.success(
        response.ride.status === "scheduled" ? "Ride scheduled successfully" : "Ride requested successfully",
        response.ride.status === "scheduled"
          ? `Scheduled for ${new Date(response.ride.scheduledFor || response.ride.createdAt).toLocaleString()}`
          : `Share verification code ${response.ride.verificationCode} with your driver.`,
      );
      await loadMyRides();
    } catch (error) {
      toast.error("Could not request ride", error);
    } finally {
      setBooking(false);
    }
  };

  const handleReverifyGps = async () => {
    const resolvedPickup = resolveStop(pickup, pickupStop, runtimeStops);

    if (!resolvedPickup) {
      setGpsVerification({ state: "failed", message: "Select pickup first" });
      toast.info("Select pickup location", "Choose a pickup point before GPS verification.");
      return;
    }

    setGpsVerification({ state: "checking", message: "Verifying pickup with GPS..." });

    let gpsLocation: { lat: number; lng: number; accuracy: number | null };
    try {
      gpsLocation = await getCurrentPosition();
    } catch (error) {
      setGpsVerification({ state: "failed", message: "GPS access required for booking" });
      toast.error("Unable to verify your location", error, "Enable location access to book rides.");
      return;
    }

    const isCoarseGps = !Number.isFinite(gpsLocation.accuracy || NaN)
      || (gpsLocation.accuracy || 0) > COARSE_GPS_ACCURACY_THRESHOLD_METERS;

    if (!isWithinBoundary({ lat: gpsLocation.lat, lng: gpsLocation.lng }, campusBoundary) && !isCoarseGps) {
      setGpsVerification({ state: "failed", message: "Your current GPS is outside campus" });
      setOutsideCampusAlertOpen(true);
      return;
    }

    // 200m pickup distance check permanently removed; any pickup allowed

    setGpsVerification({
      state: "verified",
      message: isCoarseGps
        ? "Low GPS accuracy detected; pickup stop verification accepted"
        : `GPS verified`,
    });
    if (isCoarseGps) {
      toast.info("Low GPS accuracy", "Proceeding with selected pickup stop because device GPS is coarse.");
      return;
    }
  };

  const handleShareTracking = async (trackingUrl?: string | null) => {
    if (!trackingUrl) {
      toast.info("Tracking link unavailable", "Live sharing link is not available for this ride yet.");
      return;
    }

    try {
      await navigator.clipboard.writeText(trackingUrl);
      toast.success("Tracking link copied", "Share this link for live ride tracking.");
    } catch {
      toast.info("Copy failed", "Please copy the tracking link manually.");
    }
  };

  const addToRecent = useCallback((stop: CampusStop) => {
    setRecentLocations((prev) => {
      const filtered = prev.filter((r) => r.name !== stop.name);
      const next = [{ name: stop.name, lat: stop.lat, lng: stop.lng }, ...filtered].slice(0, 5);
      try { localStorage.setItem("campusride_recent", JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const applyFavorite = useCallback((fav: FavoriteLocation, type: "pickup" | "drop") => {
    const stop = runtimeStops.find(
      (s) => Math.abs(s.lat - fav.location.lat) < 0.0001 && Math.abs(s.lng - fav.location.lng) < 0.0001,
    ) ?? { name: fav.location.address ?? fav.label, lat: fav.location.lat, lng: fav.location.lng };
    if (type === "pickup") {
      setPickup(stop.name);
      setPickupStop(stop);
      setGpsVerification({ state: "idle", message: "Press Find Ride to verify GPS" });
    } else {
      setDrop(stop.name);
      setDropStop(stop);
    }
    toast.info(`Set as ${type}`, `${fav.label} selected.`);
  }, [runtimeStops, toast]);

  const deleteFavoriteById = useCallback(async (favId: string) => {
    try {
      await apiClient.users.deleteFavorite(favId);
      setFavorites((prev) => prev.filter((f) => f.id !== favId));
      toast.info("Removed from favorites", "");
    } catch (error) {
      toast.error("Could not remove favorite", error);
    }
  }, [toast]);

  const saveCurrentAsFavorite = async (type: "pickup" | "drop") => {
    const point = type === "pickup"
      ? resolveStop(pickup, pickupStop, runtimeStops)
      : resolveStop(drop, dropStop, runtimeStops);
    if (!point) {
      toast.info("Select a location first", `Choose a ${type} location before saving as favorite.`);
      return;
    }

    const label = (type === "pickup" ? pickup : drop) || point.name;

    try {
      await apiClient.users.addFavorite({
        label: label.trim(),
        location: {
          lat: point.lat,
          lng: point.lng,
          address: point.name,
        },
      });
      toast.success("Favorite saved", `${label.trim()} saved to your places.`);
      await loadFavorites();
    } catch (error) {
      toast.error("Could not save favorite", error);
    }
  };

  const handleCancelRide = async () => {
    if (!activeRide) return;
    try {
      await apiClient.rides.cancel(activeRide.id, {
        reasonKey: cancelReasonKey,
        customReason: cancelReasonKey === "other" ? cancelCustomReason : undefined,
      });
      toast.success("Ride cancelled", "Your cancellation has been recorded.");
      await loadMyRides();
    } catch (error) {
      toast.error("Could not cancel ride", error);
    }
  };

  const handleSubmitIssue = async () => {
    if (!issueRideId) {
      toast.info("Select a ride", "Choose a completed/cancelled ride to report an issue.");
      return;
    }
    if (issueDescription.trim().length < 8) {
      toast.info("Issue details required", "Please describe your issue in at least 8 characters.");
      return;
    }

    setSubmittingIssue(true);
    try {
      await apiClient.issues.create({
        rideId: issueRideId,
        category: issueCategory,
        description: issueDescription.trim(),
      });
      toast.success("Issue submitted", "Admin team has received your complaint.");
      setIssueDescription("");
      setIssueCategory("route_issue");
      setIssueRideId("");
    } catch (error) {
      toast.error("Could not submit issue", error);
    } finally {
      setSubmittingIssue(false);
    }
  };

  const handleLogout = () => {
    if (logoutTimeoutRef.current) {
      window.clearTimeout(logoutTimeoutRef.current);
    }

    setLogoutTransitionOpen(true);
    logoutTimeoutRef.current = window.setTimeout(() => {
      setLogoutTransitionOpen(false);
      logout();
      navigate("/", { replace: true });
      window.location.assign("/");
    }, 900);
  };

  const card = (i: number) => ({
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: 0.1 + i * 0.06 },
  });

  const activeDriverName = activeRide?.driver?.name || "Demo Driver";
  const activeDriverPhoneRaw = activeRide?.driver?.phone || "+91 90000 00000";
  const activeDriverPhoneDigits = toPhoneDigits(activeDriverPhoneRaw);
  const canContactDriver = activeDriverPhoneDigits.length >= 10;
  const callDriverHref = canContactDriver ? `tel:${activeDriverPhoneDigits}` : undefined;
  const chatDriverHref = canContactDriver
    ? `sms:${activeDriverPhoneDigits}?body=${encodeURIComponent(`Hi ${activeDriverName}, I am your student rider.`)}`
    : undefined;

  const supportDigits = toPhoneDigits(rideSupportPhone);
  const supportCallHref = supportDigits.length >= 10 ? `tel:${supportDigits}` : undefined;
  const securityDigits = toPhoneDigits(rideSecurityPhone);
  const securityCallHref = securityDigits.length >= 3 ? `tel:${securityDigits}` : undefined;
  const ambulanceDigits = toPhoneDigits(rideAmbulancePhone);
  const ambulanceCallHref = ambulanceDigits.length >= 3 ? `tel:${ambulanceDigits}` : undefined;

  return (
    <PageTransition>
      <div className="min-h-screen bg-background relative overflow-hidden">
        <div className="absolute inset-0 [background:var(--gradient-hero)]" />
        <div className="absolute top-1/4 right-1/4 w-[min(60vw,400px)] h-[min(60vw,400px)] rounded-full opacity-10 animate-pulse-glow [background:var(--gradient-glow)]" />

        <div className="relative z-10">
          {/* Navbar */}
          <nav className="glass py-3 sm:py-4 px-3 sm:px-6 sticky top-0 z-20">
            <div className="container mx-auto flex items-center justify-between gap-2 flex-wrap">
              <a href="/" className="flex items-center gap-2">
                <BrandIcon className="w-9 h-9" />
                <span className="text-base sm:text-xl font-bold font-display">
                  Campus<span className="gradient-text">Ride</span>
                </span>
              </a>
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end">
                <NotificationBell />
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setProfileDialogOpen(true)}
                  className="w-9 h-9 rounded-full overflow-hidden bg-muted/50 hover:bg-muted border border-border transition-colors flex items-center justify-center"
                  title="Edit profile"
                >
                  {user?.avatarUrl ? (
                    <img src={user.avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <UserCircle2 className="w-5 h-5 text-muted-foreground" />
                  )}
                </motion.button>
                <span className="text-sm text-muted-foreground hidden sm:block">
                  Hey, <span className="text-foreground font-medium">{user?.name}</span>
                </span>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleLogout}
                  disabled={logoutTransitionOpen}
                  className="btn-outline-glow px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm flex items-center gap-2 disabled:opacity-70"
                >
                  <LogOut className="w-4 h-4" /> {logoutTransitionOpen ? "Logging out..." : "Logout"}
                </motion.button>
              </div>
            </div>
          </nav>

          <div className="container mx-auto px-3 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">
            {/* Welcome + Booking */}
            <div className="grid lg:grid-cols-5 gap-6">
              <motion.div {...card(0)} className="lg:col-span-3 card-glass">
                <h1 className="text-2xl md:text-3xl font-bold font-display mb-1">
                  Welcome back, <span className="gradient-text">{user?.name}</span> 👋
                </h1>
                <p className="text-muted-foreground text-sm mb-6">Where are you heading today?</p>

                <div className="flex flex-col gap-3">
                  <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                    <StopTypeahead
                      placeholder="Pickup location"
                      value={pickup}
                      onChange={(value) => {
                        setPickup(value);
                        if (pickupStop?.name !== value) {
                          setPickupStop(null);
                          setGpsVerification({ state: "idle", message: "Select pickup to verify GPS" });
                        }
                      }}
                      onSelect={(stop) => {
                        setPickupStop(stop);
                        setGpsVerification({ state: "idle", message: "Press Find Ride to verify GPS" });
                        addToRecent(stop);
                      }}
                      stops={runtimeStops}
                      minChars={2}
                      maxResults={8}
                      debounceMs={300}
                      remoteEndpoint={import.meta.env.VITE_USE_REMOTE_STOP_SUGGEST === "true" ? `${API_BASE_URL}/stops/suggest` : undefined}
                      icon={<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />}
                    />
                    {/* Swap button */}
                    <motion.button
                      whileTap={{ scale: 0.9, rotate: 180 }}
                      onClick={handleSwapLocations}
                      className="p-2 rounded-lg bg-primary/20 hover:bg-primary/30 text-primary transition-colors shrink-0 sm:self-center self-center"
                      title="Swap locations"
                    >
                      <ArrowUpDown className="w-3.5 h-3.5" />
                    </motion.button>
                    <StopTypeahead
                      placeholder="Drop-off location"
                      value={drop}
                      onChange={(value) => {
                        setDrop(value);
                        if (dropStop?.name !== value) {
                          setDropStop(null);
                        }
                      }}
                      onSelect={(stop) => {
                        setDropStop(stop);
                        addToRecent(stop);
                      }}
                      stops={runtimeStops}
                      minChars={2}
                      maxResults={8}
                      debounceMs={300}
                      remoteEndpoint={import.meta.env.VITE_USE_REMOTE_STOP_SUGGEST === "true" ? `${API_BASE_URL}/stops/suggest` : undefined}
                      icon={<Navigation className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />}
                    />
                  </div>

                  {/* Favorites & Recent quick-access chips */}
                  {(favorites.length > 0 || recentLocations.length > 0) && (
                    <div className="space-y-2">
                      {favorites.length > 0 && (
                        <div>
                          <p className="text-[11px] font-semibold text-muted-foreground mb-1.5">⭐ Saved Places</p>
                          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                            {favorites.map((fav) => (
                              <div key={fav.id} className="flex items-center bg-primary/10 border border-primary/20 rounded-full shrink-0 overflow-hidden">
                                <span className="text-xs text-primary font-medium pl-2.5 pr-1 py-1.5 max-w-[88px] truncate">{fav.label}</span>
                                <motion.button
                                  {...tapSoft}
                                  onClick={() => applyFavorite(fav, "pickup")}
                                  className="text-[11px] text-primary/80 hover:bg-primary/20 px-1.5 py-1.5 transition-colors font-bold leading-none"
                                  title="Set as pickup"
                                >↑</motion.button>
                                <motion.button
                                  {...tapSoft}
                                  onClick={() => applyFavorite(fav, "drop")}
                                  className="text-[11px] text-primary/80 hover:bg-primary/20 px-1.5 py-1.5 transition-colors font-bold leading-none"
                                  title="Set as drop-off"
                                >↓</motion.button>
                                <motion.button
                                  {...tapSoft}
                                  onClick={() => void deleteFavoriteById(fav.id)}
                                  className="text-[11px] text-muted-foreground hover:text-destructive hover:bg-destructive/10 px-1.5 py-1.5 transition-colors rounded-r-full leading-none"
                                  title="Remove"
                                >✕</motion.button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {recentLocations.length > 0 && (
                        <div>
                          <p className="text-[11px] font-semibold text-muted-foreground mb-1.5">🕐 Recent</p>
                          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                            {recentLocations.map((r) => (
                              <div key={r.name} className="flex items-center bg-muted/60 border border-border rounded-full shrink-0 overflow-hidden">
                                <span className="text-xs text-foreground/80 font-medium pl-2.5 pr-1 py-1.5 max-w-[88px] truncate">{r.name}</span>
                                <motion.button
                                  {...tapSoft}
                                  onClick={() => { setPickup(r.name); setPickupStop(r as CampusStop); setGpsVerification({ state: "idle", message: "Press Find Ride to verify GPS" }); }}
                                  className="text-[11px] text-muted-foreground hover:text-primary hover:bg-primary/10 px-1.5 py-1.5 transition-colors font-bold leading-none"
                                  title="Set as pickup"
                                >↑</motion.button>
                                <motion.button
                                  {...tapSoft}
                                  onClick={() => { setDrop(r.name); setDropStop(r as CampusStop); }}
                                  className="text-[11px] text-muted-foreground hover:text-primary hover:bg-primary/10 px-1.5 py-1.5 transition-colors font-bold rounded-r-full leading-none"
                                  title="Set as drop-off"
                                >↓</motion.button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <p className="text-[11px] text-muted-foreground">Select pickup and drop-off from suggestions to continue.</p>
                  <div className="flex flex-col gap-3">
                    <div className="flex sm:flex-row gap-3 items-stretch sm:items-center">
                      {/* Passenger count */}
                      <div className="flex items-center gap-2.5 bg-muted/50 border border-border rounded-xl py-3 px-4 justify-center">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <div className="flex items-center gap-2">
                          <motion.button
                            {...tapSnap}
                            onClick={() => setPassengers(Math.max(1, passengers - 1))}
                            className="w-7 h-7 rounded-lg bg-muted hover:bg-muted/80 active:scale-90 text-foreground text-base font-bold flex items-center justify-center transition-transform"
                          >−</motion.button>
                          <span className="w-7 text-center text-sm font-semibold text-foreground">{passengers}</span>
                          <motion.button
                            {...tapSnap}
                            onClick={() => setPassengers(Math.min(rideMaxPassengers, passengers + 1))}
                            className="w-7 h-7 rounded-lg bg-muted hover:bg-muted/80 active:scale-90 text-foreground text-base font-bold flex items-center justify-center transition-transform"
                          >+</motion.button>
                        </div>
                      </div>
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        animate={booking ? { scale: [1, 0.985, 1] } : { scale: 1 }}
                        transition={booking ? { duration: 1.05, repeat: Infinity, ease: "easeInOut" } : { duration: 0.15 }}
                        onClick={handleFindRide}
                        disabled={booking || !rideBookingEnabled}
                        className="btn-primary-gradient relative overflow-hidden px-6 py-3 rounded-xl font-semibold text-sm whitespace-nowrap flex-1 disabled:opacity-70 transition-all"
                      >
                        {booking && (
                          <>
                            <motion.span
                              aria-hidden="true"
                              className="absolute inset-y-1 left-0 w-20 rounded-full bg-white/25 blur-md"
                              animate={{ x: ["-120%", "320%"] }}
                              transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
                            />
                            <motion.span
                              aria-hidden="true"
                              className="absolute inset-0 bg-white/5"
                              animate={{ opacity: [0.08, 0.2, 0.08] }}
                              transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
                            />
                          </>
                        )}
                        <span className="relative z-10 flex items-center justify-center gap-2">
                          {!rideBookingEnabled ? (
                            "Booking Paused"
                          ) : booking ? (
                            <>
                              <span className="relative inline-flex h-4 w-12 items-center overflow-hidden rounded-full bg-white/10">
                                <span className="absolute left-1 right-1 h-px bg-white/35" />
                                <motion.span
                                  aria-hidden="true"
                                  className="absolute left-1 top-1/2 -translate-y-1/2 text-white"
                                  animate={{ x: [0, 18, 32, 18, 0], rotate: [0, -8, 0, 8, 0] }}
                                  transition={{ duration: 1.25, repeat: Infinity, ease: "easeInOut" }}
                                >
                                  <Navigation className="h-3.5 w-3.5 fill-current" />
                                </motion.span>
                              </span>
                              <span>Finding ride...</span>
                            </>
                          ) : (
                            "Find Ride"
                          )}
                        </span>
                      </motion.button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs flex-wrap">
                    <span
                      className={`px-3 py-1.5 rounded-lg border ${
                        gpsVerification.state === "verified"
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600"
                          : gpsVerification.state === "failed"
                            ? "border-destructive/40 bg-destructive/10 text-destructive"
                            : gpsVerification.state === "checking"
                              ? "border-primary/40 bg-primary/10 text-primary"
                              : "border-border bg-muted/40 text-muted-foreground"
                      }`}
                    >
                      GPS: {gpsVerification.state === "idle" ? "Not verified" : gpsVerification.state}
                    </span>
                    <span className="text-muted-foreground break-words flex-1">{gpsVerification.message}</span>
                    <motion.button
                      {...tapSoft}
                      type="button"
                      onClick={handleReverifyGps}
                      className="relative overflow-hidden px-3 py-1.5 rounded-lg border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-medium whitespace-nowrap"
                    >
                      {gpsVerification.state === "checking" && (
                        <motion.span
                          aria-hidden="true"
                          className="absolute inset-y-0 left-0 w-12 bg-primary/20 blur-sm"
                          animate={{ x: ["-140%", "240%"] }}
                          transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
                        />
                      )}
                      <span className="relative z-10 inline-flex items-center gap-1.5">
                        <motion.span
                          aria-hidden="true"
                          animate={gpsVerification.state === "checking" ? { rotate: [0, -18, 0, 18, 0] } : { rotate: 0 }}
                          transition={gpsVerification.state === "checking" ? { duration: 0.8, repeat: Infinity, ease: "easeInOut" } : { duration: 0.2 }}
                        >
                          <Navigation className="h-3.5 w-3.5" />
                        </motion.span>
                        <span>{gpsVerification.state === "checking" ? "Verifying..." : "Reverify"}</span>
                      </span>
                    </motion.button>
                  </div>
                  <div className="space-y-3">
                    <input
                      type="datetime-local"
                      title="Schedule ride date and time"
                      placeholder="Schedule date and time"
                      value={scheduledAt}
                      onChange={(event) => setScheduledAt(event.target.value)}
                      className="w-full bg-muted/50 border border-border rounded-xl py-3 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                    <input
                      type="text"
                      value={passengerNamesText}
                      onChange={(event) => setPassengerNamesText(event.target.value)}
                      placeholder="Passenger names (comma separated)"
                      className="w-full bg-muted/50 border border-border rounded-xl py-3 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                  <label className="flex items-center gap-3 text-sm text-foreground cursor-pointer py-2">
                    <input
                      type="checkbox"
                      checked={splitFare}
                      onChange={(event) => setSplitFare(event.target.checked)}
                      className="w-4 h-4 cursor-pointer"
                    />
                    <span>Split fare among passengers</span>
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <motion.button
                      {...tapSoft}
                      whileHover={{ y: -1 }}
                      onClick={() => saveCurrentAsFavorite("pickup")}
                      className="px-4 py-2.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 text-sm font-medium transition-colors"
                    >
                      <span className="inline-flex items-center gap-2">
                        <motion.span whileHover={{ rotate: [-8, 8, 0] }} transition={{ duration: 0.25 }} aria-hidden="true">⭐</motion.span>
                        <span>Save pickup</span>
                      </span>
                    </motion.button>
                    <motion.button
                      {...tapSoft}
                      whileHover={{ y: -1 }}
                      onClick={() => saveCurrentAsFavorite("drop")}
                      className="px-4 py-2.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 text-sm font-medium transition-colors"
                    >
                      <span className="inline-flex items-center gap-2">
                        <motion.span whileHover={{ rotate: [-8, 8, 0] }} transition={{ duration: 0.25 }} aria-hidden="true">⭐</motion.span>
                        <span>Save drop-off</span>
                      </span>
                    </motion.button>
                  </div>
                  <p className="text-xs text-muted-foreground">Passenger limit: {rideMaxPassengers} per ride</p>
                  {!rideBookingEnabled && (
                    <p className="text-xs text-destructive">Ride booking is currently disabled by admin settings.</p>
                  )}
                </div>
              </motion.div>

              {/* Stats card */}
              <motion.div {...card(1)} className="lg:col-span-2 card-glass flex flex-col justify-between">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-semibold font-display text-lg">Your Stats</h3>
                  <span className="text-xs bg-primary/20 text-primary px-3 py-1.5 rounded-full font-semibold">This month: {rideStats.thisMonth}</span>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-5">
                  {[
                    { label: "Total Rides", value: String(animatedTotal) },
                    { label: "Completed", value: String(animatedCompleted) },
                    { label: "Cancelled", value: String(animatedCancelled) },
                    { label: "Active", value: String(animatedActive) },
                  ].map((s) => (
                    <div key={s.label} className="bg-muted/30 rounded-xl p-4 text-center hover:bg-muted/40 transition-colors">
                      <p className="text-2xl font-bold font-display text-foreground">{s.value}</p>
                      <p className="text-xs text-muted-foreground mt-1.5 font-medium">{s.label}</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-muted-foreground font-medium">Completion Rate</span>
                      <span className="font-bold text-foreground">{animatedCompletionRate}%</span>
                    </div>
                    <progress
                      max={100}
                      value={animatedCompletionRate}
                      className="w-full h-2.5 rounded-full overflow-hidden [&::-webkit-progress-bar]:bg-muted/40 [&::-webkit-progress-value]:bg-primary [&::-moz-progress-bar]:bg-primary"
                    />
                    <svg viewBox="0 0 100 20" className="mt-2 h-4 w-full text-primary/60" aria-hidden="true">
                      <polyline fill="none" stroke="currentColor" strokeWidth="2" points="0,15 18,12 36,13 54,9 72,10 100,6" />
                    </svg>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-muted-foreground font-medium">Cancellation Rate</span>
                      <span className="font-bold text-foreground">{animatedCancellationRate}%</span>
                    </div>
                    <progress
                      max={100}
                      value={animatedCancellationRate}
                      className="w-full h-2.5 rounded-full overflow-hidden [&::-webkit-progress-bar]:bg-muted/40 [&::-webkit-progress-value]:bg-destructive/80 [&::-moz-progress-bar]:bg-destructive/80"
                    />
                    <svg viewBox="0 0 100 20" className="mt-2 h-4 w-full text-destructive/60" aria-hidden="true">
                      <polyline fill="none" stroke="currentColor" strokeWidth="2" points="0,6 20,8 40,10 60,9 80,13 100,15" />
                    </svg>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Quick Actions */}
            <div>
              <h2 className="text-lg font-bold font-display mb-4">Quick Actions</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                {quickActions.map((item, i) => (
                  <motion.div
                    key={item.label}
                    {...card(i + 2)}
                    whileHover={{ y: -4, scale: 1.01 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => handleQuickAction(item.label)}
                    className="card-glass cursor-pointer group text-center transition-shadow hover:shadow-[0_10px_30px_rgba(0,0,0,0.08)]"
                  >
                    <motion.div
                      animate={item.gradient ? { boxShadow: ["0 0 0 rgba(0,0,0,0)", "0 10px 24px rgba(59,130,246,0.18)", "0 0 0 rgba(0,0,0,0)"] } : undefined}
                      transition={item.gradient ? { duration: 2.2, repeat: Infinity, ease: "easeInOut" } : { duration: 0.2 }}
                      className={`w-11 h-11 rounded-xl flex items-center justify-center mx-auto mb-3 ${item.gradient ? "btn-primary-gradient" : "bg-primary/20 group-hover:bg-primary/25"}`}
                    >
                      <motion.div whileHover={{ rotate: [-6, 6, 0] }} transition={{ duration: 0.25 }}>
                        <item.icon className={`w-5 h-5 ${item.gradient ? "text-primary-foreground" : "text-primary"}`} />
                      </motion.div>
                    </motion.div>
                    <h3 className="font-semibold text-sm mb-0.5">{item.label}</h3>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Track Active Ride */}
            {activeRide && (["accepted", "in_progress", "pending", "ongoing", "requested", "scheduled"].includes(activeRide.status)) && (
              <motion.div {...card(7)} className="card-glass border border-primary/30">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl btn-primary-gradient flex items-center justify-center">
                      <MapIcon className="w-5 h-5 text-primary-foreground" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">Active Ride — {activeRide.pickup?.label || "—"} → {activeRide.drop?.label || "—"}</p>
                      <p className="text-xs text-muted-foreground">Status: {activeRide.status}</p>
                      {activeRide.status === "scheduled" && activeRide.scheduledFor && (
                        <p className="text-xs text-primary">Scheduled for: {new Date(activeRide.scheduledFor).toLocaleString()}</p>
                      )}
                      <p className="text-xs text-muted-foreground">Driver: {activeRide.driver?.name || "Not assigned yet"}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {activeRide.passengers || 1}</p>
                      {activeRide.passengerNames && activeRide.passengerNames.length > 0 && (
                        <p className="text-xs text-muted-foreground">Group: {activeRide.passengerNames.join(", ")}</p>
                      )}
                      {activeRide.fareBreakdown?.totalFare ? (
                        <p className="text-xs text-muted-foreground">Fare: ₹{activeRide.fareBreakdown.totalFare}{activeRide.fareBreakdown.perPassengerFare ? ` · ₹${activeRide.fareBreakdown.perPassengerFare}/person` : ""}</p>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {activeRide.status !== "cancelled" && Boolean(activeRide.verificationCode) && (
                      <span className="text-[11px] font-bold bg-primary/20 text-primary px-2 py-1 rounded-lg">
                        Code: {activeRide.verificationCode}
                      </span>
                    )}
                    <div className="flex items-center gap-2">
                    {callDriverHref ? (
                      <motion.a
                        {...tapSoft}
                        whileHover={{ y: -1 }}
                        href={callDriverHref}
                        className="px-3 py-2 rounded-xl text-xs font-semibold bg-primary/20 text-primary hover:bg-primary/30 transition-colors flex items-center gap-1"
                      >
                        <motion.span whileHover={{ rotate: [-6, 6, 0] }} transition={{ duration: 0.25 }}>
                          <Phone className="w-3.5 h-3.5" />
                        </motion.span>
                        Call
                      </motion.a>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="px-3 py-2 rounded-xl text-xs font-semibold bg-muted/50 text-muted-foreground cursor-not-allowed flex items-center gap-1"
                      >
                        <Phone className="w-3.5 h-3.5" /> Call
                      </button>
                    )}
                    {chatDriverHref ? (
                      <motion.a
                        {...tapSoft}
                        whileHover={{ y: -1 }}
                        href={chatDriverHref}
                        className="px-3 py-2 rounded-xl text-xs font-semibold bg-primary/20 text-primary hover:bg-primary/30 transition-colors flex items-center gap-1"
                      >
                        <motion.span whileHover={{ scale: 1.08 }} transition={{ duration: 0.2 }}>
                          <MessageCircle className="w-3.5 h-3.5" />
                        </motion.span>
                        Chat
                      </motion.a>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="px-3 py-2 rounded-xl text-xs font-semibold bg-muted/50 text-muted-foreground cursor-not-allowed flex items-center gap-1"
                      >
                        <MessageCircle className="w-3.5 h-3.5" /> Chat
                      </button>
                    )}
                    <div className="flex items-center gap-2">
                      <select title="Cancellation reason" value={cancelReasonKey} onChange={(event) => setCancelReasonKey(event.target.value)} className="bg-muted/50 border border-border rounded-xl py-2 px-2 text-xs">
                        {cancellationReasons.map((item) => (
                          <option key={item.key} value={item.key}>{item.label}</option>
                        ))}
                      </select>
                      {cancelReasonKey === "other" && (
                        <input
                          value={cancelCustomReason}
                          onChange={(event) => setCancelCustomReason(event.target.value)}
                          placeholder="Custom reason"
                          className="bg-muted/50 border border-border rounded-xl py-2 px-2 text-xs"
                        />
                      )}
                    </div>
                    </div>
                    <motion.button
                      {...tapSoft}
                      whileHover={{ y: -1 }}
                      onClick={handleCancelRide}
                      className="px-4 py-2 rounded-xl text-xs font-semibold bg-destructive/20 text-destructive hover:bg-destructive/30 transition-colors flex items-center gap-1"
                    >
                      <motion.span whileHover={{ rotate: [-8, 8, 0] }} transition={{ duration: 0.25 }}>
                        <XCircle className="w-3.5 h-3.5" />
                      </motion.span>
                      Cancel
                    </motion.button>
                    <motion.button
                      {...tapSoft}
                      whileHover={{ y: -1 }}
                      animate={{ boxShadow: ["0 0 0 rgba(0,0,0,0)", "0 8px 20px rgba(59,130,246,0.18)", "0 0 0 rgba(0,0,0,0)"] }}
                      transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                      onClick={() => playTrackRideSplash(activeRide?.id ? `/ride-tracking/${activeRide.id}` : "/ride-tracking", activeRide)}
                      className="btn-primary-gradient px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1"
                    >
                      <motion.span animate={{ x: [0, 2, 0] }} transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}>
                        <Navigation className="w-3.5 h-3.5" />
                      </motion.span>
                      Track Ride
                    </motion.button>
                    <motion.button
                      {...tapSoft}
                      whileHover={{ y: -1 }}
                      onClick={() => handleShareTracking(activeRide.shareTrackingUrl)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold bg-primary/20 text-primary hover:bg-primary/30 transition-colors flex items-center gap-1"
                    >
                      <motion.span animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </motion.span>
                      Share Live
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Ride History */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold font-display">My Rides</h2>
                <motion.button
                  {...tapSoft}
                  whileHover={{ x: 2 }}
                  onClick={() => navigate("/rides")}
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  View all <ChevronRight className="w-4 h-4" />
                </motion.button>
              </div>
              <RideHistoryTabs compact />
            </div>

            <motion.div {...card(8)} className="card-glass">
              <h2 className="text-lg font-bold font-display mb-1">Report Post-Ride Issue</h2>
              <p className="text-xs text-muted-foreground mb-4">Raise a complaint for completed or cancelled rides. Admin will review it in the Issue Center.</p>

              <div className="grid sm:grid-cols-3 gap-3">
                <select
                  title="Ride for issue"
                  value={issueRideId}
                  onChange={(event) => setIssueRideId(event.target.value)}
                  className="bg-muted/50 border border-border rounded-xl py-2.5 px-3 text-sm"
                >
                  <option value="">Select ride</option>
                  {issueEligibleRides.map((ride) => (
                    <option key={ride.id} value={ride.id}>
                      #{ride.id.slice(-6)} · {ride.pickup?.label || "—"} → {ride.drop?.label || "—"}
                    </option>
                  ))}
                </select>

                <select
                  title="Issue category"
                  value={issueCategory}
                  onChange={(event) => setIssueCategory(event.target.value as RideIssueDto["category"])}
                  className="bg-muted/50 border border-border rounded-xl py-2.5 px-3 text-sm"
                >
                  {issueCategories.map((item) => (
                    <option key={item.key} value={item.key}>{item.label}</option>
                  ))}
                </select>

                <motion.button
                  {...tapSoft}
                  animate={submittingIssue ? { scale: [1, 0.985, 1] } : { scale: 1 }}
                  transition={submittingIssue ? { duration: 0.9, repeat: Infinity, ease: "easeInOut" } : { duration: 0.15 }}
                  onClick={handleSubmitIssue}
                  disabled={submittingIssue}
                  className="btn-primary-gradient relative overflow-hidden rounded-xl text-sm font-semibold px-4 py-2.5 disabled:opacity-60"
                >
                  {submittingIssue && (
                    <motion.span
                      aria-hidden="true"
                      className="absolute inset-y-1 left-0 w-16 rounded-full bg-white/20 blur-md"
                      animate={{ x: ["-140%", "260%"] }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    />
                  )}
                  <span className="relative z-10">{submittingIssue ? "Submitting..." : "Submit Issue"}</span>
                </motion.button>
              </div>

              <textarea
                value={issueDescription}
                onChange={(event) => setIssueDescription(event.target.value)}
                rows={3}
                placeholder="Describe what went wrong (fare, route, behavior, safety, etc.)"
                className="mt-3 w-full bg-muted/50 border border-border rounded-xl py-2.5 px-3 text-sm"
              />
            </motion.div>
          </div>
        </div>
      </div>

      {/* Floating Track Ride Button — visible only when ride is active */}
      <AnimatePresence>
        {activeRide && (["accepted", "in_progress", "pending", "ongoing", "requested", "scheduled"].includes(activeRide.status)) && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            className="fixed bottom-8 right-8 z-50"
          >
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => playTrackRideSplash(`/ride-tracking/${activeRide.id}`, activeRide)}
              className="relative btn-primary-gradient w-16 h-16 rounded-2xl shadow-2xl flex items-center justify-center"
              title="Track your ride"
            >
              <MapIcon className="w-7 h-7 text-primary-foreground" />
              {/* Pulse ring */}
              <span className="absolute inset-0 rounded-2xl animate-ping opacity-30 btn-primary-gradient" />
            </motion.button>
            {/* Tooltip label */}
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap bg-foreground text-background text-xs font-medium px-3 py-1.5 rounded-lg"
            >
              Track Ride
              <span className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-foreground" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {logoutTransitionOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[95] flex items-center justify-center px-6"
          >
            <div className="absolute inset-0 bg-background/80 backdrop-blur-lg" />
            <motion.div
              initial={{ opacity: 0, y: 14, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              className="relative w-full max-w-sm rounded-3xl border border-primary/25 bg-background/95 p-6 text-center shadow-[0_24px_80px_rgba(0,0,0,0.26)]"
            >
              <motion.div
                aria-hidden="true"
                className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-primary"
                animate={{ scale: [1, 1.08, 1], rotate: [0, -6, 0, 6, 0] }}
                transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
              >
                <LogOut className="h-7 w-7" />
              </motion.div>
              <h3 className="text-lg font-bold font-display text-foreground">Logout successful</h3>
              <p className="mt-1 text-sm text-muted-foreground">Returning to home...</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {trackRideSplash.open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="fixed inset-0 z-[80] flex items-center justify-center px-6"
          >
            <div className="absolute inset-0 bg-background/82 backdrop-blur-xl" />
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 18 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 10 }}
              transition={{ duration: 0.32, ease: "easeOut" }}
              className="relative z-10 w-full max-w-sm overflow-hidden rounded-[28px] border border-primary/20 bg-background/90 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.22)]"
            >
              <motion.div
                aria-hidden="true"
                className="absolute -left-12 top-0 h-full w-24 bg-primary/10 blur-2xl"
                animate={{ x: [0, 240, 0] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
              />
              <div className="relative z-10 space-y-5">
                <div className="flex items-center justify-center">
                  <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                    <motion.span
                      aria-hidden="true"
                      className="absolute inset-0 rounded-full border border-primary/25"
                      animate={{ scale: [1, 1.18, 1.32], opacity: [0.55, 0.22, 0] }}
                      transition={{ duration: 1.3, repeat: Infinity, ease: "easeOut" }}
                    />
                    <motion.span
                      aria-hidden="true"
                      className="absolute inset-2 rounded-full border border-primary/20"
                      animate={{ scale: [1, 1.1, 1.22], opacity: [0.45, 0.18, 0] }}
                      transition={{ duration: 1.3, repeat: Infinity, delay: 0.2, ease: "easeOut" }}
                    />
                    <motion.div
                      animate={{ rotate: [0, -10, 0, 10, 0], y: [0, -2, 0] }}
                      transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                      className="relative z-10 rounded-full bg-primary text-primary-foreground p-3 shadow-lg"
                    >
                      <Navigation className="h-7 w-7" />
                    </motion.div>
                  </div>
                </div>

                <div className="space-y-1 text-center">
                  <h3 className="text-xl font-bold font-display text-foreground">Preparing Live Tracking</h3>
                  <p className="text-sm text-muted-foreground">Securing your ride route and syncing the latest driver location.</p>
                </div>

                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3 text-sm">
                  <div className="min-w-0 text-left">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary/70">From</p>
                    <p className="truncate font-semibold text-foreground">{trackRideSplash.pickupLabel}</p>
                  </div>
                  <motion.div
                    aria-hidden="true"
                    animate={{ x: [0, 4, 0] }}
                    transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
                    className="rounded-full bg-primary/10 p-1.5 text-primary"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </motion.div>
                  <div className="min-w-0 text-right">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary/70">To</p>
                    <p className="truncate font-semibold text-foreground">{trackRideSplash.dropLabel}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-border/60 bg-muted/35 px-4 py-4">
                  <div className="relative h-8">
                    <div className="absolute left-2 right-2 top-1/2 h-[2px] -translate-y-1/2 rounded-full bg-primary/15" />
                    <motion.div
                      aria-hidden="true"
                      className="absolute left-2 top-1/2 h-[2px] -translate-y-1/2 rounded-full bg-primary"
                      animate={{ width: ["12%", "88%"] }}
                      transition={{ duration: 1.05, repeat: Infinity, ease: "easeInOut" }}
                    />
                    <motion.div
                      aria-hidden="true"
                      className="absolute left-2 top-1/2 -translate-y-1/2"
                      animate={{ x: [0, 208] }}
                      transition={{ duration: 1.05, repeat: Infinity, ease: "easeInOut" }}
                    >
                      <div className="rounded-full bg-primary p-1.5 text-primary-foreground shadow-md">
                        <MapIcon className="h-3.5 w-3.5" />
                      </div>
                    </motion.div>
                    <div className="absolute left-1 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-primary bg-background" />
                    <div className="absolute right-1 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-primary bg-background" />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-muted/30 px-4 py-3 text-sm">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Driver</p>
                    <p className="font-medium text-foreground">{trackRideSplash.driverName}</p>
                  </div>
                  <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
                    {trackRideSplash.statusLabel}
                  </span>
                </div>

                <div className="flex items-center justify-center gap-2 text-xs font-medium uppercase tracking-[0.24em] text-primary/80">
                  {[0, 1, 2].map((dot) => (
                    <motion.span
                      key={dot}
                      className="h-1.5 w-1.5 rounded-full bg-primary"
                      animate={{ opacity: [0.25, 1, 0.25], y: [0, -2, 0] }}
                      transition={{ duration: 0.8, repeat: Infinity, delay: dot * 0.14, ease: "easeInOut" }}
                    />
                  ))}
                  Entering tracking view
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Ride Completion Popup */}
      <RideCompletionPopup
        open={showCompletionPopup}
        allowClose={false}
        onClose={() => {
          setShowCompletionPopup(false);
          setFeedbackRide(null);
        }}
        submitting={submittingFeedback}
        onSubmit={async (rating, message) => {
          if (!feedbackRide) return;
          setSubmittingFeedback(true);
          try {
            await apiClient.rides.feedback(feedbackRide.id, rating, message);
            toast.success("Feedback submitted", "Thanks for rating your ride.");
            await loadMyRides();
          } finally {
            setSubmittingFeedback(false);
          }
        }}
        ride={{
          from: feedbackRide?.pickup?.label || "—",
          to: feedbackRide?.drop?.label || "—",
          fare: "—",
          duration: "—",
          distance: "—",
          driverName: feedbackRide?.driver?.name || "—",
          driverPhone: feedbackRide?.driver?.phone || "—",
          passengers: feedbackRide?.passengers || 1,
        }}
      />
      <ProfileDialog
        open={profileDialogOpen}
        onOpenChange={setProfileDialogOpen}
        user={user as AuthUser | null}
        onSaved={(updatedUser) => {
          login({
            id: updatedUser.id,
            name: updatedUser.name,
            email: updatedUser.email,
            role: updatedUser.role,
            phone: updatedUser.phone || null,
            avatarUrl: updatedUser.avatarUrl || null,
            driverApprovalStatus: updatedUser.driverApprovalStatus,
            driverVerificationStatus: updatedUser.driverVerificationStatus,
            vehicleSeats: updatedUser.vehicleSeats,
            driverPerformanceScore: updatedUser.driverPerformanceScore,
            driverStats: updatedUser.driverStats,
          });
        }}
      />

      <Dialog open={emergencyOpen} onOpenChange={setEmergencyOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Emergency Contacts</DialogTitle>
            <DialogDescription>
              Use these quick contacts for safety and urgent support.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-3 py-2">
              <div>
                <p className="text-sm font-medium">Ride Support</p>
                <p className="text-xs text-muted-foreground">{rideSupportPhone}</p>
              </div>
              {supportCallHref ? (
                <motion.a
                  {...tapSoft}
                  whileHover={{ y: -1 }}
                  href={supportCallHref}
                  className="btn-primary-gradient px-3 py-1.5 rounded-lg text-xs font-semibold"
                >
                  Call
                </motion.a>
              ) : (
                <button type="button" disabled className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-muted text-muted-foreground">Call</button>
              )}
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-3 py-2">
              <div>
                <p className="text-sm font-medium">Campus Security</p>
                <p className="text-xs text-muted-foreground">{rideSecurityPhone}</p>
              </div>
              {securityCallHref ? (
                <motion.a
                  {...tapSoft}
                  whileHover={{ y: -1 }}
                  href={securityCallHref}
                  className="btn-primary-gradient px-3 py-1.5 rounded-lg text-xs font-semibold"
                >
                  Call
                </motion.a>
              ) : (
                <button type="button" disabled className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-muted text-muted-foreground">Call</button>
              )}
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-3 py-2">
              <div>
                <p className="text-sm font-medium">Ambulance</p>
                <p className="text-xs text-muted-foreground">{rideAmbulancePhone}</p>
              </div>
              {ambulanceCallHref ? (
                <motion.a
                  {...tapSoft}
                  whileHover={{ y: -1 }}
                  href={ambulanceCallHref}
                  className="btn-primary-gradient px-3 py-1.5 rounded-lg text-xs font-semibold"
                >
                  Call
                </motion.a>
              ) : (
                <button type="button" disabled className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-muted text-muted-foreground">Call</button>
              )}
            </div>
          </div>

          <DialogFooter>
            <motion.button
              {...tapSoft}
              whileHover={{ y: -1 }}
              type="button"
              onClick={() => setEmergencyOpen(false)}
              className="px-4 py-2 rounded-xl text-sm bg-muted/50 hover:bg-muted text-muted-foreground transition-colors"
            >
              Close
            </motion.button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={outsideCampusAlertOpen} onOpenChange={setOutsideCampusAlertOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-destructive" />
              Outside Campus
            </DialogTitle>
            <DialogDescription>
              You are currently outside the campus area.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
              <p className="text-sm text-destructive font-medium mb-2">Location Verification Failed</p>
              <p className="text-xs text-muted-foreground">
                Campus Ride is only available for locations within the TMU campus boundary. Your current GPS location or selected pickup point is outside the campus area.
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">What you can do:</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>✓ Move to a location inside the campus boundary</li>
                <li>✓ Ensure your GPS is enabled and up-to-date</li>
                <li>✓ Select a pickup point from valid campus stops</li>
                <li>✓ Wait for better GPS signal (if accuracy is low)</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <motion.button
              {...tapSoft}
              whileHover={{ y: -1 }}
              type="button"
              onClick={() => setOutsideCampusAlertOpen(false)}
              className="px-4 py-2 rounded-xl text-sm bg-primary hover:bg-primary/90 text-primary-foreground transition-colors font-medium"
            >
              Got it
            </motion.button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
};

export default StudentDashboard;
