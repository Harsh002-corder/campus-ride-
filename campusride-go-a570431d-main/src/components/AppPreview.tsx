import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { useInView } from "@/hooks/useInView";
import appMockup from "@/assets/app-mockup.jpg";

const AppPreview = () => {
  const { ref, isInView } = useInView(0.1);
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  });
  const rotateX = useTransform(scrollYProgress, [0, 0.5, 1], [10, 0, -5]);
  const scale = useTransform(scrollYProgress, [0, 0.5], [0.9, 1]);

  return (
    <section className="py-24 relative overflow-hidden" ref={containerRef}>
      <div className="container mx-auto px-6" ref={ref}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          className="text-center mb-16"
        >
          <span className="text-sm font-medium text-primary mb-3 block tracking-widest uppercase">Preview</span>
          <h2 className="text-3xl md:text-5xl font-bold font-display mb-4">
            Your Ride, <span className="gradient-text">One Tap Away</span>
          </h2>
        </motion.div>

        <motion.div
          style={{ rotateX, scale, perspective: 1000 }}
          className="max-w-sm mx-auto"
        >
          <div className="relative">
            <div className="absolute -inset-8 rounded-[2rem] opacity-30 [background:var(--gradient-glow)]" />
            <img
              src={appMockup}
              alt="CampusRide app preview"
              className="w-full rounded-3xl shadow-2xl relative z-10 border border-border/50"
              loading="lazy"
            />
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default AppPreview;
