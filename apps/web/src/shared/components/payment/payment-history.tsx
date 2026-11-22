'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { Loader2, Calendar, DollarSign, User, Clock, TrendingUp, TrendingDown } from 'lucide-react'
import { useToast } from '@/shared/components/ui/use-toast'
import { LoadingSpinner } from '@/shared/components/ui/loading-spinner'
import { logger } from '@/shared/lib/logger'
import { api, errorMessage } from '@/shared/lib/api'
import { formatBookingDate, formatBookingTime, formatCents, type EarningsResponse } from '@barber-app/shared'

interface PaymentHistoryProps {
  barberId: string
}

type PaymentRecord = EarningsResponse['bookings'][number]

interface Totals {
  totalBarberPayout: number // cents: net booking-fee share + completed service revenue
  totalBookings: number
}

interface EarningsData {
  trend: 'up' | 'down'
  percentage: number
}

/** The last year of bookings with their money, from GET /api/earnings. */
const RANGE_DAYS = 365

export function PaymentHistory({ barberId }: PaymentHistoryProps) {
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [totals, setTotals] = useState<Totals | null>(null)
  const [earningsData, setEarningsData] = useState<EarningsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const { toast } = useToast()
  const [timeZone, setTimeZone] = useState('America/New_York')

  const loadPayments = async (pageNum: number = 0) => {
    try {
      setLoading(true)
      setError(null)

      const limit = 20
      const offset = pageNum * limit

      const to = new Date()
      const from = new Date(to.getTime() - RANGE_DAYS * 86_400_000)
      const data = await api.earnings.get({ from: from.toISOString(), to: to.toISOString(), limit, offset })

      if (pageNum === 0) {
        setPayments(data.bookings)
        setTotals({
          totalBarberPayout: data.totals.netFeeShareCents + data.totals.serviceRevenueCents,
          totalBookings: data.totals.completedBookings,
        })
      } else {
        setPayments(prev => [...prev, ...data.bookings])
      }

      setHasMore(offset + data.bookings.length < data.pagination.total)
      setPage(pageNum)
    } catch (error) {
      logger.error('Error loading payments', error)
      setError(errorMessage(error, 'Failed to load payments'))
      toast({
        title: 'Error',
        description: errorMessage(error, 'Failed to load payment history'),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const loadEarningsData = async () => {
    try {
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const [cur, prev] = await Promise.all([
        api.earnings.get({ from: monthStart.toISOString(), to: now.toISOString(), limit: 1 }),
        api.earnings.get({ from: prevStart.toISOString(), to: monthStart.toISOString(), limit: 1 }),
      ])
      const a = cur.totals.netFeeShareCents + cur.totals.serviceRevenueCents
      const b = prev.totals.netFeeShareCents + prev.totals.serviceRevenueCents
      const change = b > 0 ? Math.round(((a - b) / b) * 100) : a > 0 ? 100 : 0
      setEarningsData({ trend: change >= 0 ? 'up' : 'down', percentage: Math.abs(change) })
    } catch (error) {
      logger.error('Error loading earnings data', error)
      // Secondary; no toast.
    }
  }

  useEffect(() => {
    api.me
      .get()
      .then((me) => me.barber?.timezone && setTimeZone(me.barber.timezone))
      .catch(() => undefined)
    loadPayments()
    loadEarningsData()
  }, [barberId])

  const loadMore = () => {
    if (!loading && hasMore) {
      loadPayments(page + 1)
    }
  }

  const formatCurrency = (cents: number) => formatCents(cents)

  // Appointment times in the barber's time zone (barbers.timezone).
  const formatDate = (iso: string) => formatBookingDate(iso, timeZone)
  const formatTime = (iso: string) => formatBookingTime(iso, timeZone)

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <Badge variant="glassy-secondary" className="bg-green-500/20 text-green-400 border-green-500/30">Confirmed</Badge>
      case 'completed':
        return <Badge variant="glassy-secondary" className="bg-blue-500/20 text-blue-400 border-blue-500/30">Completed</Badge>
      case 'cancelled':
        return <Badge variant="glassy-secondary" className="bg-red-500/20 text-red-400 border-red-500/30">Cancelled</Badge>
      case 'no_show':
        return <Badge variant="glassy-secondary" className="bg-red-500/20 text-red-400 border-red-500/30">No-show</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  if (loading && payments.length === 0) {
    return (
      <Card className="bg-gradient-to-br from-white/5 to-white/3 border border-black/5 dark:border-white/10 shadow-xl backdrop-blur-xl rounded-3xl overflow-hidden">
        <CardContent className="pt-6 flex justify-center items-center min-h-[300px]">
          <LoadingSpinner size="md" text="Loading payment history..." />
        </CardContent>
      </Card>
    )
  }

  if (error && payments.length === 0) {
    return (
      <Card className="bg-gradient-to-br from-white/5 to-white/3 border border-black/5 dark:border-white/10 shadow-xl backdrop-blur-xl rounded-3xl overflow-hidden">
        <CardContent className="pt-6">
          <div className="text-center text-red-400">
            <p className="text-lg font-bebas tracking-wide mb-4">Error loading payment history</p>
            <p className="text-sm text-foreground/60 mb-6">{error}</p>
            <Button 
              onClick={() => loadPayments()} 
              className="bg-secondary hover:bg-secondary/90 text-primary font-bold rounded-xl px-8 py-2 shadow-lg transition-all"
            >
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-gradient-to-br from-white/5 to-white/3 border border-black/5 dark:border-white/10 shadow-2xl backdrop-blur-xl rounded-3xl overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-secondary/10 to-transparent border-b border-black/5 dark:border-white/10 p-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-secondary/20 rounded-xl">
            <DollarSign className="h-5 w-5 text-secondary" />
          </div>
          <CardTitle className="text-2xl font-bebas text-foreground tracking-wide">Payment History</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-8">
        {/* Summary Cards */}
        {totals && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-white/5 backdrop-blur-md border border-black/5 dark:border-white/10 rounded-2xl p-5 transition-all hover:bg-white/10 group">
              <div className="flex items-center gap-2 mb-2">
                {earningsData?.trend === "up" ? (
                  <TrendingUp className="h-4 w-4 text-green-400" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-400" />
                )}
                <span className="text-xs font-semibold text-foreground/60 uppercase tracking-widest">Growth</span>
              </div>
              <div className={`text-2xl font-bebas tracking-wide ${earningsData?.trend === "up" ? "text-green-400" : "text-red-400"}`}>
                {earningsData?.trend === "up" ? "+" : "-"}{earningsData?.percentage || 0}%
              </div>
              <div className="text-[10px] text-foreground/40 mt-1 uppercase">vs last month</div>
            </div>
            
            <div className="bg-secondary/10 border border-secondary/20 rounded-2xl p-5 transition-all hover:bg-secondary/20 group">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-4 w-4 text-secondary" />
                <span className="text-xs font-semibold text-secondary uppercase tracking-widest">Payout</span>
              </div>
              <div className="text-2xl font-bebas tracking-wide text-secondary">{formatCurrency(totals.totalBarberPayout)}</div>
              <div className="text-[10px] text-secondary/60 mt-1 uppercase">Total earned</div>
            </div>
            
            <div className="bg-white/5 backdrop-blur-md border border-black/5 dark:border-white/10 rounded-2xl p-5 transition-all hover:bg-white/10 group">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-4 w-4 text-secondary/70" />
                <span className="text-xs font-semibold text-foreground/60 uppercase tracking-widest">Bookings</span>
              </div>
              <div className="text-2xl font-bebas tracking-wide text-foreground">{totals.totalBookings}</div>
              <div className="text-[10px] text-foreground/40 mt-1 uppercase">Finalized count</div>
            </div>
          </div>
        )}

        {/* Payment List */}
        <div className="space-y-4">
          {payments.map((payment) => (
            <div key={payment.id} className="bg-white/5 backdrop-blur-xl border border-black/5 dark:border-white/10 rounded-2xl p-5 hover:bg-white/10 hover:border-secondary/20 transition-all duration-300 group">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-bebas tracking-wide text-foreground">
                      {payment.serviceName || 'Unknown Service'}
                    </h3>
                    {getStatusBadge(payment.status)}
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-y-2 gap-x-4 text-sm text-foreground/60">
                    <div className="flex items-center gap-2 bg-black/5 dark:bg-white/5 px-2 py-1 rounded-lg">
                      <Calendar className="h-3 w-3 text-secondary" />
                      {formatDate(payment.startsAt)}
                    </div>
                    <div className="flex items-center gap-2 bg-black/5 dark:bg-white/5 px-2 py-1 rounded-lg">
                      <Clock className="h-3 w-3 text-secondary" />
                      {formatTime(payment.startsAt)}
                    </div>
                    <div className="flex items-center gap-2 bg-black/5 dark:bg-white/5 px-2 py-1 rounded-lg">
                      <User className="h-3 w-3 text-secondary" />
                      {payment.customerName || 'Client'}
                    </div>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="text-xl font-bebas tracking-wide text-foreground mb-1">{formatCurrency(payment.servicePriceCents + payment.addonTotalCents)}</div>
                  <div className="text-xs font-semibold text-secondary uppercase tracking-widest bg-secondary/10 px-2 py-1 rounded-lg inline-block">
                    Fee share: {formatCurrency(payment.feeShareCents)}
                  </div>
                </div>
              </div>
              
            </div>
          ))}
        </div>

        {/* Load More Button */}
        {hasMore && (
          <div className="mt-8 text-center">
            <Button 
              onClick={loadMore} 
              disabled={loading}
              variant="outline"
              className="border-black/10 dark:border-white/20 text-foreground hover:bg-black/5 dark:hover:bg-white/10 backdrop-blur-xl rounded-xl px-10 py-6 font-bold text-lg transition-all duration-300"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin mr-3" />
                  Loading...
                </>
              ) : (
                'Load More'
              )}
            </Button>
          </div>
        )}

        {!hasMore && payments.length > 0 && (
          <div className="mt-6 text-center text-white/60">
            No more payments to load
          </div>
        )}

        {payments.length === 0 && !loading && (
          <div className="text-center py-20">
            <div className="flex flex-col items-center gap-6">
              <div className="p-6 bg-gradient-to-br from-secondary/20 to-secondary/10 rounded-3xl shadow-lg">
                <DollarSign className="h-12 w-12 text-secondary/50" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-bebas tracking-wide text-foreground">No payment history found</h3>
                <p className="text-foreground/60 text-lg">Your completed bookings will appear here</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
} 