import { motion } from "framer-motion";
import { useInView } from "@/hooks/useInView";
import { Zap, Navigation, Lock, DollarSign } from "lucide-react";

const features = [
  {
    icon: Zap,
    title: "Instant Ride Booking",
    description: "Book a ride in under 10 seconds. Select your pickup, choose destination, and you're matched instantly.",
  },
  {
    icon: Navigation,
    title: "Live Ride Tracking",
    description: "Track your ride in real-time on an interactive map. Know exactly when your driver arrives.",
  },
  {
    icon: Lock,
    title: "Secure Login",
    description: "University-verified authentication ensures only students and authorized personnel can access the platform.",
  },
  {
    icon: DollarSign,
    title: "Affordable Pricing",
    description: "Student-friendly pricing with transparent fare calculation. No surge pricing, no hidden fees.",
  },
];

const FeaturesSection = () => {
  const { ref, isInView } = useInView(0.1);

  return (
    <section id="features" className="py-24 relative" ref={ref}>
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="text-sm font-medium text-primary mb-3 block tracking-widest uppercase">Features</span>
          <h2 className="text-3xl md:text-5xl font-bold font-display mb-4">
            Everything You Need to{" "}
            <span className="gradient-text">Ride Smart</span>
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            A complete transportation solution designed for the modern campus experience.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="gradient-border card-glass group cursor-default"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <feature.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold font-display mb-2 text-foreground">{feature.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
