import { useInView } from "@/hooks/useInView";
import { useCountUp } from "@/hooks/useCountUp";
import { Users, Car, MapPin, Star } from "lucide-react";

const stats = [
  { icon: Users, value: 5000, suffix: "+", label: "Students" },
  { icon: Car, value: 100, suffix: "+", label: "Drivers" },
  { icon: MapPin, value: 10, suffix: "+", label: "Campus Zones" },
  { icon: Star, value: 4.9, suffix: "", label: "Average Rating", decimal: true },
];

const StatItem = ({ icon: Icon, value, suffix, label, decimal, started }: any) => {
  const count = useCountUp(decimal ? 49 : value, 2000, started);
  const display = decimal ? (count / 10).toFixed(1) : count;

  return (
    <div className="flex items-center gap-3 px-6 py-4">
      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <div>
        <p className="text-2xl font-bold font-display text-foreground">
          {display}{suffix}
        </p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
};

const TrustBar = () => {
  const { ref, isInView } = useInView(0.3);

  return (
    <section ref={ref} className="py-12 relative">
      <div className="absolute inset-0 opacity-30" style={{ background: "var(--gradient-glow)" }} />
      <div className="container mx-auto px-6 relative z-10">
        <div className="glass rounded-2xl flex flex-wrap justify-around">
          {stats.map((stat) => (
            <StatItem key={stat.label} {...stat} started={isInView} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default TrustBar;
