import { motion } from "framer-motion";
import { ArrowDown, MapPin, Shield } from "lucide-react";
import heroImg from "@/assets/hero-rickshaw.jpg";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";

const HeroSection = () => {
  const { handleBookRide } = useAuthRedirect();

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden" id="home">
      {/* Background effects */}
      <div className="hero-bg-layer absolute inset-0" />
      <div className="hero-glow-primary absolute top-1/4 left-1/4 w-[min(68vw,500px)] h-[min(68vw,500px)] rounded-full opacity-20 animate-pulse-glow" />
      <div className="hero-glow-secondary absolute bottom-1/3 right-1/4 w-[min(60vw,400px)] h-[min(60vw,400px)] rounded-full opacity-15 animate-pulse-glow" />

      <div className="container mx-auto px-6 relative z-10 pt-24">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Text */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="inline-flex items-center gap-2 glass px-4 py-2 rounded-full mb-6"
            >
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs text-muted-foreground font-medium">Now live on 10+ campuses</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold font-display leading-[1.1] mb-6"
            >
              Smart Campus{" "}
              <span className="gradient-text">Transportation</span>{" "}
              Made Simple
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="text-lg text-muted-foreground max-w-lg mb-8 leading-relaxed"
            >
              Book safe, affordable rides inside your university in seconds. Real-time tracking, verified drivers, and seamless payments.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="flex flex-wrap gap-4"
            >
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleBookRide}
                className="btn-primary-gradient px-8 py-3.5 rounded-2xl font-semibold text-base flex items-center gap-2"
              >
                <MapPin className="w-4 h-4" />
                Book Ride
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleBookRide}
                className="btn-outline-glow px-8 py-3.5 rounded-2xl font-semibold text-base flex items-center gap-2"
              >
                <Shield className="w-4 h-4" />
                Become a Driver
              </motion.button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="flex items-center gap-6 mt-10"
            >
              <div className="flex -space-x-3">
                {[1,2,3,4].map(i => (
                  <div key={i} className="w-9 h-9 rounded-full border-2 border-background bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">
                    {String.fromCharCode(64 + i)}
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                <span className="text-foreground font-semibold">5,000+</span> students already riding
              </p>
            </motion.div>
          </div>

          {/* Image */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, x: 40 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            transition={{ duration: 0.9, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="relative hidden lg:block"
          >
            <div className="relative floating">
              <div className="hero-image-glow absolute -inset-4 rounded-3xl opacity-30" />
              <img
                src={heroImg}
                alt="CampusRide e-rickshaw"
                className="w-full rounded-3xl shadow-2xl"
                loading="eager"
              />
            </div>
          </motion.div>
        </div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <div className="flex flex-col items-center gap-2 animate-scroll-indicator">
          <span className="text-xs text-muted-foreground">Scroll</span>
          <ArrowDown className="w-4 h-4 text-muted-foreground" />
        </div>
      </motion.div>

      {/* Wave SVG */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 1440 80" className="w-full" preserveAspectRatio="none">
          <path
            d="M0,40 C360,80 720,0 1080,40 C1260,60 1380,50 1440,40 L1440,80 L0,80 Z"
            fill="hsl(222, 47%, 6%)"
            opacity="0.5"
          />
        </svg>
      </div>
    </section>
  );
};

export default HeroSection;
