import 'server-only'
import type { TablesUpdate } from '@barber-app/shared'
import { getSupabaseAdmin } from './clients'
import { ApiError, pgCode } from './errors'

/**
 * A barber's own services and add-ons. Every query is scoped to the caller's
 * barber id; another barber's id is reported as not found.
 *
 * Deleting something a booking references (bookings.service_id,
 * booking_addons.addon_id; both ON DELETE RESTRICT) deactivates it instead.
 */

const FOREIGN_KEY_VIOLATION = '23503'

export interface ServiceInput {
  name: string
  description?: string | null
  durationMinutes: number
  priceCents: number
  isActive?: boolean
}

export interface AddonInput {
  name: string
  description?: string | null
  priceCents: number
  isActive?: boolean
}

export async function listServices(barberId: string) {
  const db = getSupabaseAdmin()
  const { data, error } = await db
    .from('services')
    .select('*')
    .eq('barber_id', barberId)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
  if (error) throw error
  return { services: data ?? [] }
}

export async function createService(barberId: string, input: ServiceInput) {
  const db = getSupabaseAdmin()
  const { data, error } = await db
    .from('services')
    .insert({
      barber_id: barberId,
      name: input.name,
      description: input.description ?? null,
      duration_minutes: input.durationMinutes,
      price_cents: input.priceCents,
      is_active: input.isActive ?? true,
    })
    .select('*')
    .single()
  if (error) throw error
  return { service: data }
}

export async function updateService(barberId: string, id: string, input: Partial<ServiceInput>) {
  const patch: TablesUpdate<'services'> = {}
  if (input.name !== undefined) patch.name = input.name
  if (input.description !== undefined) patch.description = input.description
  if (input.durationMinutes !== undefined) patch.duration_minutes = input.durationMinutes
  if (input.priceCents !== undefined) patch.price_cents = input.priceCents
  if (input.isActive !== undefined) patch.is_active = input.isActive

  const db = getSupabaseAdmin()
  const { data, error } = await db
    .from('services')
    .update(patch)
    .eq('id', id)
    .eq('barber_id', barberId)
    .select('*')
    .maybeSingle()
  if (error) throw error
  if (!data) throw new ApiError(404, 'SERVICE_NOT_FOUND', 'Service not found.')
  return { service: data }
}

export async function deleteService(barberId: string, id: string) {
  const db = getSupabaseAdmin()
  const { data: service, error } = await db
    .from('services')
    .select('id')
    .eq('id', id)
    .eq('barber_id', barberId)
    .maybeSingle()
  if (error) throw error
  if (!service) throw new ApiError(404, 'SERVICE_NOT_FOUND', 'Service not found.')

  const { count, error: countError } = await db
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('service_id', id)
  if (countError) throw countError

  if (!count) {
    const { error: deleteError } = await db.from('services').delete().eq('id', id).eq('barber_id', barberId)
    if (!deleteError) return { deleted: true, deactivated: false }
    if (pgCode(deleteError) !== FOREIGN_KEY_VIOLATION) throw deleteError
  }

  const { error: updateError } = await db.from('services').update({ is_active: false }).eq('id', id).eq('barber_id', barberId)
  if (updateError) throw updateError
  return { deleted: false, deactivated: true }
}

export async function listAddons(barberId: string) {
  const db = getSupabaseAdmin()
  const { data, error } = await db
    .from('service_addons')
    .select('*')
    .eq('barber_id', barberId)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
  if (error) throw error
  return { addons: data ?? [] }
}

export async function createAddon(barberId: string, input: AddonInput) {
  const db = getSupabaseAdmin()
  const { data, error } = await db
    .from('service_addons')
    .insert({
      barber_id: barberId,
      name: input.name,
      description: input.description ?? null,
      price_cents: input.priceCents,
      is_active: input.isActive ?? true,
    })
    .select('*')
    .single()
  if (error) throw error
  return { addon: data }
}

export async function updateAddon(barberId: string, id: string, input: Partial<AddonInput>) {
  const patch: TablesUpdate<'service_addons'> = {}
  if (input.name !== undefined) patch.name = input.name
  if (input.description !== undefined) patch.description = input.description
  if (input.priceCents !== undefined) patch.price_cents = input.priceCents
  if (input.isActive !== undefined) patch.is_active = input.isActive

  const db = getSupabaseAdmin()
  const { data, error } = await db
    .from('service_addons')
    .update(patch)
    .eq('id', id)
    .eq('barber_id', barberId)
    .select('*')
    .maybeSingle()
  if (error) throw error
  if (!data) throw new ApiError(404, 'ADDON_NOT_FOUND', 'Add-on not found.')
  return { addon: data }
}

export async function deleteAddon(barberId: string, id: string) {
  const db = getSupabaseAdmin()
  const { data: addon, error } = await db
    .from('service_addons')
    .select('id')
    .eq('id', id)
    .eq('barber_id', barberId)
    .maybeSingle()
  if (error) throw error
  if (!addon) throw new ApiError(404, 'ADDON_NOT_FOUND', 'Add-on not found.')

  const { count, error: countError } = await db
    .from('booking_addons')
    .select('id', { count: 'exact', head: true })
    .eq('addon_id', id)
  if (countError) throw countError

  if (!count) {
    const { error: deleteError } = await db.from('service_addons').delete().eq('id', id).eq('barber_id', barberId)
    if (!deleteError) return { deleted: true, deactivated: false }
    if (pgCode(deleteError) !== FOREIGN_KEY_VIOLATION) throw deleteError
  }

  const { error: updateError } = await db
    .from('service_addons')
    .update({ is_active: false })
    .eq('id', id)
    .eq('barber_id', barberId)
  if (updateError) throw updateError
  return { deleted: false, deactivated: true }
}
