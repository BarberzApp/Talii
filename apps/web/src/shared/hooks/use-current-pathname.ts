"use client";

import { usePathname } from "next/navigation";

/**
 * Small wrapper around Next.js usePathname to provide
 * a non-null string and centralize any future pathname logic.
 */
export function useCurrentPathname(): string {
  const pathname = usePathname();
  return pathname ?? "/";
}

