import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import InstallAppButton from "@/components/InstallAppButton";
import { usePwaUpdate } from "@/hooks/usePwaUpdate";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";

const StudentDashboard = lazy(() => import("./pages/StudentDashboard"));
const DriverDashboard = lazy(() => import("./pages/DriverDashboard"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const SuperAdminDashboard = lazy(() => import("./pages/SuperAdminDashboard"));
const SubAdminDashboard = lazy(() => import("./pages/SubAdminDashboard"));
const SuperAdminSetup = lazy(() => import("./pages/SuperAdminSetup"));
const NotFound = lazy(() => import("./pages/NotFound"));
const RideTracking = lazy(() => import("./pages/RideTracking"));
const RidesPage = lazy(() => import("./pages/RidesPage"));
const PublicRideTracking = lazy(() => import("./pages/PublicRideTracking"));
const TMUCampusMapPage = lazy(() => import("./pages/TMUCampusMapPage"));
const JarviouWidget = lazy(() => import("./components/JarviouWidget"));

const queryClient = new QueryClient();

const RouteLoader = () => (
  <div className="min-h-[40vh] flex items-center justify-center px-4 text-sm text-muted-foreground">
    Loading Campus Ride...
  </div>
);

const RequireAuth = ({
  children,
  allowedRoles,
}: {
  children: JSX.Element;
  allowedRoles?: Array<"student" | "driver" | "admin" | "super_admin" | "sub_admin">;
}) => {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to={user.role === "super_admin" ? "/super-admin-dashboard" : user.role === "sub_admin" ? "/sub-admin-dashboard" : user.role === "admin" ? "/admin" : user.role === "driver" ? "/driver-dashboard" : "/student-dashboard"} replace />;
  }

  return children;
};

const AnimatedRoutes = () => {
  const location = useLocation();
  return (
    <Suspense fallback={<RouteLoader />}>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/system/setup-super-admin" element={<SuperAdminSetup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/student-dashboard" element={<RequireAuth allowedRoles={["student"]}><StudentDashboard /></RequireAuth>} />
          <Route path="/driver-dashboard" element={<RequireAuth allowedRoles={["driver"]}><DriverDashboard /></RequireAuth>} />
          <Route path="/admin" element={<RequireAuth allowedRoles={["admin", "sub_admin"]}><AdminDashboard /></RequireAuth>} />
          <Route path="/sub-admin-dashboard" element={<RequireAuth allowedRoles={["sub_admin"]}><SubAdminDashboard /></RequireAuth>} />
          <Route path="/super-admin-dashboard" element={<RequireAuth allowedRoles={["super_admin"]}><SuperAdminDashboard /></RequireAuth>} />
          <Route path="/ride-tracking" element={<RequireAuth><RideTracking /></RequireAuth>} />
          <Route path="/ride-tracking/:id" element={<RequireAuth><RideTracking /></RequireAuth>} />
          <Route path="/track/:token" element={<PublicRideTracking />} />
          <Route path="/rides" element={<RequireAuth><RidesPage /></RequireAuth>} />
          <Route path="/campus-map" element={<TMUCampusMapPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AnimatePresence>
    </Suspense>
  );
};

const PwaUpdateNotifier = () => {
  usePwaUpdate();
  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <AnimatedRoutes />
          <InstallAppButton />
          <PwaUpdateNotifier />
          <Suspense fallback={null}>
            <JarviouWidget />
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
