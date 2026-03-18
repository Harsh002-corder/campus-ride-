import { useInView } from "@/hooks/useInView";
import { useCountUp } from "@/hooks/useCountUp";
import { motion } from "framer-motion";

const stats = [
  { value: 500, suffix: "+", label: "Daily Rides" },
  { value: 100, suffix: "+", label: "Active Drivers" },
  { value: 5000, suffix: "+", label: "Registered Students" },
  { value: 99, suffix: "%", label: "Satisfaction Rate" },
];

const StatsSection = () => {
  const { ref, isInView } = useInView(0.2);

  return (
    <section className="py-24 relative" ref={ref}>
      <div className="absolute inset-0 opacity-20" style={{ background: "var(--gradient-glow)" }} />
      <div className="container mx-auto px-6 relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat, i) => (
            <StatCard key={stat.label} {...stat} index={i} started={isInView} />
          ))}
        </div>
      </div>
    </section>
  );
};

const StatCard = ({ value, suffix, label, index, started }: any) => {
  const count = useCountUp(value, 2000, started);
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={started ? { opacity: 1, scale: 1 } : {}}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className="text-center"
    >
      <p className="text-4xl md:text-5xl font-bold font-display gradient-text mb-2">
        {count}{suffix}
      </p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </motion.div>
  );
};

export default StatsSection;
