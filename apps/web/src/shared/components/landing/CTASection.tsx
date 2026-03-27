"use client";

import React from "react";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { ArrowRight } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { LandingSection } from "./LandingSection";

export interface CTASectionProps {
  /** Section title */
  title: string;
  /** Section subtitle */
  subtitle: string;
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
  /** Optional guarantee text */
  guarantee?: string;
  /** Variant: 'band' (full-width) or 'card' (contained) */
  variant?: "band" | "card";
  /** Additional className */
  className?: string;
}

export function CTASection({
  title,
  subtitle,
  primaryCta,
  secondaryCta,
  guarantee,
  variant = "card",
  className,
}: CTASectionProps) {
  if (variant === "band") {
    return (
      <section className={cn("py-[var(--landing-section-py)] sm:py-[var(--landing-section-py-sm)]", className)}>
        <div className="w-full bg-gradient-to-br from-muted/70 via-muted/40 to-transparent dark:from-secondary/20 dark:via-secondary/10 dark:to-transparent border-y border-border">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-[var(--landing-cta-inner-py)] sm:py-[var(--landing-cta-inner-py-sm)] text-center">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-4">
              {title}
            </h2>
            <p className="text-lg sm:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              {subtitle}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                href={primaryCta.href}
                size="lg"
                className="bg-secondary text-primary-foreground px-8 py-4 rounded-xl font-semibold text-lg hover:bg-secondary/90 transition-all duration-300 transform hover:scale-105 shadow-lg shadow-secondary/25"
              >
                {primaryCta.label}
                <ArrowRight className="inline ml-2 h-5 w-5" />
              </Button>
              {secondaryCta && (
                <Button
                  href={secondaryCta.href}
                  variant="outline"
                  size="lg"
                  className="flex items-center justify-center px-8 py-4 border border-border text-foreground rounded-xl font-semibold text-lg hover:bg-muted transition-all duration-300"
                >
                  {secondaryCta.label}
                </Button>
              )}
            </div>
            {guarantee && (
              <p className="text-sm text-muted-foreground mt-6">{guarantee}</p>
            )}
          </div>
        </div>
      </section>
    );
  }

  return (
    <LandingSection maxWidth="4xl" className={cn("text-center", className)}>
        <Card className="group bg-surface/60 dark:bg-white/5 backdrop-blur-xl border border-border/50 dark:border-white/10 shadow-xl dark:shadow-2xl rounded-[2rem] px-8 sm:px-12 py-[var(--landing-cta-inner-py)] sm:py-[var(--landing-cta-inner-py-sm)] transition-all duration-500 hover:shadow-2xl hover:border-primary/40 dark:hover:border-primary/40 relative overflow-hidden">
          {/* Subtle gradient overlay for extra glass effect */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-[2rem] pointer-events-none" />
          <CardContent className="p-0 relative z-10">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-4">
              {title}
            </h2>
            <p className="text-lg sm:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              {subtitle}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                href={primaryCta.href}
                size="lg"
                className="bg-secondary text-primary-foreground px-8 py-4 rounded-xl font-semibold text-lg hover:bg-secondary/90 transition-all duration-300 transform hover:scale-105 shadow-lg shadow-secondary/25"
              >
                {primaryCta.label}
                <ArrowRight className="inline ml-2 h-5 w-5" />
              </Button>
              {secondaryCta && (
                <Button
                  href={secondaryCta.href}
                  variant="outline"
                  size="lg"
                  className="flex items-center justify-center px-8 py-4 border border-border text-foreground rounded-xl font-semibold text-lg hover:bg-muted transition-all duration-300"
                >
                  {secondaryCta.label}
                </Button>
              )}
            </div>
            {guarantee && (
              <p className="text-sm text-muted-foreground mt-6">{guarantee}</p>
            )}
          </CardContent>
        </Card>
    </LandingSection>
  );
}
