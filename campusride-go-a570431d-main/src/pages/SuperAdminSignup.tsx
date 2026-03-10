import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Eye, EyeOff, KeyRound, Lock, Mail, Phone, Shield, User } from "lucide-react";
import { apiClient } from "@/lib/apiClient";
import { useAuth } from "@/contexts/AuthContext";
import PageTransition from "@/components/PageTransition";
import BrandIcon from "@/components/BrandIcon";

const SuperAdminSignup = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [collegeId, setCollegeId] = useState("");
  const [collegeOptions, setCollegeOptions] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [setupKey, setSetupKey] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    const loadColleges = async () => {
      try {
        const response = await apiClient.colleges.publicList();
        if (!mounted) return;
        setCollegeOptions((response.colleges || []).map((item) => ({ id: item.id, name: item.name, code: item.code })));
      } catch {
        if (mounted) setCollegeOptions([]);
      }
    };

    void loadColleges();
    return () => {
      mounted = false;
    };
  }, []);

  const inputClass =
    "w-full bg-muted/50 border border-border rounded-xl py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all";

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.auth.superAdminSignup({
        name,
        email,
        password,
        setupKey,
        ...(phone ? { phone } : {}),
        ...(collegeId ? { collegeId } : {}),
      });
      login(response.user, response.token);
      navigate("/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create super admin account");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-background flex items-center justify-center px-6 py-12 relative overflow-hidden">
        <div className="absolute inset-0 [background:var(--gradient-hero)]" />
        <div className="absolute top-1/3 left-1/3 w-[min(52vw,360px)] h-[min(52vw,360px)] rounded-full opacity-20 animate-pulse-glow [background:var(--gradient-glow)]" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="relative z-10 w-full max-w-md"
        >
          <button
            onClick={() => navigate("/login")}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8 group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm">Back to login</span>
          </button>

          <div className="glass rounded-3xl p-8 border border-border/60">
            <div className="flex items-center gap-2 mb-6">
              <BrandIcon className="w-9 h-9" />
              <span className="text-xl font-bold font-display text-foreground">
                Campus<span className="gradient-text">Ride</span>
              </span>
            </div>

            <h1 className="text-2xl font-bold font-display mb-2">Super Admin Signup</h1>
            <p className="text-muted-foreground text-sm mb-6">Create the platform owner account using your secure setup key.</p>

            <div className="rounded-xl bg-primary/10 border border-primary/25 p-2.5 text-xs text-primary flex items-center gap-2 mb-6">
              <Shield className="w-3.5 h-3.5" />
              This endpoint is protected by server-side setup key validation.
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  required
                  placeholder="Full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="email"
                  required
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="tel"
                  placeholder="Phone number (optional)"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <select
                  value={collegeId}
                  onChange={(e) => setCollegeId(e.target.value)}
                  className={`${inputClass} appearance-none`}
                  title="Select college"
                >
                  <option value="">Assign default college (optional)</option>
                  {collegeOptions.map((college) => (
                    <option key={college.id} value={college.id}>
                      {college.name} ({college.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="password"
                  required
                  placeholder="Setup key"
                  value={setupKey}
                  onChange={(e) => setSetupKey(e.target.value)}
                  className={inputClass}
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
                  className={`${inputClass} pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  minLength={8}
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`${inputClass} pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  title={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
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
                whileTap={{ scale: 0.97 }}
                disabled={loading}
                className="w-full btn-primary-gradient py-3 rounded-xl font-semibold text-sm shadow-lg shadow-primary/20"
              >
                {loading ? "Creating account..." : "Create Super Admin"}
              </motion.button>
            </form>

            <p className="text-sm text-muted-foreground text-center mt-6">
              Back to{" "}
              <Link to="/login" className="text-primary hover:underline font-medium">
                Sign in
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </PageTransition>
  );
};

export default SuperAdminSignup;
