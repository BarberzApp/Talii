"use client";

import React from "react";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { cn } from "@/shared/lib/utils";

export interface TextRevealProps {
  /** Text content to reveal */
  text: string;
  /** Animation delay (in seconds) */
  delay?: number;
  /** Additional className */
  className?: string;
  /** Whether to trigger once */
  once?: boolean;
}

/**
 * Text reveal animation component
 * Reveals text with fade-in and slide-up effect on scroll
 */
export function TextReveal({
  text,
  delay = 0,
  className,
  once = true,
}: TextRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once, margin: "0px 0px -100px 0px" });

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      variants={{
        hidden: {
          opacity: 0,
          y: 20,
        },
        visible: {
          opacity: 1,
          y: 0,
          transition: {
            duration: 0.6,
            delay,
            ease: [0.22, 1, 0.36, 1],
          },
        },
      }}
      className={cn(className)}
    >
      {text}
    </motion.div>
  );
}
