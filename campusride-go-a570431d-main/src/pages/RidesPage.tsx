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

  const backPath = user?.role === "driver" ? "/driver-dashboard" : "/student-dashboard";

  return (
    <PageTransition>
      <div className="min-h-screen bg-background relative overflow-hidden">
        <div className="absolute inset-0 [background:var(--gradient-hero)]" />
        <div className="relative z-10">
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
              <RideHistoryTabs compact={false} initialTab={initialTab} />
            </motion.div>
          </div>
        </div>
      </div>
    </PageTransition>
  );
};

export default RidesPage;
