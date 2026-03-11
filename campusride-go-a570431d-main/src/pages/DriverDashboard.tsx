import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import PageTransition from "@/components/PageTransition";
import RideHistoryTabs from "@/components/ride/RideHistoryTabs";
import IncomingRequestsList from "@/components/ride/IncomingRequestsList";
import NewRideRequestPopup from "@/components/ride/NewRideRequestPopup";
import RideCard from "@/components/ride/RideCard";
import { useAppToast } from "@/hooks/use-app-toast";
import BrandIcon from "@/components/BrandIcon";
import NotificationBell from "@/components/NotificationBell";
import ProfileDialog from "@/components/ProfileDialog";
import { apiClient, type AuthUser, type RideDto } from "@/lib/apiClient";
import { buildTodayEarningsFromRides } from "@/lib/driverEarnings";
import { getSocketClient } from "@/lib/socketClient";
import {
  Navigation, Wallet, Users, LogOut, Power,
  TrendingUp, ChevronRight, Star,
  UserCircle2,
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

const toQueueRides = (rides: RideDto[]) => rides
  .slice()
  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

type RideActionType = "accept" | "decline" | "start" | "complete" | "cancel";

type TodayEarningsSummary = {
  totalEarnings: number;
  platformCharges: number;
  netDriverEarnings: number;
  completedRides: number;
};

const DriverDashboard = () => {
  const { user, logout, login } = useAuth();
  const toast = useAppToast();
  const navigate = useNavigate();
  const [isOnline, setIsOnline] = useState<boolean>(
    () => sessionStorage.getItem("driver_is_online") === "true",
  );
  const [availableRides, setAvailableRides] = useState<RideDto[]>([]);
  const [myRides, setMyRides] = useState<RideDto[]>([]);
  const [onlineBusy, setOnlineBusy] = useState(false);
  const [rideActionBusyByRide, setRideActionBusyByRide] = useState<Record<string, boolean>>({});
  const [rideActionTypeByRide, setRideActionTypeByRide] = useState<Record<string, RideActionType>>({});
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [rideBookingEnabled, setRideBookingEnabled] = useState(true);
  const [locationSyncIntervalSeconds, setLocationSyncIntervalSeconds] = useState(5);
  const [rideSupportPhone, setRideSupportPhone] = useState("+91 90000 00000");
  const [rideSecurityPhone, setRideSecurityPhone] = useState("+91 100");
  const [rideAmbulancePhone, setRideAmbulancePhone] = useState("+91 108");
  const [verificationStatus, setVerificationStatus] = useState<"pending" | "approved" | "rejected" | "not_submitted">("not_submitted");
  const [verificationNotes, setVerificationNotes] = useState("");
  const [verificationUploadBusy, setVerificationUploadBusy] = useState(false);
  const [cancelReasonByRide, setCancelReasonByRide] = useState<Record<string, string>>({});
  const [cancelCustomReasonByRide, setCancelCustomReasonByRide] = useState<Record<string, string>>({});
  const [verificationCodeByRide, setVerificationCodeByRide] = useState<Record<string, string>>({});
  const [verificationModalRideId, setVerificationModalRideId] = useState<string | null>(null);
  const [verificationModalCode, setVerificationModalCode] = useState("");
  const [newRequestPopupRide, setNewRequestPopupRide] = useState<RideDto | null>(null);
  const [rideSearch, setRideSearch] = useState("");
  const [todayEarnings, setTodayEarnings] = useState<TodayEarningsSummary>({
    totalEarnings: 0,
    platformCharges: 0,
    netDriverEarnings: 0,
    completedRides: 0,
  });
  const newRequestPopupTimerRef = useRef<number | null>(null);

  const cancellationReasons = [
    { key: "driver_delayed", label: "Driver delayed" },
    { key: "change_of_plans", label: "Change of plans" },
    { key: "emergency", label: "Emergency" },
    { key: "wrong_booking", label: "Wrong booking" },
    { key: "personal_reason", label: "Personal reason" },
    { key: "other", label: "Other" },
  ];

  const setRideActionBusy = useCallback((rideId: string, isBusy: boolean) => {
    setRideActionBusyByRide((prev) => {
      if (isBusy) {
        return { ...prev, [rideId]: true };
      }

      if (!prev[rideId]) {
        return prev;
      }

      const next = { ...prev };
      delete next[rideId];
      return next;
    });
  }, []);

  const isRideBusy = useCallback((rideId: string) => Boolean(rideActionBusyByRide[rideId]), [rideActionBusyByRide]);

  const setRideActionType = useCallback((rideId: string, actionType: RideActionType | null) => {
    setRideActionTypeByRide((prev) => {
      if (!actionType) {
        if (!prev[rideId]) return prev;
        const next = { ...prev };
        delete next[rideId];
        return next;
      }

      return { ...prev, [rideId]: actionType };
    });
  }, []);

  const getRideActionLabel = useCallback((rideId: string): string | undefined => {
    switch (rideActionTypeByRide[rideId]) {
      case "accept":
        return "Accepting...";
      case "decline":
        return "Denying...";
      case "start":
        return "Starting...";
      case "complete":
        return "Completing...";
      case "cancel":
        return "Cancelling...";
      default:
        return undefined;
    }
  }, [rideActionTypeByRide]);

  const upsertMyRide = useCallback((ride: RideDto) => {
    setMyRides((prev) => {
      const exists = prev.some((item) => item.id === ride.id);
      return toQueueRides(exists ? prev.map((item) => (item.id === ride.id ? ride : item)) : [...prev, ride]);
    });
  }, []);

  const patchMyRide = useCallback((rideId: string, patcher: (ride: RideDto) => RideDto) => {
    setMyRides((prev) => {
      let found = false;
      const next = prev.map((ride) => {
        if (ride.id !== rideId) return ride;
        found = true;
        return patcher(ride);
      });
      return found ? toQueueRides(next) : prev;
    });
  }, []);

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
      const [profileResult, mineResult, availableResult, verificationResult, settingsResult] = await Promise.allSettled([
        apiClient.users.me() as Promise<{ user: { isOnline?: boolean; driverVerificationStatus?: "pending" | "approved" | "rejected" } }>,
        apiClient.rides.my(),
        apiClient.rides.available(),
        apiClient.drivers.verification(),
        apiClient.settings.list() as Promise<{ settings?: Array<{ key: string; value: unknown }> }>,
      ]);

      const profile = profileResult.status === "fulfilled" ? profileResult.value : null;
      const mine = mineResult.status === "fulfilled" ? mineResult.value : null;
      const available = availableResult.status === "fulfilled" ? availableResult.value : null;
      const verification = verificationResult.status === "fulfilled" ? verificationResult.value : null;
      const settingsResponse = settingsResult.status === "fulfilled" ? settingsResult.value : null;

      if (!profile || !mine || !available) {
        throw new Error("Failed to load core driver ride data");
      }

      const onlineStatus = Boolean(profile.user?.isOnline);
      sessionStorage.setItem("driver_is_online", String(onlineStatus));
      setIsOnline(onlineStatus);
      const myRideList = toQueueRides(mine.rides || []);
      setMyRides(myRideList);
      setAvailableRides(toIncomingRequestRides(available.rides || []));
      setTodayEarnings(buildTodayEarningsFromRides(myRideList).summary || {
        totalEarnings: 0,
        platformCharges: 0,
        netDriverEarnings: 0,
        completedRides: 0,
      });
      setVerificationStatus(profile.user?.driverVerificationStatus || verification?.verification?.status || "not_submitted");
      setVerificationNotes(verification?.verification?.reviewNotes || "");

      const settingsMap = new globalThis.Map((settingsResponse?.settings || []).map((item) => [item.key, item.value]));
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
      // Keep incoming request list fresh even if realtime events are delayed.
      void loadData();
    }, 20000);

    const socket = getSocketClient();
    const onSocketReconnect = () => {
      void loadData();
    };
    socket.on("connect", onSocketReconnect);

    return () => {
      window.clearInterval(intervalId);
      socket.off("connect", onSocketReconnect);
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
          return toQueueRides(prev.filter((ride) => ride.id !== updatedRide.id));
        }

        const next = exists
          ? prev.map((ride) => (ride.id === updatedRide.id ? updatedRide : ride))
          : [...prev, updatedRide];

        return toQueueRides(next);
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

  const matchesSearch = useCallback((ride: RideDto) => {
    const searchTerm = rideSearch.trim().toLowerCase();
    if (!searchTerm) return true;

    const student = (ride.student?.name || "").toLowerCase();
    const pickup = (ride.pickup?.label || "").toLowerCase();
    const drop = (ride.drop?.label || "").toLowerCase();
    return student.includes(searchTerm) || pickup.includes(searchTerm) || drop.includes(searchTerm);
  }, [rideSearch]);

  const activeRides = useMemo(
    () => toQueueRides(myRides.filter((ride) => ["accepted", "in_progress", "ongoing"].includes(ride.status))).filter(matchesSearch),
    [myRides, matchesSearch],
  );

  const activeRide = activeRides[0] || null;

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
    const active = activeRides.length;

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
  }, [activeRides.length, myRides]);

  const estimatedEarnings = useMemo(() => {
    return myRides
      .filter((ride) => ride.status === "completed")
      .reduce((total, ride) => total + Number(ride.fareBreakdown?.totalFare || 0) - Number(ride.fareBreakdown?.platformFee || 0), 0)
      .toFixed(2);
  }, [myRides]);

  const handleStatCardClick = (key: "total" | "today" | "active" | "completed" | "earnings" | "today-earnings") => {
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
      return;
    }

    if (key === "today-earnings") {
      navigate("/driver-dashboard/today-earnings");
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/", { replace: true });
    window.location.assign("/");
  };

  const toggleOnline = async () => {
    setOnlineBusy(true);
    try {
      const nextOnline = !isOnline;
      await apiClient.drivers.setOnline(nextOnline);
      sessionStorage.setItem("driver_is_online", String(nextOnline));
      setIsOnline(nextOnline);
      await loadData();
    } catch (error) {
      toast.error("Could not update online status", error);
    } finally {
      setOnlineBusy(false);
    }
  };

  const acceptRide = async (rideId: string) => {
    setRideActionBusy(rideId, true);
    setRideActionType(rideId, "accept");
    const nowIso = new Date().toISOString();
    const sourceRide = availableRides.find((ride) => ride.id === rideId)
      || (newRequestPopupRide?.id === rideId ? newRequestPopupRide : null);

    setAvailableRides((prev) => prev.filter((ride) => ride.id !== rideId));
    setNewRequestPopupRide((current) => (current?.id === rideId ? null : current));

    if (sourceRide) {
      upsertMyRide({
        ...sourceRide,
        status: "accepted",
        driverId: user?.id || sourceRide.driverId,
        acceptedAt: sourceRide.acceptedAt || nowIso,
        updatedAt: nowIso,
      });
    }

    try {
      await apiClient.rides.accept(rideId);
      toast.success("Ride request accepted", "Student has been notified.");
    } catch (error) {
      await loadData();
      toast.error("Could not accept ride", error);
    } finally {
      setRideActionBusy(rideId, false);
      setRideActionType(rideId, null);
    }
  };

  const declineRide = async (rideId: string) => {
    setRideActionBusy(rideId, true);
    setRideActionType(rideId, "decline");
    setAvailableRides((prev) => prev.filter((ride) => ride.id !== rideId));
    setNewRequestPopupRide((current) => (current?.id === rideId ? null : current));

    try {
      await apiClient.rides.deny(rideId);
    } catch (error) {
      await loadData();
      toast.error("Could not decline ride", error);
    } finally {
      setRideActionBusy(rideId, false);
      setRideActionType(rideId, null);
    }
  };

  const startRide = async (rideId: string) => {
    setRideActionBusy(rideId, true);
    setRideActionType(rideId, "start");
    const nowIso = new Date().toISOString();
    patchMyRide(rideId, (ride) => ({
      ...ride,
      status: "in_progress",
      ongoingAt: ride.ongoingAt || nowIso,
      updatedAt: nowIso,
    }));

    try {
      await apiClient.rides.start(rideId);
      toast.success("Ride started", "Trip status is now marked as in progress.");
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : "";
      if (message.includes("verification code")) {
        setVerificationModalRideId(rideId);
        setVerificationModalCode(verificationCodeByRide[rideId] || "");
        toast.info("Verification required", "Enter the student code to start this ride.");
        setRideActionBusy(rideId, false);
        setRideActionType(rideId, null);
        return;
      }
      await loadData();
      toast.error("Could not start ride", error);
    } finally {
      setRideActionBusy(rideId, false);
      setRideActionType(rideId, null);
    }
  };

  const submitVerificationAndStart = async () => {
    const rideId = verificationModalRideId;
    if (!rideId) return;

    const verificationCode = verificationModalCode.trim();
    if (!verificationCode) {
      toast.error("Verification code required", "Enter the student code before starting the ride.");
      return;
    }

    setVerificationCodeByRide((prev) => ({ ...prev, [rideId]: verificationCode }));
    setRideActionBusy(rideId, true);
    setRideActionType(rideId, "start");

    try {
      await apiClient.rides.verify(rideId, verificationCode);
      setVerificationModalRideId(null);
      setVerificationModalCode("");
      toast.success("Ride started", "Trip status is now marked as in progress.");
    } catch (error) {
      await loadData();
      toast.error("Could not start ride", error);
    } finally {
      setRideActionBusy(rideId, false);
      setRideActionType(rideId, null);
    }
  };

  const completeRide = async (rideId: string) => {
    setRideActionBusy(rideId, true);
    setRideActionType(rideId, "complete");
    const nowIso = new Date().toISOString();
    patchMyRide(rideId, (ride) => ({
      ...ride,
      status: "completed",
      completedAt: ride.completedAt || nowIso,
      updatedAt: nowIso,
    }));

    try {
      await apiClient.rides.complete(rideId);
      toast.success("Ride completed", "Student can now submit rating and feedback.");
    } catch (error) {
      await loadData();
      toast.error("Could not complete ride", error);
    } finally {
      setRideActionBusy(rideId, false);
      setRideActionType(rideId, null);
    }
  };

  const cancelRide = async (rideId: string) => {
    const reasonKey = cancelReasonByRide[rideId] || "driver_delayed";
    const customReason = cancelCustomReasonByRide[rideId] || "";
    const selectedReason = cancellationReasons.find((item) => item.key === reasonKey)?.label || "Other";
    const reasonText = reasonKey === "other"
      ? (customReason.trim() || "Other")
      : selectedReason;

    setRideActionBusy(rideId, true);
    setRideActionType(rideId, "cancel");
    const nowIso = new Date().toISOString();
    patchMyRide(rideId, (ride) => ({
      ...ride,
      status: "cancelled",
      cancelReason: reasonKey === "other" && customReason.trim() ? customReason.trim() : reasonKey,
      cancelledAt: ride.cancelledAt || nowIso,
      updatedAt: nowIso,
    }));

    try {
      await apiClient.rides.cancel(rideId, {
        reason: reasonText,
        reasonKey,
        customReason: reasonKey === "other" ? customReason : undefined,
      });
      toast.success("Ride cancelled", "The cancellation was saved successfully.");
    } catch (error) {
      await loadData();
      toast.error("Could not cancel ride", error);
    } finally {
      setRideActionBusy(rideId, false);
      setRideActionType(rideId, null);
    }
  };

  const handleCancelReasonKeyChange = (rideId: string, reasonKey: string) => {
    setCancelReasonByRide((prev) => ({ ...prev, [rideId]: reasonKey }));
  };

  const handleCancelCustomReasonChange = (rideId: string, reasonText: string) => {
    setCancelCustomReasonByRide((prev) => ({ ...prev, [rideId]: reasonText }));
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
          busy={Boolean(newRequestPopupRide && isRideBusy(newRequestPopupRide.id))}
          busyLabel={newRequestPopupRide ? getRideActionLabel(newRequestPopupRide.id) : undefined}
          onAccept={acceptRide}
          onIgnore={() => setNewRequestPopupRide(null)}
        />

        {verificationModalRideId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="card-glass border border-primary/40 w-full max-w-sm">
              <h3 className="text-base font-semibold font-display mb-1">Enter Verification Code</h3>
              <p className="text-xs text-muted-foreground mb-3">Ask student for the ride code before starting.</p>
              <input
                value={verificationModalCode}
                onChange={(event) => setVerificationModalCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                maxLength={6}
                autoFocus
                placeholder="Enter code"
                className="w-full bg-muted/50 border border-border rounded-xl py-2.5 px-3 text-sm"
              />
              <div className="flex gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => {
                    setVerificationModalRideId(null);
                    setVerificationModalCode("");
                  }}
                  className="flex-1 bg-muted/50 hover:bg-muted py-2 rounded-xl text-xs font-medium text-muted-foreground"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isRideBusy(verificationModalRideId)}
                  onClick={() => void submitVerificationAndStart()}
                  className="flex-1 btn-primary-gradient py-2 rounded-xl text-xs font-semibold disabled:opacity-60"
                >
                  {isRideBusy(verificationModalRideId) ? "Starting..." : "Verify & Start"}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="absolute inset-0 [background:var(--gradient-hero)]" />
        <div className="absolute top-1/4 right-1/4 w-[min(60vw,400px)] h-[min(60vw,400px)] rounded-full opacity-10 animate-pulse-glow [background:var(--gradient-glow)]" />

        <div className="relative z-10">
          <nav className="glass py-3 sm:py-4 px-3 sm:px-6 sticky top-0 z-20">
            <div className="container mx-auto flex items-center justify-between gap-2 flex-wrap">
              <a href="/" className="flex items-center gap-2">
                <BrandIcon className="w-9 h-9" />
                <span className="text-base sm:text-xl font-bold font-display">
                  Campus<span className="gradient-text">Ride</span>
                </span>
              </a>
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={toggleOnline}
                  disabled={onlineBusy}
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
                <motion.button whileTap={{ scale: 0.95 }} onClick={handleLogout} className="btn-outline-glow px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm flex items-center gap-2">
                  <LogOut className="w-4 h-4" /> Logout
                </motion.button>
              </div>
            </div>
          </nav>

          <div className="container mx-auto px-3 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">
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

            <div className="grid grid-cols-2 xl:grid-cols-6 gap-4">
              {[
                { key: "total", icon: Wallet, label: "Total Rides", value: String(stats.total), change: "all time" },
                { key: "today", icon: Navigation, label: "Rides Today", value: String(stats.today), change: "today" },
                { key: "active", icon: Users, label: "Active", value: String(stats.active), change: "in progress" },
                { key: "completed", icon: Star, label: "Completed", value: String(stats.completed), change: "finished" },
                { key: "earnings", icon: Wallet, label: "Earnings", value: `₹${estimatedEarnings}`, change: "net total" },
                { key: "today-earnings", icon: TrendingUp, label: "Today Earnings", value: `₹${todayEarnings.netDriverEarnings.toFixed(2)}`, change: `${todayEarnings.completedRides} completed` },
              ].map((s, i) => (
                <motion.div
                  key={s.label}
                  {...card(i + 1)}
                  onClick={() => handleStatCardClick(s.key as "total" | "today" | "active" | "completed" | "earnings" | "today-earnings")}
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
                  isRideBusy={isRideBusy}
                  getRideActionLabel={getRideActionLabel}
                  card={card}
                  onAccept={acceptRide}
                  onDecline={declineRide}
                />
              </div>

              <div>
                <div className="space-y-3 mb-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold font-display text-sm">Assigned Rides</h3>
                    <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full font-medium">
                      {activeRides.length} assigned rides
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    <input
                      value={rideSearch}
                      onChange={(event) => setRideSearch(event.target.value)}
                      placeholder="Search by student, pickup, drop"
                      className="bg-muted/50 border border-border rounded-xl py-2 px-3 text-xs"
                    />
                  </div>

                  {activeRides.length === 0 && (
                    <div className="card-glass text-sm text-muted-foreground">No assigned rides match your current search.</div>
                  )}

                  {activeRides.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-green-400">Assigned Rides (accepted + in_progress)</h4>
                      {activeRides.map((ride, index) => (
                        <RideCard
                          key={ride.id}
                          ride={ride}
                          busy={isRideBusy(ride.id)}
                          isActive
                          queuePosition={index + 1}
                          isLatest={index === 0}
                          actionLabel={getRideActionLabel(ride.id)}
                          cancelReasonKey={cancelReasonByRide[ride.id] || "driver_delayed"}
                          cancelCustomReason={cancelCustomReasonByRide[ride.id] || ""}
                          cancellationReasons={cancellationReasons}
                          onCancelReasonKeyChange={handleCancelReasonKeyChange}
                          onCancelCustomReasonChange={handleCancelCustomReasonChange}
                          onStart={startRide}
                          onCancel={cancelRide}
                          onComplete={completeRide}
                          onTrack={(rideId) => navigate(`/ride-tracking/${rideId}`)}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold font-display">My Rides</h2>
                  <button onClick={() => navigate("/rides")} className="text-sm text-primary hover:underline flex items-center gap-1">
                    View all <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                <RideHistoryTabs
                  compact
                  allowedTabs={["all", "completed", "cancelled"]}
                  allTabFilter="finalizedOnly"
                />
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
