"use client";

import React from "react";
import { TestimonialCard, TestimonialCardProps } from "./TestimonialCard";
import { cn } from "@/shared/lib/utils";
import { AnimatedSection } from "@/shared/components/ui/animated-section";
import { LandingSection } from "./LandingSection";

export interface TestimonialSectionProps {
  /** Array of testimonials */
  testimonials: TestimonialCardProps[];
  /** Section title */
  title?: string;
  /** Section subtitle */
  subtitle?: string;
  /** Number of columns (1-3) */
  columns?: 1 | 2 | 3;
  /** Section ID for anchor links */
  id?: string;
  /** Additional className */
  className?: string;
}

export function TestimonialSection({
  testimonials,
  title,
  subtitle,
  columns = 2,
  id,
  className,
}: TestimonialSectionProps) {
  const gridCols = {
    1: "md:grid-cols-1",
    2: "md:grid-cols-2",
    3: "md:grid-cols-3",
  };

  return (
    <LandingSection id={id} className={cn("bg-background", className)}>
        {(title || subtitle) && (
          <div className="text-center mb-[var(--landing-block-mb)] sm:mb-[var(--landing-block-mb-sm)]">
            {title && (
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-4">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto">
                {subtitle}
              </p>
            )}
          </div>
        )}

        <AnimatedSection delay={0.1}>
          <div className={cn("grid gap-[var(--landing-grid-gap)] sm:gap-[var(--landing-grid-gap-sm)]", gridCols[columns])}>
            {testimonials.map((testimonial, index) => (
              <TestimonialCard key={index} {...testimonial} />
            ))}
          </div>
        </AnimatedSection>
    </LandingSection>
  );
}
