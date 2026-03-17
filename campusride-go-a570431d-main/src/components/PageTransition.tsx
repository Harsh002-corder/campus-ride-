import { motion } from "framer-motion";
import { ReactNode, useEffect } from "react";
import { useLocation } from "react-router-dom";

const PageTransition = ({ children }: { children: ReactNode }) => {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const pathname = location.pathname.toLowerCase();
  const isAuthRoute = pathname.includes("login") || pathname.includes("signup") || pathname.includes("forgot-password");
  const isTrackingRoute = pathname.includes("ride-tracking");
  const isDashboardRoute = pathname.includes("dashboard") || pathname === "/admin";

  const initial = isAuthRoute
    ? { opacity: 0, y: 26, scale: 0.985, filter: "blur(12px)" }
    : isTrackingRoute
      ? { opacity: 0, y: 12, scale: 0.992, filter: "blur(6px)" }
      : isDashboardRoute
        ? { opacity: 0, y: 16, scale: 0.988, filter: "blur(8px)" }
        : { opacity: 0, y: 18, scale: 0.985, filter: "blur(10px)" };

  const animate = isAuthRoute
    ? { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }
    : isTrackingRoute
      ? { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }
      : isDashboardRoute
        ? { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }
        : { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" };

  const exit = isAuthRoute
    ? { opacity: 0, y: -16, scale: 0.992, filter: "blur(10px)" }
    : isTrackingRoute
      ? { opacity: 0, y: -8, scale: 0.996, filter: "blur(6px)" }
      : isDashboardRoute
        ? { opacity: 0, y: -10, scale: 0.994, filter: "blur(7px)" }
        : { opacity: 0, y: -12, scale: 0.992, filter: "blur(8px)" };

  const transition = isAuthRoute
    ? { duration: 0.48, ease: [0.22, 1, 0.36, 1] as const }
    : isTrackingRoute
      ? { duration: 0.34, ease: [0.2, 0.8, 0.2, 1] as const }
      : isDashboardRoute
        ? { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const }
        : { duration: 0.44, ease: [0.22, 1, 0.36, 1] as const };

  return (
    <motion.div
      initial={initial}
      animate={animate}
      exit={exit}
      transition={transition}
      className="relative"
    >
      <motion.div
        aria-hidden="true"
        initial={{ opacity: 0.35, scaleX: 0.12 }}
        animate={{ opacity: 0, scaleX: 1.05 }}
        exit={{ opacity: 0.28, scaleX: 0.18 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="pointer-events-none fixed left-0 right-0 top-0 z-[70] mx-auto h-px origin-center bg-gradient-to-r from-transparent via-primary/70 to-transparent"
      />
      <motion.div
        aria-hidden="true"
        initial={{ opacity: 0.18, y: -12 }}
        animate={{ opacity: 0, y: 10 }}
        exit={{ opacity: 0.14, y: -6 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-24 bg-gradient-to-b from-primary/10 via-primary/5 to-transparent"
      />
      {children}
    </motion.div>
  );
};

export default PageTransition;
