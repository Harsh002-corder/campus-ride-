import { motion } from "framer-motion";
import { useInView } from "@/hooks/useInView";
import { LogIn, MapPin, UserCheck, Navigation } from "lucide-react";

const steps = [
  { icon: LogIn, title: "Login", desc: "Sign in with your university credentials" },
  { icon: MapPin, title: "Book Ride", desc: "Select pickup & drop-off location" },
  { icon: UserCheck, title: "Driver Accepts", desc: "Get matched with a verified driver" },
  { icon: Navigation, title: "Track Live", desc: "Watch your ride in real-time" },
];

const HowItWorks = () => {
  const { ref, isInView } = useInView(0.15);

  return (
    <section id="how-it-works" className="py-24 relative" ref={ref}>
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          className="text-center mb-16"
        >
          <span className="text-sm font-medium text-primary mb-3 block tracking-widest uppercase">Process</span>
          <h2 className="text-3xl md:text-5xl font-bold font-display mb-4">
            How It <span className="gradient-text">Works</span>
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Four simple steps to your next campus ride.
          </p>
        </motion.div>

        <div className="relative">
          {/* Desktop timeline line */}
          <div className="hidden md:block absolute top-1/2 left-0 right-0 h-0.5 bg-border -translate-y-1/2" />

          <div className="grid md:grid-cols-4 gap-8 relative">
            {steps.map((step, i) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 30 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: i * 0.15 }}
                className="flex flex-col items-center text-center relative"
              >
                <div className="w-16 h-16 rounded-2xl btn-primary-gradient flex items-center justify-center mb-4 relative z-10 shadow-lg" style={{ boxShadow: "var(--shadow-glow-sm)" }}>
                  <step.icon className="w-7 h-7 text-primary-foreground" />
                </div>
                <span className="text-xs text-primary font-semibold mb-1">Step {i + 1}</span>
                <h3 className="font-semibold font-display text-foreground mb-1">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
