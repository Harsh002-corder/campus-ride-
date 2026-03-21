import { lazy, Suspense } from "react";
import ScrollProgress from "@/components/ScrollProgress";
import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import TrustBar from "@/components/TrustBar";

const FeaturesSection = lazy(() => import("@/components/FeaturesSection"));
const HowItWorks = lazy(() => import("@/components/HowItWorks"));
const AppPreview = lazy(() => import("@/components/AppPreview"));
const WhyChoose = lazy(() => import("@/components/WhyChoose"));
const Testimonials = lazy(() => import("@/components/Testimonials"));
const StatsSection = lazy(() => import("@/components/StatsSection"));
const CTASection = lazy(() => import("@/components/CTASection"));
const Footer = lazy(() => import("@/components/Footer"));

const Index = () => {
  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <ScrollProgress />
      <Navbar />
      <HeroSection />
      <TrustBar />
      <Suspense fallback={null}>
        <FeaturesSection />
        <HowItWorks />
        <AppPreview />
        <WhyChoose />
        <Testimonials />
        <StatsSection />
        <CTASection />
        <Footer />
      </Suspense>
    </div>
  );
};

export default Index;
