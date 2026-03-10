import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import StudentDashboard from "./pages/StudentDashboard";
import DriverDashboard from "./pages/DriverDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import NotFound from "./pages/NotFound";
import RideTracking from "./pages/RideTracking";
import RidesPage from "./pages/RidesPage";
import PublicRideTracking from "./pages/PublicRideTracking";
import TMUCampusMapPage from "./pages/TMUCampusMapPage";
import JarviouWidget from "./components/JarviouWidget";

const queryClient = new QueryClient();

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
    return <Navigate to={["admin", "super_admin", "sub_admin"].includes(user.role) ? "/admin" : user.role === "driver" ? "/driver-dashboard" : "/student-dashboard"} replace />;
  }

  return children;
};

const AnimatedRoutes = () => {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Index />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/student-dashboard" element={<RequireAuth allowedRoles={["student"]}><StudentDashboard /></RequireAuth>} />
        <Route path="/driver-dashboard" element={<RequireAuth allowedRoles={["driver"]}><DriverDashboard /></RequireAuth>} />
        <Route path="/admin" element={<RequireAuth allowedRoles={["admin", "super_admin", "sub_admin"]}><AdminDashboard /></RequireAuth>} />
        <Route path="/ride-tracking" element={<RequireAuth><RideTracking /></RequireAuth>} />
        <Route path="/ride-tracking/:id" element={<RequireAuth><RideTracking /></RequireAuth>} />
        <Route path="/track/:token" element={<PublicRideTracking />} />
        <Route path="/rides" element={<RequireAuth><RidesPage /></RequireAuth>} />
        <Route path="/campus-map" element={<TMUCampusMapPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AnimatePresence>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <AnimatedRoutes />
          <JarviouWidget />
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
