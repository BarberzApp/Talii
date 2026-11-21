"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/shared/components/ui/button'
import { logger } from '@/shared/lib/logger'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/shared/components/ui/dialog'
import { useToast } from '@/shared/components/ui/use-toast'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  formatCents,
  formatInTimeZone,
  timeZoneAbbreviation,
  TOTAL_PRICE_CENTS,
  type AvailabilitySlot,
  type BookingRow,
  type PublicAddon,
  type PublicService,
} from '@barber-app/shared'
import { api, bookingErrorMessage, errorMessage, hasErrorCode } from '@/shared/lib/api'
import { storeRedirectUrl } from '@/shared/lib/redirect-utils'
import { BookingPayment, paymentIntentStatus } from '@/shared/components/payment/booking-payment'
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, startOfWeek, endOfWeek } from 'date-fns'
import { CalendarIcon, Clock, User, CreditCard, Loader2, MapPin, Scissors, Star, ChevronLeft, ChevronRight, X, CheckCircle, ArrowRight, Sparkles } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { useAuth } from '@/shared/hooks/use-auth-zustand'
import { Badge } from '@/shared/components/ui/badge'
import { Separator } from '@/shared/components/ui/separator'
import { AddonSelector } from './addon-selector'
import { motion, AnimatePresence } from 'framer-motion'
import { staggerContainer, staggerItem } from '@/shared/lib/animations'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

interface BookingFormProps {
  isOpen: boolean
  onClose: () => void
  selectedDate: Date
  barberId: string
  onBookingCreated: (booking: BookingRow) => void
}

/** A pending booking waiting for the booking fee (POST /api/bookings returned a clientSecret). */
type PendingPayment = { bookingId: string; clientSecret: string; amountCents: number }

export function BookingForm({ isOpen, onClose, selectedDate, barberId, onBookingCreated }: BookingFormProps) {
  const { user } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [services, setServices] = useState<PublicService[]>([])
  const [addons, setAddons] = useState<PublicAddon[]>([])
  const [timezone, setTimezone] = useState<string>('America/New_York')
  const [slots, setSlots] = useState<AvailabilitySlot[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [formData, setFormData] = useState({
    serviceId: '',
    /** The chosen slot's startsAt (ISO instant). */
    startsAt: '',
    notes: '',
  })
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([])
  const [date, setDate] = useState<Date>(selectedDate)
  const [currentMonth, setCurrentMonth] = useState<Date>(selectedDate ? new Date(selectedDate) : new Date())
  const [payment, setPayment] = useState<PendingPayment | null>(null)
  /** confirmPayment is in flight: the dialog cannot be closed and the hold is not released. */
  const [paymentSubmitting, setPaymentSubmitting] = useState(false)
  
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1))
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1))
  
  const calendarDays = () => {
    const start = startOfWeek(startOfMonth(currentMonth))
    const end = endOfWeek(endOfMonth(currentMonth))
    return eachDayOfInterval({ start, end })
  }
  const [selectedService, setSelectedService] = useState<PublicService | null>(null)
  const [currentStep, setCurrentStep] = useState(1)
  const totalSteps = 4

  const selectedSlot = slots.find((s) => s.startsAt === formData.startsAt) || null

  useEffect(() => {
    if (isOpen) {
      fetchServices()
      setCurrentStep(1)
      setPayment(null)
    }
  }, [isOpen, barberId])

  useEffect(() => {
    if (isOpen && selectedService) {
      fetchAvailability()
    }
  }, [isOpen, barberId, date, selectedService])

  const fetchServices = async () => {
    try {
      const profile = await api.barbers.get(barberId)
      setServices(profile.services)
      setAddons(profile.addons)
      setTimezone(profile.barber.timezone)
    } catch (error) {
      logger.error('Error fetching services and add-ons', error)
      toast({
        title: "Error",
        description: errorMessage(error, "Failed to load services. Please try again."),
        variant: "destructive",
      })
    }
  }

  const fetchAvailability = async () => {
    if (!selectedService) return

    setSlotsLoading(true)
    try {
      // The calendar day is the barber's local date; slots come back in their time zone.
      const { slots: daySlots } = await api.barbers.availability(barberId, {
        date: format(date, 'yyyy-MM-dd'),
        serviceId: selectedService.id,
      })
      setSlots(daySlots)
    } catch (error) {
      logger.error('Error fetching availability', error)
      setSlots([])
      toast({
        title: "Error",
        description: errorMessage(error, "Failed to load available time slots. Please try again."),
        variant: "destructive",
      })
    } finally {
      setSlotsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const service = services.find(s => s.id === formData.serviceId)
    if (!service) {
      toast({ title: "Error", description: "Please select a service.", variant: "destructive" })
      return
    }

    if (!formData.startsAt) {
      toast({ title: "Error", description: "Please select a time.", variant: "destructive" })
      return
    }

    if (!user) {
      toast({ title: "Sign in required", description: "Please sign in to book.", variant: "destructive" })
      return
    }

    setLoading(true)

    try {
      const { booking, clientSecret } = await api.bookings.create({
        barberId,
        serviceId: formData.serviceId,
        startsAt: formData.startsAt,
        addonIds: selectedAddonIds,
        notes: formData.notes.trim() || undefined,
      })

      if (!clientSecret) {
        // Fee-exempt barber: the booking is already confirmed.
        toast({ title: "Booked!", description: "Your appointment is confirmed." })
        onBookingCreated(booking)
        router.push(`/booking/success?booking_id=${encodeURIComponent(booking.id)}`)
        return
      }

      // Pay the booking fee with the Payment Element; the slot is held meanwhile.
      setPayment({ bookingId: booking.id, clientSecret, amountCents: booking.booking_fee_cents })
    } catch (error) {
      logger.error('Error creating booking', error)
      toast({
        title: "Could not book",
        description: bookingErrorMessage(error, "Failed to create booking. Please try again."),
        variant: "destructive",
      })
      if (hasErrorCode(error, 'SLOT_TAKEN', 'OUTSIDE_HOURS', 'SLOT_IN_PAST')) {
        setFormData((prev) => ({ ...prev, startsAt: '' }))
        setCurrentStep(2)
        fetchAvailability()
      }
    } finally {
      setLoading(false)
    }
  }

  /**
   * Leaving the payment step releases the held slot, unless the client has in
   * fact paid (or the payment is still processing): then the booking stands and
   * the success page takes over.
   */
  const abandonPayment = async () => {
    const pending = payment
    if (!pending || paymentSubmitting) return
    setPayment(null)
    const status = await paymentIntentStatus(pending.clientSecret)
    if (status === 'succeeded' || status === 'processing') {
      router.push(`/booking/success?booking_id=${encodeURIComponent(pending.bookingId)}`)
      return
    }
    try {
      await api.bookings.cancel(pending.bookingId, 'Payment abandoned')
    } catch (error) {
      // The hold expires on its own; nothing to show.
      logger.warn('Could not release the booking hold', error)
    }
  }

  const handleClose = () => {
    if (paymentSubmitting) return // never close mid-confirmation
    if (payment) void abandonPayment()
    onClose()
  }

  const handleServiceChange = (serviceId: string) => {
    setSelectedService(services.find(s => s.id === serviceId) || null)
    setFormData({ ...formData, serviceId, startsAt: '' }) // Reset time when service changes
  }

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':')
    const hour = parseInt(hours)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour % 12 || 12
    return `${displayHour}:${minutes} ${ampm}`
  }

  const getDayName = (date: Date) => DAYS[date.getDay()]
  const getMonthName = (date: Date) => date.toLocaleDateString('en-US', { month: 'long' })

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const canProceed = () => {
    switch (currentStep) {
      case 1: return !!formData.serviceId
      case 2: return !!formData.startsAt
      case 3: return !!user
      case 4: return true
      default: return false
    }
  }

  const handleNextStep = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1)
    }
  }

  const getStepTitle = () => {
    switch (currentStep) {
      case 1: return "Choose Your Service"
      case 2: return "Pick Your Time"
      case 3: return "Your Information"
      case 4: return "Review & Book"
      default: return ""
    }
  }

  const getStepDescription = () => {
    switch (currentStep) {
      case 1: return "Select the service you'd like to book"
      case 2: return "Choose your preferred appointment time"
      case 3: return "Provide your contact information"
      case 4: return "Review your booking details and confirm"
      default: return ""
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose() }}>
      <DialogContent className="max-w-2xl w-full bg-white/95 dark:bg-[#111110]/95 border border-black/10 dark:border-white/10 backdrop-blur-2xl rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)] p-0 overflow-hidden mb-[200px] md:mb-0 max-h-[95vh] md:max-h-[90vh] sm:max-h-[85vh]">
        {/* Header */}
        <div className="relative p-6 border-b border-black/5 dark:border-white/10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <DialogTitle className="text-3xl font-bebas tracking-wide bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">{getStepTitle()}</DialogTitle>
              <DialogDescription className="text-muted-foreground mt-1">{getStepDescription()}</DialogDescription>
            </div>

          </div>

          {/* Progress Bar */}
          <div className="w-full bg-black/5 dark:bg-white/10 rounded-full h-2 mb-4">
            <div 
              className="bg-gradient-to-r from-secondary to-orange-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(currentStep / totalSteps) * 100}%` }}
            />
          </div>

          {/* Step Indicators */}
          <div className="flex justify-between">
            {[1, 2, 3, 4].map((step) => (
              <div key={step} className="flex flex-col items-center">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300",
                  step < currentStep 
                    ? "bg-secondary text-primary-foreground" 
                    : step === currentStep 
                    ? "bg-secondary/10 dark:bg-secondary/20 text-secondary border-2 border-secondary shadow-[0_0_15px_rgba(238,109,35,0.4)] scale-110" 
                    : "bg-black/5 dark:bg-white/10 text-foreground/40"
                )}>
                  {step < currentStep ? <CheckCircle className="h-4 w-4" /> : step}
                </div>
                <span className={cn(
                  "text-xs mt-1 transition-colors",
                  step <= currentStep ? "text-foreground" : "text-foreground/40"
                )}>
                  {step === 1 && "Service"}
                  {step === 2 && "Time"}
                  {step === 3 && "Info"}
                  {step === 4 && "Book"}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 space-y-6 max-h-[50vh] sm:max-h-[55vh] md:max-h-[75vh] lg:max-h-[80vh] overflow-y-auto pb-40 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent scrollbar-thumb-rounded-full scrollbar-track-rounded-full scroll-smooth hover:scrollbar-thumb-white/30 transition-all duration-200">
          {/* Step 1: Service Selection */}
          {currentStep === 1 && (
            <div className="space-y-6 pb-8">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-secondary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Scissors className="h-8 w-8 text-secondary" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">What service do you need?</h3>
                <p className="text-muted-foreground">Choose from our available services</p>
              </div>

              <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-4">
                {services.map((service) => (
                  <motion.div
                    variants={staggerItem}
                    key={service.id}
                    className={cn(
                      "relative p-6 rounded-2xl border-2 cursor-pointer transition-all duration-300 group",
                      formData.serviceId === service.id
                        ? "border-2 border-secondary bg-secondary/5 dark:bg-secondary/10 shadow-xl shadow-secondary/20 scale-[1.02] ring-2 ring-secondary/20"
                        : "border border-black/5 dark:border-white/5 bg-white dark:bg-white/5 hover:border-secondary/40 hover:shadow-lg hover:shadow-secondary/5 dark:hover:bg-white/10 transition-all duration-300"
                    )}
                    onClick={() => handleServiceChange(service.id)}
                  >

                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="text-lg font-semibold text-foreground mb-2">{service.name}</h4>
                        {service.description && (
                          <p className="text-muted-foreground text-sm mb-3">{service.description}</p>
                        )}
                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            <span>{service.duration_minutes} min</span>
                          </div>
                          <Badge className="bg-secondary/20 text-secondary border-secondary/30">
                            Popular
                          </Badge>
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <div className="text-3xl font-bold text-secondary">{formatCents(service.price_cents, { compact: true })}</div>
                        <div className="text-muted-foreground text-sm">per service</div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>

              {/* Add-on Selector */}
              {addons.length > 0 && (
                <div className="pt-6">
                  <h4 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-secondary" />
                    Enhance Your Service (Optional)
                  </h4>
                  <AddonSelector
                    addons={addons}
                    selectedAddonIds={selectedAddonIds}
                    onAddonChange={setSelectedAddonIds}
                  />
                </div>
              )}
            </div>
          )}

          {/* Step 2: Date & Time Selection */}
          {currentStep === 2 && (
            <div className="space-y-6 pb-8">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-secondary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CalendarIcon className="h-8 w-8 text-secondary" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">When works best for you?</h3>
                <p className="text-muted-foreground">Pick your preferred date and time</p>
              </div>

          {/* Date Selection */}
              <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl p-6 border border-black/5 dark:border-white/10 shadow-sm">
                <h4 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5 text-secondary" />
                  Select Date
                </h4>
                <div className="w-full max-w-[340px] mx-auto pt-4 pb-4">
                  {/* Calendar Header */}
                  <div className="flex items-center justify-between mb-6 px-2">
                    <button
                      onClick={prevMonth}
                      className="p-2 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-foreground"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <h5 className="font-bold text-foreground text-lg tracking-tight">
                      {format(currentMonth, 'MMMM yyyy')}
                    </h5>
                    <button
                      onClick={nextMonth}
                      className="p-2 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-foreground"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>

                  {/* Calendar Days Header */}
                  <div className="grid grid-cols-7 mb-3">
                    {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
                      <div key={day} className="text-center text-[13px] font-bold text-muted-foreground/70 uppercase tracking-wider py-1">
                        {day}
                      </div>
                    ))}
                  </div>

                  {/* Calendar Days Grid */}
                  <div className="grid grid-cols-7 gap-y-3 gap-x-2">
                    {calendarDays().map((day, idx) => {
                      const isCurrentMonth = isSameMonth(day, currentMonth);
                      const isTodayDate = isToday(day);
                      const isSelected = date && isSameDay(day, date);
                      
                      // Disable logic
                      const yesterday = new Date();
                      yesterday.setDate(yesterday.getDate() - 1);
                      const isDisabled = day < yesterday;

                      return (
                        <button
                          key={idx}
                          disabled={isDisabled}
                          onClick={() => setDate(day)}
                          className={cn(
                            "h-11 w-full rounded-xl flex items-center justify-center text-[15px] font-medium transition-all duration-300 relative overflow-hidden group",
                            !isCurrentMonth && "text-muted-foreground/20",
                            isDisabled && "opacity-30 cursor-not-allowed",
                            !isDisabled && !isSelected && "hover:bg-secondary/10 hover:text-secondary hover:shadow-sm hover:scale-105",
                            isCurrentMonth && !isDisabled && !isSelected && !isTodayDate && "text-foreground bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5",
                            isTodayDate && !isSelected && "text-secondary font-bold bg-secondary/10 border-2 border-secondary",
                            isSelected && "bg-gradient-to-br from-secondary to-[#FF8C00] text-primary-foreground font-bold shadow-lg shadow-secondary/40 scale-110 border-none z-10"
                          )}
                        >
                          <span className="relative z-10">{format(day, 'd')}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                      </div>

          {/* Time Selection */}
              <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl p-6 border border-black/5 dark:border-white/10 shadow-sm">
                <h4 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Clock className="h-5 w-5 text-secondary" />
                  Select Time
                </h4>
                
                <p className="text-xs text-muted-foreground mb-3">
                  Times are in the barber&apos;s time zone ({timeZoneAbbreviation(timezone, date)}).
                </p>
                {slotsLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-secondary" />
                  </div>
                ) : slots.length > 0 ? (
                  <div className="grid grid-cols-3 gap-3">
                    {slots.map((slot) => {
                      const isDisabled = !slot.available

                      return (
                        <Button
                          key={slot.startsAt}
                          type="button"
                          variant="ghost"
                          disabled={isDisabled}
                          className={cn(
                            "h-16 text-sm font-medium transition-all duration-300 relative overflow-hidden group",
                            isDisabled
                              ? "bg-white/70 dark:bg-white/5 backdrop-blur-xl border border-black/5 dark:border-white/10 text-foreground/40 opacity-50 cursor-not-allowed"
                              : formData.startsAt === slot.startsAt
                                ? "bg-gradient-to-br from-secondary to-orange-500 text-foreground border-2 border-secondary/50 shadow-lg scale-105 transform"
                                : "bg-transparent dark:bg-white/5 border border-black/10 dark:border-white/10 text-foreground hover:border-secondary/50 hover:bg-secondary/5 hover:scale-105 hover:shadow-sm"
                          )}
                          onClick={() => {
                            if (!isDisabled) setFormData({ ...formData, startsAt: slot.startsAt })
                          }}
                        >
                          <div className="font-semibold">{formatTime(slot.time)}</div>
                        </Button>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12">
                      <Clock className="h-16 w-16 mx-auto text-foreground/30 mb-4" />
                    <p className="text-muted-foreground font-semibold text-lg mb-2">No Available Slots</p>
                    <p className="text-muted-foreground text-sm">This date appears to be fully booked</p>
                  </div>
                )}
              </div>
            </div>
          )}

                     {/* Step 3: Guest Information */}
           {currentStep === 3 && (
             <div className="space-y-6 pb-8">
               <div className="text-center mb-6">
                 <div className="w-16 h-16 bg-secondary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                   <User className="h-8 w-8 text-secondary" />
                    </div>
                 <h3 className="text-xl font-bold text-foreground mb-2">Tell us about yourself</h3>
                 <p className="text-muted-foreground">We'll use this to confirm your booking</p>
                  </div>
                  
               {!user ? (
                   <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 text-center">
                     <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                       <X className="h-6 w-6 text-red-400" />
                     </div>
                     <h4 className="text-lg font-semibold text-foreground mb-2">Sign In Required</h4>
                     <p className="text-muted-foreground mb-4">Please sign in to book with this barber</p>
                     <Button asChild className="rounded-xl bg-secondary text-primary-foreground">
                       <Link href="/login" onClick={() => storeRedirectUrl(window.location.pathname)}>Sign in</Link>
                     </Button>
                   </div>
               ) : (
                 <div className="bg-secondary/10 border border-secondary/20 rounded-2xl p-6 text-center">
                   <div className="w-12 h-12 bg-secondary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                     <CheckCircle className="h-6 w-6 text-secondary" />
                   </div>
                   <h4 className="text-lg font-semibold text-foreground mb-2">Welcome back, {user.name}!</h4>
                   <p className="text-muted-foreground">We'll use your account information for this booking</p>
                </div>
          )}

          {/* Notes */}
               <div>
                 <Label htmlFor="notes" className="text-foreground font-medium mb-2 block">Additional Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement> ) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Any special requests or notes..."
                  className="bg-black/5 dark:bg-white/10 border-black/10 dark:border-white/20 text-foreground placeholder-white/40 focus:border-secondary focus:ring-2 focus:ring-secondary/20 ring-offset-background transition-all duration-300 rounded-xl min-h-[100px]"
                />
                          </div>
                        </div>
                      )}
                      
                     {/* Step 4: Review & Payment */}
           {currentStep === 4 && payment && (
             <div className="space-y-6 pb-8">
               <div className="text-center mb-2">
                 <div className="w-16 h-16 bg-secondary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                   <CreditCard className="h-8 w-8 text-secondary" />
                 </div>
                 <h3 className="text-xl font-bold text-foreground mb-2">Pay the booking fee</h3>
                 <p className="text-muted-foreground">Your slot is held for 10 minutes while you pay.</p>
               </div>
               <BookingPayment
                 bookingId={payment.bookingId}
                 clientSecret={payment.clientSecret}
                 amountCents={payment.amountCents}
                 onCancel={() => void abandonPayment()}
                 onSubmittingChange={setPaymentSubmitting}
               />
             </div>
           )}

           {currentStep === 4 && !payment && (
             <form onSubmit={handleSubmit} className="space-y-6 pb-8">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-secondary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CreditCard className="h-8 w-8 text-secondary" />
                          </div>
                <h3 className="text-xl font-bold text-foreground mb-2">Review Your Booking</h3>
                <p className="text-muted-foreground">Confirm your details and complete payment</p>
                      </div>
                      
              {/* Booking Summary */}
              <div className="bg-gradient-to-br from-white to-black/5 dark:from-[#1A1A1A] dark:to-white/5 backdrop-blur-2xl rounded-2xl p-6 border border-black/10 dark:border-white/10 shadow-lg space-y-4">
                <h4 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-secondary" />
                  Booking Summary
                </h4>

                      {selectedService && (
                  <div className="flex items-center justify-between p-4 bg-white/70 dark:bg-white/5 backdrop-blur-xl rounded-xl">
                          <div>
                      <p className="text-foreground font-semibold">{selectedService.name}</p>
                      <p className="text-muted-foreground text-sm">
                        {selectedSlot
                          ? `${formatInTimeZone(selectedSlot.startsAt, timezone, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}`
                          : ''}
                      </p>
                          </div>
                          <div className="text-right">
                      <p className="text-xl font-bold text-secondary">{formatCents(selectedService.price_cents)}</p>
                          </div>
                        </div>
                      )}
                      
                {/* Add-ons */}
                      {selectedAddonIds.length > 0 && (
                  <div className="space-y-2">
                    {selectedAddonIds.map((addonId) => {
                      const addon = addons.find(a => a.id === addonId)
                      return addon ? (
                        <div key={addonId} className="flex items-center justify-between p-3 bg-white/70 dark:bg-white/5 backdrop-blur-xl rounded-lg">
                          <div>
                            <p className="text-foreground font-medium">{addon.name}</p>
                            <p className="text-muted-foreground text-sm">Add-on service</p>
                          </div>
                          <div className="text-right">
                            <p className="text-secondary font-semibold">+{formatCents(addon.price_cents)}</p>
                          </div>
                        </div>
                      ) : null
                    })}
                        </div>
                      )}
                      
                      {/* Platform Fee */}
                 <div className="flex items-center justify-between p-4 bg-white/70 dark:bg-white/5 backdrop-blur-xl rounded-xl">
                        <div>
                          <p className="text-foreground font-medium">Platform Fee</p>
                     <p className="text-muted-foreground text-sm">
                       Secure payment processing (waived by some barbers)
                     </p>
                        </div>
                        <div className="text-right">
                     <p className="text-lg font-bold text-secondary">
                       {formatCents(TOTAL_PRICE_CENTS)}
                     </p>
                     <Badge className={cn(
                       "text-xs",
                       "bg-green-500/20 text-green-400 border-green-500/30"
                     )}>
                       Secure
                          </Badge>
                        </div>
                      </div>
                      
                      {/* Total */}
                 <div className="flex items-center justify-between p-4 bg-gradient-to-r from-secondary/10 to-orange-500/10 border border-secondary/20 rounded-xl">
                        <div>
                          <p className="text-foreground font-bold text-lg">Total</p>
                          <p className="text-muted-foreground text-sm">Amount to be charged</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-secondary">
                       {formatCents(TOTAL_PRICE_CENTS)}
                          </p>
                        </div>
                      </div>

                                 <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                   <p className="text-blue-400 text-sm">
                     You pay the booking fee now to hold your slot; the service and any add-ons are paid to the barber at your appointment. If the barber waives the fee, your booking is confirmed straight away.
                   </p>
                                 </div>
               </div>

               {/* Navigation Buttons for Step 4 */}
               <div className="flex gap-3 pt-6 pb-4 border-t border-black/5 dark:border-white/10">
                 <Button 
                   type="button" 
                   variant="outline" 
                   onClick={prevStep}
                   className="flex-1 border-black/10 dark:border-white/20 text-foreground hover:bg-black/5 dark:bg-white/10 rounded-xl"
                 >
                   <ChevronLeft className="h-4 w-4 mr-2" />
                   Back
                 </Button>
                 
                 <Button 
                   type="submit" 
                   disabled={loading || !canProceed()}
                   className="flex-1 bg-secondary text-primary-foreground font-semibold rounded-xl hover:bg-secondary/90 shadow-lg hover:shadow-secondary/30 transition-all tracking-wide"
                 >
                   {loading ? (
                     <>
                       <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                       Booking...
                     </>
                   ) : (
                     <>
                       <CreditCard className="mr-2 h-4 w-4" />
                       Book Appointment
                     </>
                   )}
                 </Button>
               </div>
             </form>
           )}

          {/* Navigation Buttons for Steps 1-3 */}
          {currentStep < 4 && (
            <div className="flex gap-3 pt-6 pb-4 border-t border-black/5 dark:border-white/10">
              {currentStep > 1 && (
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={prevStep}
                  className="flex-1 border-black/10 dark:border-white/20 text-foreground hover:bg-black/5 dark:bg-white/10 rounded-xl"
                >
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              )}
              
              <Button 
                type="button" 
                onClick={handleNextStep}
                disabled={!canProceed()}
                className="flex-1 bg-gradient-to-r from-secondary to-[#FF8C42] text-primary-foreground font-bold rounded-xl shadow-lg ring-1 ring-black/5 hover:scale-[1.02] hover:shadow-secondary/30 relative z-10 transition-all duration-300"
              >
                Continue
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
