import { useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import PageTransition from "@/components/PageTransition";
import RideHistoryTabs from "@/components/ride/RideHistoryTabs";
import BrandIcon from "@/components/BrandIcon";
import { ArrowLeft } from "lucide-react";

const RidesPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const tabState = location.state as { tab?: "all" | "active" | "completed" | "cancelled" } | null;
  const initialTab = tabState?.tab;
  const touchStartYRef = useRef<number | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [pullRefreshing, setPullRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const backPath = user?.role === "driver" ? "/driver-dashboard" : "/student-dashboard";

  const pullProgress = Math.min(100, Math.round((pullDistance / 110) * 100));

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (window.scrollY > 0 || pullRefreshing) return;
    touchStartYRef.current = event.touches[0]?.clientY ?? null;
  };

  const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    const startY = touchStartYRef.current;
    if (startY === null || pullRefreshing) return;
    const currentY = event.touches[0]?.clientY ?? startY;
    const delta = currentY - startY;
    if (delta <= 0) {
      setPullDistance(0);
      return;
    }
    setPullDistance(Math.min(140, delta * 0.55));
  };

  const handleTouchEnd = () => {
    touchStartYRef.current = null;
    if (pullDistance >= 85 && !pullRefreshing) {
      setPullRefreshing(true);
      setRefreshKey((prev) => prev + 1);
      window.setTimeout(() => {
        setPullRefreshing(false);
        setPullDistance(0);
      }, 850);
      return;
    }
    setPullDistance(0);
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-background relative overflow-hidden">
        <motion.div
          aria-hidden="true"
          className="pointer-events-none fixed left-1/2 top-0 z-[80] -translate-x-1/2"
          animate={{ y: pullDistance > 0 ? Math.min(54, pullDistance * 0.65) : -28, opacity: pullDistance > 0 || pullRefreshing ? 1 : 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 24 }}
        >
          <div className="glass rounded-full px-3 py-1.5 text-[11px] font-semibold text-primary border border-primary/20">
            {pullRefreshing ? "Refreshing rides..." : pullProgress >= 100 ? "Release to refresh" : `Pull to refresh ${pullProgress}%`}
          </div>
        </motion.div>
        <div className="absolute inset-0 [background:var(--gradient-hero)]" />
        <div className="relative z-10" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
          {/* Navbar */}
          <nav className="glass py-4 sm:py-5 px-3 sm:px-6 sticky top-0 z-20">
            <div className="container mx-auto flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => navigate(backPath)}
                  className="p-2.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
                  title="Back to dashboard"
                >
                  <ArrowLeft className="w-5 h-5" />
                </motion.button>
                <a href="/" className="flex items-center gap-2">
                  <BrandIcon className="w-9 h-9" />
                  <span className="text-base sm:text-xl font-bold font-display">
                    Campus<span className="gradient-text">Ride</span>
                  </span>
                </a>
              </div>
            </div>
          </nav>

          <div className="container mx-auto px-3 sm:px-6 py-6 sm:py-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <h1 className="text-2xl md:text-3xl font-bold font-display mb-1">
                All <span className="gradient-text">Rides</span>
              </h1>
              <p className="text-muted-foreground text-sm mb-6">
                View and manage your ride history
              </p>
              <RideHistoryTabs compact={false} initialTab={initialTab} refreshKey={refreshKey} />
            </motion.div>
          </div>
        </div>
      </div>
    </PageTransition>
  );
};

export default RidesPage;
