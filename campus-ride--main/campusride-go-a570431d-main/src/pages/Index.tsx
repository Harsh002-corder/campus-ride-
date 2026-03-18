import ScrollProgress from "@/components/ScrollProgress";
import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import TrustBar from "@/components/TrustBar";
import FeaturesSection from "@/components/FeaturesSection";
import HowItWorks from "@/components/HowItWorks";
import AppPreview from "@/components/AppPreview";
import WhyChoose from "@/components/WhyChoose";
import Testimonials from "@/components/Testimonials";
import StatsSection from "@/components/StatsSection";
import CTASection from "@/components/CTASection";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <ScrollProgress />
      <Navbar />
      <HeroSection />
      <TrustBar />
      <FeaturesSection />
      <HowItWorks />
      <AppPreview />
      <WhyChoose />
      <Testimonials />
      <StatsSection />
      <CTASection />
      <Footer />
    </div>
  );
};

export default Index;
