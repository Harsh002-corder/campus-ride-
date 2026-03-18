import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import PageTransition from "@/components/PageTransition";
import BrandIcon from "@/components/BrandIcon";
import { apiClient } from "@/lib/apiClient";
import { Mail, Lock, ArrowLeft, Eye, EyeOff, ShieldCheck } from "lucide-react";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [authSuccess, setAuthSuccess] = useState<{ open: boolean; message: string }>({ open: false, message: "" });
  const successTimeoutRef = useRef<number | null>(null);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const fromBooking = (location.state as any)?.from === "booking";

  const tapSoft = {
    whileTap: { scale: 0.97 },
    transition: { duration: 0.12 },
  };

  useEffect(() => () => {
    if (successTimeoutRef.current) {
      window.clearTimeout(successTimeoutRef.current);
    }
  }, []);

  const showSuccessAndNavigate = (targetPath: string, message: string) => {
    if (successTimeoutRef.current) {
      window.clearTimeout(successTimeoutRef.current);
    }

    setAuthSuccess({ open: true, message });
    successTimeoutRef.current = window.setTimeout(() => {
      setAuthSuccess({ open: false, message: "" });
      navigate(targetPath);
    }, 900);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.auth.login({ email, password });
      login(response.user, response.token);
      const targetPath = response.user.role === "super_admin"
        ? "/super-admin-dashboard"
        : response.user.role === "sub_admin"
          ? "/sub-admin-dashboard"
          : response.user.role === "admin"
            ? "/admin"
            : response.user.role === "driver"
              ? "/driver-dashboard"
              : "/student-dashboard";
      showSuccessAndNavigate(targetPath, "Login successful");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-background flex items-center justify-center px-6 py-10 relative overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 [background:var(--gradient-hero)]" />
        <div className="absolute top-1/3 left-1/4 w-[min(60vw,400px)] h-[min(60vw,400px)] rounded-full opacity-15 animate-pulse-glow [background:var(--gradient-glow)]" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="relative z-10 w-full max-w-md"
        >
          {/* Back button */}
          <motion.button
            {...tapSoft}
            whileHover={{ x: -2 }}
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8 group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm">Back to home</span>
          </motion.button>

          <div className="glass rounded-3xl p-8 border border-border/60">
            {/* Logo */}
            <div className="flex items-center gap-2 mb-7">
              <BrandIcon className="w-9 h-9" />
              <span className="text-xl font-bold font-display text-foreground">
                Campus<span className="gradient-text">Ride</span>
              </span>
            </div>

            <h1 className="text-2xl font-bold font-display mb-2">Welcome back</h1>
            <p className="text-muted-foreground text-sm mb-4">Sign in once and continue as student, driver, or admin.</p>

            {fromBooking && (
              <motion.p
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-primary mb-4 bg-primary/10 px-3 py-2 rounded-xl"
              >
                Please login to continue booking your ride.
              </motion.p>
            )}

            <div className="space-y-3 mb-6">
              <div className="rounded-lg bg-primary/10 border border-primary/30 p-3.5 text-sm text-primary font-medium flex items-center gap-3">
                <ShieldCheck className="w-5 h-5 flex-shrink-0" />
                <span>🔒 Secure JWT Login</span>
              </div>
              <div className="rounded-lg bg-green-500/10 border border-green-500/30 p-3.5 text-sm text-green-600 font-medium text-center">
                ✓ OTP Verified Signup
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="email"
                  required
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-muted/50 border border-border rounded-xl py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-muted/50 border border-border rounded-xl py-3 pl-10 pr-11 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                />
                <motion.button
                  {...tapSoft}
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </motion.button>
              </div>
              <div className="text-right">
                <Link to="/forgot-password" className="text-xs text-primary hover:underline font-medium">
                  Forgot password?
                </Link>
              </div>
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-xl"
                >
                  {error}
                </motion.p>
              )}
              <motion.button
                type="submit"
                whileTap={{ scale: 0.95 }}
                animate={loading ? { scale: [1, 0.988, 1] } : { scale: 1 }}
                transition={loading ? { duration: 0.9, repeat: Infinity, ease: "easeInOut" } : { duration: 0.15 }}
                disabled={loading}
                className="w-full btn-primary-gradient relative overflow-hidden py-3.5 rounded-xl font-semibold text-base shadow-lg shadow-primary/20 transition-all disabled:opacity-70"
              >
                {loading && (
                  <>
                    <motion.span
                      aria-hidden="true"
                      className="absolute inset-y-1 left-0 w-16 rounded-full bg-white/25 blur-md"
                      animate={{ x: ["-140%", "280%"] }}
                      transition={{ duration: 1.05, repeat: Infinity, ease: "linear" }}
                    />
                    <motion.span
                      aria-hidden="true"
                      className="absolute inset-0 bg-white/5"
                      animate={{ opacity: [0.08, 0.18, 0.08] }}
                      transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
                    />
                  </>
                )}
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {loading ? (
                    <>
                      <span className="relative inline-flex h-4 w-12 items-center overflow-hidden rounded-full bg-white/10">
                        <span className="absolute left-1 right-1 h-px bg-white/35" />
                        <motion.span
                          aria-hidden="true"
                          className="absolute left-1 top-1/2 -translate-y-1/2 text-white"
                          animate={{ x: [0, 18, 32, 18, 0], rotate: [0, -8, 0, 8, 0] }}
                          transition={{ duration: 1.15, repeat: Infinity, ease: "easeInOut" }}
                        >
                          <Mail className="h-3.5 w-3.5" />
                        </motion.span>
                      </span>
                      <span>Signing In...</span>
                    </>
                  ) : (
                    "Sign In"
                  )}
                </span>
              </motion.button>
            </form>

            <p className="text-sm text-muted-foreground text-center mt-6">
              Don't have an account?{" "}
              <Link to="/signup" className="text-primary hover:underline font-medium">
                Sign up
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
      <AnimatePresence>
        {authSuccess.open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[90] flex items-center justify-center px-6"
          >
            <div className="absolute inset-0 bg-background/80 backdrop-blur-lg" />
            <motion.div
              initial={{ opacity: 0, y: 14, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              className="relative w-full max-w-sm rounded-3xl border border-primary/25 bg-background/95 p-6 text-center shadow-[0_24px_80px_rgba(0,0,0,0.26)]"
            >
              <motion.div
                aria-hidden="true"
                className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-primary"
                animate={{ scale: [1, 1.08, 1], rotate: [0, -6, 0, 6, 0] }}
                transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
              >
                <ShieldCheck className="h-7 w-7" />
              </motion.div>
              <h3 className="text-lg font-bold font-display text-foreground">{authSuccess.message}</h3>
              <p className="mt-1 text-sm text-muted-foreground">Redirecting to your dashboard...</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageTransition>
  );
};

export default Login;
