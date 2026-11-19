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
import { api, errorMessage } from "@/shared/lib/api"
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

  /** GET /api/stripe/connect/status (refreshes the flags from Stripe). */
  const checkStripeAccount = async () => {
    if (preview) return
    try {
      const status = await api.connect.status()
      setHasStripeAccount(status.hasAccount && status.detailsSubmitted)
    } catch (error) {
      logger.error('Error checking Stripe account', error)
    }
  }

  /**
   * This month vs last month from GET /api/earnings. "Service" is what clients
   * paid in person for completed appointments; "booking fees" is the barber's
   * net share of the online booking fee.
   */
  const loadEarnings = async () => {
    if (preview || !barberId) return
    setIsLoading(true)
    try {
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const [thisMonth, lastMonth] = await Promise.all([
        api.earnings.get({ from: monthStart.toISOString(), to: now.toISOString(), limit: 1 }),
        api.earnings.get({ from: prevStart.toISOString(), to: monthStart.toISOString(), limit: 1 }),
      ])
      const total = (t: typeof thisMonth.totals) => t.serviceRevenueCents + t.netFeeShareCents
      const current = total(thisMonth.totals)
      const previous = total(lastMonth.totals)
      const change = previous > 0 ? Math.round(((current - previous) / previous) * 100) : current > 0 ? 100 : 0
      setEarnings({
        current,
        previous,
        trend: change >= 0 ? 'up' : 'down',
        percentage: Math.abs(change),
        breakdown: {
          serviceFees: thisMonth.totals.serviceRevenueCents,
          platformFees: thisMonth.totals.netFeeShareCents,
          totalEarnings: current,
        },
      })
    } catch (error) {
      logger.error("Error loading earnings", error)
      toast({
        title: "Error",
        description: errorMessage(error, "Failed to load earnings data. Please try again."),
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  /** POST /api/stripe/connect/onboarding: creates the Express account if needed and returns the link. */
  const handleSetupPayments = async () => {
    setIsSettingUp(true)
    try {
      const { url } = await api.connect.onboarding()
      window.location.href = url
    } catch (error) {
      logger.error('Error setting up payments', error)
      toast({
        title: "Error",
        description: errorMessage(error, "Failed to set up payments. Please try again."),
        variant: "destructive",
      })
    } finally {
      setIsSettingUp(false)
    }
  }

  /** POST /api/stripe/connect/dashboard: Express dashboard (or onboarding when details are missing). */
  const handleAccessDashboard = async () => {
    try {
      const { url } = await api.connect.dashboard()
      window.location.href = url
    } catch (error) {
      logger.error('Error accessing Stripe dashboard', error)
      toast({
        title: "Error",
        description: errorMessage(error, "Failed to access Stripe dashboard. Please try again."),
        variant: "destructive",
      })
    }
  }

  const isLight = variant === "light"

  const cardCls = isLight
    ? "bg-surface border border-border shadow-2xl rounded-3xl min-h-[400px] overflow-hidden"
    : "bg-gradient-to-br from-white/5 to-white/3 border border-black/5 dark:border-white/10 shadow-2xl backdrop-blur-xl rounded-3xl min-h-[400px] overflow-hidden"
  const titleCls = isLight ? "text-2xl font-bebas text-foreground tracking-wide" : "text-2xl font-bebas text-foreground dark:text-white tracking-wide"
  const descCls = isLight ? "text-foreground/70" : "text-foreground/70 dark:text-white/70"
  const mainBoxCls = isLight
    ? "relative bg-muted border border-border rounded-2xl p-8 shadow-inner"
    : "relative bg-black/10 dark:bg-white/10 backdrop-blur-xl border border-black/20 dark:border-white/20 rounded-2xl p-8 shadow-2xl"
  const breakdownLabelCls = "text-xl font-bebas text-foreground dark:text-white tracking-wide"
  const smallCardCls = isLight
    ? "p-4 space-y-2 bg-muted border border-border rounded-xl transition-all hover:shadow-md"
    : "p-4 space-y-2 bg-white/5 border border-black/10 dark:border-white/10 hover:bg-white/10 rounded-xl transition-all duration-300"
  const smallLabelCls = "text-sm font-medium text-foreground/60 dark:text-white/60"
  const smallValueCls = "text-2xl font-bebas text-foreground dark:text-white tracking-wide"
  const smallHintCls = "text-xs text-foreground/40 dark:text-white/40"
  const trendUpCls = isLight ? "h-5 w-5 text-green-600" : "h-5 w-5 text-green-400"
  const trendDownCls = isLight ? "h-5 w-5 text-red-600" : "h-5 w-5 text-red-400"

  if (isLoading) {
    logger.debug('Loading state active')
    return (
      <div className={cn("rounded-2xl min-h-[300px]", isLight ? "bg-surface border border-border" : "bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10")}>
        <CardContent className="pt-6 flex justify-center items-center min-h-[300px]">
          <div className="flex flex-col items-center gap-3">
            <p className="text-muted-foreground font-medium animate-pulse">Loading earnings dashboard...</p>
          </div>
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
      <CardHeader className="bg-gradient-to-r from-secondary/10 to-transparent border-b border-black/5 dark:border-white/10 p-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-secondary/20 rounded-xl">
            <DollarSign className="h-5 w-5 text-secondary" />
          </div>
          <CardTitle className={titleCls}>Monthly Earnings</CardTitle>
        </div>
        <CardDescription className={descCls}>Your earnings breakdown for this month</CardDescription>
      </CardHeader>
      <CardContent className="p-8">
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
                <div className={smallLabelCls}>Services</div>
                <div className={smallValueCls}>
                  ${earnings?.breakdown?.serviceFees ? (earnings.breakdown.serviceFees / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}
                </div>
                <div className={smallHintCls}>Completed appointments (paid in person)</div>
              </div>
              <div className={smallCardCls}>
                <div className={smallLabelCls}>Booking Fees</div>
                <div className={smallValueCls}>
                  ${earnings?.breakdown?.platformFees ? (earnings.breakdown.platformFees / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}
                </div>
                <div className={smallHintCls}>Your share of online booking fees</div>
              </div>
            </div>
          </div>

          {/* Payment Setup Section - hidden in preview */}
          {!preview && !hasStripeAccount && (
            <div className={cn("text-center space-y-4 border-t pt-8", isLight ? "border-border" : "border-black/10 dark:border-white/10")}>
              <div className={isLight ? "p-6 bg-muted rounded-xl border border-border" : "p-6 bg-white/5 border border-black/10 dark:border-white/10 rounded-2xl backdrop-blur-md"}>
                <p className={cn("mb-6 text-lg", descCls)}>
                  Set up your payment account to start receiving payments
                </p>
                <Button
                  onClick={handleSetupPayments}
                  disabled={isSettingUp}
                  className="bg-gradient-to-r from-secondary to-secondary/90 hover:from-secondary/90 hover:to-secondary/80 text-primary font-bold shadow-xl rounded-xl px-10 py-6 text-lg transition-all duration-300 hover:scale-105 active:scale-95"
                >
                  {isSettingUp ? (
                    <Loader2 className="h-5 w-5 animate-spin mr-3" />
                  ) : (
                    <CreditCard className="h-5 w-5 mr-3" />
                  )}
                  {isSettingUp ? "Setting up..." : "Set up payments"}
                </Button>
              </div>
            </div>
          )}

          {/* Stripe Dashboard Access - hidden in preview */}
          {!preview && hasStripeAccount && (
            <div className={cn("text-center space-y-4 border-t pt-8", isLight ? "border-border" : "border-black/10 dark:border-white/10")}>
              <div className={isLight ? "p-6 bg-muted rounded-xl border border-border" : "p-6 bg-white/5 border border-black/10 dark:border-white/10 rounded-2xl backdrop-blur-md"}>
                <Button
                  onClick={handleAccessDashboard}
                  variant="outline"
                  className={isLight ? "border-border text-foreground hover:bg-muted" : "border-black/20 dark:border-white/20 text-foreground dark:text-white hover:bg-white/10 backdrop-blur-xl rounded-xl px-8 py-6 font-semibold transition-all duration-300"}
                >
                  <CreditCard className="h-5 w-5 mr-3" />
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
