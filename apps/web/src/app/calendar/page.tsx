"use client";

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, User, DollarSign, Grid, Calendar, Scissors, Mail, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/shared/lib/supabase';
import { useAuth } from '@/shared/hooks/use-auth-zustand';
import { logger } from '@/shared/lib/logger';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/shared/components/ui/dialog';
import { Badge } from '@/shared/components/ui/badge';
import { EnhancedCalendar } from '@/shared/components/calendar/enhanced-calendar';
import { CalendarSyncSettings } from '@/shared/components/calendar-sync-settings';

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  extendedProps: {
    status: string;
    serviceName: string;
    clientName?: string;
    barberName?: string;
    price: number;
    basePrice: number;
    addons: { name: string; price: number }[];
    isGuest: boolean;
    guestEmail: string;
    guestPhone: string;
    isBarberView: boolean;
  };
}

export default function BarberCalendar() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const calendarRef = useRef<FullCalendar>(null);
  const [view, setView] = useState('timeGridWeek');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [mounted, setMounted] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [userRole, setUserRole] = useState<'barber' | 'client' | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    setMounted(true);
    logger.debug('Barber calendar page loaded/reloaded');
  }, []);

  useEffect(() => {
    if (!user) return;
    logger.debug('Fetching bookings for user', { userId: user.id });
    
    const fetchBookings = async () => {
      setLoading(true);
      try {
        // First, check if user is a barber
        const { data: barberData, error: barberError } = await supabase
          .from('barbers')
          .select('id')
          .eq('user_id', user.id)
          .single();
        
        if (barberData && !barberError) {
          // User is a barber - fetch their appointments
          setUserRole('barber');
          logger.debug('User is a barber, fetching barber appointments');
          
          const { data: bookings, error } = await supabase
            .from('bookings')
            .select('*')
            .eq('barber_id', barberData.id)
            .eq('payment_status', 'succeeded') // Only show successful payments
            .order('date', { ascending: true });
          
          if (error || !bookings) {
            logger.error('Error fetching barber bookings', error);
            setEvents([]);
            return;
          }
          
          // For each booking, fetch the related service and client
          const events = await Promise.all(bookings.map(async (booking) => {
            // Fetch service
            const { data: service } = await supabase
              .from('services')
              .select('name, duration, price')
              .eq('id', booking.service_id)
              .single();
            
            // Fetch client
            let client = null;
            if (booking.client_id) {
              const { data: clientData } = await supabase
                .from('profiles')
                .select('name')
                .eq('id', booking.client_id)
                .single();
              client = clientData;
            }
            
            // Fetch add-ons for this booking
            let addonTotal = 0;
            let addonList: { name: string; price: number }[] = [];
            const { data: bookingAddons, error: bookingAddonsError } = await supabase
              .from('booking_addons')
              .select('addon_id')
              .eq('booking_id', booking.id);
            if (!bookingAddonsError && bookingAddons && bookingAddons.length > 0) {
              const addonIds = bookingAddons.map((ba) => ba.addon_id);
              const { data: addons, error: addonsError } = await supabase
                .from('service_addons')
                .select('id, name, price')
                .in('id', addonIds);
              if (!addonsError && addons) {
                addonTotal = addons.reduce((sum, addon) => sum + (addon.price || 0), 0);
                addonList = addons.map(a => ({ name: a.name, price: a.price }));
              }
            }
            
            const startDate = new Date(booking.date);
            const endDate = new Date(startDate.getTime() + (service?.duration || 60) * 60000);
            
            return {
              id: booking.id,
              title: `${service?.name || 'Service'} - ${client?.name || booking.guest_name || 'Guest'}`,
              start: startDate.toISOString(),
              end: endDate.toISOString(),
              backgroundColor: 'hsl(var(--secondary))',
              borderColor: 'hsl(var(--secondary))',
              textColor: '#FFFFFF',
              extendedProps: {
                status: booking.status,
                serviceName: service?.name || '',
                clientName: client?.name || booking.guest_name || 'Guest',
                price: (service?.price || booking.price || 0) + addonTotal,
                basePrice: service?.price || booking.price || 0,
                addons: addonList,
                isGuest: !client,
                guestEmail: booking.guest_email,
                guestPhone: booking.guest_phone,
                isBarberView: true
              }
            };
          }));
          
          setEvents(events);
        } else {
          // User is a client - fetch their appointments
          setUserRole('client');
          logger.debug('User is a client, fetching client appointments', { userId: user.id });
          
          const { data: bookings, error } = await supabase
            .from('bookings')
            .select(`
              *,
              barbers:barber_id(
                id,
                user_id,
                profiles:user_id(name, avatar_url)
              ),
              services:service_id(name, duration, price)
            `)
            .eq('client_id', user.id)
            .eq('payment_status', 'succeeded') // Only show successful payments
            .order('date', { ascending: true });
          
          logger.debug('Client bookings query result', { count: bookings?.length, error });
          
          if (error || !bookings) {
            logger.error('Error fetching client bookings', error);
            setEvents([]);
            return;
          }
          
          logger.debug(`Found ${bookings.length} bookings for client`);
          
          // For each booking, fetch add-ons
          const events = await Promise.all(bookings.map(async (booking, index) => {
            logger.debug(`Processing booking ${index + 1}`, { bookingId: booking.id });
            
            // Fetch add-ons for this booking
            let addonTotal = 0;
            let addonList: { name: string; price: number }[] = [];
            const { data: bookingAddons, error: bookingAddonsError } = await supabase
              .from('booking_addons')
              .select('addon_id')
              .eq('booking_id', booking.id);
            if (!bookingAddonsError && bookingAddons && bookingAddons.length > 0) {
              const addonIds = bookingAddons.map((ba) => ba.addon_id);
              const { data: addons, error: addonsError } = await supabase
                .from('service_addons')
                .select('id, name, price')
                .in('id', addonIds);
              if (!addonsError && addons) {
                addonTotal = addons.reduce((sum, addon) => sum + (addon.price || 0), 0);
                addonList = addons.map(a => ({ name: a.name, price: a.price }));
              }
            }
            
            const startDate = new Date(booking.date);
            const endDate = new Date(startDate.getTime() + (booking.services?.duration || 60) * 60000);
            
            const event = {
              id: booking.id,
              title: `${booking.services?.name || 'Service'} with ${booking.barbers?.profiles?.name || 'Barber'}`,
              start: startDate.toISOString(),
              end: endDate.toISOString(),
              backgroundColor: 'hsl(var(--secondary))',
              borderColor: 'hsl(var(--secondary))',
              textColor: '#FFFFFF',
              extendedProps: {
                status: booking.status,
                serviceName: booking.services?.name || '',
                barberName: booking.barbers?.profiles?.name || 'Barber',
                price: (booking.services?.price || booking.price || 0) + addonTotal,
                basePrice: booking.services?.price || booking.price || 0,
                addons: addonList,
                isGuest: false,
                guestEmail: booking.guest_email,
                guestPhone: booking.guest_phone,
                isBarberView: false
              }
            };
            
            return event;
          }));
          
          logger.debug(`Final events array: ${events.length} events`);
          setEvents(events);
        }
      } catch (error) {
        logger.error('Error fetching bookings', error);
        setEvents([]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchBookings();
  }, [user]);

  const handleEventClick = (info: any) => {
    const event = info.event;
    setSelectedEvent({
      id: event.id,
      title: event.title,
      start: event.start.toISOString(),
      end: event.end.toISOString(),
      backgroundColor: event.backgroundColor,
      borderColor: event.borderColor,
      textColor: event.textColor,
      extendedProps: event.extendedProps
    });
    setShowEventDialog(true);
  };

  const handleViewChange = (newView: string) => {
    setView(newView);
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      calendarApi.changeView(newView);
    }
  };

  // Use a fixed visible time range for the calendar
  const slotMinTime = "06:00:00";
  const slotMaxTime = "23:00:00";

  const customStyles = `
    .barber-calendar {
      background: transparent;
      color: white;
    }
    .barber-calendar .fc {
      background: transparent;
      border-radius: 0;
      overflow: hidden;
      border: none;
    }
    .barber-calendar .fc-header-toolbar {
      background: transparent;
      padding: 0;
      border-bottom: none;
    }
    .barber-calendar .fc-toolbar-title {
      color: white;
      font-size: 1.5rem;
      font-weight: 600;
    }
    .barber-calendar .fc-button {
      background: rgba(var(--secondary-rgb), 0.2) !important;
      border: 1px solid rgba(var(--secondary-rgb), 0.3) !important;
      color: hsl(var(--secondary)) !important;
      border-radius: 12px;
      padding: 0.75rem 1.5rem;
      font-weight: 600;
      transition: all 0.3s ease;
      backdrop-filter: blur(10px);
    }
    .barber-calendar .fc-button:hover {
      background: rgba(var(--secondary-rgb), 0.3) !important;
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(var(--secondary-rgb), 0.3);
    }
    .barber-calendar .fc-button-active {
      background: hsl(var(--secondary)) !important;
      color: white !important;
      box-shadow: 0 8px 25px rgba(var(--secondary-rgb), 0.4);
    }
    .barber-calendar .fc-col-header {
      background: rgba(255, 255, 255, 0.1);
      border-bottom: 1px solid rgba(255, 255, 255, 0.2);
      backdrop-filter: blur(10px);
    }
    .barber-calendar .fc-col-header-cell {
      color: white;
      font-weight: 600;
      padding: 1.5rem 0.5rem;
      font-size: 0.9rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .barber-calendar .fc-col-header-cell .fc-col-header-cell-cushion {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.1rem;
      text-decoration: none !important;
      color: white !important;
      font-weight: 600;
      font-size: 1.1rem;
      line-height: 1.1;
      height: 3.2rem;
      min-width: 2.5rem;
      padding: 0.2rem 0;
    }
    /* Only apply stacked header styles for week view, not month view */
    .barber-calendar .fc-timeGridWeek-view .fc-col-header-cell .fc-col-header-cell-cushion {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.1rem;
      text-decoration: none !important;
      color: white !important;
      font-weight: 600;
      font-size: 1.1rem;
      line-height: 1.1;
      height: 2.2rem;
      min-width: 2.5rem;
      padding: 0.2rem 0;
    }
    .barber-calendar .fc-timeGridWeek-view .fc-col-header-cell .fc-col-header-cell-cushion .weekday-initial {
      font-size: 1.2rem;
      font-weight: 700;
      text-transform: uppercase;
      color: hsl(var(--secondary));
      display: block;
    }
    .barber-calendar .fc-timeGridWeek-view .fc-col-header-cell .fc-col-header-cell-cushion .day-number {
      font-size: 1.4rem;
      font-weight: bold;
      color: white;
      line-height: 1.1;
      display: block;
    }
    .barber-calendar .fc-timegrid .fc-scrollgrid .fc-scrollgrid-section-header .fc-col-header-cell:first-child {
      border-right: 1px solid rgba(255, 255, 255, 0.2) !important;
      border-bottom: 1px solid rgba(255, 255, 255, 0.2) !important;
      background: rgba(255, 255, 255, 0.1) !important;
    }
    .barber-calendar .fc-timegrid .fc-scrollgrid .fc-scrollgrid-section-body .fc-timegrid-axis {
      border-right: 1px solid rgba(255, 255, 255, 0.2) !important;
      background: rgba(255, 255, 255, 0.1) !important;
    }
    .barber-calendar .fc-timegrid .fc-scrollgrid .fc-scrollgrid-section-body .fc-timegrid-axis-cushion {
      border-right: 1px solid rgba(255, 255, 255, 0.2) !important;
      background: rgba(255, 255, 255, 0.1) !important;
    }
    .barber-calendar .fc-timegrid .fc-scrollgrid .fc-scrollgrid-section-body tr > td:first-child {
      border-right: 1px solid rgba(255, 255, 255, 0.2) !important;
      background: rgba(255, 255, 255, 0.1) !important;
    }
    .barber-calendar .fc-timegrid-slot-label {
      color: hsl(var(--foreground) / 0.6) !important;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .barber-calendar .fc-timegrid-slot {
      border-bottom: 1px solid hsl(var(--foreground) / 0.05) !important;
      height: 70px;
    }
    .barber-calendar .fc-timegrid-slot-lane {
      border-right: 1px solid hsl(var(--foreground) / 0.05) !important;
    }
    .barber-calendar .fc-daygrid-day {
      border-right: 1px solid hsl(var(--foreground) / 0.05) !important;
      border-bottom: 1px solid hsl(var(--foreground) / 0.05) !important;
      background: hsla(var(--foreground-rgb), 0.01);
      transition: background 0.3s ease;
    }
    .barber-calendar .fc-daygrid-day:hover {
      background: hsla(var(--foreground-rgb), 0.03);
    }
    .barber-calendar .fc-day-today {
      background: hsla(var(--secondary-rgb), 0.08) !important;
      position: relative;
    }
    .barber-calendar .fc-day-today::after {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      border: 2px solid hsl(var(--secondary) / 0.3);
      pointer-events: none;
    }
    .barber-calendar .fc-event {
      border-radius: 12px !important;
      border: none !important;
      background: hsl(var(--secondary)) !important;
      color: hsl(var(--primary-foreground)) !important;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 4px 12px hsla(var(--secondary-rgb), 0.2);
      transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      backdrop-filter: blur(8px);
      padding: 2px 4px !important;
    }
    .barber-calendar .fc-event:hover {
      transform: translateY(-2px) scale(1.02);
      box-shadow: 0 12px 24px hsla(var(--secondary-rgb), 0.3);
      background: hsl(var(--secondary)) !important;
    }
    .barber-calendar .fc-daygrid-day-number {
      color: hsl(var(--foreground)) !important;
      font-weight: 700;
      font-family: var(--font-bebas);
      font-size: 1.25rem;
      padding: 8px !important;
    }
    .barber-calendar .fc-col-header-cell-cushion {
      color: hsl(var(--foreground) / 0.4) !important;
      font-family: var(--font-bebas);
      font-size: 1.1rem;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      padding: 12px !important;
    }
    .barber-calendar .fc-popover {
      background: hsla(var(--background-rgb), 0.8) !important;
      backdrop-filter: blur(20px) !important;
      border: 1px solid hsl(var(--foreground) / 0.1) !important;
      border-radius: 1.5rem !important;
      box-shadow: 0 20px 50px rgba(0,0,0,0.3) !important;
    }
    .barber-calendar .fc-more-link {
      background: hsl(var(--secondary) / 0.15);
      color: hsl(var(--secondary)) !important;
      font-weight: 800;
      font-size: 0.7rem;
      border-radius: 6px;
      padding: 2px 6px;
      text-transform: uppercase;
    }
  `;

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-[2rem] h-20 w-20 border-b-2 border-secondary mx-auto shadow-2xl shadow-secondary/20"></div>
          <p className="text-foreground font-bebas text-2xl mt-8 tracking-widest animate-pulse opacity-50">Initializing Schedule...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">

      <div className="relative z-10 container mx-auto px-4 py-8 pb-32 flex flex-col items-center">
        {/* Header */}
        <div className="mb-8 w-full">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-secondary/15 rounded-2xl border border-secondary/20 shadow-lg shadow-secondary/5">
              <CalendarIcon className="h-7 w-7 sm:h-9 sm:w-9 text-secondary" />
            </div>
            <div>
              <h1 className="text-3xl sm:text-5xl font-bebas text-foreground tracking-wider leading-none">
                {userRole === 'barber' ? 'Appointment Calendar' : 'My Appointments'}
              </h1>
              <p className="text-foreground/60 text-sm sm:text-lg mt-1 font-medium italic">
                {userRole === 'barber' 
                  ? 'Manage your bookings and professional schedule' 
                  : 'Track your upcoming premium appointments'
                }
              </p>
            </div>
          </div>
        </div>

        {/* Calendar Sync Section */}
        <div className="w-full max-w-4xl mx-auto mb-8">
          <CalendarSyncSettings />
        </div>

        {/* Centered EnhancedCalendar */}
        <div className="w-full flex justify-center">
          <div className="max-w-2xl w-full mx-auto p-0 overflow-visible" style={{ maxWidth: '700px' }}>
            {loading ? (
              <div className="text-center py-24">
                <div className="animate-spin rounded-[1.5rem] h-14 w-14 border-b-2 border-secondary mx-auto mb-6 shadow-xl shadow-secondary/10"></div>
                <p className="text-foreground/40 font-bebas text-xl tracking-widest italic animate-pulse">Syncing Appointments...</p>
              </div>
            ) : (
              <div className="w-full">
                <EnhancedCalendar />
                {events.length === 0 && !loading && (
                  <div className="mt-8 text-center animate-fade-in">
                    <p className="text-foreground/40 font-bebas text-xl tracking-widest italic opacity-50">
                      Currently no scheduled appointments
                    </p>
                    <Button
                      variant="ghost"
                      onClick={() => window.location.href = userRole === 'barber' ? '/profile' : '/browse'}
                      className="mt-2 text-secondary hover:text-secondary/80 hover:bg-secondary/10"
                    >
                      {userRole === 'barber' ? 'Manage Services' : 'Browse Barbers'}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {showEventDialog && selectedEvent && (
         <Dialog open={showEventDialog} onOpenChange={setShowEventDialog}>
          <DialogContent className="max-w-md w-full max-h-[85vh] bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 backdrop-blur-3xl rounded-[2.5rem] shadow-2xl p-10 overflow-hidden ring-1 ring-white/10">
            <DialogHeader className="flex-shrink-0 space-y-2 mb-8">
              <DialogTitle className="text-5xl font-bebas text-foreground tracking-wider leading-none">
                {selectedEvent.extendedProps.isBarberView ? 'Client Session' : 'Premium Booking'}
              </DialogTitle>
              <DialogDescription className="text-foreground/40 text-sm font-medium italic uppercase tracking-widest pl-1">
                {selectedEvent.title}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6 overflow-y-auto flex-1 max-h-[55vh] pr-2 custom-scrollbar">
              <div className="rounded-[2rem] p-6 bg-foreground/[0.03] border border-foreground/5 space-y-4">
                <div className="flex items-center justify-between py-2 border-b border-foreground/5">
                  <span className="text-foreground/40 text-[10px] font-black uppercase tracking-widest">Service</span>
                  <span className="text-foreground font-bold tracking-tight">{selectedEvent.extendedProps.serviceName}</span>
                </div>
                
                {selectedEvent.extendedProps.isBarberView ? (
                  <div className="flex items-center justify-between py-2 border-b border-foreground/5">
                    <span className="text-foreground/40 text-[10px] font-black uppercase tracking-widest">Client</span>
                    <span className="text-foreground font-bold tracking-tight">{selectedEvent.extendedProps.clientName}</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between py-2 border-b border-foreground/5">
                    <span className="text-foreground/40 text-[10px] font-black uppercase tracking-widest">Artisan</span>
                    <span className="text-foreground font-bold tracking-tight">{selectedEvent.extendedProps.barberName}</span>
                  </div>
                )}

                <div className="flex items-center justify-between py-2 border-b border-foreground/5">
                  <span className="text-foreground/40 text-[10px] font-black uppercase tracking-widest">Status</span>
                  <Badge variant="secondary" className="bg-secondary/10 text-secondary border-none uppercase text-[8px] font-black px-2">{selectedEvent.extendedProps.status}</Badge>
                </div>

                <div className="flex items-center justify-between py-2 border-b border-foreground/5">
                  <span className="text-foreground/40 text-[10px] font-black uppercase tracking-widest">Timing</span>
                  <span className="text-foreground font-bold tracking-tight">{formatTime(new Date(selectedEvent.start))} - {formatTime(new Date(selectedEvent.end))}</span>
                </div>
              </div>

              <div className="rounded-[2rem] p-6 bg-secondary/5 border border-secondary/10">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-foreground font-bebas text-2xl tracking-wide opacity-80 uppercase">Total Worth</span>
                  <span className="text-secondary font-bold text-4xl tracking-tighter">${selectedEvent.extendedProps.price?.toFixed(2)}</span>
                </div>
                {selectedEvent.extendedProps.addons && selectedEvent.extendedProps.addons.length > 0 && (
                  <div className="space-y-2 mt-4 pt-4 border-t border-secondary/10">
                    <p className="text-foreground/30 text-[9px] uppercase font-black tracking-widest mb-2">Enabled Enhancements</p>
                    {selectedEvent.extendedProps.addons.map((addon, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm">
                        <span className="text-foreground/60 font-medium italic">{addon.name}</span>
                        <span className="text-secondary font-bold">+${addon.price?.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="mt-8">
              <Button
                onClick={() => setShowEventDialog(false)}
                className="w-full bg-secondary text-primary-foreground hover:bg-secondary/90 font-bold py-8 rounded-2xl text-xl transition-all active:scale-95 shadow-xl shadow-secondary/20"
              >
                Close Details
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <style dangerouslySetInnerHTML={{ __html: customStyles }} />
    </div>
  );
} 