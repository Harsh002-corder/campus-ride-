import { motion } from "framer-motion";
import { ReactNode, useEffect } from "react";

const PageTransition = ({ children }: { children: ReactNode }) => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 18, scale: 0.985, filter: "blur(10px)" }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
      exit={{ opacity: 0, y: -12, scale: 0.992, filter: "blur(8px)" }}
      transition={{ duration: 0.44, ease: [0.22, 1, 0.36, 1] }}
      className="relative"
    >
      <motion.div
        aria-hidden="true"
        initial={{ opacity: 0.35, scaleX: 0.12 }}
        animate={{ opacity: 0, scaleX: 1.05 }}
        exit={{ opacity: 0.28, scaleX: 0.18 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="pointer-events-none fixed left-0 right-0 top-0 z-[70] mx-auto h-px origin-center bg-gradient-to-r from-transparent via-primary/70 to-transparent"
      />
      <motion.div
        aria-hidden="true"
        initial={{ opacity: 0.18, y: -12 }}
        animate={{ opacity: 0, y: 10 }}
        exit={{ opacity: 0.14, y: -6 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-24 bg-gradient-to-b from-primary/10 via-primary/5 to-transparent"
      />
      {children}
    </motion.div>
  );
};

export default PageTransition;
