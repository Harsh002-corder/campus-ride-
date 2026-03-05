import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { GoogleMap, Marker, Polygon, Polyline, useJsApiLoader } from "@react-google-maps/api";
import { useAuth } from "@/contexts/AuthContext";
import { useAppToast } from "@/hooks/use-app-toast";
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
import { CAMPUS_BOUNDARY_POLYGON, CAMPUS_MAP_CENTER, isWithinCampusBoundary } from "@/lib/campusBoundary";
import { CAMPUS_STOPS, type CampusStop } from "@/lib/stops";
import { getSocketClient } from "@/lib/socketClient";
import {
  MapPin, Clock, LogOut, Navigation,
  Calendar, CreditCard, Shield, ChevronRight, Search, Map,
  ArrowUpDown, Users, XCircle, Phone, MessageCircle, UserCircle2,
} from "lucide-react";

const toPhoneDigits = (value?: string | null) => (value || "").replace(/\D/g, "");

const toNumber = (value: unknown, fallback: number) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const GOOGLE_MAPS_API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined)?.trim() || "";

const mapContainerStyle = { width: "100%", height: "100%" };
const mapLibraries: ("places" | "geometry" | "drawing")[] = ["places", "geometry"];
const bookingMapOptions: google.maps.MapOptions = {
  disableDefaultUI: true,
  zoomControl: true,
  fullscreenControl: false,
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

const bookingRouteLineOptions: google.maps.PolylineOptions = {
  strokeColor: "#10b981",
  strokeOpacity: 0.85,
  strokeWeight: 3,
  geodesic: true,
  zIndex: 20,
};

const getSelectedMarkerIcon = (isPickupSelected: boolean, isDropSelected: boolean): google.maps.Symbol | undefined => {
  if ((!isPickupSelected && !isDropSelected) || typeof window === "undefined" || !window.google?.maps) {
    return undefined;
  }

  return {
    path: isPickupSelected
      ? window.google.maps.SymbolPath.CIRCLE
      : window.google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
    scale: isPickupSelected ? 8 : 6,
    strokeWeight: 2,
  };
};

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
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [favorites, setFavorites] = useState<FavoriteLocation[]>([]);
  const [pickupFavoriteId, setPickupFavoriteId] = useState("");
  const [dropFavoriteId, setDropFavoriteId] = useState("");
  const [mapSelectionTarget, setMapSelectionTarget] = useState<"pickup" | "drop">("pickup");
  const [cancelReasonKey, setCancelReasonKey] = useState("change_of_plans");
  const [cancelCustomReason, setCancelCustomReason] = useState("");
  const [issueRideId, setIssueRideId] = useState("");
  const [issueCategory, setIssueCategory] = useState<RideIssueDto["category"]>("route_issue");
  const [issueDescription, setIssueDescription] = useState("");
  const [submittingIssue, setSubmittingIssue] = useState(false);
  const bookingMapRef = useRef<google.maps.Map | null>(null);

  const { isLoaded: isBookingMapLoaded } = useJsApiLoader({
    id: "student-booking-map",
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: mapLibraries,
  });

  const canRenderBookingMap = Boolean(GOOGLE_MAPS_API_KEY) && isBookingMapLoaded;
  const bookingMapCenter = pickupStop || dropStop || CAMPUS_MAP_CENTER;
  const bookingRoutePath = pickupStop && dropStop
    ? [
        { lat: pickupStop.lat, lng: pickupStop.lng },
        { lat: dropStop.lat, lng: dropStop.lng },
      ]
    : null;

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

      setRideBookingEnabled(bookingSetting === undefined ? true : bookingSetting === true || String(bookingSetting).toLowerCase() === "true");
      setRideMaxPassengers(Math.max(1, Math.min(6, toNumber(maxPassengersSetting, 4))));
      setRideSupportPhone(String(supportPhoneSetting || "+91 90000 00000"));
      setRideSecurityPhone(String(securityPhoneSetting || "+91 100"));
      setRideAmbulancePhone(String(ambulancePhoneSetting || "+91 108"));
    } catch {
      setRideBookingEnabled(true);
      setRideMaxPassengers(4);
      setRideSupportPhone("+91 90000 00000");
      setRideSecurityPhone("+91 100");
      setRideAmbulancePhone("+91 108");
    }
  }, []);

  const loadFavorites = useCallback(async () => {
    try {
      const response = await apiClient.users.favorites();
      setFavorites(response.favorites || []);
    } catch {
      setFavorites([]);
    }
  }, []);

  const loadMyRides = useCallback(async () => {
    try {
      const response = await apiClient.rides.my();
      const allRides = response.rides || [];
      setRides(allRides);
      const active = allRides.find((ride) => ["scheduled", "accepted", "ongoing", "requested"].includes(ride.status));
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

        const nextActive = next.find((ride) => ["scheduled", "accepted", "ongoing", "requested"].includes(ride.status));
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

  const rideStats = useMemo(() => {
    const total = rides.length;
    const completed = rides.filter((ride) => ride.status === "completed").length;
    const cancelled = rides.filter((ride) => ride.status === "cancelled").length;
    const active = rides.filter((ride) => ["scheduled", "requested", "accepted", "ongoing"].includes(ride.status)).length;

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

  const quickActions = [
    { icon: MapPin, label: "Book a Ride", desc: "Find your next campus ride", gradient: true },
    { icon: Clock, label: "Ride History", desc: `${rideStats.total} rides`, gradient: false },
    { icon: Navigation, label: "Active", desc: `${rideStats.active} ongoing/requested`, gradient: false },
    { icon: CreditCard, label: "Completed", desc: `${rideStats.completed} completed`, gradient: false },
    { icon: Calendar, label: "Cancelled", desc: `${rideStats.cancelled} cancelled`, gradient: false },
    { icon: Shield, label: "Safety", desc: "Emergency contacts", gradient: false },
  ];

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
      if (activeRide && ["scheduled", "requested", "accepted", "ongoing"].includes(activeRide.status)) {
        navigate("/ride-tracking");
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
  };

  const handleMapStopSelect = (stop: CampusStop) => {
    if (mapSelectionTarget === "pickup") {
      setPickup(stop.name);
      setPickupStop(stop);
      setMapSelectionTarget("drop");
      return;
    }

    setDrop(stop.name);
    setDropStop(stop);
  };

  useEffect(() => {
    if (!bookingMapRef.current || !pickupStop || !dropStop || typeof window === "undefined" || !window.google?.maps) {
      return;
    }

    const bounds = new google.maps.LatLngBounds();
    bounds.extend({ lat: pickupStop.lat, lng: pickupStop.lng });
    bounds.extend({ lat: dropStop.lat, lng: dropStop.lng });
    bookingMapRef.current.fitBounds(bounds, 70);
  }, [pickupStop, dropStop]);

  const handleFindRide = async () => {
    if (!rideBookingEnabled) {
      toast.info("Ride booking disabled", "Admin has temporarily paused ride booking.");
      return;
    }

    if (!pickupStop || !dropStop) {
      toast.info("Select pickup and drop stops", "Please choose valid campus stops from suggestions.");
      return;
    }

    if (pickupStop.name === dropStop.name) {
      toast.info("Invalid route", "Pickup and drop locations cannot be the same.");
      return;
    }

    if (!isWithinCampusBoundary({ lat: pickupStop.lat, lng: pickupStop.lng }) || !isWithinCampusBoundary({ lat: dropStop.lat, lng: dropStop.lng })) {
      toast.info("Outside campus boundary", "Pickup and drop must be within the campus geofence.");
      return;
    }

    const passengerNames = passengerNamesText
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean)
      .slice(0, passengers);

    setBooking(true);
    try {
      const response = await apiClient.rides.book({
        pickup: { lat: pickupStop.lat, lng: pickupStop.lng, label: pickupStop.name },
        drop: { lat: dropStop.lat, lng: dropStop.lng, label: dropStop.name },
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

  const handleQuickBook = async () => {
    if (!pickupFavoriteId || !dropFavoriteId) {
      toast.info("Select favorite locations", "Choose pickup and drop favorites for one-click booking.");
      return;
    }

    setBooking(true);
    try {
      const passengerNames = passengerNamesText
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean)
        .slice(0, passengers);

      const response = await apiClient.rides.quickBook({
        pickupFavoriteId,
        dropFavoriteId,
        passengers,
        passengerNames,
        splitFare,
        scheduledAt: scheduledAt || undefined,
      });

      toast.success(
        response.ride.status === "scheduled" ? "Ride scheduled from favorites" : "Ride booked from favorites",
      );
      await loadMyRides();
    } catch (error) {
      toast.error("Quick booking failed", error);
    } finally {
      setBooking(false);
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

  const saveCurrentAsFavorite = async (type: "pickup" | "drop") => {
    const stop = type === "pickup" ? pickupStop : dropStop;
    if (!stop) {
      toast.info("Select a stop first", `Choose a ${type} stop before saving as favorite.`);
      return;
    }

    const label = window.prompt(`Favorite label for ${stop.name}`, stop.name);
    if (!label?.trim()) return;

    try {
      await apiClient.users.addFavorite({
        label: label.trim(),
        location: {
          lat: stop.lat,
          lng: stop.lng,
          address: stop.name,
        },
      });
      toast.success("Favorite saved", `${label.trim()} is now available for quick booking.`);
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
    logout();
    navigate("/", { replace: true });
    window.location.assign("/");
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
        <div className="absolute top-1/4 right-1/4 w-[400px] h-[400px] rounded-full opacity-10 animate-pulse-glow [background:var(--gradient-glow)]" />

        <div className="relative z-10">
          {/* Navbar */}
          <nav className="glass py-4 px-6 sticky top-0 z-20">
            <div className="container mx-auto flex items-center justify-between">
              <a href="/" className="flex items-center gap-2">
                <BrandIcon className="w-9 h-9" />
                <span className="text-xl font-bold font-display">
                  Campus<span className="gradient-text">Ride</span>
                </span>
              </a>
              <div className="flex items-center gap-3">
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
                <motion.button whileTap={{ scale: 0.95 }} onClick={handleLogout} className="btn-outline-glow px-4 py-2 rounded-xl text-sm flex items-center gap-2">
                  <LogOut className="w-4 h-4" /> Logout
                </motion.button>
              </div>
            </div>
          </nav>

          <div className="container mx-auto px-6 py-8 space-y-8">
            {/* Welcome + Quick Book */}
            <div className="grid lg:grid-cols-5 gap-6">
              <motion.div {...card(0)} className="lg:col-span-3 card-glass">
                <h1 className="text-2xl md:text-3xl font-bold font-display mb-1">
                  Welcome back, <span className="gradient-text">{user?.name}</span> 👋
                </h1>
                <p className="text-muted-foreground text-sm mb-6">Where are you heading today?</p>

                <div className="flex flex-col gap-3">
                  <div className="flex flex-col sm:flex-row gap-3 items-center">
                    <StopTypeahead
                      placeholder="Pickup location"
                      value={pickup}
                      onChange={(value) => {
                        setPickup(value);
                        if (pickupStop?.name !== value) {
                          setPickupStop(null);
                        }
                      }}
                      onSelect={(stop) => {
                        setPickupStop(stop);
                      }}
                      stops={CAMPUS_STOPS}
                      minChars={2}
                      maxResults={8}
                      debounceMs={300}
                      remoteEndpoint={import.meta.env.VITE_USE_REMOTE_STOP_SUGGEST === "true" ? `${import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api"}/stops/suggest` : undefined}
                      icon={<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />}
                    />
                    {/* Swap button */}
                    <motion.button
                      whileTap={{ scale: 0.9, rotate: 180 }}
                      onClick={handleSwapLocations}
                      className="p-2.5 rounded-xl bg-primary/20 hover:bg-primary/30 text-primary transition-colors shrink-0"
                      title="Swap locations"
                    >
                      <ArrowUpDown className="w-4 h-4" />
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
                      }}
                      stops={CAMPUS_STOPS}
                      minChars={2}
                      maxResults={8}
                      debounceMs={300}
                      remoteEndpoint={import.meta.env.VITE_USE_REMOTE_STOP_SUGGEST === "true" ? `${import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api"}/stops/suggest` : undefined}
                      icon={<Navigation className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />}
                    />
                  </div>
                  <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">Map stop picker</p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setMapSelectionTarget("pickup")}
                          className={`px-2 py-1 rounded-lg text-xs ${mapSelectionTarget === "pickup" ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}
                        >
                          Pickup
                        </button>
                        <button
                          type="button"
                          onClick={() => setMapSelectionTarget("drop")}
                          className={`px-2 py-1 rounded-lg text-xs ${mapSelectionTarget === "drop" ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}
                        >
                          Drop-off
                        </button>
                      </div>
                    </div>

                    <div className="h-56 rounded-xl overflow-hidden">
                      {canRenderBookingMap ? (
                        <GoogleMap
                          mapContainerStyle={mapContainerStyle}
                          zoom={16}
                          center={bookingMapCenter}
                          options={bookingMapOptions}
                          onLoad={(map) => {
                            bookingMapRef.current = map;
                          }}
                          onUnmount={() => {
                            bookingMapRef.current = null;
                          }}
                        >
                          <Polygon paths={CAMPUS_BOUNDARY_POLYGON} options={campusBoundaryOptions} />
                          {bookingRoutePath && (
                            <Polyline
                              path={bookingRoutePath}
                              options={bookingRouteLineOptions}
                            />
                          )}
                          {CAMPUS_STOPS.map((stop) => {
                            const isPickupSelected = pickupStop?.name === stop.name;
                            const isDropSelected = dropStop?.name === stop.name;

                            return (
                              <Marker
                                key={stop.name}
                                position={{ lat: stop.lat, lng: stop.lng }}
                                title={isPickupSelected ? `${stop.name} (Pickup)` : isDropSelected ? `${stop.name} (Drop-off)` : stop.name}
                                label={isPickupSelected ? "P" : isDropSelected ? "D" : undefined}
                                icon={getSelectedMarkerIcon(isPickupSelected, isDropSelected)}
                                zIndex={isPickupSelected || isDropSelected ? 1000 : 10}
                                onClick={() => handleMapStopSelect(stop)}
                              />
                            );
                          })}
                        </GoogleMap>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-muted/50 text-xs text-muted-foreground text-center px-4">
                          Add VITE_GOOGLE_MAPS_API_KEY to enable map stop selection.
                        </div>
                      )}
                    </div>

                    <p className="text-[11px] text-muted-foreground">
                      Click a stop marker to set {mapSelectionTarget === "pickup" ? "pickup" : "drop-off"}.
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Selected: P {pickupStop?.name || "—"} · D {dropStop?.name || "—"}
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 items-center">
                    {/* Passenger count */}
                    <div className="flex items-center gap-2 bg-muted/50 border border-border rounded-xl py-2.5 px-4">
                      <Users className="w-4 h-4 text-muted-foreground" />
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setPassengers(Math.max(1, passengers - 1))}
                          className="w-6 h-6 rounded-lg bg-muted hover:bg-muted/80 text-foreground text-sm font-bold flex items-center justify-center"
                        >−</button>
                        <span className="w-6 text-center text-sm font-semibold">{passengers}</span>
                        <button
                          onClick={() => setPassengers(Math.min(rideMaxPassengers, passengers + 1))}
                          className="w-6 h-6 rounded-lg bg-muted hover:bg-muted/80 text-foreground text-sm font-bold flex items-center justify-center"
                        >+</button>
                      </div>
                    </div>
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={handleFindRide}
                      disabled={booking || !rideBookingEnabled}
                      className="btn-primary-gradient px-6 py-3 rounded-xl font-semibold text-sm whitespace-nowrap flex-1 sm:flex-none disabled:opacity-70"
                    >
                      {!rideBookingEnabled ? "Booking Paused" : booking ? "Finding..." : "Find Ride"}
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={handleQuickBook}
                      disabled={booking || !pickupFavoriteId || !dropFavoriteId || !rideBookingEnabled}
                      className="px-5 py-3 rounded-xl font-semibold text-sm whitespace-nowrap bg-primary/20 text-primary hover:bg-primary/30 disabled:opacity-50"
                    >
                      One-Click Book
                    </motion.button>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <input
                      type="datetime-local"
                      title="Schedule ride date and time"
                      placeholder="Schedule date and time"
                      value={scheduledAt}
                      onChange={(event) => setScheduledAt(event.target.value)}
                      className="w-full bg-muted/50 border border-border rounded-xl py-2.5 px-4 text-sm"
                    />
                    <input
                      type="text"
                      value={passengerNamesText}
                      onChange={(event) => setPassengerNamesText(event.target.value)}
                      placeholder="Passenger names (comma separated)"
                      className="w-full bg-muted/50 border border-border rounded-xl py-2.5 px-4 text-sm"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={splitFare}
                      onChange={(event) => setSplitFare(event.target.checked)}
                    />
                    Split fare among passengers
                  </label>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <select title="Pickup favorite" value={pickupFavoriteId} onChange={(event) => setPickupFavoriteId(event.target.value)} className="w-full bg-muted/50 border border-border rounded-xl py-2.5 px-3 text-sm">
                      <option value="">Pickup favorite</option>
                      {favorites.map((favorite) => (
                        <option key={`pickup-${favorite.id}`} value={favorite.id}>{favorite.label}</option>
                      ))}
                    </select>
                    <select title="Drop favorite" value={dropFavoriteId} onChange={(event) => setDropFavoriteId(event.target.value)} className="w-full bg-muted/50 border border-border rounded-xl py-2.5 px-3 text-sm">
                      <option value="">Drop favorite</option>
                      {favorites.map((favorite) => (
                        <option key={`drop-${favorite.id}`} value={favorite.id}>{favorite.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <button onClick={() => saveCurrentAsFavorite("pickup")} className="px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/70">Save pickup as favorite</button>
                    <button onClick={() => saveCurrentAsFavorite("drop")} className="px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/70">Save drop as favorite</button>
                  </div>
                  <p className="text-xs text-muted-foreground">Passenger limit: {rideMaxPassengers} per ride</p>
                  {!rideBookingEnabled && (
                    <p className="text-xs text-destructive">Ride booking is currently disabled by admin settings.</p>
                  )}
                </div>
              </motion.div>

              {/* Stats card */}
              <motion.div {...card(1)} className="lg:col-span-2 card-glass flex flex-col justify-between">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="font-semibold font-display text-lg">Your Stats</h3>
                  <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full font-medium">This month: {rideStats.thisMonth}</span>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  {[
                    { label: "Total Rides", value: String(rideStats.total) },
                    { label: "Completed", value: String(rideStats.completed) },
                    { label: "Cancelled", value: String(rideStats.cancelled) },
                    { label: "Active", value: String(rideStats.active) },
                  ].map((s) => (
                    <div key={s.label} className="bg-muted/30 rounded-xl p-3 text-center">
                      <p className="text-lg font-bold font-display text-foreground">{s.value}</p>
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Completion Rate</span>
                      <span className="font-semibold text-foreground">{rideStats.completionRate}%</span>
                    </div>
                    <progress
                      max={100}
                      value={rideStats.completionRate}
                      className="w-full h-2 rounded-full overflow-hidden [&::-webkit-progress-bar]:bg-muted/40 [&::-webkit-progress-value]:bg-primary [&::-moz-progress-bar]:bg-primary"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Cancellation Rate</span>
                      <span className="font-semibold text-foreground">{rideStats.cancellationRate}%</span>
                    </div>
                    <progress
                      max={100}
                      value={rideStats.cancellationRate}
                      className="w-full h-2 rounded-full overflow-hidden [&::-webkit-progress-bar]:bg-muted/40 [&::-webkit-progress-value]:bg-destructive/80 [&::-moz-progress-bar]:bg-destructive/80"
                    />
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
                    onClick={() => handleQuickAction(item.label)}
                    className="card-glass cursor-pointer group text-center"
                  >
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center mx-auto mb-3 ${item.gradient ? "btn-primary-gradient" : "bg-primary/20"}`}>
                      <item.icon className={`w-5 h-5 ${item.gradient ? "text-primary-foreground" : "text-primary"}`} />
                    </div>
                    <h3 className="font-semibold text-sm mb-0.5">{item.label}</h3>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Track Active Ride */}
            {activeRide && (activeRide.status === "accepted" || activeRide.status === "ongoing" || activeRide.status === "requested" || activeRide.status === "scheduled") && (
              <motion.div {...card(7)} className="card-glass border border-primary/30">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl btn-primary-gradient flex items-center justify-center">
                      <Map className="w-5 h-5 text-primary-foreground" />
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
                      <a
                        href={callDriverHref}
                        className="px-3 py-2 rounded-xl text-xs font-semibold bg-primary/20 text-primary hover:bg-primary/30 transition-colors flex items-center gap-1"
                      >
                        <Phone className="w-3.5 h-3.5" /> Call
                      </a>
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
                      <a
                        href={chatDriverHref}
                        className="px-3 py-2 rounded-xl text-xs font-semibold bg-primary/20 text-primary hover:bg-primary/30 transition-colors flex items-center gap-1"
                      >
                        <MessageCircle className="w-3.5 h-3.5" /> Chat
                      </a>
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
                      whileTap={{ scale: 0.95 }}
                      onClick={handleCancelRide}
                      className="px-4 py-2 rounded-xl text-xs font-semibold bg-destructive/20 text-destructive hover:bg-destructive/30 transition-colors flex items-center gap-1"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Cancel
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => navigate("/ride-tracking")}
                      className="btn-primary-gradient px-4 py-2 rounded-xl text-xs font-semibold"
                    >
                      Track Ride
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleShareTracking(activeRide.shareTrackingUrl)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold bg-primary/20 text-primary hover:bg-primary/30 transition-colors"
                    >
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
                <button onClick={() => navigate("/rides")} className="text-sm text-primary hover:underline flex items-center gap-1">
                  View all <ChevronRight className="w-4 h-4" />
                </button>
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

                <button
                  onClick={handleSubmitIssue}
                  disabled={submittingIssue}
                  className="btn-primary-gradient rounded-xl text-sm font-semibold px-4 py-2.5 disabled:opacity-60"
                >
                  {submittingIssue ? "Submitting..." : "Submit Issue"}
                </button>
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

      {/* Floating Track Ride Button — visible only when ride is accepted or ongoing */}
      <AnimatePresence>
        {activeRide && (activeRide.status === "accepted" || activeRide.status === "ongoing" || activeRide.status === "requested" || activeRide.status === "scheduled") && (
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
              onClick={() => navigate(`/ride-tracking/${activeRide.id}`)}
              className="relative btn-primary-gradient w-16 h-16 rounded-2xl shadow-2xl flex items-center justify-center"
              title="Track your ride"
            >
              <Map className="w-7 h-7 text-primary-foreground" />
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
      {/* Ride Completion Popup */}
      <RideCompletionPopup
        open={showCompletionPopup}
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
                <a href={supportCallHref} className="btn-primary-gradient px-3 py-1.5 rounded-lg text-xs font-semibold">Call</a>
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
                <a href={securityCallHref} className="btn-primary-gradient px-3 py-1.5 rounded-lg text-xs font-semibold">Call</a>
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
                <a href={ambulanceCallHref} className="btn-primary-gradient px-3 py-1.5 rounded-lg text-xs font-semibold">Call</a>
              ) : (
                <button type="button" disabled className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-muted text-muted-foreground">Call</button>
              )}
            </div>
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={() => setEmergencyOpen(false)}
              className="px-4 py-2 rounded-xl text-sm bg-muted/50 hover:bg-muted text-muted-foreground transition-colors"
            >
              Close
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
};

export default StudentDashboard;
