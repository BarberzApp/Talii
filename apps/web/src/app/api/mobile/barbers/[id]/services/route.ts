import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/shared/lib/supabase'
import { logger } from '@/shared/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params
    const barberId = params.id
    if (!barberId) {
      return NextResponse.json({ error: 'Barber ID is required' }, { status: 400 })
    }

    const [{ data: services, error: servicesError }, { data: addons, error: addonsError }] =
      await Promise.all([
        supabaseAdmin.from('services').select('*').eq('barber_id', barberId).order('price', { ascending: true }),
        supabaseAdmin
          .from('service_addons')
          .select('*')
          .eq('barber_id', barberId)
          .eq('is_active', true)
          .order('price', { ascending: true }),
      ])

    if (servicesError) {
      logger.error('Failed to load services', servicesError, { barberId })
      return NextResponse.json({ error: 'Failed to load services' }, { status: 500 })
    }
    if (addonsError) {
      logger.error('Failed to load addons', addonsError, { barberId })
      return NextResponse.json({ error: 'Failed to load addons' }, { status: 500 })
    }

    return NextResponse.json({ services: services || [], addons: addons || [] })
  } catch (err) {
    logger.error('Mobile /barbers/[id]/services error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

