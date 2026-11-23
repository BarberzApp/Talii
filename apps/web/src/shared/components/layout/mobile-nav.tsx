"use client"

import { useMemo } from "react"
import Link from "next/link"
import { Search, Settings as SettingsIcon, Calendar, User, LogIn } from "lucide-react"
import { useAuth } from "@/shared/hooks/use-auth-zustand"
import { cn } from "@/shared/lib/utils"
import { useCurrentPathname } from "@/shared/hooks/use-current-pathname"

export function MobileNav() {
  const { user } = useAuth()
  const pathname = useCurrentPathname() || ''

  // Browse | Calendar (centre) | Profile | Settings when signed in;
  // Browse | Sign in when signed out (the other pages need an account).
  const orderedNavItems = useMemo(() => {
    if (!user) {
      return [
        { name: "Browse", href: "/browse", icon: Search },
        { name: "Sign in", href: "/login", icon: LogIn },
      ]
    }
    return [
      { name: "Browse", href: "/browse", icon: Search },
      { name: user.role === "barber" ? "Calendar" : "Bookings", href: "/calendar", icon: Calendar },
      { name: "Profile", href: "/profile", icon: User },
      { name: "Settings", href: "/settings", icon: SettingsIcon },
    ]
  }, [user])

  const isActiveHref = (href: string) => pathname === href || pathname.startsWith(`${href}/`)

  const centerIndex = 1
  const leftItems = orderedNavItems.slice(0, centerIndex)
  const centerItem = orderedNavItems[centerIndex]
  const rightItems = orderedNavItems.slice(centerIndex + 1, centerIndex + 3)

  return (
    <nav aria-label="Main" className="fixed bottom-0 left-0 right-0 z-40 md:hidden">
      {/* Modern glass morphism background */}
      <div className="absolute inset-0 bg-background/95 backdrop-blur-xl border-t border-border shadow-lg" />
      
      {/* Main navigation container */}
      <div className="relative flex items-center justify-center gap-2 px-4 py-6 h-[120px] pb-safe">
        {/* Left navigation items */}
        {leftItems.filter(Boolean).map((item) => {
          if (!item) return null;
          const isActive = isActiveHref(item.href)
          
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative flex flex-col items-center justify-center py-3 px-4 rounded-2xl transition-all duration-300 min-w-[64px] group",
                isActive 
                  ? "text-primary bg-primary/15 shadow-lg shadow-primary/25 border border-primary/30 backdrop-blur-sm" 
                  : "text-muted-foreground hover:text-primary hover:bg-muted hover:shadow-md backdrop-blur-sm"
              )}
            >
              {/* Active indicator */}
              {isActive && (
                <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 bg-primary rounded-full shadow-lg shadow-primary/50" />
              )}
              
              <item.icon 
                className={cn(
                  "h-6 w-6 mb-1 transition-all duration-300",
                  isActive ? "text-primary scale-110" : "text-muted-foreground group-hover:scale-105 group-hover:text-primary"
                )} 
              />
              <span className={cn(
                "text-xs font-semibold transition-all duration-300 tracking-wide",
                isActive ? "text-primary" : "text-muted-foreground group-hover:text-primary"
              )}>
                {item.name}
              </span>
            </Link>
          )
        })}

        {/* Center item (highlighted) - modern design */}
        {centerItem && (
          <Link
            key={centerItem.href}
            href={centerItem.href}
            aria-current={isActiveHref(centerItem.href) ? "page" : undefined}
            className={cn(
              "relative flex flex-col items-center justify-center py-4 px-5 rounded-3xl transition-all duration-300 min-w-[80px] scale-110 group",
              "bg-gradient-to-br from-primary via-primary/90 to-primary/80 shadow-2xl shadow-primary/40",
              "border-2 border-primary/60 hover:border-primary/80",
              "hover:scale-115 hover:shadow-primary/50 hover:shadow-2xl",
              isActiveHref(centerItem.href) ? "ring-2 ring-primary/60 ring-offset-2 ring-offset-background" : ""
            )}
          >
            {/* Enhanced glow effect */}
            <div className="absolute inset-0 rounded-3xl bg-primary/30 blur-xl opacity-60" />
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/20 to-transparent" />
            
            <centerItem.icon className="h-6 w-6 mb-1 text-button-foreground drop-shadow-lg relative z-10 group-hover:scale-110 transition-transform duration-300" />
            <span className="text-xs font-bold text-button-foreground drop-shadow flex items-center relative z-10 tracking-wide">
              {centerItem.name}
            </span>
          </Link>
        )}

        {/* Right navigation items */}
        {rightItems.filter(Boolean).map((item) => {
          if (!item) return null;
          const isActive = isActiveHref(item.href)
          
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative flex flex-col items-center justify-center py-3 px-4 rounded-2xl transition-all duration-300 min-w-[64px] group",
                isActive 
                  ? "text-primary bg-primary/15 shadow-lg shadow-primary/25 border border-primary/30 backdrop-blur-sm" 
                  : "text-muted-foreground hover:text-primary hover:bg-muted hover:shadow-md backdrop-blur-sm"
              )}
            >
              {/* Active indicator */}
              {isActive && (
                <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 bg-primary rounded-full shadow-lg shadow-primary/50" />
              )}
              
              <item.icon 
                className={cn(
                  "h-6 w-6 mb-1 transition-all duration-300",
                  isActive ? "text-primary scale-110" : "text-muted-foreground group-hover:scale-105 group-hover:text-primary"
                )} 
              />
              <span className={cn(
                "text-xs font-semibold transition-all duration-300 tracking-wide",
                isActive ? "text-primary" : "text-muted-foreground group-hover:text-primary"
              )}>
                {item.name}
              </span>
            </Link>
          )
        })}


      </div>
    </nav>
  )
}
