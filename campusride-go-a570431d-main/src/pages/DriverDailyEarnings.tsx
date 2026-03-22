import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, BadgePercent, CalendarDays, CircleDollarSign, Navigation, ReceiptText, Wallet } from "lucide-react";
import BrandIcon from "@/components/BrandIcon";
import NotificationBell from "@/components/NotificationBell";
import PageTransition from "@/components/PageTransition";
import { useAuth } from "@/contexts/AuthContext";
import { useAppToast } from "@/hooks/use-app-toast";
import { apiClient, type RideDto } from "@/lib/apiClient";

type DailyEntry = {
  date: string;
  totalEarnings: number;
  platformCharges: number;
  netDriverEarnings: number;
  completedRides: number;
};

type DailySummary = {
  totalEarnings: number;
  platformCharges: number;
  netDriverEarnings: number;
  completedRides: number;
  daysIncluded: number;
  currency: string;
};

type DailyEarningsView = {
  summary: DailySummary;
  days: DailyEntry[];
};

const formatCurrency = (value: number, currency = "INR") => new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency,
  maximumFractionDigits: 2,
}).format(value || 0);

const formatDate = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const card = (index: number) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: 0.08 + index * 0.05 },
});

const buildDailyEarningsFromRides = (rides: RideDto[], daysIncluded = 30): DailyEarningsView => {
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const start = new Date(end);
  start.setDate(start.getDate() - Math.max(0, daysIncluded - 1));
  start.setHours(0, 0, 0, 0);

  const grouped = new Map<string, DailyEntry>();
  let currency = "INR";

  rides
    .filter((ride) => ride.status === "completed")
    .forEach((ride) => {
      const timestamp = ride.completedAt || ride.updatedAt || ride.createdAt;
      if (!timestamp) return;

      const rideDate = new Date(timestamp);
      if (rideDate < start || rideDate > end) return;

      const dateKey = rideDate.toISOString().slice(0, 10);
      const totalFare = Number(ride.fareBreakdown?.totalFare || 0);
      const platformFee = Number(ride.fareBreakdown?.platformFee || 0);
      const netDriverEarnings = Number((totalFare - platformFee).toFixed(2));

      if (ride.fareBreakdown?.currency) {
        currency = ride.fareBreakdown.currency;
      }

      const current = grouped.get(dateKey) || {
        date: dateKey,
        totalEarnings: 0,
        platformCharges: 0,
        netDriverEarnings: 0,
        completedRides: 0,
      };

      current.totalEarnings += totalFare;
      current.platformCharges += platformFee;
      current.netDriverEarnings += netDriverEarnings;
      current.completedRides += 1;

      grouped.set(dateKey, current);
    });

  const days = Array.from(grouped.values())
    .map((entry) => ({
      ...entry,
      totalEarnings: Number(entry.totalEarnings.toFixed(2)),
      platformCharges: Number(entry.platformCharges.toFixed(2)),
      netDriverEarnings: Number(entry.netDriverEarnings.toFixed(2)),
    }))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const summary = days.reduce((acc, entry) => ({
    totalEarnings: acc.totalEarnings + entry.totalEarnings,
    platformCharges: acc.platformCharges + entry.platformCharges,
    netDriverEarnings: acc.netDriverEarnings + entry.netDriverEarnings,
    completedRides: acc.completedRides + entry.completedRides,
  }), {
    totalEarnings: 0,
    platformCharges: 0,
    netDriverEarnings: 0,
    completedRides: 0,
  });

  return {
    summary: {
      totalEarnings: Number(summary.totalEarnings.toFixed(2)),
      platformCharges: Number(summary.platformCharges.toFixed(2)),
      netDriverEarnings: Number(summary.netDriverEarnings.toFixed(2)),
      completedRides: summary.completedRides,
      daysIncluded,
      currency,
    },
    days,
  };
};

const DriverDailyEarnings = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useAppToast();
  const [loading, setLoading] = useState(true);
  const [daily, setDaily] = useState<DailyEarningsView>({
    summary: {
      totalEarnings: 0,
      platformCharges: 0,
      netDriverEarnings: 0,
      completedRides: 0,
      daysIncluded: 30,
      currency: "INR",
    },
    days: [],
  });

  const loadEarnings = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient.rides.my();
      setDaily(buildDailyEarningsFromRides(response.rides || [], 30));
    } catch (error) {
      toast.error("Unable to load daily earnings", error, "Please try again in a moment.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadEarnings();
  }, [loadEarnings]);

  const rows = useMemo(() => daily.days.map((item) => ({
    ...item,
    dateLabel: formatDate(item.date),
    totalFareLabel: formatCurrency(item.totalEarnings, daily.summary.currency),
    platformLabel: formatCurrency(item.platformCharges, daily.summary.currency),
    netLabel: formatCurrency(item.netDriverEarnings, daily.summary.currency),
  })), [daily.days, daily.summary.currency]);

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
                  <p className="text-base sm:text-xl font-bold font-display">Daily Earnings</p>
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
                  <h1 className="text-2xl md:text-3xl font-bold font-display">Last 30 Days Earnings</h1>
                  <p className="text-sm text-muted-foreground">Day-wise earnings, platform charges and net payout view.</p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm">
                  <CalendarDays className="w-4 h-4 text-primary" />
                  Days with rides: <span className="font-semibold text-foreground">{daily.days.length}</span>
                </div>
              </div>
            </motion.div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "Gross Fare", value: formatCurrency(daily.summary.totalEarnings, daily.summary.currency), icon: Wallet },
                { label: "Platform Charges", value: formatCurrency(daily.summary.platformCharges, daily.summary.currency), icon: BadgePercent },
                { label: "Net Driver Earnings", value: formatCurrency(daily.summary.netDriverEarnings, daily.summary.currency), icon: CircleDollarSign },
                { label: "Completed Rides", value: String(daily.summary.completedRides), icon: Navigation },
              ].map((item, index) => (
                <motion.div key={item.label} {...card(index + 1)} className="card-glass hover:bg-muted/40 transition-colors">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center">
                      <item.icon className="w-6 h-6 text-primary" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold font-display break-words text-foreground">{item.value}</p>
                  <p className="text-xs text-muted-foreground mt-1.5 font-medium">{item.label}</p>
                </motion.div>
              ))}
            </div>

            <motion.section {...card(5)} className="card-glass overflow-hidden">
              <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                <div>
                  <h2 className="text-lg font-bold font-display">Day-wise Earnings</h2>
                  <p className="text-xs text-muted-foreground">Shows each day fare, platform fee and your final earning.</p>
                </div>
                <button
                  type="button"
                  onClick={() => void loadEarnings()}
                  className="px-4 py-2.5 rounded-lg text-sm font-semibold bg-primary/20 text-primary hover:bg-primary/30 transition-colors"
                >
                  <ReceiptText className="w-4 h-4 inline mr-1" /> Refresh
                </button>
              </div>

              {loading ? (
                <div className="py-14 text-center text-sm text-muted-foreground">Loading daily earnings...</div>
              ) : rows.length === 0 ? (
                <div className="py-14 text-center text-sm text-muted-foreground">No completed rides found in the selected range.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[680px] text-sm">
                    <thead>
                      <tr className="border-b border-border/60 text-left text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        <th className="py-3 pr-4 font-medium">Date</th>
                        <th className="py-3 pr-4 font-medium">Completed Rides</th>
                        <th className="py-3 pr-4 font-medium">Gross Fare</th>
                        <th className="py-3 pr-4 font-medium">Platform Fee</th>
                        <th className="py-3 font-medium">Net Earning</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.date} className="border-b border-border/40 align-top">
                          <td className="py-4 pr-4 font-medium">{row.dateLabel}</td>
                          <td className="py-4 pr-4">{row.completedRides}</td>
                          <td className="py-4 pr-4">{row.totalFareLabel}</td>
                          <td className="py-4 pr-4 text-muted-foreground">{row.platformLabel}</td>
                          <td className="py-4 font-semibold text-primary">{row.netLabel}</td>
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

export default DriverDailyEarnings;
