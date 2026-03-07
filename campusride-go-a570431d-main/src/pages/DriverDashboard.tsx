import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import PageTransition from "@/components/PageTransition";
import RideHistoryTabs from "@/components/ride/RideHistoryTabs";
import IncomingRequestsList from "@/components/ride/IncomingRequestsList";
import NewRideRequestPopup from "@/components/ride/NewRideRequestPopup";
import { useAppToast } from "@/hooks/use-app-toast";
import BrandIcon from "@/components/BrandIcon";
import NotificationBell from "@/components/NotificationBell";
import ProfileDialog from "@/components/ProfileDialog";
import { apiClient, type AuthUser, type RideDto } from "@/lib/apiClient";
import { getSocketClient } from "@/lib/socketClient";
import {
  Navigation, Wallet, Users, LogOut, Power,
  MapPin, TrendingUp, ChevronRight, Star, Map,
  Play, XCircle, CheckCircle, Phone, MessageCircle, UserCircle2,
} from "lucide-react";

const toPhoneDigits = (value?: string | null) => (value || "").replace(/\D/g, "");
const toNumber = (value: unknown, fallback: number) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toIncomingRequestRides = (rides: RideDto[]) => rides
  .filter((ride) => ["pending", "requested"].includes(ride.status) && !ride.driverId)
  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

const DriverDashboard = () => {
  const { user, logout, login } = useAuth();
  const toast = useAppToast();
  const navigate = useNavigate();
  const [isOnline, setIsOnline] = useState(false);
  const [availableRides, setAvailableRides] = useState<RideDto[]>([]);
  const [myRides, setMyRides] = useState<RideDto[]>([]);
  const [busy, setBusy] = useState(false);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [rideBookingEnabled, setRideBookingEnabled] = useState(true);
  const [locationSyncIntervalSeconds, setLocationSyncIntervalSeconds] = useState(5);
  const [rideSupportPhone, setRideSupportPhone] = useState("+91 90000 00000");
  const [rideSecurityPhone, setRideSecurityPhone] = useState("+91 100");
  const [rideAmbulancePhone, setRideAmbulancePhone] = useState("+91 108");
  const [verificationStatus, setVerificationStatus] = useState<"pending" | "approved" | "rejected" | "not_submitted">("not_submitted");
  const [verificationNotes, setVerificationNotes] = useState("");
  const [verificationUploadBusy, setVerificationUploadBusy] = useState(false);
  const [cancelReasonKey, setCancelReasonKey] = useState("driver_delayed");
  const [cancelCustomReason, setCancelCustomReason] = useState("");
  const [newRequestPopupRide, setNewRequestPopupRide] = useState<RideDto | null>(null);
  const newRequestPopupTimerRef = useRef<number | null>(null);

  const cancellationReasons = [
    { key: "driver_delayed", label: "Driver delayed" },
    { key: "change_of_plans", label: "Change of plans" },
    { key: "emergency", label: "Emergency" },
    { key: "wrong_booking", label: "Wrong booking" },
    { key: "personal_reason", label: "Personal reason" },
    { key: "other", label: "Other" },
  ];

  const playRequestAlertTone = useCallback(() => {
    if (typeof window === "undefined") return;

    try {
      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;

      const audioContext = new AudioContextClass();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.type = "sine";
      oscillator.frequency.value = 880;
      gainNode.gain.value = 0.0001;

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      const now = audioContext.currentTime;
      gainNode.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

      oscillator.start(now);
      oscillator.stop(now + 0.2);

      oscillator.onended = () => {
        void audioContext.close();
      };
    } catch {
      // Ignore browser autoplay/context restrictions silently.
    }
  }, []);

  const showNewRequestPopup = useCallback((ride: RideDto) => {
    setNewRequestPopupRide(ride);

    if (newRequestPopupTimerRef.current) {
      window.clearTimeout(newRequestPopupTimerRef.current);
    }

    newRequestPopupTimerRef.current = window.setTimeout(() => {
      setNewRequestPopupRide((current) => (current?.id === ride.id ? null : current));
      newRequestPopupTimerRef.current = null;
    }, 5000);
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [profile, mine, available, verification, settingsResponse] = await Promise.all([
        apiClient.users.me() as Promise<{ user: { isOnline?: boolean; driverVerificationStatus?: "pending" | "approved" | "rejected" } }>,
        apiClient.rides.my(),
        apiClient.rides.available(),
        apiClient.drivers.verification(),
        apiClient.settings.list() as Promise<{ settings?: Array<{ key: string; value: unknown }> }>,
      ]);

      setIsOnline(Boolean(profile.user?.isOnline));
      setMyRides(mine.rides || []);
      setAvailableRides(toIncomingRequestRides(available.rides || []));
      setVerificationStatus(profile.user?.driverVerificationStatus || verification.verification?.status || "not_submitted");
      setVerificationNotes(verification.verification?.reviewNotes || "");

      const settingsMap = new globalThis.Map((settingsResponse.settings || []).map((item) => [item.key, item.value]));
      const bookingSetting = settingsMap.get("ride_booking_enabled");
      const syncSetting = settingsMap.get("ride_location_sync_interval_seconds");
      const supportPhoneSetting = settingsMap.get("ride_support_phone");
      const securityPhoneSetting = settingsMap.get("ride_security_phone");
      const ambulancePhoneSetting = settingsMap.get("ride_ambulance_phone");

      setRideBookingEnabled(bookingSetting === undefined ? true : bookingSetting === true || String(bookingSetting).toLowerCase() === "true");
      setLocationSyncIntervalSeconds(Math.max(1, toNumber(syncSetting, 5)));
      setRideSupportPhone(String(supportPhoneSetting || "+91 90000 00000"));
      setRideSecurityPhone(String(securityPhoneSetting || "+91 100"));
      setRideAmbulancePhone(String(ambulancePhoneSetting || "+91 108"));
    } catch (error) {
      toast.error("Unable to load driver dashboard", error, "Please refresh and try again.");
      setRideSupportPhone("+91 90000 00000");
      setRideSecurityPhone("+91 100");
      setRideAmbulancePhone("+91 108");
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void loadData();
    }, 5000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadData]);

  useEffect(() => () => {
    if (newRequestPopupTimerRef.current) {
      window.clearTimeout(newRequestPopupTimerRef.current);
    }
  }, []);

  useEffect(() => {
    const socket = getSocketClient();

    const onRideRequested = (incomingRide: RideDto) => {
      if (!incomingRide?.id) {
        void loadData();
        return;
      }

      if (!["pending", "requested"].includes(incomingRide.status) || incomingRide.driverId) {
        return;
      }

      let isNewRequest = false;
      setAvailableRides((prev) => {
        const exists = prev.some((ride) => ride.id === incomingRide.id);
        isNewRequest = !exists;
        const next = exists
          ? prev.map((ride) => (ride.id === incomingRide.id ? incomingRide : ride))
          : [incomingRide, ...prev];
        return toIncomingRequestRides(next);
      });

      if (isNewRequest) {
        playRequestAlertTone();
        showNewRequestPopup(incomingRide);
      }
    };

    const onRideUpdated = (updatedRide: RideDto) => {
      if (!updatedRide?.id) {
        void loadData();
        return;
      }

      setAvailableRides((prev) => {
        if (["pending", "requested"].includes(updatedRide.status) && !updatedRide.driverId) {
          const exists = prev.some((ride) => ride.id === updatedRide.id);
          const next = exists
            ? prev.map((ride) => (ride.id === updatedRide.id ? updatedRide : ride))
            : [updatedRide, ...prev];

          if (!exists) {
            playRequestAlertTone();
            showNewRequestPopup(updatedRide);
          }

          return toIncomingRequestRides(next);
        }

        return prev.filter((ride) => ride.id !== updatedRide.id);
      });

      if (!user?.id) {
        return;
      }

      setMyRides((prev) => {
        const belongsToMe = updatedRide.driverId === user.id;
        const exists = prev.some((ride) => ride.id === updatedRide.id);

        if (!belongsToMe) {
          return prev.filter((ride) => ride.id !== updatedRide.id);
        }

        return exists
          ? prev.map((ride) => (ride.id === updatedRide.id ? updatedRide : ride))
          : [updatedRide, ...prev];
      });
    };

    socket.on("newRideRequest", onRideRequested);
    socket.on("ride:requested", onRideRequested);
    socket.on("ride:updated", onRideUpdated);

    return () => {
      socket.off("newRideRequest", onRideRequested);
      socket.off("ride:requested", onRideRequested);
      socket.off("ride:updated", onRideUpdated);
    };
  }, [loadData, playRequestAlertTone, showNewRequestPopup, user?.id]);

  const incomingRequests = useMemo(() => toIncomingRequestRides(availableRides), [availableRides]);

  const activeRide = useMemo(
    () => myRides.find((ride) => ["accepted", "in_progress", "ongoing"].includes(ride.status)) || null,
    [myRides],
  );

  const activeContactName = activeRide?.student?.name || "Student";
  const activeContactPhoneRaw = activeRide?.student?.phone || "+91 90000 00000";
  const activeContactPhoneDigits = toPhoneDigits(activeContactPhoneRaw);
  const canContactActiveStudent = activeContactPhoneDigits.length >= 10;
  const activeCallHref = canContactActiveStudent ? `tel:${activeContactPhoneDigits}` : undefined;
  const activeChatHref = canContactActiveStudent
    ? `sms:${activeContactPhoneDigits}?body=${encodeURIComponent(`Hi ${activeContactName}, I am your driver for the current ride.`)}`
    : undefined;
  const supportDigits = toPhoneDigits(rideSupportPhone);
  const supportCallHref = supportDigits.length >= 10 ? `tel:${supportDigits}` : undefined;
  const securityDigits = toPhoneDigits(rideSecurityPhone);
  const securityCallHref = securityDigits.length >= 3 ? `tel:${securityDigits}` : undefined;
  const ambulanceDigits = toPhoneDigits(rideAmbulancePhone);
  const ambulanceCallHref = ambulanceDigits.length >= 3 ? `tel:${ambulanceDigits}` : undefined;

  const stats = useMemo(() => {
    const today = new Date().toDateString();
    const todayRides = myRides.filter((ride) => {
      const timestamp = ride.completedAt || ride.ongoingAt || ride.acceptedAt || ride.createdAt;
      return timestamp ? new Date(timestamp).toDateString() === today : false;
    });

    const total = myRides.length;
    const completed = myRides.filter((ride) => ride.status === "completed").length;
    const cancelled = myRides.filter((ride) => ride.status === "cancelled").length;
    const active = myRides.filter((ride) => ["accepted", "in_progress", "ongoing"].includes(ride.status)).length;

    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    const cancellationRate = total > 0 ? Math.round((cancelled / total) * 100) : 0;

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const thisMonth = myRides.filter((ride) => {
      const createdAt = new Date(ride.createdAt);
      return createdAt.getMonth() === currentMonth && createdAt.getFullYear() === currentYear;
    }).length;

    return {
      total,
      completed,
      cancelled,
      active,
      today: todayRides.length,
      thisMonth,
      completionRate,
      cancellationRate,
    };
  }, [myRides]);

  const estimatedEarnings = useMemo(() => {
    const ratePerCompletedRide = 50;
    return stats.completed * ratePerCompletedRide;
  }, [stats.completed]);

  const handleStatCardClick = (key: "total" | "today" | "active" | "completed" | "earnings") => {
    if (key === "total" || key === "today") {
      navigate("/rides", { state: { tab: "all" } });
      return;
    }

    if (key === "active") {
      if (activeRide) {
        navigate(`/ride-tracking/${activeRide.id}`);
      } else {
        navigate("/rides", { state: { tab: "active" } });
      }
      return;
    }

    if (key === "completed" || key === "earnings") {
      navigate("/rides", { state: { tab: "completed" } });
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/", { replace: true });
    window.location.assign("/");
  };

  const toggleOnline = async () => {
    setBusy(true);
    try {
      await apiClient.drivers.setOnline(!isOnline);
      setIsOnline(!isOnline);
      await loadData();
    } catch (error) {
      toast.error("Could not update online status", error);
    } finally {
      setBusy(false);
    }
  };

  const acceptRide = async (rideId: string) => {
    setBusy(true);
    try {
      await apiClient.rides.accept(rideId);
      setNewRequestPopupRide((current) => (current?.id === rideId ? null : current));
      await loadData();
      toast.success("Ride request accepted", "Student has been notified.");
    } catch (error) {
      toast.error("Could not accept ride", error);
    } finally {
      setBusy(false);
    }
  };

  const declineRide = async (rideId: string) => {
    setBusy(true);
    try {
      await apiClient.rides.deny(rideId);
      setNewRequestPopupRide((current) => (current?.id === rideId ? null : current));
      await loadData();
    } catch (error) {
      toast.error("Could not decline ride", error);
    } finally {
      setBusy(false);
    }
  };

  const startRide = async () => {
    if (!activeRide) return;
    setBusy(true);
    try {
      await apiClient.rides.start(activeRide.id);
      await loadData();
      toast.success("Ride started", "Trip status is now marked as in progress.");
    } catch (error) {
      toast.error("Could not start ride", error);
    } finally {
      setBusy(false);
    }
  };

  const completeRide = async () => {
    if (!activeRide) return;
    setBusy(true);
    try {
      await apiClient.rides.complete(activeRide.id);
      await loadData();
      toast.success("Ride completed", "Student can now submit rating and feedback.");
    } catch (error) {
      toast.error("Could not complete ride", error);
    } finally {
      setBusy(false);
    }
  };

  const cancelRide = async () => {
    if (!activeRide) return;
    setBusy(true);
    try {
      await apiClient.rides.cancel(activeRide.id, {
        reasonKey: cancelReasonKey,
        customReason: cancelReasonKey === "other" ? cancelCustomReason : undefined,
      });
      await loadData();
      toast.success("Ride cancelled", "The cancellation was saved successfully.");
    } catch (error) {
      toast.error("Could not cancel ride", error);
    } finally {
      setBusy(false);
    }
  };

  const card = (i: number) => ({
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: 0.1 + i * 0.06 },
  });

  const fileToDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });

  const handleUploadVerification = async (docType: "license" | "id_proof" | "vehicle_rc", file?: File | null) => {
    if (!file) return;

    setVerificationUploadBusy(true);
    try {
      const fileDataUrl = await fileToDataUrl(file);
      await apiClient.drivers.uploadVerification({
        docType,
        fileDataUrl,
        fileName: file.name,
      });
      await loadData();
      toast.success("Document uploaded", "Verification document submitted for admin review.");
    } catch (error) {
      toast.error("Upload failed", error);
    } finally {
      setVerificationUploadBusy(false);
    }
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-background relative overflow-hidden">
        <NewRideRequestPopup
          ride={newRequestPopupRide}
          busy={busy}
          onAccept={acceptRide}
          onIgnore={() => setNewRequestPopupRide(null)}
        />

        <div className="absolute inset-0 [background:var(--gradient-hero)]" />
        <div className="absolute top-1/4 right-1/4 w-[400px] h-[400px] rounded-full opacity-10 animate-pulse-glow [background:var(--gradient-glow)]" />

        <div className="relative z-10">
          <nav className="glass py-4 px-6 sticky top-0 z-20">
            <div className="container mx-auto flex items-center justify-between">
              <a href="/" className="flex items-center gap-2">
                <BrandIcon className="w-9 h-9" />
                <span className="text-xl font-bold font-display">
                  Campus<span className="gradient-text">Ride</span>
                </span>
              </a>
              <div className="flex items-center gap-3">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={toggleOnline}
                  disabled={busy}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    isOnline ? "btn-primary-gradient text-primary-foreground" : "bg-muted/50 text-muted-foreground"
                  }`}
                >
                  <Power className="w-4 h-4" />
                  <span className="hidden sm:inline">{isOnline ? "Online" : "Offline"}</span>
                </motion.button>
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
                  <span className="text-foreground font-medium">{user?.name}</span>
                </span>
                <motion.button whileTap={{ scale: 0.95 }} onClick={handleLogout} className="btn-outline-glow px-4 py-2 rounded-xl text-sm flex items-center gap-2">
                  <LogOut className="w-4 h-4" /> Logout
                </motion.button>
              </div>
            </div>
          </nav>

          <div className="container mx-auto px-6 py-8 space-y-8">
            <motion.div {...card(0)} className={`card-glass border ${isOnline ? "border-green-500/30" : "border-muted"}`}>
              <h1 className="text-2xl md:text-3xl font-bold font-display mb-1">
                {isOnline ? <>You're <span className="text-green-400">Online</span> 🟢</> : <>You're <span className="text-muted-foreground">Offline</span> ⚫</>}
              </h1>
              <p className="text-muted-foreground text-sm">{isOnline ? "Accepting ride requests in your campus zone" : "Go online to start receiving ride requests"}</p>
              <p className="text-xs text-muted-foreground mt-1">Driver GPS sync policy: every {locationSyncIntervalSeconds}s</p>
              {!rideBookingEnabled && (
                <p className="text-xs text-destructive mt-1">New ride booking is currently disabled by admin.</p>
              )}
            </motion.div>

            <motion.div {...card(1)} className="card-glass">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold font-display">Verification & Score</h3>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  verificationStatus === "approved"
                    ? "bg-green-500/20 text-green-400"
                    : verificationStatus === "rejected"
                      ? "bg-destructive/20 text-destructive"
                      : "bg-yellow-500/20 text-yellow-400"
                }`}>{verificationStatus}</span>
              </div>
              <p className="text-xs text-muted-foreground mb-2">Driver performance score: <span className="text-foreground font-semibold">{user?.driverPerformanceScore || 60}</span></p>
              {verificationNotes ? <p className="text-xs text-muted-foreground mb-2">Review notes: {verificationNotes}</p> : null}
              <div className="grid sm:grid-cols-3 gap-2">
                <label className="text-xs bg-muted/40 rounded-lg px-2 py-2 cursor-pointer">
                  License
                  <input type="file" accept="image/*,.pdf" className="hidden" disabled={verificationUploadBusy} onChange={(event) => void handleUploadVerification("license", event.target.files?.[0])} />
                </label>
                <label className="text-xs bg-muted/40 rounded-lg px-2 py-2 cursor-pointer">
                  ID Proof
                  <input type="file" accept="image/*,.pdf" className="hidden" disabled={verificationUploadBusy} onChange={(event) => void handleUploadVerification("id_proof", event.target.files?.[0])} />
                </label>
                <label className="text-xs bg-muted/40 rounded-lg px-2 py-2 cursor-pointer">
                  Vehicle RC
                  <input type="file" accept="image/*,.pdf" className="hidden" disabled={verificationUploadBusy} onChange={(event) => void handleUploadVerification("vehicle_rc", event.target.files?.[0])} />
                </label>
              </div>

              <div className="mt-3 border-t border-border/50 pt-3">
                <p className="text-xs text-muted-foreground mb-2">Emergency contacts</p>
                <div className="grid sm:grid-cols-3 gap-2">
                  {supportCallHref ? (
                    <a href={supportCallHref} className="px-2 py-2 rounded-lg bg-primary/20 text-primary hover:bg-primary/30 text-xs text-center font-semibold transition-colors">
                      <span className="block">Support</span>
                      <span className="block text-[10px] text-muted-foreground">{rideSupportPhone}</span>
                    </a>
                  ) : (
                    <button type="button" disabled className="px-2 py-2 rounded-lg bg-muted text-muted-foreground text-xs text-center font-semibold">
                      <span className="block">Support</span>
                      <span className="block text-[10px]">{rideSupportPhone}</span>
                    </button>
                  )}
                  {securityCallHref ? (
                    <a href={securityCallHref} className="px-2 py-2 rounded-lg bg-primary/20 text-primary hover:bg-primary/30 text-xs text-center font-semibold transition-colors">
                      <span className="block">Security</span>
                      <span className="block text-[10px] text-muted-foreground">{rideSecurityPhone}</span>
                    </a>
                  ) : (
                    <button type="button" disabled className="px-2 py-2 rounded-lg bg-muted text-muted-foreground text-xs text-center font-semibold">
                      <span className="block">Security</span>
                      <span className="block text-[10px]">{rideSecurityPhone}</span>
                    </button>
                  )}
                  {ambulanceCallHref ? (
                    <a href={ambulanceCallHref} className="px-2 py-2 rounded-lg bg-primary/20 text-primary hover:bg-primary/30 text-xs text-center font-semibold transition-colors">
                      <span className="block">Ambulance</span>
                      <span className="block text-[10px] text-muted-foreground">{rideAmbulancePhone}</span>
                    </a>
                  ) : (
                    <button type="button" disabled className="px-2 py-2 rounded-lg bg-muted text-muted-foreground text-xs text-center font-semibold">
                      <span className="block">Ambulance</span>
                      <span className="block text-[10px]">{rideAmbulancePhone}</span>
                    </button>
                  )}
                </div>
              </div>
            </motion.div>

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              {[
                { key: "total", icon: Wallet, label: "Total Rides", value: String(stats.total), change: "all time" },
                { key: "today", icon: Navigation, label: "Rides Today", value: String(stats.today), change: "today" },
                { key: "active", icon: Users, label: "Active", value: String(stats.active), change: "in progress" },
                { key: "completed", icon: Star, label: "Completed", value: String(stats.completed), change: "finished" },
                { key: "earnings", icon: Wallet, label: "Earnings", value: `₹${estimatedEarnings}`, change: "estimated" },
              ].map((s, i) => (
                <motion.div
                  key={s.label}
                  {...card(i + 1)}
                  onClick={() => handleStatCardClick(s.key as "total" | "today" | "active" | "completed" | "earnings")}
                  className="card-glass cursor-pointer"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                      <s.icon className="w-5 h-5 text-primary" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold font-display">{s.value}</p>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <span className="text-xs text-green-400 flex items-center gap-0.5">
                      <TrendingUp className="w-3 h-3" /> {s.change}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>

            <motion.div {...card(6)} className="card-glass mt-4">
              <div className="flex items-start justify-between mb-4">
                <h3 className="font-semibold font-display text-base">Performance Snapshot</h3>
                <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full font-medium">This month: {stats.thisMonth}</span>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Completion Rate</span>
                    <span className="font-semibold text-foreground">{stats.completionRate}%</span>
                  </div>
                  <progress
                    max={100}
                    value={stats.completionRate}
                    className="w-full h-2 rounded-full overflow-hidden [&::-webkit-progress-bar]:bg-muted/40 [&::-webkit-progress-value]:bg-primary [&::-moz-progress-bar]:bg-primary"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Cancellation Rate</span>
                    <span className="font-semibold text-foreground">{stats.cancellationRate}%</span>
                  </div>
                  <progress
                    max={100}
                    value={stats.cancellationRate}
                    className="w-full h-2 rounded-full overflow-hidden [&::-webkit-progress-bar]:bg-muted/40 [&::-webkit-progress-value]:bg-destructive/80 [&::-moz-progress-bar]:bg-destructive/80"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">Cancelled rides: {stats.cancelled}</p>
                </div>
              </div>
            </motion.div>

            <div className="grid lg:grid-cols-2 gap-6">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold font-display">Incoming Requests</h2>
                  <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full font-medium">{incomingRequests.length} pending</span>
                </div>
                <IncomingRequestsList
                  rides={incomingRequests}
                  busy={busy}
                  card={card}
                  onAccept={acceptRide}
                  onDecline={declineRide}
                />
              </div>

              <div>
                {activeRide && (
                  <motion.div {...card(8)} className="card-glass border border-primary/30 mb-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl btn-primary-gradient flex items-center justify-center">
                          <Map className="w-5 h-5 text-primary-foreground" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm">Active — {activeRide.pickup?.label || "—"} → {activeRide.drop?.label || "—"}</p>
                          <p className="text-xs text-muted-foreground">Status: {activeRide.status}</p>
                          <p className="text-xs text-muted-foreground">Student: {activeContactName}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {activeRide.passengers || 1}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {activeRide.status !== "cancelled" && Boolean(activeRide.verificationCode) && (
                          <span className="text-[11px] font-bold bg-primary/20 text-primary px-2 py-1 rounded-lg">
                            Code: {activeRide.verificationCode}
                          </span>
                        )}
                        <motion.button whileTap={{ scale: 0.95 }} onClick={() => navigate(`/ride-tracking/${activeRide.id}`)} className="btn-primary-gradient px-3 py-1.5 rounded-lg text-xs font-semibold">Track</motion.button>
                      </div>
                    </div>
                    <div className="flex gap-2 mb-2">
                      {activeCallHref ? (
                        <a href={activeCallHref} className="flex-1 bg-primary/20 hover:bg-primary/30 text-primary py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors">
                          <Phone className="w-3.5 h-3.5" /> Call Student
                        </a>
                      ) : (
                        <button type="button" disabled className="flex-1 bg-muted/50 text-muted-foreground py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-not-allowed">
                          <Phone className="w-3.5 h-3.5" /> Call Student
                        </button>
                      )}
                      {activeChatHref ? (
                        <a href={activeChatHref} className="flex-1 bg-primary/20 hover:bg-primary/30 text-primary py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors">
                          <MessageCircle className="w-3.5 h-3.5" /> Chat Student
                        </a>
                      ) : (
                        <button type="button" disabled className="flex-1 bg-muted/50 text-muted-foreground py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-not-allowed">
                          <MessageCircle className="w-3.5 h-3.5" /> Chat Student
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mb-2">
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
                    <div className="flex gap-2">
                      {activeRide.status === "accepted" && (
                        <motion.button whileTap={{ scale: 0.95 }} onClick={startRide} disabled={busy} className="flex-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors">
                          <Play className="w-3.5 h-3.5" /> Start Ride
                        </motion.button>
                      )}
                      {["in_progress", "ongoing"].includes(activeRide.status) && (
                        <motion.button whileTap={{ scale: 0.95 }} onClick={completeRide} disabled={busy} className="flex-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors">
                          <CheckCircle className="w-3.5 h-3.5" /> Complete Ride
                        </motion.button>
                      )}
                      {activeRide.status === "accepted" && (
                        <motion.button whileTap={{ scale: 0.95 }} onClick={cancelRide} disabled={busy} className="flex-1 bg-destructive/20 hover:bg-destructive/30 text-destructive py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors">
                          <XCircle className="w-3.5 h-3.5" /> Cancel Ride
                        </motion.button>
                      )}
                    </div>
                  </motion.div>
                )}

                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold font-display">My Rides</h2>
                  <button onClick={() => navigate("/rides")} className="text-sm text-primary hover:underline flex items-center gap-1">
                    View all <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                <RideHistoryTabs compact />
              </div>
            </div>
          </div>
        </div>
      </div>

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
    </PageTransition>
  );
};

export default DriverDashboard;
