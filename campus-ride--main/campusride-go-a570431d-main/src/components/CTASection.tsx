import { motion } from "framer-motion";
import { useInView } from "@/hooks/useInView";
import { ArrowRight } from "lucide-react";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";

const CTASection = () => {
  const { ref, isInView } = useInView(0.2);
  const { handleBookRide } = useAuthRedirect();

  return (
    <section className="py-24 relative" ref={ref} id="contact">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="relative rounded-3xl overflow-hidden"
        >
          <div
            className="absolute inset-0 animate-gradient-shift"
            style={{
              background: "var(--gradient-cta)",
              backgroundSize: "200% 200%",
            }}
          />
          <div className="absolute inset-0 opacity-20" style={{ background: "radial-gradient(circle at 30% 50%, white, transparent 60%)" }} />

          <div className="relative z-10 py-20 px-8 text-center">
            <h2 className="text-3xl md:text-5xl font-bold font-display mb-4 text-primary-foreground">
              Ready to Ride Smart?
            </h2>
            <p className="text-lg text-primary-foreground/80 max-w-lg mx-auto mb-8">
              Join thousands of students using CampusRide daily. Your next ride is just a tap away.
            </p>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleBookRide}
              className="bg-background text-foreground px-8 py-4 rounded-2xl font-semibold text-base inline-flex items-center gap-2 hover:gap-3 transition-all duration-300 hover:shadow-xl"
            >
              Start Your Journey
              <ArrowRight className="w-5 h-5" />
            </motion.button>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default CTASection;
