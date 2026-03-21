import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";
import BrandIcon from "@/components/BrandIcon";
import ThemeToggle from "@/components/ThemeToggle";

const navLinks = ["Home", "Features", "How It Works", "Drivers", "Contact"];

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { handleBookRide } = useAuthRedirect();

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <motion.nav
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled ? "glass py-3" : "py-5 bg-transparent"
      }`}
    >
      <div className="container mx-auto flex items-center justify-between px-3 sm:px-6 gap-3">
        <a href="#home" className="flex items-center gap-2 group">
          <BrandIcon className="w-9 h-9" />
          <span className="text-base sm:text-xl font-bold font-display text-foreground">
            Campus<span className="gradient-text">Ride</span>
          </span>
        </a>

        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link}
              href={`#${link.toLowerCase().replace(/\s+/g, "-")}`}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors relative group"
            >
              {link}
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-primary transition-all duration-300 group-hover:w-full rounded-full" />
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <ThemeToggle />
          <motion.button whileTap={{ scale: 0.95 }} onClick={handleBookRide} className="btn-primary-gradient px-6 py-2.5 rounded-xl text-sm font-semibold">
            Book Ride
          </motion.button>
        </div>

        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden text-foreground p-2 rounded-lg hover:bg-muted/50 transition-colors"
          aria-label="Toggle mobile navigation"
        >
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="md:hidden glass mt-2 mx-4 rounded-2xl overflow-hidden"
          >
            <div className="flex flex-col p-4 gap-3">
              <div className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2">
                <span className="text-xs text-muted-foreground">Theme</span>
                <ThemeToggle />
              </div>
              {navLinks.map((link) => (
                <a
                  key={link}
                  href={`#${link.toLowerCase().replace(/\s+/g, "-")}`}
                  onClick={() => setMobileOpen(false)}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors py-2 px-3 rounded-lg hover:bg-muted/50"
                >
                  {link}
                </a>
              ))}
              <motion.button whileTap={{ scale: 0.95 }} onClick={() => { setMobileOpen(false); handleBookRide(); }} className="btn-primary-gradient px-6 py-2.5 rounded-xl text-sm font-semibold mt-2">
                Book Ride
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
};

export default Navbar;
