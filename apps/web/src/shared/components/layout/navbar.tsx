"use client"
import Link from "next/link"
import { useTheme } from "next-themes"
import { useAuth } from "@/shared/hooks/use-auth-zustand"
import { logger } from "@/shared/lib/logger"
import { Button } from "@/shared/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar"
import { ModeToggle } from "@/shared/components/theme/mode-toggle"
import { MobileNav } from "@/shared/components/layout/mobile-nav"
import { useMobile } from "@/shared/hooks/use-mobile"
import {
  User,
  LogOut,
  Settings,
  Calendar,
  Scissors,
  Search,
  UserCircle,
  Video,
  Compass,
  Bell,
} from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { UpdatesBadge } from "@/shared/components/updates/updates-badge"
import { NotificationBell } from "@/shared/notifications/notification-bell"
import { useCurrentPathname } from "@/shared/hooks/use-current-pathname"

export function Navbar() {
  const { user, logout } = useAuth();
  const isMobile = useMobile();
  const { resolvedTheme } = useTheme();
  const pathname = useCurrentPathname();
  const mounted = typeof window !== "undefined";

  // Don't show on home page, but show on all other pages including settings
  if (pathname === '/') return null;

  const roleSpecificNavItems = () => {
    if (!user) return []

    if (user.role === "barber") {
      return [
        {
          href: "/calendar",
          icon: Calendar,
          label: "Calendar",
        },
      ]
    }

    return [
      {
        href: "/calendar",
        icon: Calendar,
        label: "Bookings",
      },
    ]
  }

  const handleLogout = async () => {
    try {
      await logout()
      window.location.href = "/"
    } catch (error) {
      logger.error("Logout failed", error)
    }
  }

  if (isMobile) {
    return <MobileNav />
  }

  const isDark = mounted && resolvedTheme === "dark";
  const logoSrc = isDark ? "/brand/talii-logo-zoomed-dark.png" : "/brand/talii-logo-zoomed.png";

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur-xl shadow-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center group">
            <div className="relative flex items-center shrink-0">
              <img src={logoSrc} alt="Talii Logo" className="h-8 w-auto sm:h-10 transition-transform duration-300 group-hover:scale-110 object-contain" width={120} height={40} />
              <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </div>
          </Link>
        </div>
        
        {user ? (
          // Authenticated user navigation
          <nav className="hidden md:flex items-center space-x-6">
            {/* Role-specific navigation items */}
            {roleSpecificNavItems().map((item) => {
              const isActive = pathname === item.href || 
                (item.href === "/calendar" && pathname?.startsWith("/calendar"))
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "text-muted-foreground hover:text-primary transition-all duration-300 font-medium px-4 py-2 rounded-xl flex items-center gap-2 group relative",
                    isActive 
                      ? "text-primary bg-primary/10 shadow-lg shadow-primary/20 border border-primary/30" 
                      : "hover:bg-muted hover:shadow-md"
                  )}
                >
                  <item.icon className={cn(
                    "h-4 w-4 transition-all duration-300",
                    isActive ? "text-primary scale-110" : "group-hover:scale-105"
                  )} />
                  {item.label}
                  {isActive && (
                    <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-primary rounded-full" />
                  )}
                </Link>
              )
            })}
            
            {/* Browse link for all users */}
            <Link 
              href="/browse" 
              className={cn(
                "text-muted-foreground hover:text-primary transition-all duration-300 font-medium px-4 py-2 rounded-xl flex items-center gap-2 group relative",
                pathname === "/browse" || pathname?.startsWith("/browse")
                  ? "text-primary bg-primary/10 shadow-lg shadow-primary/20 border border-primary/30" 
                  : "hover:bg-muted hover:shadow-md"
              )}
            >
              <Compass className={cn(
                "h-4 w-4 transition-all duration-300",
                pathname === "/browse" || pathname?.startsWith("/browse") ? "text-primary scale-110" : "group-hover:scale-105"
              )} />
              Browse
              {(pathname === "/browse" || pathname?.startsWith("/browse")) && (
                <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-primary rounded-full" />
              )}
            </Link>
            
            {/* Theme toggle and Notification Bell */}
            <div className="flex items-center gap-2">
              <ModeToggle />
              <NotificationBell />
              
              {/* User dropdown menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="p-0 h-10 w-10 rounded-full bg-muted hover:bg-muted/80 border border-border transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/20"
                  >
                    {user?.avatar_url ? (
                      <img 
                        src={user.avatar_url} 
                        alt="Profile" 
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <User className="h-5 w-5 text-foreground" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-popover backdrop-blur-xl border border-border shadow-xl rounded-2xl">
                  <DropdownMenuLabel className="text-muted-foreground font-medium px-3 py-2">
                    {user.email}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-border" />
                  {/* Profile tab for all users */}
                  <DropdownMenuItem asChild className="p-3 hover:bg-muted focus:bg-muted cursor-pointer rounded-xl mx-2 my-1">
                    <Link href="/profile" className="text-foreground hover:text-primary transition-colors flex items-center gap-3">
                      <User className="h-4 w-4" />
                      <span className="font-medium">Profile</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="p-3 hover:bg-muted focus:bg-muted cursor-pointer rounded-xl mx-2 my-1">
                    <Link href="/settings" className="text-foreground hover:text-primary transition-colors flex items-center gap-3">
                      <Settings className="h-4 w-4" />
                      <span className="font-medium">Settings</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-border" />
                  <DropdownMenuItem 
                    onClick={handleLogout}
                    className="p-3 hover:bg-red-500/10 focus:bg-red-500/10 cursor-pointer text-red-400 hover:text-red-300 transition-colors rounded-xl mx-2 my-1"
                  >
                    <LogOut className="h-4 w-4 mr-3" />
                    <span className="font-medium">Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </nav>
        ) : (
          // Unauthenticated user navigation
          <nav className="hidden md:flex items-center space-x-6">
            <ModeToggle />
            <Link href="/browse" className="text-muted-foreground hover:text-primary transition-all duration-300 font-medium px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-muted">
              <Compass className="h-4 w-4" />
              Browse
            </Link>
            <Link href="/login" className="text-muted-foreground hover:text-primary transition-all duration-300 font-medium px-4 py-2 rounded-xl hover:bg-muted">
              Login
            </Link>
            <Link href="/register" className="bg-secondary text-primary-foreground px-6 py-2 rounded-xl font-semibold hover:bg-secondary/90 shadow-lg transition-all duration-300 hover:shadow-xl hover:shadow-primary/20">
              Get Started
            </Link>
          </nav>
        )}
      </div>
    </nav>
  )
}
