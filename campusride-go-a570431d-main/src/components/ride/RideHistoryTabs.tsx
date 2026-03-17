import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { MapPin, Clock, CheckCircle, XCircle, Navigation, List } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient, type RideDto } from "@/lib/apiClient";
import { useAppToast } from "@/hooks/use-app-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type RideStatus = "all" | "active" | "completed" | "cancelled";

const tabs: { label: string; value: RideStatus; icon: typeof CheckCircle }[] = [
  { label: "All", value: "all", icon: List },
  { label: "Active", value: "active", icon: Navigation },
  { label: "Completed", value: "completed", icon: CheckCircle },
  { label: "Cancelled", value: "cancelled", icon: XCircle },
];

const statusColors: Record<RideStatus, string> = {
  all: "text-primary",
  active: "text-blue-400",
  completed: "text-green-400",
  cancelled: "text-destructive",
};

interface RideHistoryTabsProps {
  compact?: boolean;
  initialTab?: RideStatus;
  allowedTabs?: RideStatus[];
  allTabFilter?: "allRides" | "finalizedOnly";
  refreshKey?: number;
}

const RideHistoryTabs = ({
  compact = false,
  initialTab = "all",
  allowedTabs,
  allTabFilter = "allRides",
  refreshKey = 0,
}: RideHistoryTabsProps) => {
  const { user } = useAuth();
  const toast = useAppToast();
  const [activeTab, setActiveTab] = useState<RideStatus>(initialTab);
  const [rides, setRides] = useState<RideDto[]>([]);
  const [loadingRides, setLoadingRides] = useState(true);
  const [selectedRide, setSelectedRide] = useState<RideDto | null>(null);

  const visibleTabs = useMemo(() => {
    const configuredTabs = allowedTabs && allowedTabs.length > 0 ? allowedTabs : tabs.map((tab) => tab.value);
    return tabs.filter((tab) => configuredTabs.includes(tab.value));
  }, [allowedTabs]);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (!visibleTabs.some((tab) => tab.value === activeTab)) {
      setActiveTab(visibleTabs[0]?.value || "all");
    }
  }, [activeTab, visibleTabs]);

  useEffect(() => {
    let mounted = true;

    const loadRides = async () => {
      setLoadingRides(true);
      try {
        const response = await apiClient.rides.my();

        if (mounted) {
          setRides(response.rides || []);
        }
      } catch (error) {
        if (mounted) {
          toast.error("Unable to load ride history", error, "Please refresh and try again.");
        }
      } finally {
        if (mounted) {
          setLoadingRides(false);
        }
      }
    };

    loadRides();
    return () => {
      mounted = false;
    };
  }, [toast, user?.role, refreshKey]);

  const filtered = useMemo(() => {
    return rides.filter((ride) => {
      if (activeTab === "all") {
        if (allTabFilter === "finalizedOnly") {
          return ride.status === "completed" || ride.status === "cancelled";
        }
        return true;
      }
      if (activeTab === "completed") return ride.status === "completed";
      if (activeTab === "cancelled") return ride.status === "cancelled";
      return ["pending", "accepted", "in_progress", "requested", "ongoing"].includes(ride.status);
    });
  }, [rides, activeTab, allTabFilter]);

  const statusCounts = useMemo(() => ({
    all: allTabFilter === "finalizedOnly"
      ? rides.filter((ride) => ride.status === "completed" || ride.status === "cancelled").length
      : rides.length,
    active: rides.filter((ride) => ["pending", "accepted", "in_progress", "requested", "ongoing"].includes(ride.status)).length,
    completed: rides.filter((ride) => ride.status === "completed").length,
    cancelled: rides.filter((ride) => ride.status === "cancelled").length,
  }), [rides, allTabFilter]);

  const formatDate = (value: string | null) => {
    if (!value) return "—";
    return new Date(value).toLocaleString();
  };

  const statusTone = (status: RideDto["status"]) => {
    if (status === "completed") return "text-green-400";
    if (status === "cancelled") return "text-destructive";
    return "text-blue-400";
  };

  const detailRows = selectedRide
    ? [
        { label: "Ride ID", value: selectedRide.id },
        { label: "Status", value: selectedRide.status.replace(/_/g, " ") },
        { label: "Pickup", value: selectedRide.pickup?.label || "—" },
        { label: "Drop", value: selectedRide.drop?.label || "—" },
        { label: "Scheduled For", value: formatDate(selectedRide.scheduledFor || null) },
        { label: "Requested At", value: formatDate(selectedRide.requestedAt) },
        { label: "Accepted At", value: formatDate(selectedRide.acceptedAt) },
        { label: "Ride Started", value: formatDate(selectedRide.ongoingAt) },
        { label: "Completed At", value: formatDate(selectedRide.completedAt) },
        { label: "Cancelled At", value: formatDate(selectedRide.cancelledAt) },
        { label: "Passengers", value: String(selectedRide.passengers || 1) },
        { label: "Passenger Names", value: selectedRide.passengerNames?.length ? selectedRide.passengerNames.join(", ") : "—" },
        { label: "Driver", value: selectedRide.driver?.name || "Not assigned" },
        { label: "Driver Phone", value: selectedRide.driver?.phone || "—" },
        { label: "Student", value: selectedRide.student?.name || "—" },
        { label: "Student Phone", value: selectedRide.student?.phone || "—" },
        { label: "ETA", value: typeof selectedRide.etaMinutes === "number" ? `${selectedRide.etaMinutes} min` : "—" },
        { label: "Distance", value: typeof selectedRide.etaDistanceKm === "number" ? `${selectedRide.etaDistanceKm.toFixed(2)} km` : "—" },
        { label: "Total Fare", value: selectedRide.fareBreakdown?.totalFare != null ? `₹${selectedRide.fareBreakdown.totalFare}` : "—" },
        { label: "Per Passenger Fare", value: selectedRide.fareBreakdown?.perPassengerFare != null ? `₹${selectedRide.fareBreakdown.perPassengerFare}` : "—" },
        { label: "Platform Fee", value: selectedRide.fareBreakdown?.platformFee != null ? `₹${selectedRide.fareBreakdown.platformFee}` : "—" },
        { label: "Cancellation Reason", value: selectedRide.cancellationCustomReason || selectedRide.cancelReason || "—" },
        { label: "Verification Code", value: selectedRide.verificationCode || "—" },
        { label: "Tracking Link", value: selectedRide.shareTrackingUrl || "—" },
        { label: "Rating", value: selectedRide.studentRating != null ? `${selectedRide.studentRating}/5` : "—" },
        { label: "Feedback", value: selectedRide.studentFeedback || "—" },
      ]
    : [];

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {visibleTabs.map((tab) => {
          const count = statusCounts[tab.value];
          return (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === tab.value
                  ? "btn-primary-gradient text-primary-foreground"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
              <span className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-full ${
                activeTab === tab.value ? "bg-primary-foreground/20" : "bg-muted"
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Ride list */}
      <div className="space-y-2">
        {loadingRides ? (
          Array.from({ length: compact ? 3 : 5 }).map((_, i) => (
            <motion.div
              key={`ride-skeleton-${i}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="card-glass"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <motion.div
                    className="w-9 h-9 rounded-xl bg-muted/60 shrink-0"
                    animate={{ opacity: [0.35, 0.7, 0.35] }}
                    transition={{ duration: 1.05, repeat: Infinity, ease: "easeInOut", delay: i * 0.08 }}
                  />
                  <div className="space-y-2 w-full">
                    <motion.div className="h-3 rounded bg-muted/60 w-3/4" animate={{ opacity: [0.3, 0.65, 0.3] }} transition={{ duration: 1.05, repeat: Infinity, ease: "easeInOut", delay: i * 0.08 + 0.05 }} />
                    <motion.div className="h-2.5 rounded bg-muted/50 w-2/3" animate={{ opacity: [0.28, 0.55, 0.28] }} transition={{ duration: 1.05, repeat: Infinity, ease: "easeInOut", delay: i * 0.08 + 0.1 }} />
                    <motion.div className="h-2.5 rounded bg-muted/50 w-1/2" animate={{ opacity: [0.25, 0.5, 0.25] }} transition={{ duration: 1.05, repeat: Infinity, ease: "easeInOut", delay: i * 0.08 + 0.15 }} />
                  </div>
                </div>
                <motion.div className="h-5 rounded bg-muted/50 w-16" animate={{ opacity: [0.3, 0.6, 0.3] }} transition={{ duration: 1.05, repeat: Infinity, ease: "easeInOut", delay: i * 0.08 + 0.2 }} />
              </div>
            </motion.div>
          ))
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No {activeTab} rides</p>
        ) : (
          filtered.slice(0, compact ? 3 : undefined).map((ride, i) => (
            <motion.button
              key={ride.id}
              type="button"
              onClick={() => setSelectedRide(ride)}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.99 }}
              className="card-glass w-full text-left flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                  <MapPin className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{ride.pickup?.label || "—"} → {ride.drop?.label || "—"}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    <span>{formatDate(ride.updatedAt || ride.createdAt)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Driver: {ride.driver?.name || "—"} · Passengers: {ride.passengers || 1}
                  </p>
                  {ride.studentRating && (
                    <p className="text-xs text-primary mt-1">
                      Rating: {ride.studentRating}/5 {ride.studentFeedback ? `· ${ride.studentFeedback}` : ""}
                    </p>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="font-semibold text-xs text-primary">View details</p>
                <p className={`text-xs capitalize ${statusColors[ride.status === "completed" ? "completed" : ride.status === "cancelled" ? "cancelled" : "active"]}`}>{ride.status}</p>
              </div>
            </motion.button>
          ))
        )}
      </div>

      <Dialog open={Boolean(selectedRide)} onOpenChange={(open) => { if (!open) setSelectedRide(null); }}>
        <DialogContent className="sm:max-w-2xl">
          {selectedRide && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between gap-2">
                  <span>Ride Details</span>
                  <span className={`text-sm font-semibold capitalize ${statusTone(selectedRide.status)}`}>{selectedRide.status.replace(/_/g, " ")}</span>
                </DialogTitle>
                <DialogDescription>
                  Full trip information including timings, contact, fare, and ride status.
                </DialogDescription>
              </DialogHeader>

              {selectedRide.timeline && selectedRide.timeline.length > 0 && (
                <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Timeline</p>
                  <div className="space-y-1.5">
                    {selectedRide.timeline.map((step) => (
                      <div key={`${step.key}-${step.timestamp || "-"}`} className="flex items-center justify-between text-xs">
                        <span className={step.reached ? "text-foreground" : "text-muted-foreground"}>{step.label}</span>
                        <span className="text-muted-foreground">{formatDate(step.timestamp || null)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-2 max-h-[60vh] overflow-y-auto pr-1">
                {detailRows.map((row) => (
                  <div key={row.label} className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{row.label}</p>
                    <p className="text-sm text-foreground break-words">{row.value}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RideHistoryTabs;
