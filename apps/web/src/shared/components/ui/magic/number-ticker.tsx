"use client";

import React, { useEffect, useRef } from "react";
import { useInView, useMotionValue, useSpring } from "framer-motion";
import { cn } from "@/shared/lib/utils";

export interface NumberTickerProps {
  /** The target value to count to */
  value: number;
  /** Direction of counting */
  direction?: "up" | "down";
  /** Delay before counting starts (in seconds) */
  delay?: number;
  /** Number of decimal places */
  decimalPlaces?: number;
  /** Starting value */
  startValue?: number;
  /** Additional className */
  className?: string;
  /** Prefix string (e.g., "$") */
  prefix?: string;
  /** Suffix string (e.g., "/month") */
  suffix?: string;
  /** Custom formatter: receives the raw number, returns display string (e.g. for locale commas) */
  formatValue?: (n: number) => string;
}

/**
 * Animated number ticker component
 * Counts from startValue to value with smooth animation
 */
export function NumberTicker({
  value,
  direction = "up",
  delay = 0,
  decimalPlaces = 0,
  startValue = 0,
  className,
  prefix = "",
  suffix = "",
  formatValue,
}: NumberTickerProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(direction === "down" ? value : startValue);
  const springValue = useSpring(motionValue, {
    damping: 60,
    stiffness: 100,
  });
  const isInView = useInView(ref, { once: true, margin: "0px" });

  useEffect(() => {
    if (isInView) {
      const timer = setTimeout(() => {
        motionValue.set(direction === "down" ? startValue : value);
      }, delay * 1000);
      return () => clearTimeout(timer);
    }
  }, [motionValue, isInView, value, direction, delay, startValue]);

  useEffect(() => {
    springValue.on("change", (latest) => {
      if (ref.current) {
        const formattedValue = formatValue
          ? formatValue(latest)
          : latest.toFixed(decimalPlaces);
        ref.current.textContent = `${prefix}${formattedValue}${suffix}`;
      }
    });
  }, [springValue, decimalPlaces, prefix, suffix, formatValue]);

  const initialDisplay = formatValue
    ? formatValue(direction === "down" ? value : startValue)
    : (direction === "down" ? value : startValue).toFixed(decimalPlaces);

  return (
    <span
      ref={ref}
      className={cn("tabular-nums", className)}
      aria-live="polite"
      aria-atomic="true"
    >
      {prefix}
      {initialDisplay}
      {suffix}
    </span>
  );
}
