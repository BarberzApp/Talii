"use client";

import { useEffect, useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Calendar as CalendarIcon, Loader2 } from 'lucide-react';
import { useAuth } from '@/shared/hooks/use-auth-zustand';
import { useSafeNavigation } from '@/shared/hooks/use-safe-navigation';
import { storeRedirectUrl } from '@/shared/lib/redirect-utils';
import { EnhancedCalendar } from '@/shared/components/calendar/enhanced-calendar';

/**
 * Barbers: their appointments (opens on today's agenda). Clients: their bookings.
 * EnhancedCalendar loads the visible month with GET /api/bookings (from/to).
 */
export default function CalendarPage() {
  const [eventCount, setEventCount] = useState<number | null>(null);
  const { user, status } = useAuth();
  const { replace } = useSafeNavigation();
  const isBarber = user?.role === 'barber';

  useEffect(() => {
    if (status === 'unauthenticated') {
      storeRedirectUrl('/calendar');
      replace('/login');
    }
  }, [status, replace]);

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" role="status" aria-label="Loading your calendar">
        <Loader2 className="h-10 w-10 animate-spin text-secondary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="relative z-10 container mx-auto px-4 py-8 pb-36 md:pb-12 flex flex-col items-center">
        {/* Header */}
        <div className="mb-6 w-full max-w-[700px]">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-secondary/15 rounded-2xl border border-secondary/20 shadow-lg shadow-secondary/5">
              <CalendarIcon className="h-7 w-7 sm:h-9 sm:w-9 text-secondary" />
            </div>
            <div>
              <h1 className="text-3xl sm:text-5xl font-bebas text-foreground tracking-wider leading-none">
                {isBarber ? 'Appointment Calendar' : 'My Appointments'}
              </h1>
              <p className="text-muted-foreground text-sm sm:text-lg mt-1 font-medium">
                {isBarber ? 'Your bookings, in your time zone' : 'Your bookings with barbers'}
              </p>
            </div>
          </div>
        </div>

        <div className="w-full max-w-[700px]">
          <EnhancedCalendar onEventsLoaded={setEventCount} />
          {eventCount === 0 && (
            <div className="mt-8 text-center">
              <p className="text-muted-foreground">No appointments this month.</p>
              <Button
                href={isBarber ? '/settings?tab=availability' : '/browse'}
                variant="ghost"
                className="mt-2 text-secondary hover:text-secondary/80 hover:bg-secondary/10"
              >
                {isBarber ? 'Check your hours' : 'Browse barbers'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
