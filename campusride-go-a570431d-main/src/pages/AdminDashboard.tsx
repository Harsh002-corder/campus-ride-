import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import PageTransition from "@/components/PageTransition";
import {
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import AdminOverview from "@/components/admin/AdminOverview";
import AdminUsers from "@/components/admin/AdminUsers";
import AdminRides from "@/components/admin/AdminRides";
import AdminDrivers from "@/components/admin/AdminDrivers";
import AdminIssues from "@/components/admin/AdminIssues";
import AdminSettings from "@/components/admin/AdminSettings";
import BrandIcon from "@/components/BrandIcon";
import NotificationBell from "@/components/NotificationBell";
import ProfileDialog from "@/components/ProfileDialog";
import { apiClient, type AuthUser, type RideIssueDto } from "@/lib/apiClient";
import { getSocketClient } from "@/lib/socketClient";
import { LogOut, UserCircle2 } from "lucide-react";

const tabs: Record<string, React.FC> = {
  overview: AdminOverview,
  users: AdminUsers,
  rides: AdminRides,
  drivers: AdminDrivers,
  issues: AdminIssues,
  settings: AdminSettings,
};

const AdminDashboard = () => {
  const { user, logout, login } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");
  const [pendingIssuesCount, setPendingIssuesCount] = useState(0);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadPendingIssues = async () => {
      try {
        const response = await apiClient.admin.issues();
        if (!mounted) return;
        const pending = (response.issues || []).filter((issue) => issue.status === "open" || issue.status === "in_review").length;
        setPendingIssuesCount(pending);
      } catch {
        if (mounted) setPendingIssuesCount(0);
      }
    };

    void loadPendingIssues();

    const socket = getSocketClient();
    const isPending = (status?: string | null) => status === "open" || status === "in_review";

    const onIssueCreated = (issue: RideIssueDto) => {
      if (isPending(issue?.status)) {
        setPendingIssuesCount((prev) => prev + 1);
      }
    };

    const onIssueUpdated = (payload: { issue?: RideIssueDto; previousStatus?: string | null }) => {
      const wasPending = isPending(payload?.previousStatus);
      const nowPending = isPending(payload?.issue?.status || null);

      if (wasPending && !nowPending) {
        setPendingIssuesCount((prev) => Math.max(0, prev - 1));
        return;
      }
      if (!wasPending && nowPending) {
        setPendingIssuesCount((prev) => prev + 1);
      }
    };

    socket.on("admin:issue-created", onIssueCreated);
    socket.on("admin:issue-updated", onIssueUpdated);

    return () => {
      mounted = false;
      socket.off("admin:issue-created", onIssueCreated);
      socket.off("admin:issue-updated", onIssueUpdated);
    };
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/", { replace: true });
    window.location.assign("/");
  };

  const ActiveComponent = tabs[activeTab] || AdminOverview;

  return (
    <PageTransition>
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-background relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none [background:var(--gradient-hero)]" />

          <AdminSidebar activeTab={activeTab} setActiveTab={setActiveTab} pendingIssuesCount={pendingIssuesCount} />

          <div className="flex-1 flex flex-col relative z-10">
            {/* Top bar */}
            <nav className="glass py-3 px-6 sticky top-0 z-20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
                <div className="hidden sm:flex items-center gap-2">
                  <BrandIcon className="w-8 h-8 rounded-lg" />
                  <span className="text-lg font-bold font-display">
                    Campus<span className="gradient-text">Ride</span>
                    <span className="text-xs ml-2 bg-primary/20 text-primary px-2 py-0.5 rounded-full font-medium">Admin</span>
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
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
                  <span className="text-foreground font-medium">{user?.name || "Admin"}</span>
                </span>
                <motion.button whileTap={{ scale: 0.95 }} onClick={handleLogout} className="btn-outline-glow px-3 py-2 rounded-xl text-sm flex items-center gap-2">
                  <LogOut className="w-4 h-4" /> Logout
                </motion.button>
              </div>
            </nav>

            {/* Content */}
            <main className="flex-1 p-6 overflow-auto">
              <ActiveComponent />
            </main>
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
      </SidebarProvider>
    </PageTransition>
  );
};

export default AdminDashboard;
