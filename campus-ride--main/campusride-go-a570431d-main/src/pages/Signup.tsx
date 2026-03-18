import { useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import PageTransition from "@/components/PageTransition";
import BrandIcon from "@/components/BrandIcon";
import { apiClient } from "@/lib/apiClient";
import { Mail, Lock, ArrowLeft, User, Phone, Eye, EyeOff, ShieldCheck } from "lucide-react";

const Signup = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [emergencyContactName, setEmergencyContactName] = useState("");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("");
  const [idNumberLast4, setIdNumberLast4] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [role, setRole] = useState<"student" | "driver">("student");
  const [collegeId, setCollegeId] = useState("");
  const [collegeOptions, setCollegeOptions] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [otp, setOtp] = useState("");
  const [otpRequested, setOtpRequested] = useState(false);
  const [otpSuccessWave, setOtpSuccessWave] = useState(false);
  const [otpResendSeconds, setOtpResendSeconds] = useState(0);
  const [resendingOtp, setResendingOtp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [signupSuccess, setSignupSuccess] = useState<{ open: boolean; message: string }>({ open: false, message: "" });
  const successTimeoutRef = useRef<number | null>(null);
  const { login } = useAuth();
  const navigate = useNavigate();

  const tapSoft = {
    whileTap: { scale: 0.97 },
    transition: { duration: 0.12 },
  };

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

  useEffect(() => {
    if (!otpRequested || otpResendSeconds <= 0) return;
    const timeoutId = window.setTimeout(() => setOtpResendSeconds((prev) => Math.max(0, prev - 1)), 1000);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [otpRequested, otpResendSeconds]);

  useEffect(() => () => {
    if (successTimeoutRef.current) {
      window.clearTimeout(successTimeoutRef.current);
    }
  }, []);

  const showSuccessAndNavigate = (targetPath: string, message: string) => {
    if (successTimeoutRef.current) {
      window.clearTimeout(successTimeoutRef.current);
    }

    setSignupSuccess({ open: true, message });
    successTimeoutRef.current = window.setTimeout(() => {
      setSignupSuccess({ open: false, message: "" });
      navigate(targetPath);
    }, 950);
  };

  const buildSignupOtpPayload = () => ({
    name: name || email.split("@")[0],
    email,
    password,
    role,
    ...(phone ? { phone } : {}),
    ...(collegeId ? { collegeId } : {}),
    ...(role === "driver"
      ? {
          driverSecurity: {
            licenseNumber: licenseNumber.trim(),
            vehicleNumber: vehicleNumber.trim(),
            emergencyContactName: emergencyContactName.trim(),
            emergencyContactPhone: emergencyContactPhone.trim(),
            idNumberLast4: idNumberLast4.trim(),
          },
        }
      : {}),
  });

  const requestOtp = async () => {
    if (role === "driver") {
      if (!licenseNumber.trim() || !vehicleNumber.trim() || !emergencyContactName.trim() || !emergencyContactPhone.trim() || !idNumberLast4.trim()) {
        setError("Please fill all driver security fields.");
        return false;
      }
      if (!/^\d{4}$/.test(idNumberLast4.trim())) {
        setError("ID number last 4 digits must be exactly 4 numbers.");
        return false;
      }
    }

    await apiClient.auth.requestSignupOtp(buildSignupOtpPayload());
    setOtpRequested(true);
    setOtpResendSeconds(30);
    setInfo("OTP sent. Enter the 6-digit code to complete signup.");
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      if (!otpRequested) {
        const otpSent = await requestOtp();
        if (!otpSent) return;
      } else {
        if (!/^\d{6}$/.test(otp)) {
          setError("Enter a valid 6-digit OTP");
          return;
        }
        const response = await apiClient.auth.verifySignupOtp({ email, role, otp });
        if (response.token && response.user) {
          login(response.user, response.token);
          setOtpSuccessWave(true);
          window.setTimeout(() => {
            setOtpSuccessWave(false);
            showSuccessAndNavigate(response.user.role === "driver" ? "/driver-dashboard" : "/student-dashboard", "Signup successful");
          }, 520);
          return;
        }

        setInfo(response.message || "Signup completed. Please wait for admin approval before logging in.");
        showSuccessAndNavigate("/login", "Account created");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setError("");
    setInfo("");
    setResendingOtp(true);
    try {
      const otpSent = await requestOtp();
      if (!otpSent) return;
      setInfo("A new OTP has been sent to your email.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resend OTP");
    } finally {
      setResendingOtp(false);
    }
  };

  const inputClass =
    "w-full bg-muted/50 border border-border rounded-xl py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all";

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
            <div className="flex items-center gap-2 mb-6">
              <BrandIcon className="w-9 h-9" />
              <span className="text-xl font-bold font-display text-foreground">
                Campus<span className="gradient-text">Ride</span>
              </span>
            </div>

            <h1 className="text-2xl font-bold font-display mb-2">Create your account</h1>
            <p className="text-muted-foreground text-sm mb-6">Join the smart campus transportation network</p>

            <div className="space-y-3 mb-6">
              <div className="rounded-lg bg-primary/10 border border-primary/30 p-3.5 text-sm text-primary font-medium flex items-center gap-3">
                <ShieldCheck className="w-5 h-5 flex-shrink-0" />
                <span>{otpRequested ? "🔐 Step 2/2: Verify OTP to finish signup" : "🔐 Step 1/2: Enter details to receive OTP"}</span>
              </div>
            </div>

            {/* Role toggle */}
            <div className="flex gap-3 mb-6 p-2 rounded-lg bg-muted/40 border border-border/60">
              {(["student", "driver"] as const).map((r) => (
                <motion.button
                  {...tapSoft}
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 capitalize ${ role === r
                      ? "btn-primary-gradient text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground bg-muted/30"
                  }`}
                >
                  {r === "student" ? "👨‍🎓 Student" : "🚗 Driver"}
                </motion.button>
              ))}
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
                  disabled={otpRequested}
                  className={`${inputClass} appearance-none`}
                  title="Select college"
                >
                  <option value="">Select your college (optional)</option>
                  {collegeOptions.map((college) => (
                    <option key={college.id} value={college.id}>
                      {college.name} ({college.code})
                    </option>
                  ))}
                </select>
              </div>
              {role === "driver" && (
                <>
                  <div className="rounded-xl bg-primary/10 border border-primary/20 px-3 py-2 text-xs text-primary font-medium">
                    Driver verification details (required for account security)
                  </div>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      required
                      placeholder="Driving license number"
                      value={licenseNumber}
                      onChange={(e) => setLicenseNumber(e.target.value)}
                      className={inputClass}
                      disabled={otpRequested}
                    />
                  </div>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      required
                      placeholder="Vehicle registration number"
                      value={vehicleNumber}
                      onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
                      className={inputClass}
                      disabled={otpRequested}
                    />
                  </div>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      required
                      placeholder="Emergency contact name"
                      value={emergencyContactName}
                      onChange={(e) => setEmergencyContactName(e.target.value)}
                      className={inputClass}
                      disabled={otpRequested}
                    />
                  </div>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="tel"
                      required
                      placeholder="Emergency contact phone"
                      value={emergencyContactPhone}
                      onChange={(e) => setEmergencyContactPhone(e.target.value)}
                      className={inputClass}
                      disabled={otpRequested}
                    />
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      required
                      placeholder="ID number last 4 digits"
                      value={idNumberLast4}
                      onChange={(e) => setIdNumberLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      className={inputClass}
                      maxLength={4}
                      disabled={otpRequested}
                    />
                  </div>
                </>
              )}
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${inputClass} pr-11`}
                  disabled={otpRequested}
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
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`${inputClass} pr-11`}
                  disabled={otpRequested}
                />
                <motion.button
                  {...tapSoft}
                  type="button"
                  onClick={() => setShowConfirmPassword((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  title={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </motion.button>
              </div>

              {otpRequested && (
                <div className="space-y-2">
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.985 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.28, ease: "easeOut" }}
                    className="relative"
                  >
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      required
                      placeholder="6-digit OTP"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      className={inputClass}
                      maxLength={6}
                    />
                  </motion.div>
                  <div className="grid grid-cols-6 gap-1.5">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <motion.div
                        key={`otp-slot-${i}`}
                        className={`h-9 rounded-lg border flex items-center justify-center text-sm font-semibold ${otpSuccessWave ? "border-green-400/60 bg-green-500/10 text-green-400" : "border-border bg-muted/35 text-foreground"}`}
                        animate={otpSuccessWave
                          ? { y: [0, -5, 0], scale: [1, 1.08, 1], opacity: [0.95, 1, 0.95] }
                          : { y: 0, scale: 1, opacity: 1 }}
                        transition={otpSuccessWave
                          ? { duration: 0.34, delay: i * 0.05, ease: "easeOut" }
                          : { duration: 0.15 }}
                      >
                        {otp[i] || "•"}
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {otpRequested && (
                <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-primary/90 font-medium">Didn't receive OTP?</span>
                    <motion.button
                      {...tapSoft}
                      type="button"
                      onClick={() => void handleResendOtp()}
                      disabled={resendingOtp || loading || otpResendSeconds > 0}
                      className="text-xs font-semibold text-primary disabled:text-muted-foreground"
                    >
                      {resendingOtp ? "Resending..." : otpResendSeconds > 0 ? `Resend in ${otpResendSeconds}s` : "Resend OTP"}
                    </motion.button>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-primary/15 overflow-hidden">
                    <motion.div
                      className="h-full bg-primary"
                      animate={{ width: otpResendSeconds > 0 ? `${(otpResendSeconds / 30) * 100}%` : "0%" }}
                      transition={{ duration: 0.25, ease: "linear" }}
                    />
                  </div>
                </div>
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
                          {otpRequested ? <ShieldCheck className="h-3.5 w-3.5" /> : <Mail className="h-3.5 w-3.5" />}
                        </motion.span>
                      </span>
                      <span>{otpRequested ? "Verifying OTP..." : "Sending OTP..."}</span>
                    </>
                  ) : otpRequested ? (
                    <>
                      <motion.span animate={{ scale: [1, 1.06, 1] }} transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }} aria-hidden="true">✓</motion.span>
                      <span>Verify & Create Account</span>
                    </>
                  ) : (
                    <>
                      <motion.span whileHover={{ rotate: [-8, 8, 0] }} transition={{ duration: 0.25 }} aria-hidden="true">📨</motion.span>
                      <span>Send OTP</span>
                    </>
                  )}
                </span>
              </motion.button>
            </form>

            <p className="text-sm text-muted-foreground text-center mt-6">
              Already have an account?{" "}
              <Link to="/login" className="text-primary hover:underline font-medium">
                Sign in
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
      <AnimatePresence>
        {signupSuccess.open && (
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
              <h3 className="text-lg font-bold font-display text-foreground">{signupSuccess.message}</h3>
              <p className="mt-1 text-sm text-muted-foreground">Redirecting to continue...</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageTransition>
  );
};

export default Signup;
