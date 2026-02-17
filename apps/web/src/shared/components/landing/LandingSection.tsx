"use client";

import React from "react";
import { cn } from "@/shared/lib/utils";

export interface LandingSectionProps {
  /** Section ID for anchor links */
  id?: string;
  /** Additional class for the section element */
  className?: string;
  /** Max width of the inner container: 7xl (default) or 4xl */
  maxWidth?: "7xl" | "4xl";
  /** Content to render inside the section */
  children: React.ReactNode;
}

const maxWidthClasses = {
  "7xl": "max-w-7xl",
  "4xl": "max-w-4xl",
};

/**
 * Standard landing section wrapper: uses --landing-section-py tokens for
 * vertical padding; horizontal padding + max-width controlled in one place.
 */
export function LandingSection({
  id,
  className,
  maxWidth = "7xl",
  children,
}: LandingSectionProps) {
  return (
    <section
      id={id}
      className={cn("py-[var(--landing-section-py)] sm:py-[var(--landing-section-py-sm)]", className)}
    >
      <div
        className={cn(
          "mx-auto px-4 sm:px-6 lg:px-8",
          maxWidthClasses[maxWidth]
        )}
      >
        {children}
      </div>
    </section>
  );
}
