"use client";

import React from "react";
import { motion, Variants } from "framer-motion";
import { cn } from "@/shared/lib/utils";

export interface AnimatedSectionProps {
  /** Animation variants from animations.ts */
  animation?: Variants;
  /** Delay before animation starts (in seconds) */
  delay?: number;
  /** Children to animate */
  children: React.ReactNode;
  /** Additional className */
  className?: string;
  /** Whether to trigger on viewport entry (default: true) */
  viewport?: boolean;
  /** Viewport threshold (0-1) */
  threshold?: number;
  /** Whether to trigger animation once */
  once?: boolean;
}

/**
 * Wrapper component that applies viewport-triggered animations
 * Uses Framer Motion for smooth, performant animations
 */
export function AnimatedSection({
  animation,
  delay = 0,
  children,
  className,
  viewport = true,
  threshold = 0.1,
  once = true,
}: AnimatedSectionProps) {
  const defaultAnimation = {
    hidden: {
      opacity: 0,
      y: 20,
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        delay,
        ease: "easeOut",
      },
    },
  };

  const variants = animation || defaultAnimation;

  if (!viewport) {
    return (
      <motion.div
        initial="hidden"
        animate="visible"
        variants={variants}
        className={cn(className)}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once, amount: threshold }}
      variants={variants}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}
