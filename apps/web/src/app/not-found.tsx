'use client'

import Link from 'next/link'
import { Button } from '@/shared/components/ui/button'
import { Search, Scissors, User, Calendar, Settings, ArrowLeft, Home, AlertCircle } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/shared/hooks/use-auth-zustand'
import { useSafeNavigation } from '@/shared/hooks/use-safe-navigation'
import { storeRedirectUrl } from '@/shared/lib/redirect-utils'
import { useEffect, useState, useMemo } from 'react'

export default function NotFound() {
  const router = useRouter()
  const pathname = usePathname()
  const { user, status } = useAuth()
  const { push } = useSafeNavigation()

  const [smartSuggestions, setSmartSuggestions] = useState<Array<{
    title: string
    description: string
    href: string
    icon: React.ReactNode
  }>>([])

  // Smart redirect suggestions based on URL patterns and user context
  useEffect(() => {
    const suggestions = []
    
    // URL-based suggestions
    if (pathname?.includes('barber')) {
      if (user?.role === 'barber') {
        suggestions.push({
          title: 'Barber Dashboard',
          description: 'Access your settings',
          href: '/settings',
          icon: <Settings className="h-4 w-4" />
        })
      } else {
        suggestions.push({
          title: 'Find Barbers',
          description: 'Browse available barbers',
          href: '/browse',
          icon: <Search className="h-4 w-4" />
        })
      }
    }

    if (pathname?.includes('book')) {
      suggestions.push({
        title: 'Browse Barbers',
        description: 'Find a barber to book with',
        href: '/browse',
        icon: <Search className="h-4 w-4" />
      })
      if (user) {
        suggestions.push({
          title: 'My Calendar',
          description: 'View your existing bookings',
          href: '/calendar',
          icon: <Calendar className="h-4 w-4" />
        })
      }
    }

    if (pathname?.includes('profile') || pathname?.includes('account')) {
      if (user) {
        suggestions.push({
          title: 'My Profile',
          description: 'View and edit your profile',
          href: '/profile',
          icon: <User className="h-4 w-4" />
        })
      } else {
        suggestions.push({
          title: 'Login',
          description: 'Sign in to access your profile',
          href: '/login',
          icon: <User className="h-4 w-4" />
        })
      }
    }

    if (pathname?.includes('setting')) {
      if (user) {
        suggestions.push({
          title: 'Settings',
          description: 'Manage your account settings',
          href: '/settings',
          icon: <Settings className="h-4 w-4" />
        })
      }
    }

    if (pathname?.includes('admin')) {
      if (user?.email === 'primbocm@gmail.com') {
        suggestions.push({
          title: 'Admin Dashboard',
          description: 'Access admin features',
          href: '/admin',
          icon: <Settings className="h-4 w-4" />
        })
      }
    }

    // User context-based suggestions
    if (user) {
      if (user.role === 'barber') {
        suggestions.push({
          title: 'Settings',
          description: 'Manage your settings and availability',
          href: '/settings',
          icon: <Settings className="h-4 w-4" />
        })
      }
      
      suggestions.push({
        title: 'My Calendar',
        description: 'View your appointment history',
        href: '/calendar',
        icon: <Calendar className="h-4 w-4" />
      })
    }

    // Always include browse as fallback
    if (!suggestions.some(s => s.href === '/browse')) {
      suggestions.push({
        title: 'Browse Barbers',
        description: 'Find and book with top barbers',
        href: '/browse',
        icon: <Search className="h-4 w-4" />
      })
    }

    // Limit to 3 most relevant suggestions
    setSmartSuggestions(suggestions.slice(0, 3))
  }, [pathname, user])

  const handleLoginRedirect = () => {
    if (pathname && !pathname.includes('/login') && !pathname.includes('/register')) {
      storeRedirectUrl(pathname)
    }
    push('/login')
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex flex-col items-center justify-center p-4">
      {/* Heavy Talii Landing Page Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute inset-0 h-full bg-gradient-to-b from-primary/[0.12] via-primary/[0.05] to-transparent dark:from-primary/[0.08] dark:via-primary/[0.03] dark:to-transparent" />
        <div className="absolute top-0 right-0 w-[28rem] h-[28rem] rounded-full blur-3xl bg-primary/15 dark:bg-primary/12" />
        <div className="absolute bottom-1/4 left-0 w-80 h-80 rounded-full blur-3xl bg-secondary/12 dark:bg-secondary/10" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full blur-3xl bg-primary/8 dark:bg-primary/5" />
      </div>

      <div className="relative z-10 w-full max-w-5xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-12 lg:gap-20">
        
        {/* Left Column: 404 Visual Display */}
        <div className="flex-1 flex flex-col items-center lg:items-start text-center lg:text-left space-y-6">
          <div className="inline-flex items-center justify-center p-3 sm:p-4 rounded-2xl bg-white/5 dark:bg-white/10 backdrop-blur-md border border-black/5 dark:border-white/10 shadow-xl mb-4">
            <AlertCircle className="h-6 w-6 sm:h-8 sm:w-8 text-secondary mr-3" />
            <span className="font-bebas text-2xl sm:text-3xl tracking-wide text-foreground">Page Not Found</span>
          </div>
          
          <h1 className="text-[120px] sm:text-[160px] lg:text-[200px] leading-none font-black font-bebas text-transparent bg-clip-text bg-gradient-to-br from-secondary via-[#FF8C00] to-secondary drop-shadow-2xl animate-pulse">
            404
          </h1>
          
          <p className="text-lg sm:text-xl text-muted-foreground max-w-lg leading-relaxed font-medium">
            Looks like this page took a little too much off the top. The link you followed is either broken or the page has been moved.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 pt-6 w-full sm:w-auto">
            <Button 
              onClick={() => router.back()}
              className="h-14 px-8 rounded-xl bg-white dark:bg-white/5 border border-black/10 dark:border-white/10 text-foreground hover:bg-black/5 dark:hover:bg-white/10 font-bold text-lg transition-all duration-300 shadow-sm"
              variant="outline"
            >
              <ArrowLeft className="mr-2 h-5 w-5" />
              Go Back
            </Button>
            
            <Button 
              asChild 
              className="h-14 px-8 rounded-xl bg-gradient-to-r from-secondary to-[#FF8C00] text-primary-foreground font-bold text-lg transition-all duration-300 shadow-lg shadow-secondary/30 hover:shadow-secondary/50 hover:scale-105"
            >
              <Link href="/landing">
                <Home className="mr-2 h-5 w-5" />
                Return Home
              </Link>
            </Button>
            
            {!user && (
              <Button 
                onClick={handleLoginRedirect}
                variant="outline" 
                className="h-14 px-8 rounded-xl bg-transparent border-foreground/20 text-foreground hover:bg-foreground/5 font-bold text-lg transition-all duration-300"
              >
                Login
              </Button>
            )}
          </div>
        </div>

        {/* Right Column: Smart Suggestions Glass Card */}
        {smartSuggestions.length > 0 && (
          <div className="flex-1 w-full max-w-md">
            <div className="bg-white/40 dark:bg-black/40 backdrop-blur-xl border border-white/50 dark:border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl">
              <h3 className="text-xl font-bold text-foreground mb-2">Looking for something else?</h3>
              <p className="text-muted-foreground text-sm mb-6">Based on your navigation, try these:</p>
              
              <div className="space-y-4">
                {smartSuggestions.map((suggestion, index) => (
                  <Link 
                    key={index} 
                    href={suggestion.href}
                    className="group block p-4 rounded-2xl bg-white/50 dark:bg-white/5 border border-black/5 dark:border-white/5 hover:bg-white dark:hover:bg-white/10 hover:border-secondary/50 transition-all duration-300 shadow-sm hover:shadow-md hover:scale-[1.02]"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-xl bg-secondary/10 dark:bg-secondary/20 text-secondary group-hover:bg-secondary group-hover:text-primary-foreground transition-colors duration-300">
                        {suggestion.icon}
                      </div>
                      <div>
                        <div className="font-bold text-foreground text-base group-hover:text-secondary transition-colors duration-300">
                          {suggestion.title}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {suggestion.description}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>

              {/* Developer Contact Footer within card */}
              <div className="mt-8 pt-6 border-t border-black/5 dark:border-white/10 text-center">
                <Link 
                  href="/support"
                  className="text-sm text-muted-foreground hover:text-secondary font-medium transition-colors"
                >
                  Report a broken link →
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 