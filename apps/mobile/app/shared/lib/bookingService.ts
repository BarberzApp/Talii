// lib/bookingService.ts
import { supabase } from './supabase';
import { logger } from './logger';
import { apiFetch } from './api-client';

export type { Service } from '../types';
import type { Service } from '../types';

export interface TimeSlot {
  date: string;
  time: string;
  available: boolean;
}

export interface Booking {
  id: string;
  barber_id: string;
  client_id: string;
  service_id: string;
  date: string;
  price: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  payment_status: 'pending' | 'succeeded' | 'failed' | 'refunded' | 'partially_refunded';
  payment_intent_id?: string;
  platform_fee?: number;
  barber_payout?: number;
  addon_total?: number;
  service_price?: number; // Historical service price at time of booking
  guest_name?: string;
  guest_email?: string;
  guest_phone?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateBookingData {
  barberId: string;
  serviceId: string;
  date: string; // ISO
  notes?: string;
  addonIds?: string[];
}

class BookingService {
  // Fetch services for a specific barber (using barber ID directly)
  async getBarberServices(barberId: string): Promise<Service[]> {
    const data = await apiFetch<{ services: Service[] }>(`/api/mobile/barbers/${barberId}/services`, {
      method: 'GET',
      auth: false,
    });
    return data.services || [];
  }

  // Fetch active add-ons for a specific barber
  async getBarberAddons(barberId: string): Promise<any[]> {
    const data = await apiFetch<{ addons: any[] }>(`/api/mobile/barbers/${barberId}/services`, {
      method: 'GET',
      auth: false,
    });
    return data.addons || [];
  }

  // Get available time slots for a specific date (using barber ID directly)
  async getAvailableSlots(barberId: string, date: string, serviceDuration: number): Promise<TimeSlot[]> {
    const res = await apiFetch<{ slots: TimeSlot[] }>(
      `/api/mobile/availability/slots?barberId=${encodeURIComponent(barberId)}&date=${encodeURIComponent(
        date
      )}&duration=${encodeURIComponent(String(serviceDuration))}`,
      { method: 'GET', auth: false }
    );
    return res.slots || [];
  }

  // Create a booking (developer: immediate booking, regular: PaymentIntent + webhook booking creation)
  async createBooking(bookingData: CreateBookingData): Promise<any> {
    try {
      return await apiFetch('/api/mobile/bookings', {
        method: 'POST',
        auth: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barberId: bookingData.barberId,
          serviceId: bookingData.serviceId,
          date: bookingData.date,
          notes: bookingData.notes,
          addonIds: bookingData.addonIds || [],
        }),
      });
    } catch (err) {
      logger.error('Error creating booking:', err);
      
      // Capture error in Sentry
      const { captureException } = require('./sentry');
      captureException(err as Error, {
        context: 'bookingService.createBooking',
        barberId: bookingData.barberId,
        serviceId: bookingData.serviceId,
        date: bookingData.date,
      });
      
      throw err;
    }
  }

  // Get user's bookings
  async getUserBookings(userId: string): Promise<Booking[]> {
    // userId is kept for backwards compatibility, but the gateway derives it from the access token.
    void userId;
    const res = await apiFetch<{ bookings: Booking[] }>('/api/mobile/bookings', {
      method: 'GET',
      auth: true,
    });
    return res.bookings || [];
  }

  // Cancel a booking
  async cancelBooking(bookingId: string): Promise<void> {
    const { error } = await supabase
      .from('bookings')
      .update({ 
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', bookingId);

    if (error) {
      logger.error('Error cancelling booking:', error);
      throw error;
    }
  }
}

export const bookingService = new BookingService();