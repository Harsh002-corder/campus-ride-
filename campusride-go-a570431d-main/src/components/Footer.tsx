import { ArrowUp, Github, Twitter, Linkedin, Instagram } from "lucide-react";
import BrandIcon from "@/components/BrandIcon";

const footerSections = [
  { title: "About", links: ["Our Story", "Team", "Careers", "Press"] },
  { title: "Services", links: ["Ride Booking", "Campus Zones", "Group Rides", "Events"] },
  { title: "Drivers", links: ["Join as Driver", "Driver App", "Earnings", "Support"] },
  { title: "Legal", links: ["Privacy Policy", "Terms of Service", "Safety", "Accessibility"] },
];

const socialIcons = [Twitter, Instagram, Linkedin, Github];

const footerLinkHref: Record<string, string> = {
  "Our Story": "#features",
  Team: "#testimonials",
  Careers: "#contact",
  Press: "#contact",
  "Ride Booking": "/login",
  "Campus Zones": "#features",
  "Group Rides": "#features",
  Events: "#contact",
  "Join as Driver": "/signup",
  "Driver App": "/login",
  Earnings: "/driver-dashboard",
  Support: "#contact",
  "Privacy Policy": "#contact",
  "Terms of Service": "#contact",
  Safety: "#features",
  Accessibility: "#contact",
};

const socialHref: Record<string, string> = {
  Twitter: "https://twitter.com",
  Instagram: "https://instagram.com",
  Linkedin: "https://linkedin.com",
  Github: "https://github.com",
};

const Footer = () => {
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <footer className="pt-16 pb-8 relative border-t border-border/50">
      <div className="absolute top-0 left-0 right-0 h-px [background:var(--gradient-primary)]" />
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          <div className="col-span-2 md:col-span-1">
            <a href="#home" className="flex items-center gap-2 mb-4">
              <BrandIcon className="w-8 h-8 rounded-lg" />
              <span className="text-lg font-bold font-display text-foreground">
                Campus<span className="gradient-text">Ride</span>
              </span>
            </a>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Smart campus transportation for the modern university.
            </p>
            <div className="flex gap-3">
              {socialIcons.map((Icon, i) => (
                <a
                  key={i}
                  href={socialHref[Icon.displayName || ""] || "https://github.com"}
                  target="_blank"
                  rel="noreferrer"
                  title={`Open ${Icon.displayName || "social"}`}
                  aria-label={`Open ${Icon.displayName || "social"}`}
                  className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all hover:scale-110"
                >
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          {footerSections.map((section) => (
            <div key={section.title}>
              <h4 className="text-sm font-semibold text-foreground mb-4">{section.title}</h4>
              <ul className="space-y-2">
                {section.links.map((link) => (
                  <li key={link}>
                    <a href={footerLinkHref[link] || "#contact"} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between pt-8 border-t border-border/50 gap-4">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} CampusRide. All rights reserved.
          </p>
          <button
            onClick={scrollToTop}
            title="Scroll to top"
            aria-label="Scroll to top"
            className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all glow-hover"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
