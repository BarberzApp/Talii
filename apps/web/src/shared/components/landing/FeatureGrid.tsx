"use client";

import React from "react";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { LucideIcon } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { motion } from "framer-motion";
import { staggerContainer, staggerItem } from "@/shared/lib/animations";
import { LandingSection } from "./LandingSection";

export interface Feature {
  /** Feature number (e.g., "01", "02") */
  number: string;
  /** Feature title */
  title: string;
  /** Feature description */
  description: string;
  /** Icon component from lucide-react */
  icon: LucideIcon;
  /** Optional badge text (e.g., "Beta", "New") */
  badge?: string;
  /** Optional color variant for icon background */
  iconColor?: string;
}

export interface FeatureGridProps {
  /** Array of features to display */
  features: Feature[];
  /** Number of columns (2-4) */
  columns?: 2 | 3 | 4;
  /** Section title */
  title?: string;
  /** Section subtitle */
  subtitle?: string;
  /** Section ID for anchor links */
  id?: string;
  /** Additional className */
  className?: string;
}

export function FeatureGrid({
  features,
  columns = 4,
  title,
  subtitle,
  id,
  className,
}: FeatureGridProps) {
  const gridCols = {
    2: "sm:grid-cols-2",
    3: "sm:grid-cols-2 lg:grid-cols-3",
    4: "sm:grid-cols-2 lg:grid-cols-4",
  };

  return (
    <LandingSection id={id} className={className}>
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

        <motion.div
          className={cn("grid gap-[var(--landing-grid-gap)] sm:gap-[var(--landing-grid-gap-sm)]", gridCols[columns])}
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
        >
          {features.map((feature, index) => (
            <motion.div key={index} variants={staggerItem} className="h-full">
              <Card className="group bg-surface border border-border shadow-lg dark:shadow-xl rounded-2xl p-5 sm:p-6 hover:shadow-xl dark:hover:shadow-2xl hover:border-primary/30 transition-all duration-300 hover:-translate-y-2 relative overflow-hidden h-full flex flex-col">
              <CardContent className="p-0 flex flex-col flex-1">
                <div className="flex items-center justify-between mb-4">
                  <div
                    className={cn(
                      "w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center",
                      feature.iconColor || "bg-secondary/20 text-secondary"
                    )}
                  >
                    <feature.icon className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <span className="text-3xl sm:text-4xl text-muted-foreground/50 group-hover:text-muted-foreground transition-colors">
                    {feature.number}
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-lg sm:text-xl font-semibold text-foreground mb-0">
                    {feature.title}
                  </h3>
                  {feature.badge && (
                    <Badge className="bg-secondary/90 text-primary-foreground border-secondary/50 dark:border-secondary/40 animate-pulse">
                      {feature.badge}
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground leading-relaxed text-sm sm:text-base flex-1">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
            </motion.div>
          ))}
        </motion.div>
    </LandingSection>
  );
}
