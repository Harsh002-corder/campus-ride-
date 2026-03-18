import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Mail, Lock, User, ShieldCheck } from "lucide-react";
import PageTransition from "@/components/PageTransition";
import BrandIcon from "@/components/BrandIcon";
import { apiClient } from "@/lib/apiClient";

const SuperAdminSetup = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);
  const [setupApiAvailable, setSetupApiAvailable] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const isMissingSetupApi = (value: string) => value.toLowerCase().includes("route not found");

  useEffect(() => {
    let mounted = true;
    const loadStatus = async () => {
      try {
        const response = await apiClient.auth.superAdminSetupStatus();
        if (!mounted) return;
        setInitialized(Boolean(response.initialized));
        if (response.initialized) {
          setMessage("System already initialized.");
        }
      } catch (err) {
        if (!mounted) return;
        const text = err instanceof Error ? err.message : "Unable to verify setup status right now.";
        if (isMissingSetupApi(text)) {
          setSetupApiAvailable(false);
          setError("Setup API not deployed yet. Redeploy backend to enable super admin setup.");
          return;
        }
        setError("Unable to verify setup status right now.");
      } finally {
        if (mounted) setStatusLoading(false);
      }
    };

    void loadStatus();
    return () => {
      mounted = false;
    };
  }, []);

  const inputClass =
    "w-full bg-muted/50 border border-border rounded-xl py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all";

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (initialized) {
      setMessage("System already initialized.");
      return;
    }

    if (!setupApiAvailable) {
      setError("Setup API not deployed yet. Redeploy backend to enable super admin setup.");
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.auth.superAdminSignup({
        name,
        email,
        password,
      });
      setInitialized(true);
      setMessage(response.message || "Super Admin created successfully.");
      setName("");
      setEmail("");
      setPassword("");
    } catch (err) {
      const text = err instanceof Error ? err.message : "Setup failed";
      if (isMissingSetupApi(text)) {
        setSetupApiAvailable(false);
        setError("Setup API not deployed yet. Redeploy backend to enable super admin setup.");
      } else {
        setError(text);
      }
      if (text.includes("Super Admin already exists")) {
        setInitialized(true);
        setMessage("System already initialized.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-background flex items-center justify-center px-4 py-10 relative overflow-hidden">
        <div className="absolute inset-0 [background:var(--gradient-hero)]" />

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="relative z-10 w-full max-w-md"
        >
          <div className="glass rounded-3xl p-6 sm:p-8 border border-border/60">
            <div className="flex items-center gap-2 mb-6">
              <BrandIcon className="w-9 h-9" />
              <span className="text-xl font-bold font-display text-foreground">
                Campus<span className="gradient-text">Ride</span>
              </span>
            </div>

            <h1 className="text-2xl font-bold font-display mb-2">Super Admin Setup</h1>
            <p className="text-sm text-muted-foreground mb-6">
              One-time system initialization for the platform owner.
            </p>

            <div className="rounded-xl bg-muted/40 border border-border/50 p-2.5 text-xs text-muted-foreground flex items-center gap-2 mb-6">
              <ShieldCheck className="w-3.5 h-3.5 text-primary" />
              {initialized ? "System already initialized." : "Create first and only super admin account."}
            </div>

            {statusLoading ? (
              <p className="text-sm text-muted-foreground">Checking setup status...</p>
            ) : (
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    required
                    placeholder="Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={inputClass}
                    disabled={initialized || loading}
                  />
                </div>

                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="email"
                    required
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClass}
                    disabled={initialized || loading}
                  />
                </div>

                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="password"
                    required
                    minLength={8}
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={inputClass}
                    disabled={initialized || loading}
                  />
                </div>

                <button
                  type="submit"
                  disabled={initialized || loading || !setupApiAvailable}
                  className="w-full btn-primary-gradient py-3 rounded-xl font-semibold text-sm shadow-lg shadow-primary/20 disabled:opacity-60"
                >
                  {loading ? "Creating..." : "Create Super Admin"}
                </button>
              </form>
            )}

            {message && <p className="mt-4 text-sm text-primary bg-primary/10 px-3 py-2 rounded-xl">{message}</p>}
            {error && <p className="mt-4 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-xl">{error}</p>}

            <p className="text-xs text-muted-foreground mt-6 text-center">
              Return to <Link to="/login" className="text-primary hover:underline">Login</Link>
            </p>
          </div>
        </motion.div>
      </div>
    </PageTransition>
  );
};

export default SuperAdminSetup;
