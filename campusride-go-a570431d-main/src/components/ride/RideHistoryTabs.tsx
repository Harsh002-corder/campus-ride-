import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { MapPin, Clock, CheckCircle, XCircle, Navigation, List } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient, type RideDto } from "@/lib/apiClient";
import { useAppToast } from "@/hooks/use-app-toast";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
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

const getRideStatusClass = (status: RideDto["status"]) => {
  if (status === "accepted" || status === "completed") return "text-green-400";
  if (status === "cancelled") return "text-destructive";
  if (status === "pending" || status === "requested") return "text-blue-400";
  return statusColors.active;
};

interface RideHistoryTabsProps {
  compact?: boolean;
  initialTab?: RideStatus;
  allowedTabs?: RideStatus[];
  allTabFilter?: "allRides" | "finalizedOnly";
}

const RideHistoryTabs = ({
  compact = false,
  initialTab = "all",
  allowedTabs,
  allTabFilter = "allRides",
}: RideHistoryTabsProps) => {
  const { user } = useAuth();
  const toast = useAppToast();
  const [activeTab, setActiveTab] = useState<RideStatus>(initialTab);
  const [rides, setRides] = useState<RideDto[]>([]);
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
      try {
        const response = user?.role === "driver"
          ? await apiClient.rides.my()
          : user?.role === "admin"
            ? await apiClient.rides.my()
            : await apiClient.rides.my();

        if (mounted) {
          setRides(response.rides || []);
        }
      } catch (error) {
        if (mounted) {
          toast.error("Unable to load ride history", error, "Please refresh and try again.");
        }
      }
    };

    loadRides();
    return () => {
      mounted = false;
    };
  }, [toast, user?.role]);

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

  const formatCurrency = (value?: number | null) => {
    if (value == null || Number.isNaN(Number(value))) return "—";
    return `₹${value}`;
  };

  const formatCoordinate = (lat?: number, lng?: number) => {
    if (typeof lat !== "number" || typeof lng !== "number") return "—";
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  };

  const detailSections = selectedRide
    ? [
        {
          title: "Ride Details",
          rows: [
            { label: "Ride ID", value: selectedRide.id },
            { label: "Status", value: selectedRide.status.replace(/_/g, " ") },
            { label: "Pickup", value: selectedRide.pickup?.label || "—" },
            { label: "Pickup Coordinates", value: formatCoordinate(selectedRide.pickup?.lat, selectedRide.pickup?.lng) },
            { label: "Drop", value: selectedRide.drop?.label || "—" },
            { label: "Drop Coordinates", value: formatCoordinate(selectedRide.drop?.lat, selectedRide.drop?.lng) },
            { label: "Passengers", value: String(selectedRide.passengers || 1) },
            { label: "Passenger Names", value: selectedRide.passengerNames?.length ? selectedRide.passengerNames.join(", ") : "—" },
          ],
        },
        {
          title: "Student Details",
          rows: [
            { label: "Name", value: selectedRide.student?.name || "—" },
            { label: "Email", value: selectedRide.student?.email || "—" },
            { label: "Phone", value: selectedRide.student?.phone || "—" },
            { label: "Student ID", value: selectedRide.studentId || "—" },
            { label: "Student Rating", value: selectedRide.studentRating != null ? `${selectedRide.studentRating}/5` : "—" },
            { label: "Feedback", value: selectedRide.studentFeedback || "—" },
          ],
        },
        {
          title: "Driver Details",
          rows: [
            { label: "Name", value: selectedRide.driver?.name || "Not assigned" },
            { label: "Email", value: selectedRide.driver?.email || "—" },
            { label: "Phone", value: selectedRide.driver?.phone || "—" },
            { label: "Driver ID", value: selectedRide.driverId || "—" },
            { label: "ETA", value: typeof selectedRide.etaMinutes === "number" ? `${selectedRide.etaMinutes} min` : "—" },
            { label: "Distance", value: typeof selectedRide.etaDistanceKm === "number" ? `${selectedRide.etaDistanceKm.toFixed(2)} km` : "—" },
          ],
        },
        {
          title: "Timeline & Fare",
          rows: [
            { label: "Requested At", value: formatDate(selectedRide.requestedAt) },
            { label: "Accepted At", value: formatDate(selectedRide.acceptedAt) },
            { label: "Started At", value: formatDate(selectedRide.ongoingAt) },
            { label: "Completed At", value: formatDate(selectedRide.completedAt) },
            { label: "Cancelled At", value: formatDate(selectedRide.cancelledAt) },
            { label: "Created At", value: formatDate(selectedRide.createdAt) },
            { label: "Updated At", value: formatDate(selectedRide.updatedAt) },
            { label: "Total Fare", value: formatCurrency(selectedRide.fareBreakdown?.totalFare) },
            { label: "Platform Fee", value: formatCurrency(selectedRide.fareBreakdown?.platformFee) },
            { label: "Cancellation Reason", value: selectedRide.cancellationCustomReason || selectedRide.cancelReason || "—" },
          ],
        },
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
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No {activeTab} rides</p>
        ) : (
          filtered.slice(0, compact ? 3 : undefined).map((ride, i) => (
            <motion.div
              key={ride.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="card-glass flex items-center justify-between gap-3"
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
                <button
                  type="button"
                  onClick={() => setSelectedRide(ride)}
                  className="font-semibold text-xs px-2 py-1 rounded-lg bg-primary/20 text-primary hover:bg-primary/30 transition-colors"
                >
                  View
                </button>
                <p className={`text-xs capitalize ${getRideStatusClass(ride.status)}`}>{ride.status}</p>
              </div>
            </motion.div>
          ))
        )}
      </div>

      <Dialog open={Boolean(selectedRide)} onOpenChange={(open) => !open && setSelectedRide(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Ride Details</DialogTitle>
            <DialogDescription>Professional summary of ride, student, and driver details.</DialogDescription>
          </DialogHeader>

          {selectedRide && (
            <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
              {detailSections.map((section) => (
                <section key={section.title} className="rounded-lg border border-border/60 overflow-hidden bg-background/40">
                  <div className="px-3 py-2 text-sm font-semibold bg-muted/40 border-b border-border/60">
                    {section.title}
                  </div>
                  <table className="w-full text-sm">
                    <tbody>
                      {section.rows.map((row) => (
                        <tr key={`${section.title}-${row.label}`} className="border-b border-border/40 last:border-b-0 align-top">
                          <th className="w-[42%] text-left font-medium text-muted-foreground px-3 py-2">{row.label}</th>
                          <td className="w-[58%] text-foreground px-3 py-2 break-words">{row.value || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              ))}
            </div>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <button className="btn-primary-gradient px-4 py-2 rounded-md">Close</button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RideHistoryTabs;
