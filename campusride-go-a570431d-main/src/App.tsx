import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense, useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import ThemeProvider from "@/contexts/ThemeProvider";
import { useRideRealtime } from "@/hooks/useRideRealtime";
import { useRealtimeRideAlerts } from "@/hooks/useRealtimeRideAlerts";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import OfflineFallback from "@/components/pwa/OfflineFallback";
import NotificationPermissionBanner from "@/components/NotificationPermissionBanner";

const Index = lazy(() => import("./pages/Index"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const StudentDashboard = lazy(() => import("./pages/StudentDashboard"));
const DriverDashboard = lazy(() => import("./pages/DriverDashboard"));
const DriverDailyEarnings = lazy(() => import("./pages/DriverDailyEarnings"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const NotFound = lazy(() => import("./pages/NotFound"));
const RideTracking = lazy(() => import("./pages/RideTracking"));
const RidesPage = lazy(() => import("./pages/RidesPage"));
const PublicRideTracking = lazy(() => import("./pages/PublicRideTracking"));
const TMUCampusMapPage = lazy(() => import("./pages/TMUCampusMapPage"));
const JarviouWidget = lazy(() => import("./components/JarviouWidget"));
const PwaController = lazy(() => import("@/components/pwa/PwaController"));

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
          <Route path="/driver-dashboard/daily-earnings" element={<RequireAuth allowedRoles={["driver"]}><DriverDailyEarnings /></RequireAuth>} />
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
  useRealtimeRideAlerts();
  return null;
};

const PushNotificationManager = () => {
  const { permission, canUsePush, requestPermission } = usePushNotifications();

  return (
    <NotificationPermissionBanner
      show={canUsePush && permission !== "granted"}
      onEnable={() => {
        void requestPermission();
      }}
    />
  );
};

const DeferredUtilities = () => {
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    const onIdle = () => setShouldRender(true);
    if ("requestIdleCallback" in window) {
      const idleId = window.requestIdleCallback(onIdle, { timeout: 1200 });
      return () => window.cancelIdleCallback(idleId);
    }

    const timeoutId = window.setTimeout(onIdle, 350);
    return () => window.clearTimeout(timeoutId);
  }, []);

  if (!shouldRender) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <PwaController />
      <JarviouWidget />
    </Suspense>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AuthProvider>
          <BrowserRouter>
            <RealtimeBootstrap />
            <AnimatedRoutes />
            <PushNotificationManager />
            <DeferredUtilities />
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
