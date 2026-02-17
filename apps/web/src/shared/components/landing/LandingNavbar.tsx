"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { Button } from "@/shared/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/shared/components/ui/sheet";
import { ModeToggle } from "@/shared/components/theme/mode-toggle";
import { Menu } from "lucide-react";
import { cn } from "@/shared/lib/utils";

export interface NavItem {
  href: string;
  label: string;
}

export interface LandingNavbarProps {
  /** Logo image source (light theme) */
  logo?: string;
  /** Logo image source (dark theme); falls back to logo if not set */
  logoDark?: string;
  /** Logo text (if no image) */
  logoText?: string;
  /** Navigation items */
  navItems: NavItem[];
  /** CTA button label */
  ctaLabel: string;
  /** CTA button href */
  ctaHref: string;
  /** Additional className */
  className?: string;
}

export function LandingNavbar({
  logo = "/brand/talii-logo-zoomed.png",
  logoDark = "/brand/talii-logo-zoomed-dark.png",
  logoText = "Talii",
  navItems,
  ctaLabel,
  ctaHref,
  className,
}: LandingNavbarProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [headerState, setHeaderState] = useState<
    "default" | "scrolled" | "hidden"
  >("default");

  // Avoid hydration mismatch: only use theme for logo after mount (server and initial client both use light)
  const isDark = mounted && resolvedTheme === "dark";
  const logoSrc = isDark ? logoDark : logo;
  const logoAlt = isDark ? `${logoText} Logo (Dark)` : `${logoText} Logo`;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 200) {
        setHeaderState("hidden");
      } else if (window.scrollY > 0) {
        setHeaderState("scrolled");
      } else {
        setHeaderState("default");
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={cn(
        "w-full py-4 sm:py-5 px-4 sm:px-6 bg-background/95 backdrop-blur-md transition-transform duration-300 ease-in-out z-50 fixed top-0",
        headerState === "default" ? "translate-y-0" : "",
        headerState === "scrolled" ? "translate-y-2 shadow-lg" : "",
        headerState === "hidden" ? "-translate-y-full" : "",
        className
      )}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center w-full md:w-auto justify-between md:justify-start">
          <Link
            href="/"
            className="flex items-center shrink-0"
            aria-label={`${logoText} Home`}
          >
            {logoSrc ? (
              <span className="inline-block h-12 w-[140px] sm:h-14 sm:w-[160px] flex items-center">
                <img
                  src={logoSrc}
                  alt={`${logoText} Logo`}
                  className="max-h-full max-w-full w-full object-contain object-left"
                  width={160}
                  height={56}
                />
              </span>
            ) : (
              <span className="font-bebas text-2xl font-bold text-secondary">
                {logoText}
              </span>
            )}
          </Link>
          <div className="md:hidden flex items-center gap-2">
            <ModeToggle />
            <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="p-2 text-foreground hover:bg-muted"
                >
                  <Menu className="h-6 w-6" />
                  <span className="sr-only">Toggle Menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent
                side="right"
                className="w-[300px] bg-background backdrop-blur-xl border-border"
              >
                <div className="flex flex-col h-full">
                  <div className="flex items-center justify-center mb-8 pt-2">
                    {logoSrc ? (
                      <span className="inline-flex h-14 w-[180px] items-center justify-center">
                        <img
                          src={logoSrc}
                          alt={`${logoText} Logo`}
                          className="max-h-full max-w-full object-contain"
                          width={180}
                          height={56}
                        />
                      </span>
                    ) : (
                      <span className="font-bebas text-2xl font-bold text-secondary">
                        {logoText}
                      </span>
                    )}
                  </div>
                  <nav className="flex-1">
                    <ul className="space-y-4">
                      {navItems.map((item) => (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            onClick={() => setIsMenuOpen(false)}
                            className="block py-3 px-4 text-foreground hover:text-primary hover:bg-muted rounded-lg transition-colors text-lg font-bebas font-medium"
                          >
                            {item.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </nav>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-6" aria-label="Main navigation">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-foreground hover:text-primary transition-colors font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded"
            >
              {item.label}
            </Link>
          ))}
          <ModeToggle />
          <Button
            href={ctaHref}
            className="bg-secondary text-primary-foreground px-6 py-2 rounded-xl font-semibold hover:bg-secondary/90 transition-colors"
          >
            {ctaLabel}
          </Button>
        </nav>
      </div>
    </header>
  );
}
