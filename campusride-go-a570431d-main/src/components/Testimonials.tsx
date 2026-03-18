import { motion } from "framer-motion";
import { useInView } from "@/hooks/useInView";
import { Star } from "lucide-react";

const testimonials = [
  { name: "Aarav S.", role: "Engineering Student", text: "CampusRide changed how I commute. No more waiting in the sun between classes!", rating: 5 },
  { name: "Priya M.", role: "Business School", text: "Super affordable and the drivers are always so friendly. Feels very safe on campus.", rating: 5 },
  { name: "Rohan K.", role: "Medical Student", text: "The real-time tracking is amazing. I always know exactly when my ride arrives.", rating: 5 },
  { name: "Sneha D.", role: "Arts Faculty", text: "Booking takes seconds. This is what campus transport should have always been.", rating: 5 },
  { name: "Vikram P.", role: "Law Student", text: "I use it daily between the library and hostel. Absolute game-changer.", rating: 5 },
  { name: "Meera R.", role: "PhD Scholar", text: "As a driver, the extra income is great and the platform is incredibly easy to use.", rating: 5 },
];

const TestimonialCard = ({ t }: { t: typeof testimonials[0] }) => (
  <div className="card-glass gradient-border min-w-[300px] max-w-[320px] shrink-0 mx-3">
    <div className="flex gap-1 mb-3">
      {Array.from({ length: t.rating }).map((_, i) => (
        <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
      ))}
    </div>
    <p className="text-sm text-muted-foreground mb-4 leading-relaxed">"{t.text}"</p>
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-sm font-semibold text-primary">
        {t.name[0]}
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">{t.name}</p>
        <p className="text-xs text-muted-foreground">{t.role}</p>
      </div>
    </div>
  </div>
);

const Testimonials = () => {
  const { ref, isInView } = useInView(0.1);
  const doubled = [...testimonials, ...testimonials];

  return (
    <section className="py-24 relative overflow-hidden" ref={ref}>
      <div className="container mx-auto px-6 mb-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          className="text-center"
        >
          <span className="text-sm font-medium text-primary mb-3 block tracking-widest uppercase">Testimonials</span>
          <h2 className="text-3xl md:text-5xl font-bold font-display mb-4">
            Loved by <span className="gradient-text">Students</span>
          </h2>
        </motion.div>
      </div>

      <div className="relative">
        <motion.div
          animate={{ x: [0, -1920] }}
          transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
          className="flex"
        >
          {doubled.map((t, i) => (
            <TestimonialCard key={i} t={t} />
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default Testimonials;
