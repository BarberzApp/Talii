import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/shared/lib/supabase'
import { logger } from '@/shared/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, context: { params: { id: string } }) {
  try {
    const barberId = context.params.id

    if (!barberId) {
      return NextResponse.json({ error: 'Barber ID is required' }, { status: 400 })
    }

    const { data: barber, error } = await supabaseAdmin
      .from('barbers')
      .select(
        `
        *,
        user:profiles!barbers_user_id_fkey(
          id,
          name,
          username,
          avatar_url,
          location,
          bio,
          business_name
        )
      `
      )
      .eq('id', barberId)
      .maybeSingle()

    if (error) {
      logger.error('Failed to load barber profile', error, { barberId })
      return NextResponse.json({ error: 'Failed to load barber' }, { status: 500 })
    }

    if (!barber) {
      return NextResponse.json({ error: 'Barber not found' }, { status: 404 })
    }

    return NextResponse.json({ barber })
  } catch (err) {
    logger.error('Mobile /barbers/[id] error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

