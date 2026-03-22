import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Navigation, Search, Clock, Users, RefreshCw } from "lucide-react";
import { apiClient, type RideDto } from "@/lib/apiClient";
import { useAppToast } from "@/hooks/use-app-toast";

const AdminRides = () => {
  const toast = useAppToast();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "completed" | "in_progress" | "cancelled" | "pending" | "accepted" | "ongoing" | "requested">("all");
  const [rides, setRides] = useState<RideDto[]>([]);
  const [reasonFilter, setReasonFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [driverIdFilter, setDriverIdFilter] = useState("all");
  const [loading, setLoading] = useState(false);

  const loadRides = async (mounted = true) => {
    setLoading(true);
    try {
      const response = await apiClient.admin.rides({
        status: filter === "all" ? undefined : filter,
        reasonKey: reasonFilter === "all" ? undefined : reasonFilter,
        driverId: driverIdFilter === "all" ? undefined : driverIdFilter,
        from: fromDate || undefined,
        to: toDate || undefined,
      });
      if (mounted) setRides(response.rides || []);
    } catch (error) {
      if (mounted) toast.error("Unable to load rides", error, "Please refresh and try again.");
    } finally {
      if (mounted) setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    void loadRides(mounted);
    return () => {
      mounted = false;
    };
  }, [toast, filter, reasonFilter, fromDate, toDate, driverIdFilter]);

  const filtered = useMemo(() => {
    return rides.filter((ride) => {
      const haystack = `${ride.pickup?.label || ""} ${ride.drop?.label || ""} ${ride.studentId || ""} ${ride.driverId || ""} ${ride.student?.name || ""} ${ride.driver?.name || ""}`.toLowerCase();
      const matchSearch = haystack.includes(search.toLowerCase());
      const matchFilter = filter === "all"
        || ride.status === filter
        || (filter === "pending" && ride.status === "requested")
        || (filter === "in_progress" && ride.status === "ongoing");
      return matchSearch && matchFilter;
    });
  }, [rides, search, filter]);

  const statusCounts = useMemo(() => ({
    all: rides.length,
    completed: rides.filter((r) => r.status === "completed").length,
    pending: rides.filter((r) => r.status === "pending" || r.status === "requested").length,
    accepted: rides.filter((r) => r.status === "accepted").length,
    in_progress: rides.filter((r) => r.status === "in_progress" || r.status === "ongoing").length,
    cancelled: rides.filter((r) => r.status === "cancelled").length,
  }), [rides]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display mb-1">Ride Management</h1>
        <p className="text-sm text-muted-foreground">{loading ? "Loading rides..." : `${rides.length} rides loaded`}</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            placeholder="Search by route or IDs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-muted/50 border border-border rounded-xl py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {(["all", "pending", "accepted", "in_progress", "completed", "cancelled"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-all capitalize ${
                filter === f ? "btn-primary-gradient text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:text-foreground"
              }`}
            >
              {f} ({statusCounts[f]})
            </button>
          ))}
          <button
            onClick={() => void loadRides(true)}
            disabled={loading}
            className="px-3 py-2 rounded-xl text-xs font-medium bg-muted/50 text-muted-foreground hover:text-foreground disabled:opacity-60 flex items-center gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      <div className="grid sm:grid-cols-4 gap-3">
        <input type="date" title="From date" placeholder="From date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="bg-muted/50 border border-border rounded-xl py-2.5 px-3 text-sm" />
        <input type="date" title="To date" placeholder="To date" value={toDate} onChange={(event) => setToDate(event.target.value)} className="bg-muted/50 border border-border rounded-xl py-2.5 px-3 text-sm" />
        <select title="Cancellation reason filter" value={reasonFilter} onChange={(event) => setReasonFilter(event.target.value)} className="bg-muted/50 border border-border rounded-xl py-2.5 px-3 text-sm">
          <option value="all">All cancellation reasons</option>
          <option value="driver_delayed">Driver delayed</option>
          <option value="change_of_plans">Change of plans</option>
          <option value="emergency">Emergency</option>
          <option value="wrong_booking">Wrong booking</option>
          <option value="personal_reason">Personal reason</option>
          <option value="other">Other</option>
        </select>
        <select title="Driver filter" value={driverIdFilter} onChange={(event) => setDriverIdFilter(event.target.value)} className="bg-muted/50 border border-border rounded-xl py-2.5 px-3 text-sm">
          <option value="all">All drivers</option>
          {Array.from(new Set(rides.map((ride) => ride.driverId).filter(Boolean))).map((driverId) => (
            <option key={driverId} value={driverId || ""}>{driverId?.slice(-6)}</option>
          ))}
        </select>
      </div>

      <div className="space-y-3">
        {!loading && filtered.length === 0 && (
          <div className="card-glass text-sm text-muted-foreground">No rides found for your current filters.</div>
        )}
        {filtered.map((ride, i) => (
          <motion.div
            key={ride.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="card-glass !p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                <Navigation className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground">#{ride.id.slice(-6)}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    ride.status === "completed" ? "bg-green-500/20 text-green-400" :
                    ride.status === "in_progress" || ride.status === "ongoing" || ride.status === "accepted" ? "bg-primary/20 text-primary" :
                    ride.status === "pending" || ride.status === "requested" ? "bg-blue-500/20 text-blue-400" :
                    "bg-destructive/20 text-destructive"
                  }`}>{ride.status}</span>
                </div>
                <p className="font-medium text-sm mt-1">{ride.pickup?.label || "—"} → {ride.drop?.label || "—"}</p>
                <p className="text-xs text-muted-foreground">Student: {ride.student?.name || ride.studentId?.slice(-6) || "—"} · Driver: {ride.driver?.name || ride.driverId?.slice(-6) || "—"}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {ride.passengers || 1}</p>
                {ride.cancellationReasonKey && <p className="text-xs text-muted-foreground">Cancellation reason: {ride.cancellationReasonKey}</p>}
                {ride.studentRating && (
                  <p className="text-xs text-primary mt-1">Rating: {ride.studentRating}/5 {ride.studentFeedback ? `· ${ride.studentFeedback}` : ""}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4 sm:text-right">
              <div>
                <p className="font-bold text-sm">₹{Number(ride.fareBreakdown?.totalFare || 0).toFixed(2)}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {new Date(ride.updatedAt || ride.createdAt).toLocaleString()}
                </p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default AdminRides;
