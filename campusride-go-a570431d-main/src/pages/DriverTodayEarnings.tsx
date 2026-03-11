import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import BrandIcon from "@/components/BrandIcon";
import NotificationBell from "@/components/NotificationBell";
import PageTransition from "@/components/PageTransition";
import { useAuth } from "@/contexts/AuthContext";
import { useAppToast } from "@/hooks/use-app-toast";
import { apiClient, type DriverTodayEarningsDto, type DriverTodayEarningsRideDto } from "@/lib/apiClient";
import { buildTodayEarningsFromRides } from "@/lib/driverEarnings";
import { ArrowLeft, BadgePercent, CircleDollarSign, Clock3, Navigation, ReceiptText, Wallet } from "lucide-react";

const emptySummary: DriverTodayEarningsDto["summary"] = {
  totalEarnings: 0,
  platformCharges: 0,
  netDriverEarnings: 0,
  completedRides: 0,
  currency: "INR",
  date: new Date().toISOString(),
};

const formatCurrency = (value: number, currency = "INR") => new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency,
  maximumFractionDigits: 2,
}).format(value || 0);

const formatDateTime = (value?: string | null) => (value ? new Date(value).toLocaleString() : "-");

const card = (index: number) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: 0.08 + index * 0.05 },
});

const DriverTodayEarnings = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useAppToast();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<DriverTodayEarningsDto["summary"]>(emptySummary);
  const [rides, setRides] = useState<DriverTodayEarningsRideDto[]>([]);

  const loadEarnings = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient.rides.my();
      const todayEarnings = buildTodayEarningsFromRides(response.rides || []);
      setSummary(todayEarnings.summary || emptySummary);
      setRides(todayEarnings.rides || []);
    } catch (error) {
      toast.error("Unable to load today earnings", error, "Please try again in a moment.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadEarnings();
  }, [loadEarnings]);

  const tableRows = useMemo(() => rides.map((ride) => ({
    id: ride.id,
    pickup: ride.pickup?.label || "-",
    drop: ride.drop?.label || "-",
    rideFare: formatCurrency(ride.totalFare, summary.currency),
    platformFee: formatCurrency(ride.platformFee, summary.currency),
    driverEarning: formatCurrency(ride.driverEarning, summary.currency),
    rideTime: formatDateTime(ride.rideTime),
  })), [rides, summary.currency]);

  return (
    <PageTransition>
      <div className="min-h-screen bg-background relative overflow-hidden">
        <div className="absolute inset-0 [background:var(--gradient-hero)]" />
        <div className="absolute top-1/4 right-1/4 w-[min(60vw,400px)] h-[min(60vw,400px)] rounded-full opacity-10 animate-pulse-glow [background:var(--gradient-glow)]" />

        <div className="relative z-10">
          <nav className="glass py-3 sm:py-4 px-3 sm:px-6 sticky top-0 z-20">
            <div className="container mx-auto flex items-center justify-between gap-3 flex-wrap">
              <button type="button" onClick={() => navigate("/driver-dashboard")} className="flex items-center gap-3 text-left">
                <BrandIcon className="w-9 h-9" />
                <div>
                  <p className="text-base sm:text-xl font-bold font-display">Today Earnings Details</p>
                  <p className="text-xs text-muted-foreground">Driver: {user?.name || "CampusRide Driver"}</p>
                </div>
              </button>
              <div className="flex items-center gap-2">
                <NotificationBell />
                <button
                  type="button"
                  onClick={() => navigate("/driver-dashboard")}
                  className="btn-outline-glow px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm flex items-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" /> Back to Dashboard
                </button>
              </div>
            </div>
          </nav>

          <div className="container mx-auto px-3 sm:px-6 py-6 sm:py-8 space-y-6">
            <motion.div {...card(0)} className="card-glass border border-primary/20">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold font-display">Today Earnings</h1>
                  <p className="text-sm text-muted-foreground">Completed rides and earnings for {new Date(summary.date).toLocaleDateString()}.</p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm">
                  <ReceiptText className="w-4 h-4 text-primary" />
                  Completed rides today: <span className="font-semibold text-foreground">{summary.completedRides}</span>
                </div>
              </div>
            </motion.div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "Total Today Earnings", value: formatCurrency(summary.totalEarnings, summary.currency), icon: Wallet },
                { label: "Platform Charges", value: formatCurrency(summary.platformCharges, summary.currency), icon: BadgePercent },
                { label: "Net Driver Earnings", value: formatCurrency(summary.netDriverEarnings, summary.currency), icon: CircleDollarSign },
                { label: "Completed Rides Today", value: String(summary.completedRides), icon: Navigation },
              ].map((item, index) => (
                <motion.div key={item.label} {...card(index + 1)} className="card-glass">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-11 h-11 rounded-xl bg-primary/20 flex items-center justify-center">
                      <item.icon className="w-5 h-5 text-primary" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold font-display break-words">{item.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{item.label}</p>
                </motion.div>
              ))}
            </div>

            <motion.section {...card(5)} className="card-glass overflow-hidden">
              <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                <div>
                  <h2 className="text-lg font-bold font-display">Today Ride History</h2>
                  <p className="text-xs text-muted-foreground">Only completed rides from today are included.</p>
                </div>
                <button
                  type="button"
                  onClick={() => void loadEarnings()}
                  className="px-3 py-2 rounded-xl text-xs font-semibold bg-primary/20 text-primary hover:bg-primary/30 transition-colors"
                >
                  Refresh
                </button>
              </div>

              {loading ? (
                <div className="py-14 text-center text-sm text-muted-foreground">Loading today earnings...</div>
              ) : tableRows.length === 0 ? (
                <div className="py-14 text-center text-sm text-muted-foreground">No completed rides found for today.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead>
                      <tr className="border-b border-border/60 text-left text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        <th className="py-3 pr-4 font-medium">Ride Time</th>
                        <th className="py-3 pr-4 font-medium">Pickup</th>
                        <th className="py-3 pr-4 font-medium">Drop</th>
                        <th className="py-3 pr-4 font-medium">Ride Fare</th>
                        <th className="py-3 pr-4 font-medium">Platform Fee</th>
                        <th className="py-3 font-medium">Driver Earning</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tableRows.map((ride) => (
                        <tr key={ride.id} className="border-b border-border/40 align-top">
                          <td className="py-4 pr-4 text-muted-foreground whitespace-nowrap">
                            <span className="inline-flex items-center gap-2">
                              <Clock3 className="w-3.5 h-3.5 text-primary" />
                              {ride.rideTime}
                            </span>
                          </td>
                          <td className="py-4 pr-4 font-medium">{ride.pickup}</td>
                          <td className="py-4 pr-4 font-medium">{ride.drop}</td>
                          <td className="py-4 pr-4">{ride.rideFare}</td>
                          <td className="py-4 pr-4 text-muted-foreground">{ride.platformFee}</td>
                          <td className="py-4 font-semibold text-primary">{ride.driverEarning}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.section>
          </div>
        </div>
      </div>
    </PageTransition>
  );
};

export default DriverTodayEarnings;