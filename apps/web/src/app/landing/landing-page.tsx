"use client";

import React, { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import {
  HeroSection,
  FeatureGrid,
  TestimonialSection,
  RevenueCalculator,
  CTASection,
  LandingNavbar,
  type Feature,
} from "@/shared/components/landing";
import { EarningsDashboard } from "@/shared/components/payment/earnings-dashboard";
import {
  DollarSign,
  Users,
  Star,
  Zap,
  MessageCircle,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/shared/components/ui/button";

export default function LandingPage() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // Avoid hydration mismatch: use "light" until mounted, then theme-based variant
  const heroVariant = mounted && resolvedTheme === "dark" ? "default" : "light";

  useEffect(() => {
    setMounted(true);
  }, []);

  // Smooth scroll behavior for anchor links
  useEffect(() => {
    const handleAnchorClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a[href^="#"]');
      
      if (anchor) {
        const href = anchor.getAttribute('href');
        if (href && href.startsWith('#')) {
          e.preventDefault();
          const targetId = href.slice(1);
          const targetElement = document.getElementById(targetId);
          
          if (targetElement) {
            const headerOffset = 80;
            const elementPosition = targetElement.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

            window.scrollTo({
              top: offsetPosition,
              behavior: 'smooth'
            });
          }
        }
      }
    };

    document.addEventListener('click', handleAnchorClick);
    return () => document.removeEventListener('click', handleAnchorClick);
  }, []);
  const navItems = [
    { href: "#calculator", label: "Calculator" },
    { href: "#features", label: "Features" },
    { href: "#testimonials", label: "Success Stories" },
    { href: "/browse", label: "Browse" },
    { href: "/login", label: "Login" },
  ];

  const features: Feature[] = [
    {
      number: "01",
      title: "Social Media Integration",
      description:
        "Connect your Instagram, Twitter, and Facebook to showcase your best work, share your portfolio, and attract new clients directly from your profile.",
      icon: Star,
      iconColor: "bg-secondary/20 text-secondary",
    },
    {
      number: "02",
      title: "Revenue Optimization",
      description:
        "Boost your earnings with smart pricing, service add-ons, and analytics that help you maximize every booking.",
      icon: DollarSign,
      iconColor: "bg-secondary/20 text-secondary",
    },
    {
      number: "03",
      title: "Reach System",
      description:
        "Get discovered by clients through our on-demand marketplace—customers browse, book, and you get paid for every service delivered.",
      icon: Zap,
      iconColor: "bg-secondary/20 text-secondary",
      badge: "Alpha",
    },
    {
      number: "04",
      title: "Client Management",
      description:
        "Easily manage client profiles, preferences, and booking history to deliver a personalized experience every time.",
      icon: Users,
      iconColor: "bg-secondary/20 text-secondary",
    },
  ];

  const testimonials = [
    {
      name: "Chance Robenson",
      role: "Barber",
      location: "Princeton, NJ",
      revenue: "$50K/year",
      image: "/api/placeholder/60/60",
      quote:
        "Talii made running my business so much easier. My clients love the booking experience, and I've seen my revenue grow every month.",
      rating: 5,
      metric: "+300% Revenue Growth",
    },
    {
      name: "Caleb Bock",
      role: "Barber",
      location: "Blacksburg, VA",
      revenue: "$65K/year",
      image: "/api/placeholder/60/60",
      quote:
        "Since switching to Talii, I spend less time on admin and more time with my clients. The reminders and scheduling are a game changer!",
      rating: 5,
      metric: "95% Booking Rate",
    },
  ];

  // Hero visual - actual revenue dashboard UI with fake numbers (preview mode)
  const heroVisual = (
    <EarningsDashboard preview variant={heroVariant} />
  );

  return (
    <div className="landing-root min-h-screen bg-background">
      {/* Background: warm gradient in hero area + soft orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.06] via-transparent to-transparent h-[85vh]" />
        <div className="absolute top-0 right-0 w-[28rem] h-[28rem] bg-primary/12 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-0 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      </div>

      {/* Navigation */}
      <LandingNavbar
        logo="/brand/talii-logo-zoomed.png"
        logoDark="/brand/talii-logo-zoomed-dark.png"
        logoText="Talii"
        navItems={navItems}
        ctaLabel="Get Started"
        ctaHref="/register"
      />

      {/* Hero Section */}
      <HeroSection
        overline="FOR BEAUTY & GROOMING PROS"
        headline={
          <>
            Built to Help You Earn More
            <span className="text-secondary block font-bebas">
              With Every Booking on{"\u00a0"}Talii
            </span>
          </>
        }
        subheadline="Connect, showcase, and grow. The first platform for modern cosmetology bookings made for individuals, so you can turn every client into extra income."
        primaryCta={{
          label: "Start Your Journey",
          href: "/register",
        }}
        secondaryCta={{
          label: "See Real Results",
          href: "#testimonials",
        }}
        proof="Loved by independent stylists and barbers across the country"
        visual={heroVisual}
      />

      {/* Revenue Calculator Section */}
      <RevenueCalculator
        defaultMonthlyRevenue={5000}
        defaultCutCost={50}
        title='The "Holy Sh*t" Moment'
        subtitle="See exactly how much more you could be earning with Talii's revenue optimization tools."
        ctaLabel="Start Earning More Today"
        ctaHref="/register"
      />

      {/* Features Section */}
      <FeatureGrid
        id="features"
        features={features}
        columns={4}
        title="Everything You Need to Scale"
        subtitle="From booking automation to revenue optimization, Talii gives you the tools to transform your cosmetology business."
      />

      {/* Testimonials Section */}
      <TestimonialSection
        id="testimonials"
        testimonials={testimonials}
        title="Success Stories"
        subtitle="See how cosmetologists are transforming their businesses with Talii."
        columns={2}
      />

      {/* Final CTA Section */}
      <CTASection
        title="Ready to Transform Your Business?"
        subtitle="Join cosmetologists who are already growing their business with Talii. Start your journey today."
        primaryCta={{
          label: "Get Started Free",
          href: "/register",
        }}
        secondaryCta={{
          label: "Browse Stylists",
          href: "/browse",
        }}
        guarantee="30-day money-back guarantee • No setup fees • Cancel anytime"
        variant="card"
      />

      {/* Footer */}
      <footer className="py-16 sm:py-20 bg-surface border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-6">
            {/* Support Button */}
            <div className="flex justify-center">
              <Link href="/support">
                <Button className="bg-muted border border-border text-foreground hover:bg-muted/80 hover:border-primary/30 transition-all duration-300 rounded-xl px-6 py-3 font-semibold">
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Need Help? Contact Support
                </Button>
              </Link>
            </div>

            <p className="text-muted-foreground text-sm">
              © 2025 Talii. All rights reserved. The future of booking.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
