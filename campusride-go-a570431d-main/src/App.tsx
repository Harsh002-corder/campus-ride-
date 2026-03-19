import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import JarviouWidget from "./components/JarviouWidget";
import { useRideRealtime } from "@/hooks/useRideRealtime";
import PwaController from "@/components/pwa/PwaController";
import OfflineFallback from "@/components/pwa/OfflineFallback";

const Index = lazy(() => import("./pages/Index"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const StudentDashboard = lazy(() => import("./pages/StudentDashboard"));
const DriverDashboard = lazy(() => import("./pages/DriverDashboard"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const NotFound = lazy(() => import("./pages/NotFound"));
const RideTracking = lazy(() => import("./pages/RideTracking"));
const RidesPage = lazy(() => import("./pages/RidesPage"));
const PublicRideTracking = lazy(() => import("./pages/PublicRideTracking"));
const TMUCampusMapPage = lazy(() => import("./pages/TMUCampusMapPage"));

const queryClient = new QueryClient();

const RouteFallback = () => (
  (typeof navigator === "undefined" || navigator.onLine)
    ? (
      <div className="min-h-screen bg-background text-foreground grid place-items-center">
        <p className="text-sm text-muted-foreground">Loading CampusRide...</p>
      </div>
      )
    : <OfflineFallback />
);

const RequireAuth = ({
  children,
  allowedRoles,
}: {
  children: JSX.Element;
  allowedRoles?: Array<"student" | "driver" | "admin">;
}) => {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to={user.role === "admin" ? "/admin" : user.role === "driver" ? "/driver-dashboard" : "/student-dashboard"} replace />;
  }

  return children;
};

const AnimatedRoutes = () => {
  const location = useLocation();
  return (
    <Suspense fallback={<RouteFallback />}>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/student-dashboard" element={<RequireAuth allowedRoles={["student"]}><StudentDashboard /></RequireAuth>} />
          <Route path="/driver-dashboard" element={<RequireAuth allowedRoles={["driver"]}><DriverDashboard /></RequireAuth>} />
          <Route path="/admin" element={<RequireAuth allowedRoles={["admin"]}><AdminDashboard /></RequireAuth>} />
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

const RealtimeBootstrap = () => {
  useRideRealtime();
  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <RealtimeBootstrap />
          <PwaController />
          <AnimatedRoutes />
          <JarviouWidget />
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
