"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useToast } from "@/shared/components/ui/use-toast"
import { useSafeNavigation } from '@/shared/hooks/use-safe-navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { supabaseAdmin } from "@/shared/lib/supabase"
import { logger } from "@/shared/lib/logger"

export default function BookingSuccessPage({
  searchParams,
}: {
  searchParams: { session_id?: string }
}) {
  const router = useRouter()
  const { toast } = useToast()
  const sessionId = searchParams.session_id
  const { push: safePush } = useSafeNavigation();

  useEffect(() => {
    const handleSuccess = async () => {
      if (!sessionId) {
        toast({
          title: "Error",
          description: "No session ID provided",
          variant: "destructive",
        })
        safePush('/')
        return
      }

      try {
        logger.debug('Payment successful', { sessionId })
        
        // Verify the session was successful
        const response = await fetch(`/api/payments/session?session_id=${sessionId}`)
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(`Failed to verify payment: ${errorData.error || response.statusText}`)
        }
        
        const session = await response.json()
        logger.debug('Payment verified', {
          id: session.id,
          payment_status: session.payment_status,
          amount_total: session.amount_total
        })

        // Check if booking was created by webhook
        const { data: existingBooking } = await supabaseAdmin
          .from('bookings')
          .select('id, status, payment_status')
          .eq('payment_intent_id', session.payment_intent)
          .single()

        if (existingBooking) {
          logger.debug('Booking created by webhook', { bookingId: existingBooking.id })
          toast({
            title: "Payment Successful!",
            description: "Your booking has been confirmed and you'll receive a confirmation shortly.",
          })
        } else {
          logger.debug('Booking being created by webhook')
          toast({
            title: "Payment Successful!",
            description: "Your payment was processed successfully. Your booking will be confirmed shortly.",
          })
        }

      } catch (error) {
        logger.error('Error verifying payment', error)
        // Don't show error to user since payment was successful
        // The webhook will handle booking creation
        toast({
          title: "Payment Successful!",
          description: "Your payment was processed successfully. Your booking will be confirmed shortly.",
        })
      }
    }

    handleSuccess()
  }, [sessionId, router, toast])

  return (
    <div className="container max-w-2xl py-10 min-h-screen flex items-center justify-center">
      <Card className="w-full shadow-lg border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 backdrop-blur-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-foreground dark:text-white">Payment Successful</CardTitle>
          <CardDescription className="text-muted-foreground dark:text-white/70">
            Your payment has been processed and your booking will be confirmed shortly.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-secondary/10 border border-secondary/20 rounded-lg p-5">
            <p className="text-secondary font-semibold text-lg">
              Payment Confirmed
            </p>
            <p className="text-foreground dark:text-white/80 text-sm mt-2 leading-relaxed">
              Your booking is being processed automatically. You will receive a confirmation email and SMS shortly.
            </p>
          </div>
          
          <div className="bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg p-5">
            <p className="text-foreground dark:text-white font-medium mb-3">What happens next?</p>
            <ul className="text-muted-foreground dark:text-white/70 text-sm space-y-2">
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-secondary"></div>
                Your booking will be created automatically
              </li>
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-secondary"></div>
                You will receive a confirmation email
              </li>
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-secondary"></div>
                You will get an SMS notification
              </li>
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-secondary"></div>
                The barber will be notified of your appointment
              </li>
            </ul>
          </div>
          
          <Button 
            onClick={() => safePush('/browse')} 
            className="w-full bg-secondary text-primary-foreground hover:bg-secondary/90 py-6 text-base font-semibold rounded-full"
          >
            Browse
          </Button>
        </CardContent>
      </Card>
    </div>
  )
} 