"use client";

import React from "react";
import { Button, ButtonProps } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";

export interface ShimmerButtonProps extends ButtonProps {
  /** Shimmer effect intensity */
  shimmerColor?: string;
}

/**
 * Button with shimmer effect on hover
 * Adds a subtle animated shimmer effect for enhanced interactivity
 */
export function ShimmerButton({
  className,
  shimmerColor = "rgba(255, 255, 255, 0.3)",
  children,
  ...props
}: ShimmerButtonProps) {
  return (
    <Button
      className={cn(
        "relative overflow-hidden",
        "before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_2s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent",
        className
      )}
      style={
        {
          "--shimmer-color": shimmerColor,
        } as React.CSSProperties
      }
      {...props}
    >
      <span className="relative z-10">{children}</span>
    </Button>
  );
}
