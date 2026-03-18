import { motion } from "framer-motion";
import { useInView } from "@/hooks/useInView";
import { ShieldCheck, Navigation, Clock, Banknote } from "lucide-react";

const reasons = [
  { icon: ShieldCheck, title: "Verified Drivers", desc: "Every driver undergoes background verification and university approval." },
  { icon: Navigation, title: "Real-Time Tracking", desc: "Live GPS tracking keeps you informed every second of your journey." },
  { icon: Clock, title: "Safe Campus Travel", desc: "Designed specifically for campus environments with safety protocols." },
  { icon: Banknote, title: "Affordable & Fast", desc: "Student-friendly pricing with no surge. Average wait time under 3 minutes." },
];

const WhyChoose = () => {
  const { ref, isInView } = useInView(0.15);

  return (
    <section id="drivers" className="py-24 relative" ref={ref}>
      <div className="container mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.7 }}
          >
            <span className="text-sm font-medium text-primary mb-3 block tracking-widest uppercase">Why Us</span>
            <h2 className="text-3xl md:text-5xl font-bold font-display mb-6">
              Why Choose{" "}
              <span className="gradient-text">CampusRide</span>?
            </h2>
            <div className="space-y-6">
              {reasons.map((r, i) => (
                <motion.div
                  key={r.title}
                  initial={{ opacity: 0, x: -20 }}
                  animate={isInView ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.5, delay: 0.2 + i * 0.1 }}
                  className="flex gap-4"
                >
                  <div className="w-11 h-11 shrink-0 rounded-xl bg-primary/10 flex items-center justify-center">
                    <r.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold font-display text-foreground mb-1">{r.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{r.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="hidden lg:flex justify-center"
          >
            <div className="relative w-80 h-80 floating">
              <div className="absolute inset-0 rounded-full opacity-20 [background:var(--gradient-glow)]" />
              <div className="absolute inset-4 glass rounded-full flex items-center justify-center">
                <div className="text-center">
                  <p className="text-5xl font-bold font-display gradient-text">99%</p>
                  <p className="text-sm text-muted-foreground mt-2">Satisfaction Rate</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default WhyChoose;
