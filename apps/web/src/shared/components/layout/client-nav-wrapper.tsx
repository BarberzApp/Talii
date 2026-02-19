"use client";
import { Navbar } from "@/shared/components/layout/navbar";
import { MobileNav } from "@/shared/components/layout/mobile-nav";
import React from "react";
import { useCurrentPathname } from "@/shared/hooks/use-current-pathname";

export default function ClientNavWrapper({ children }: { children: React.ReactNode }) {
  const pathname = useCurrentPathname();

  // Define pages where navigation should be hidden
  const hiddenPages = ["/", "/landing"];
  
  // Determine what to show
  const showNavbar = pathname ? !hiddenPages.includes(pathname) : true;
  const isSettingsPage = pathname?.startsWith('/settings') || false;
  const isProfilePage = pathname?.startsWith('/profile') || false;
  const shouldShowNav = showNavbar || isSettingsPage || isProfilePage;
  const showMobileNav = showNavbar || isSettingsPage || isProfilePage;

  // Debug logging can be re-enabled if needed

  return (
    <>
      {shouldShowNav && <Navbar />}
      <div>
        {children}
      </div>
      {showMobileNav && <MobileNav />}
    </>
  );
} 