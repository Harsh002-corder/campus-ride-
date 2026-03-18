import { motion } from "framer-motion";
import { Gauge, GaugeCircle } from "lucide-react";
import { useMotionPrefs } from "@/hooks/useMotionPrefs";

const MotionToggle = () => {
  const { reducedMotion, toggleReducedMotion } = useMotionPrefs();

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.94 }}
      onClick={toggleReducedMotion}
      className="fixed bottom-4 left-4 z-[95] rounded-full border border-primary/25 bg-background/85 px-3 py-2 text-xs font-semibold text-primary backdrop-blur-md"
      title={reducedMotion ? "Enable full motion" : "Reduce motion"}
    >
      <span className="inline-flex items-center gap-1.5">
        {reducedMotion ? <Gauge className="h-3.5 w-3.5" /> : <GaugeCircle className="h-3.5 w-3.5" />}
        {reducedMotion ? "Reduced Motion" : "Motion On"}
      </span>
    </motion.button>
  );
};

export default MotionToggle;
