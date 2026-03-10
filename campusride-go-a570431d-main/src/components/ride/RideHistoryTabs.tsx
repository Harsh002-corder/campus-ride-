import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { MapPin, Clock, CheckCircle, XCircle, Navigation, List } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient, type RideDto } from "@/lib/apiClient";
import { useAppToast } from "@/hooks/use-app-toast";

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
        const response = await apiClient.rides.my();

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
                <p className="font-semibold text-sm">—</p>
                <p className={`text-xs capitalize ${statusColors[ride.status === "completed" ? "completed" : ride.status === "cancelled" ? "cancelled" : "active"]}`}>{ride.status}</p>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};

export default RideHistoryTabs;
