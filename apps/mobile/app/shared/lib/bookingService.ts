// lib/bookingService.ts
import { logger } from './logger';
import { apiFetch } from './api-client';

export type { Service } from '../types';
import type { Service } from '../types';

export interface TimeSlot {
  date: string;
  time: string;
  available: boolean;
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
}

export const bookingService = new BookingService();