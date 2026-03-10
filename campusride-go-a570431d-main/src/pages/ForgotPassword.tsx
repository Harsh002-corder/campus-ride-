import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import PageTransition from "@/components/PageTransition";
import BrandIcon from "@/components/BrandIcon";
import { apiClient } from "@/lib/apiClient";
import { ArrowLeft, Lock, Mail, Eye, EyeOff, ShieldCheck } from "lucide-react";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [otpRequested, setOtpRequested] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const navigate = useNavigate();

  const inputClass =
    "w-full bg-muted/50 border border-border rounded-xl py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all";

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setInfo("");

    if (!otpRequested) {
      setLoading(true);
      try {
        const response = await apiClient.auth.forgotPassword({ email });
        setOtpRequested(true);
        setInfo(response.message || "If this email exists, an OTP has been sent.");
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "Failed to request OTP");
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!/^\d{6}$/.test(otp.trim())) {
      setError("Enter a valid 6-digit OTP");
      return;
    }

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.auth.resetPassword({
        email,
        otp: otp.trim(),
        newPassword,
      });
      setInfo(response.message || "Password reset successful. You can now login.");
      setTimeout(() => {
        navigate("/login");
      }, 1200);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-background flex items-center justify-center px-6 py-12 relative overflow-hidden">
        <div className="absolute inset-0 [background:var(--gradient-hero)]" />
        <div className="absolute bottom-1/3 right-1/4 w-[min(60vw,400px)] h-[min(60vw,400px)] rounded-full opacity-15 animate-pulse-glow [background:var(--gradient-glow)]" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
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

            <h1 className="text-2xl font-bold font-display mb-2">Forgot password</h1>
            <p className="text-muted-foreground text-sm mb-6">Reset your account password using OTP</p>

            <div className="rounded-xl bg-muted/40 border border-border/50 p-2.5 text-xs text-muted-foreground flex items-center gap-2 mb-6">
              <ShieldCheck className="w-3.5 h-3.5 text-primary" />
              {otpRequested ? "Step 2/2: Enter OTP and set a new password" : "Step 1/2: Request OTP on your email"}
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
                  className={inputClass}
                  disabled={otpRequested}
                />
              </div>

              {otpRequested && (
                <>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      required
                      placeholder="6-digit OTP"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      className={inputClass}
                      maxLength={6}
                    />
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type={showNewPassword ? "text" : "password"}
                      required
                      minLength={8}
                      placeholder="New password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className={`${inputClass} pr-11`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((value) => !value)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      title={showNewPassword ? "Hide password" : "Show password"}
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      required
                      minLength={8}
                      placeholder="Confirm new password"
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
                </>
              )}

              {info && (
                <motion.p
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-sm text-primary bg-primary/10 px-3 py-2 rounded-xl"
                >
                  {info}
                </motion.p>
              )}

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
                {loading ? "Please wait..." : otpRequested ? "Reset Password" : "Send OTP"}
              </motion.button>
            </form>

            <p className="text-sm text-muted-foreground text-center mt-6">
              Remembered your password? {" "}
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

export default ForgotPassword;
