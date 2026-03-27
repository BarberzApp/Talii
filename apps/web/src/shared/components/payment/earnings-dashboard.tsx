"use client"

import type * as React from "react"
import { useState, useEffect } from "react"
import {
  Card,
  CardContent as CardContentBase,
  CardDescription as CardDescriptionBase,
  CardHeader as CardHeaderBase,
  CardTitle as CardTitleBase,
} from "@/shared/components/ui/card"
import { useToast } from "@/shared/components/ui/use-toast"
import { Loader2, DollarSign, TrendingUp, TrendingDown, CreditCard, Sparkles } from "lucide-react"
import { Button as ButtonBase } from "@/shared/components/ui/button"
import { Badge } from "@/shared/components/ui/badge"
import { LoadingSpinner } from "@/shared/components/ui/loading-spinner"
import { cn } from "@/shared/lib/utils"
import { supabase } from "@/shared/lib/supabase"
import { logger } from "@/shared/lib/logger"

// React 19 JSX compatibility: cast to valid component types
const CardHeader = CardHeaderBase as React.ComponentType<React.HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode }>
const CardTitle = CardTitleBase as React.ComponentType<React.HTMLAttributes<HTMLHeadingElement> & { children?: React.ReactNode }>
const CardDescription = CardDescriptionBase as React.ComponentType<React.HTMLAttributes<HTMLParagraphElement> & { children?: React.ReactNode }>
const CardContent = CardContentBase as React.ComponentType<React.HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode }>
const Button = ButtonBase as React.ComponentType<React.ButtonHTMLAttributes<HTMLButtonElement> & { children?: React.ReactNode; variant?: string; className?: string }>

interface MonthlyEarnings {
  current: number
  previous: number
  trend: "up" | "down"
  percentage: number
  breakdown: {
    serviceFees: number
    platformFees: number
    totalEarnings: number
  }
}

interface BarberProfile {
  id: string
  profiles: {
    email: string
    name: string
  }
}

/** Fake data for landing page preview (amounts in cents) */
const PREVIEW_EARNINGS: MonthlyEarnings = {
  current: 1245000, // $12,450
  previous: 925000,
  trend: "up",
  percentage: 40,
  breakdown: {
    serviceFees: 982000,
    platformFees: 263000,
    totalEarnings: 1245000,
  },
}

interface EarningsDashboardProps {
  barberId?: string
  /** When true, show fake data and hide Stripe/API; barberId not required */
  preview?: boolean
  /** "light" for landing page (uses semantic tokens); "default" for app (dark glassy) */
  variant?: "default" | "light"
}

export function EarningsDashboard({ barberId, preview = false, variant = "default" }: EarningsDashboardProps) {
  const { toast } = useToast()
  const [earnings, setEarnings] = useState<MonthlyEarnings | null>(preview ? PREVIEW_EARNINGS : null)
  const [isLoading, setIsLoading] = useState(!preview)
  const [isSettingUp, setIsSettingUp] = useState(false)
  const [hasStripeAccount, setHasStripeAccount] = useState(false)

  useEffect(() => {
    if (preview) return
    if (!barberId) return
    logger.debug('EarningsDashboard mounted', { barberId })
    loadEarnings()
    checkStripeAccount()
  }, [barberId, preview])

  const checkStripeAccount = async () => {
    if (preview) return
    logger.debug('Checking Stripe account for barber', { barberId })
    try {
      // First, try to refresh the account status from Stripe
      const refreshResponse = await fetch('/api/connect/refresh-account-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: barberId }),
      });

      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json();
        logger.debug('Stripe account refresh result', { hasAccount: refreshData.success && refreshData.data.hasStripeAccount });
        
        if (refreshData.success && refreshData.data.hasStripeAccount) {
          setHasStripeAccount(true);
          return;
        }
      }

      // Fallback to checking the database directly
      const { data, error } = await supabase
        .from('barbers')
        .select('stripe_account_id')
        .eq('id', barberId)
        .single()

      if (error) {
        logger.error('Error fetching Stripe account', error)
        throw error
      }

      logger.debug('Stripe account check result', {
        hasAccount: !!data?.stripe_account_id,
        accountId: data?.stripe_account_id
      })
      setHasStripeAccount(!!data?.stripe_account_id)
    } catch (error) {
      logger.error('Error checking Stripe account', error)
    }
  }

  const loadEarnings = async () => {
    if (preview || !barberId) return
    logger.debug('Loading earnings for barber', { barberId })
    setIsLoading(true)
    try {
      const response = await fetch(`/api/earnings/monthly?barberId=${barberId}`)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch earnings')
      }
      
      const data = await response.json()
      logger.debug('Earnings data loaded', { hasData: !!data })
      
      // Validate the data structure
      if (!data || typeof data.current !== 'number') {
        throw new Error('Invalid earnings data received')
      }
      
      setEarnings(data)
    } catch (error) {
      logger.error("Error loading earnings", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load earnings data. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSetupPayments = async () => {
    logger.debug('Starting payment setup for barber', { barberId })
    setIsSettingUp(true)
    try {
      // First, check if there's already a Stripe account and refresh its status
      const refreshResponse = await fetch('/api/connect/refresh-account-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: barberId }),
      });

      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json();
        
        if (refreshData.success && refreshData.data.hasStripeAccount) {
          // Update the local state to reflect the refreshed status
          setHasStripeAccount(true);
          
          if (refreshData.data.currentStatus === 'active') {
            toast({
              title: 'Stripe Account Active',
              description: 'Your Stripe account is already active and ready to accept payments!',
            });
            return;
          } else if (refreshData.data.currentStatus === 'pending') {
            toast({
              title: 'Account Pending',
              description: 'Your Stripe account is being reviewed. This usually takes 1-2 business days.',
            });
            return;
          }
        }
      }

      // Get barber's email and name
      logger.debug('Fetching barber details')
      const { data: barber, error: barberError } = await supabase
        .from('barbers')
        .select(`
          id,
          profiles (
            email,
            name
          )
        `)
        .eq('id', barberId)
        .single() as { data: BarberProfile | null, error: any }

      if (barberError) {
        logger.error('Error fetching barber details', barberError)
        throw new Error(`Failed to fetch barber details: ${barberError.message}`)
      }

      if (!barber?.profiles?.email || !barber?.profiles?.name) {
        throw new Error('Barber email or name is missing')
      }

      logger.debug('Barber details fetched', {
        email: barber.profiles.email,
        name: barber.profiles.name
      })

      // Create Stripe Connect account
      logger.debug('Creating Stripe Connect account')
      const response = await fetch('/api/connect/create-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          barberId,
          email: barber.profiles.email,
          name: barber.profiles.name,
        }),
      }).catch(error => {
        logger.error('Network error during fetch', error)
        throw new Error(`Network error: ${error.message}`)
      })

      if (!response) {
        throw new Error('No response received from server')
      }

      let responseData
      try {
        responseData = await response.json()
      } catch (error) {
        logger.error('Error parsing response', error)
        throw new Error('Invalid response from server')
      }

      if (!response.ok) {
        logger.error('Failed to create Stripe account', { error: responseData.error })
        throw new Error(responseData.error || 'Failed to create Stripe account')
      }

      const redirectUrl = responseData.url || responseData.accountLink
      if (!redirectUrl) {
        throw new Error('No redirect URL received from Stripe')
      }

      logger.debug('Stripe account created, redirecting', { redirectUrl })
      window.location.href = redirectUrl
    } catch (error) {
      logger.error('Error setting up payments', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to set up payments. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSettingUp(false)
    }
  }

  const handleAccessDashboard = async () => {
    logger.debug('Accessing Stripe dashboard for barber', { barberId })
    try {
      const response = await fetch('/api/connect/create-dashboard-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ barberId }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to access Stripe dashboard')
      }

      if (!data.url) {
        throw new Error('No dashboard URL received')
      }

      window.location.href = data.url
    } catch (error) {
      logger.error('Error accessing Stripe dashboard', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to access Stripe dashboard. Please try again.",
        variant: "destructive",
      })
    }
  }

  const isLight = variant === "light"

  const cardCls = isLight
    ? "bg-surface border border-border shadow-2xl rounded-2xl min-h-[400px]"
    : "bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 shadow-xl backdrop-blur-xl rounded-2xl min-h-[400px]"
  const titleCls = isLight ? "text-2xl font-bebas text-foreground tracking-wide" : "text-2xl font-bebas text-foreground dark:text-white tracking-wide"
  const descCls = isLight ? "text-muted-foreground" : "text-muted-foreground dark:text-white/80"
  const mainBoxCls = isLight
    ? "relative bg-muted border border-border rounded-2xl p-8"
    : "relative bg-black/10 dark:bg-white/10 backdrop-blur-xl border border-black/20 dark:border-white/20 rounded-2xl p-8"
  const breakdownLabelCls = isLight ? "text-lg font-semibold text-foreground" : "text-lg font-semibold text-foreground dark:text-white"
  const smallCardCls = isLight
    ? "p-4 space-y-2 bg-muted border border-border rounded-xl"
    : "p-4 space-y-2 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 hover:bg-black/10 dark:bg-white/10 rounded-xl"
  const smallLabelCls = isLight ? "text-sm text-muted-foreground" : "text-sm text-muted-foreground dark:text-white/60"
  const smallValueCls = isLight ? "text-2xl font-bold text-foreground" : "text-2xl font-bold text-foreground dark:text-white"
  const smallHintCls = isLight ? "text-xs text-muted-foreground/80" : "text-xs text-muted-foreground dark:text-white/40"
  const trendUpCls = isLight ? "h-5 w-5 text-green-600" : "h-5 w-5 text-green-400"
  const trendDownCls = isLight ? "h-5 w-5 text-red-600" : "h-5 w-5 text-red-400"

  if (isLoading) {
    logger.debug('Loading state active')
    return (
      <div className={cn("rounded-2xl min-h-[300px]", isLight ? "bg-surface border border-border" : "bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10")}>
        <CardContent className="pt-6 flex justify-center items-center min-h-[300px]">
          <LoadingSpinner size="md" text="Loading earnings..." />
        </CardContent>
      </div>
    )
  }

  logger.debug('Rendering dashboard with state', {
    hasStripeAccount,
    isSettingUp,
    hasEarnings: !!earnings,
    preview,
  })

  return (
    <div className={cn(cardCls)}>
      <CardHeader className="text-center">
        <div className="flex items-center justify-center gap-3 mb-2">
          <div className="p-2 bg-secondary/20 rounded-full">
            <DollarSign className="h-5 w-5 text-secondary" />
          </div>
          <CardTitle className={titleCls}>Monthly Earnings</CardTitle>
        </div>
        <CardDescription className={descCls}>Your earnings breakdown for this month</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col space-y-8">
          {/* Main Earnings Display */}
          <div className="text-center space-y-4">
            <div className="relative">
              {!isLight && (
                <div className="absolute inset-0 bg-gradient-to-r from-secondary/20 via-secondary/10 to-transparent rounded-2xl blur-xl" />
              )}
              <div className={cn("relative rounded-2xl p-8", mainBoxCls)}>
                <div className="text-5xl font-bebas font-bold text-secondary mb-2">
                  ${earnings?.current ? (earnings.current / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}
                </div>
                <div className="flex items-center justify-center space-x-2">
                  {earnings?.trend === "up" ? (
                    <TrendingUp className={trendUpCls} />
                  ) : (
                    <TrendingDown className={trendDownCls} />
                  )}
                  <Badge variant="secondary" className="text-xs bg-secondary/20 text-secondary border-secondary/30">
                    {earnings?.trend === "up" ? "+" : "-"}{earnings?.percentage}% from last month
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Earnings Breakdown */}
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-secondary" />
              <h3 className={breakdownLabelCls}>Earnings Breakdown</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className={smallCardCls}>
                <div className={smallLabelCls}>Service Fees</div>
                <div className={smallValueCls}>
                  ${earnings?.breakdown?.serviceFees ? (earnings.breakdown.serviceFees / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}
                </div>
                <div className={smallHintCls}>From haircut services</div>
              </div>
              <div className={smallCardCls}>
                <div className={smallLabelCls}>Platform Fees</div>
                <div className={smallValueCls}>
                  ${earnings?.breakdown?.platformFees ? (earnings.breakdown.platformFees / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}
                </div>
                <div className={smallHintCls}>Processing fees</div>
              </div>
            </div>
          </div>

          {/* Payment Setup Section - hidden in preview */}
          {!preview && !hasStripeAccount && (
            <div className={cn("text-center space-y-4 border-t pt-8", isLight ? "border-border" : "border-black/10 dark:border-white/10")}>
              <div className={isLight ? "p-6 bg-muted rounded-xl border border-border" : "p-6 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl"}>
                <p className={cn("mb-4", descCls)}>
                  Set up your payment account to start receiving payments
                </p>
                <Button
                  onClick={handleSetupPayments}
                  disabled={isSettingUp}
                  className="bg-secondary hover:bg-secondary/90 text-primary-foreground font-semibold shadow-lg"
                >
                  {isSettingUp ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <CreditCard className="h-4 w-4 mr-2" />
                  )}
                  {isSettingUp ? "Setting up..." : "Set up payments"}
                </Button>
              </div>
            </div>
          )}

          {/* Stripe Dashboard Access - hidden in preview */}
          {!preview && hasStripeAccount && (
            <div className={cn("text-center space-y-4 border-t pt-8", isLight ? "border-border" : "border-black/10 dark:border-white/10")}>
              <div className={isLight ? "p-6 bg-muted rounded-xl border border-border" : "p-6 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl"}>
                <Button
                  onClick={handleAccessDashboard}
                  variant="outline"
                  className={isLight ? "border-border text-foreground hover:bg-muted" : "border-black/20 dark:border-white/20 text-foreground dark:text-white hover:bg-black/10 dark:bg-white/10 font-semibold"}
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  Access Stripe Dashboard
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </div>
  )
}
