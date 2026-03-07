import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Users, Navigation, Wallet, TrendingUp, Activity,
  ArrowUpRight, Car,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { apiClient } from "@/lib/apiClient";
import { useAppToast } from "@/hooks/use-app-toast";

interface Metrics {
  totalUsers: number;
  totalStudents: number;
  totalDrivers: number;
  pendingDrivers: number;
  totalRides: number;
  pendingRides?: number;
  requestedRides: number;
  acceptedRides: number;
  inProgressRides?: number;
  ongoingRides: number;
  completedRides: number;
  cancelledRides: number;
  cancellationRate: number;
  totalRevenue: number;
  averageFare: number;
}

const card = (i: number) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: 0.05 + i * 0.05 },
});

const AdminOverview = () => {
  const toast = useAppToast();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [cancellations, setCancellations] = useState<Array<{ id: string; cancelReason: string | null; cancelledBy: string | null; cancelledAt: string | null }>>([]);
  const [bookingTrend, setBookingTrend] = useState<Array<{ day: string; count: number }>>([]);
  const [peakBookingHours, setPeakBookingHours] = useState<Array<{ hour: number; bookings: number }>>([]);
  const [driverPerformance, setDriverPerformance] = useState<Array<{ driverName: string; completedRides: number; avgRating: number; revenue: number }>>([]);
  const [scheduledQueue, setScheduledQueue] = useState<Array<{ id: string; status: "pending" | "activated" | "cancelled" | "failed"; triggerAt: string; pickup?: { label?: string } | null; drop?: { label?: string } | null; passengers: number; student?: { name: string } | null; errorMessage?: string | null }>>([]);

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      try {
        const [analytics, scheduled] = await Promise.all([
          apiClient.admin.analytics(),
          apiClient.admin.scheduledRides(),
        ]);

        if (!mounted) return;
        setMetrics(analytics.metrics);
        setCancellations(analytics.cancellations || []);
        setBookingTrend(analytics.bookingTrend || []);
        setPeakBookingHours(analytics.peakBookingHours || []);
        setDriverPerformance(analytics.driverPerformance || []);
        setScheduledQueue(scheduled.queue || []);
      } catch (error) {
        if (!mounted) return;
        toast.error("Unable to load admin overview", error, "Please refresh and try again.");
      }
    };

    loadData();
    return () => {
      mounted = false;
    };
  }, [toast]);

  const stats = [
    { label: "Total Users", value: String(metrics?.totalUsers ?? 0), change: "live", up: true, icon: Users },
    {
      label: "Active Rides",
      value: String(
        (metrics?.acceptedRides ?? 0)
        + (metrics?.inProgressRides ?? metrics?.ongoingRides ?? 0)
        + (metrics?.pendingRides ?? metrics?.requestedRides ?? 0),
      ),
      change: "live",
      up: true,
      icon: Navigation,
    },
    { label: "Revenue", value: `₹${metrics?.totalRevenue ?? 0}`, change: "all-time", up: true, icon: Wallet },
    { label: "Drivers", value: String(metrics ? Math.max(metrics.totalDrivers - metrics.pendingDrivers, 0) : 0), change: "approved", up: true, icon: Car },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold font-display mb-1">Dashboard Overview</h1>
        <p className="text-sm text-muted-foreground">Live campus transportation analytics</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <motion.div key={s.label} {...card(i)} className="card-glass">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                <s.icon className="w-5 h-5 text-primary" />
              </div>
              <span className="text-xs flex items-center gap-0.5 font-medium text-green-400">
                <ArrowUpRight className="w-3 h-3" />
                {s.change}
              </span>
            </div>
            <p className="text-2xl font-bold font-display">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <motion.div {...card(4)} className="card-glass">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold font-display">Recent Cancellations</h2>
            <span className="ml-auto w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          </div>
          <div className="space-y-3 max-h-[320px] overflow-y-auto pr-2">
            {cancellations.length === 0 && <div className="text-sm text-muted-foreground">No recent cancellations</div>}
            {cancellations.slice(0, 8).map((item) => (
              <div key={item.id} className="flex items-start gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
                <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-foreground">{item.cancelledBy || "unknown"}: {item.cancelReason || "No reason provided"}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.cancelledAt ? new Date(item.cancelledAt).toLocaleString() : "—"}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div {...card(5)} className="card-glass">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold font-display">Driver Performance</h2>
          </div>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={driverPerformance.slice(0, 6)}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="driverName" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="completedRides" fill="hsl(var(--primary))" name="Completed" radius={[6, 6, 0, 0]} />
                <Bar dataKey="avgRating" fill="hsl(var(--secondary))" name="Rating" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      <motion.div {...card(6)} className="card-glass">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold font-display">Booking Trend (7 Days)</h2>
        </div>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={bookingTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-6">
          <h3 className="text-sm font-semibold mb-3">Peak Booking Hours</h3>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={peakBookingHours.filter((_, idx) => idx % 2 === 0)}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="hour" tickFormatter={(hour) => `${hour}:00`} />
                <YAxis />
                <Tooltip labelFormatter={(value) => `${value}:00`} />
                <Bar dataKey="bookings" fill="hsl(var(--accent))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </motion.div>

      <motion.div {...card(7)} className="card-glass">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold font-display">Scheduled Rides Queue</h2>
          <span className="text-xs text-muted-foreground ml-auto">{scheduledQueue.length} items</span>
        </div>
        <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
          {scheduledQueue.length === 0 && <div className="text-sm text-muted-foreground">No scheduled rides in queue</div>}
          {scheduledQueue.slice(0, 12).map((item) => (
            <div key={item.id} className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium truncate">{item.pickup?.label || "—"} → {item.drop?.label || "—"}</p>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                  item.status === "pending"
                    ? "bg-yellow-500/20 text-yellow-400"
                    : item.status === "activated"
                      ? "bg-green-500/20 text-green-400"
                      : item.status === "failed"
                        ? "bg-destructive/20 text-destructive"
                        : "bg-muted text-muted-foreground"
                }`}>{item.status}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">Student: {item.student?.name || "—"} · Pax: {item.passengers}</p>
              <p className="text-xs text-muted-foreground">Trigger: {new Date(item.triggerAt).toLocaleString()}</p>
              {item.errorMessage ? <p className="text-xs text-destructive mt-0.5">{item.errorMessage}</p> : null}
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default AdminOverview;
