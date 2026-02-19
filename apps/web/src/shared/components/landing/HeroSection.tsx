"use client";

import React from "react";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { ArrowRight, Play } from "lucide-react";
import Link from "next/link";
import { cn } from "@/shared/lib/utils";
import { AnimatedSection } from "@/shared/components/ui/animated-section";

export interface HeroSectionProps {
  /** Optional overline badge text (e.g., "FOR BEAUTY & GROOMING PROS") */
  overline?: string;
  /** Main hero headline (can be string or ReactNode for formatting) */
  headline: React.ReactNode;
  /** Subheadline describing the value proposition */
  subheadline: string;
  /** Primary CTA configuration */
  primaryCta: {
    label: string;
    href: string;
  };
  /** Secondary CTA configuration */
  secondaryCta?: {
    label: string;
    href: string;
  };
  /** Optional proof/metric snippet to display */
  proof?: string;
  /** Visual element (React node) - dashboard preview, illustration, etc. */
  visual?: React.ReactNode;
  /** Additional className for the section */
  className?: string;
}

export function HeroSection({
  overline,
  headline,
  subheadline,
  primaryCta,
  secondaryCta,
  proof,
  visual,
  className,
}: HeroSectionProps) {
  return (
    <section
      className={cn(
        "pt-[var(--landing-hero-pt)] sm:pt-[var(--landing-hero-pt-sm)] pb-[var(--landing-hero-pb)] sm:pb-[var(--landing-hero-pb-sm)] relative",
        className
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-[var(--landing-hero-gap)] lg:gap-[var(--landing-hero-gap-lg)] items-center">
          {/* Left Column - Content */}
          <AnimatedSection delay={0.1} className="space-y-8">
            <div className="space-y-6">
              {overline && (
                <div className="flex items-center gap-3">
                  <Badge className="bg-secondary/10 text-secondary border border-secondary/20 dark:bg-secondary/15 dark:border-secondary/25 px-3 py-1 text-xs font-medium tracking-wider">
                    {overline}
                  </Badge>
                </div>
              )}

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bebas font-bold text-foreground leading-tight">
                {headline}
              </h1>

              <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed max-w-2xl">
                {subheadline}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                href={primaryCta.href}
                size="lg"
                className="bg-secondary text-primary-foreground px-8 py-4 rounded-xl font-semibold text-lg hover:bg-secondary/90 transition-all duration-300 transform hover:scale-105 shadow-lg shadow-secondary/25"
              >
                {primaryCta.label}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              {secondaryCta && (
                <Button
                  href={secondaryCta.href}
                  variant="outline"
                  size="lg"
                  className="flex items-center justify-center px-8 py-4 border border-border text-foreground rounded-xl font-semibold text-lg hover:bg-muted transition-all duration-300"
                >
                  <Play className="w-5 h-5 mr-2" />
                  {secondaryCta.label}
                </Button>
              )}
            </div>

            {proof && (
              <div className="pt-6 sm:pt-8">
                <p className="text-sm sm:text-base text-muted-foreground text-center sm:text-left">
                  {proof}
                </p>
              </div>
            )}
          </AnimatedSection>

          {/* Right Column - Visual */}
          {visual && (
            <AnimatedSection delay={0.3} className="relative mt-8 lg:mt-0">
              {visual}
            </AnimatedSection>
          )}
        </div>
      </div>
    </section>
  );
}
