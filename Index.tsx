import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Hero } from "@/components/landing/Hero";
import { Features } from "@/components/landing/Features";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { FAQ } from "@/components/landing/FAQ";
import { CTA } from "@/components/landing/CTA";
import { useEffect } from "react";

const Index = () => {
  useEffect(() => {
    document.title = "Vivasayi.AI — Precision farming for India";
    const meta = document.querySelector('meta[name="description"]');
    const desc = "AI-powered farming platform combining satellite imagery, soil sensors and weather forecasts to help Indian farmers irrigate, fertilize and harvest smarter.";
    if (meta) meta.setAttribute("content", desc);
    else {
      const m = document.createElement("meta");
      m.name = "description"; m.content = desc;
      document.head.appendChild(m);
    }
  }, []);

  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      <Hero />
      <Features />
      <HowItWorks />
      <FAQ />
      <CTA />
      <Footer />
    </main>
  );
};

export default Index;
